import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  LoaderCircle,
  Minus,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import {
  fetchChatAttachmentDocumentPreviewBlob,
  fetchChatDocumentPreviewBlob,
} from "../../pages/chat/stateApi.js";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const MIN_SCALE = 0.8;
const MAX_SCALE = 2.4;
const SCALE_STEP = 0.2;

export default function ChatDocumentPreview({
  document: activeDocument,
  documents = [],
  selectedContextDocumentKeys = [],
  onSelectDocument,
  onToggleContextDocument,
  onDownloadDocument,
  onClose,
}) {
  const viewportRef = useRef(null);
  const objectUrlRef = useRef("");
  const titleMenuRef = useRef(null);
  const [documentUrl, setDocumentUrl] = useState("");
  const [documentText, setDocumentText] = useState("");
  const [documentMode, setDocumentMode] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageCount, setPageCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [downloadPending, setDownloadPending] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const selectedKeySet = useMemo(
    () => new Set(Array.isArray(selectedContextDocumentKeys) ? selectedContextDocumentKeys : []),
    [selectedContextDocumentKeys],
  );
  const canSwitchDocuments = documents.length > 1;
  const isSessionDocument = activeDocument?.source === "session";
  const isSelectedForContext = activeDocument ? selectedKeySet.has(activeDocument.key) : false;

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    const updateWidth = () => {
      setViewportWidth(viewport.clientWidth || 0);
    };

    updateWidth();
    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver(() => {
        updateWidth();
      });
      observer.observe(viewport);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", updateWidth);
    return () => {
      window.removeEventListener("resize", updateWidth);
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [activeDocument?.key]);

  useEffect(() => {
    if (!menuOpen) return undefined;

    function handlePointerDown(event) {
      if (!titleMenuRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    setPageCount(0);
    setPageNumber(1);
    setScale(1);
    setLoadError("");
    setDownloadError("");
    setDocumentText("");
    setDocumentMode("");

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = "";
    }

    if (!activeDocument) {
      setDocumentUrl("");
      setLoading(false);
      return undefined;
    }

    const abortController = new AbortController();

    async function loadDocument() {
      try {
        setLoading(true);
        setDocumentUrl("");
        setDocumentText("");

        if (activeDocument.source === "composer") {
          if (activeDocument.kind === "pdf") {
            const nextUrl = URL.createObjectURL(activeDocument.file);
            objectUrlRef.current = nextUrl;
            setDocumentUrl(nextUrl);
            setDocumentMode("pdf");
            setLoading(false);
            return;
          }

          if (activeDocument.kind === "html") {
            const nextUrl = URL.createObjectURL(activeDocument.file);
            objectUrlRef.current = nextUrl;
            setDocumentUrl(nextUrl);
            setDocumentMode("html");
            setLoading(false);
            return;
          }

          if (activeDocument.kind === "markdown") {
            const nextText = await activeDocument.file.text();
            if (abortController.signal.aborted) return;
            setDocumentText(nextText);
            setDocumentMode("markdown");
            setLoading(false);
            return;
          }
        }

        const blob =
          activeDocument.source === "session"
            ? await fetchChatAttachmentDocumentPreviewBlob({
                sessionId: activeDocument.sessionId,
                messageId: activeDocument.messageId,
                attachmentIndex: activeDocument.attachmentIndex,
                attachment: activeDocument.attachment,
                signal: abortController.signal,
              })
            : await fetchChatDocumentPreviewBlob({
                file: activeDocument.file,
                signal: abortController.signal,
              });
        if (abortController.signal.aborted) return;

        if (activeDocument.kind === "markdown") {
          const nextText = await blob.text();
          if (abortController.signal.aborted) return;
          setDocumentText(nextText);
          setDocumentMode("markdown");
          setLoading(false);
          return;
        }

        const nextUrl = URL.createObjectURL(blob);
        objectUrlRef.current = nextUrl;
        setDocumentUrl(nextUrl);
        setDocumentMode(activeDocument.kind === "html" ? "html" : "pdf");
        setLoading(false);
      } catch (error) {
        if (abortController.signal.aborted) return;
        setLoading(false);
        setLoadError(error?.message || "文档预览生成失败，请稍后重试。");
      }
    }

    void loadDocument();

    return () => {
      abortController.abort();
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = "";
      }
    };
  }, [activeDocument]);

  const renderedPageWidth = Math.max(360, Math.floor(Math.max(420, viewportWidth - 40)));
  const isPdfReady = documentMode === "pdf" && !!documentUrl && !loading && !loadError;
  const isHtmlReady = documentMode === "html" && !!documentUrl && !loading && !loadError;
  const isMarkdownReady = documentMode === "markdown" && !loading && !loadError;
  const canRenderDocument = Boolean(activeDocument);
  const showPdfToolbar = isPdfReady;

  async function handleDownloadClick() {
    if (!activeDocument || typeof onDownloadDocument !== "function" || downloadPending) return;
    setDownloadPending(true);
    setDownloadError("");
    try {
      await onDownloadDocument(activeDocument);
    } catch (error) {
      setDownloadError(error?.message || "下载失败，请稍后重试。");
    } finally {
      setDownloadPending(false);
    }
  }

  return (
    <aside className="chat-document-preview" aria-label={activeDocument?.name || "文档预览"}>
      <div className="chat-document-preview-header">
        <div className="chat-document-preview-copy">
          <div className="chat-document-preview-title-shell" ref={titleMenuRef}>
            {canSwitchDocuments ? (
              <button
                type="button"
                className={`chat-document-preview-title-trigger${menuOpen ? " is-open" : ""}`}
                onClick={() => setMenuOpen((current) => !current)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                title={activeDocument?.name || "文档预览"}
              >
                <span className="chat-document-preview-title-content">
                  <span className="chat-document-preview-title">
                    {truncateDocumentName(activeDocument?.name || "文档预览")}
                  </span>
                  <span className="chat-document-preview-kind">
                    {readDocumentKindLabel(activeDocument?.kind)}
                  </span>
                </span>
                <span className="chat-document-preview-title-caret" aria-hidden="true">
                  <ChevronDown size={15} />
                </span>
              </button>
            ) : (
              <div className="chat-document-preview-title-trigger static">
                <span className="chat-document-preview-title-content">
                  <span className="chat-document-preview-title">
                    {truncateDocumentName(activeDocument?.name || "文档预览")}
                  </span>
                  <span className="chat-document-preview-kind">
                    {readDocumentKindLabel(activeDocument?.kind)}
                  </span>
                </span>
              </div>
            )}

            {canSwitchDocuments && menuOpen ? (
              <div className="chat-document-preview-dropdown" role="menu" aria-label="文件列表">
                {documents.map((item) => {
                  const isActive = item.key === activeDocument?.key;
                  const itemSelectedForContext = selectedKeySet.has(item.key);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      role="menuitemradio"
                      aria-checked={isActive}
                      className={`chat-document-preview-dropdown-item${
                        isActive ? " is-active" : ""
                      }`}
                      onClick={() => {
                        setMenuOpen(false);
                        onSelectDocument?.(item);
                      }}
                      title={item.name}
                    >
                      <span className="chat-document-preview-dropdown-copy">
                        <span className="chat-document-preview-dropdown-name">{item.name}</span>
                        <span className="chat-document-preview-dropdown-meta">
                          {readDocumentKindLabel(item.kind)}
                          {item.source === "session"
                            ? itemSelectedForContext
                              ? " · 已加入上下文"
                              : ""
                            : " · 本轮上传"}
                        </span>
                      </span>
                      {isActive ? <Check size={14} /> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
        <div className="chat-document-preview-header-actions">
          {isSessionDocument ? (
            <button
              type="button"
              className={`chat-document-preview-context-button${
                isSelectedForContext ? " is-selected" : ""
              }`}
              onClick={() => onToggleContextDocument?.(activeDocument)}
              title={isSelectedForContext ? "移出上下文" : "加入上下文"}
            >
              {isSelectedForContext ? <Check size={14} /> : null}
              <span>{isSelectedForContext ? "已加入" : "加入上下文"}</span>
            </button>
          ) : null}
          <button
            type="button"
            className="chat-document-preview-action"
            onClick={() => {
              void handleDownloadClick();
            }}
            disabled={!activeDocument || typeof onDownloadDocument !== "function" || downloadPending}
            aria-label={downloadPending ? "下载中" : "下载文档"}
            title={downloadPending ? "下载中" : "下载"}
          >
            <Download size={15} />
          </button>
          <button
            type="button"
            className="chat-document-preview-action ghost close"
            onClick={() => onClose?.()}
            aria-label="关闭文档预览"
            title="关闭"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {downloadError ? (
        <div className="chat-document-preview-inline-error" role="alert">
          {downloadError}
        </div>
      ) : null}

      <div className="chat-document-preview-viewport" ref={viewportRef}>
        {!canRenderDocument ? (
          <div className="chat-document-preview-placeholder" role="status">
            <span>当前对话还没有可预览的文档。</span>
          </div>
        ) : null}

        {canRenderDocument && loading ? (
          <div className="chat-document-preview-placeholder" role="status">
            <LoaderCircle size={18} className="chat-document-preview-spinner" />
            <span>正在生成文档预览…</span>
          </div>
        ) : null}

        {canRenderDocument && !loading && loadError ? (
          <div className="chat-document-preview-placeholder error" role="alert">
            <span>{loadError}</span>
          </div>
        ) : null}

        {isPdfReady ? (
          <div className="chat-document-preview-canvas">
            <Document
              file={documentUrl}
              loading={
                <div className="chat-document-preview-placeholder" role="status">
                  <LoaderCircle size={18} className="chat-document-preview-spinner" />
                  <span>正在加载 PDF 页面…</span>
                </div>
              }
              error="PDF 渲染失败，请重新上传后重试。"
              onLoadSuccess={({ numPages }) => {
                setPageCount(numPages);
                setPageNumber((current) => Math.min(Math.max(1, current), numPages));
              }}
              onLoadError={(error) => {
                setLoadError(error?.message || "PDF 渲染失败，请重新上传后重试。");
              }}
            >
              <Page
                key={`${activeDocument?.key || "doc"}-${pageNumber}-${scale}`}
                pageNumber={pageNumber}
                width={renderedPageWidth}
                scale={scale}
                className="chat-document-preview-page"
                loading=""
                renderAnnotationLayer
                renderTextLayer
              />
            </Document>
          </div>
        ) : null}

        {isHtmlReady ? (
          <div className="chat-document-preview-rich-shell html">
            <iframe
              key={activeDocument?.key || "html-preview"}
              src={documentUrl}
              title={activeDocument?.name || "HTML 预览"}
              className="chat-document-preview-html-frame"
              sandbox=""
            />
          </div>
        ) : null}

        {isMarkdownReady ? (
          <div className="chat-document-preview-rich-shell markdown">
            <div className="chat-document-preview-markdown md-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                {documentText || ""}
              </ReactMarkdown>
            </div>
          </div>
        ) : null}
      </div>

      {showPdfToolbar ? (
        <div className="chat-document-preview-toolbar">
        <div className="chat-document-preview-toolbar-group">
          <button
            type="button"
            className="chat-document-preview-action"
            onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
            disabled={!isPdfReady || pageNumber <= 1}
            aria-label="上一页"
            title="上一页"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="chat-document-preview-status">
            {pageCount > 0 ? `${pageNumber} / ${pageCount}` : "等待加载"}
          </span>
          <button
            type="button"
            className="chat-document-preview-action"
            onClick={() =>
              setPageNumber((current) =>
                pageCount > 0 ? Math.min(pageCount, current + 1) : current,
              )
            }
            disabled={!isPdfReady || pageCount <= 0 || pageNumber >= pageCount}
            aria-label="下一页"
            title="下一页"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="chat-document-preview-toolbar-group">
          <button
            type="button"
            className="chat-document-preview-action"
            onClick={() => setScale((current) => clampScale(current - SCALE_STEP))}
            disabled={!isPdfReady || scale <= MIN_SCALE}
            aria-label="缩小"
            title="缩小"
          >
            <Minus size={16} />
          </button>
          <span className="chat-document-preview-status">{Math.round(scale * 100)}%</span>
          <button
            type="button"
            className="chat-document-preview-action"
            onClick={() => setScale((current) => clampScale(current + SCALE_STEP))}
            disabled={!isPdfReady || scale >= MAX_SCALE}
            aria-label="放大"
            title="放大"
          >
            <Plus size={16} />
          </button>
          <button
            type="button"
            className="chat-document-preview-action"
            onClick={() => setScale(1)}
            disabled={!isPdfReady || scale === 1}
            aria-label="恢复默认缩放"
            title="恢复默认缩放"
          >
            <RefreshCw size={15} />
          </button>
        </div>
        </div>
      ) : null}
    </aside>
  );
}

function clampScale(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(numeric.toFixed(2))));
}

function readDocumentKindLabel(kind) {
  if (kind === "word") return "Word";
  if (kind === "html") return "HTML";
  if (kind === "markdown") return "Markdown";
  return "PDF";
}

function truncateDocumentName(name, maxLength = 25) {
  const text = String(name || "").trim();
  if (!text) return "文档预览";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}

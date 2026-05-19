import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, LoaderCircle } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import "../../../styles/classroom-teaching.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

const RESIZE_SETTLE_MS = 180;
const PDFJS_ASSET_BASE = buildPdfjsAssetBaseUrl();
const PDF_DOCUMENT_OPTIONS = {
  cMapUrl: `${PDFJS_ASSET_BASE}cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `${PDFJS_ASSET_BASE}standard_fonts/`,
  wasmUrl: `${PDFJS_ASSET_BASE}wasm/`,
};

export default function ClassroomTeachingPdfViewer({
  fileUrl = "",
  fileName = "",
  pageNumber = 1,
  onPageCountChange,
  emptyTitle = "当前还没有可显示的授课 PDF",
  emptyText = "",
  label = "课堂 PDF 预览",
  actionSlot = null,
}) {
  const viewportRef = useRef(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [documentState, setDocumentState] = useState({
    fileUrl: "",
    pageCount: 0,
    loadError: "",
  });

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    let resizeTimer = 0;

    const updateWidth = () => {
      setViewportWidth(viewport.clientWidth || 0);
    };
    const scheduleWidthUpdate = () => {
      if (resizeTimer) {
        window.clearTimeout(resizeTimer);
      }
      resizeTimer = window.setTimeout(() => {
        resizeTimer = 0;
        updateWidth();
      }, RESIZE_SETTLE_MS);
    };

    updateWidth();
    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver(() => {
        scheduleWidthUpdate();
      });
      observer.observe(viewport);
      return () => {
        observer.disconnect();
        if (resizeTimer) {
          window.clearTimeout(resizeTimer);
        }
      };
    }

    window.addEventListener("resize", scheduleWidthUpdate);
    return () => {
      window.removeEventListener("resize", scheduleWidthUpdate);
      if (resizeTimer) {
        window.clearTimeout(resizeTimer);
      }
    };
  }, []);

  const loadError =
    documentState.fileUrl === fileUrl ? documentState.loadError : "";
  const safePageCount =
    documentState.fileUrl === fileUrl && Number.isFinite(Number(documentState.pageCount))
      ? Number(documentState.pageCount)
      : 0;
  const safePageNumber = useMemo(() => {
    const nextPage = Number(pageNumber);
    if (!Number.isFinite(nextPage) || nextPage < 1) return 1;
    if (safePageCount > 0) {
      return Math.min(Math.floor(nextPage), safePageCount);
    }
    return Math.floor(nextPage);
  }, [pageNumber, safePageCount]);
  const renderedPageWidth = Math.max(
    320,
    Math.floor(Math.max(320, viewportWidth - 40)),
  );

  if (!fileUrl) {
    return (
      <section className="teaching-pdf-viewer teaching-pdf-viewer-empty" aria-label={label}>
        <div className="teaching-pdf-viewer-empty-content">
          <strong>{emptyTitle}</strong>
          {emptyText ? <p>{emptyText}</p> : null}
        </div>
      </section>
    );
  }

  return (
    <section className="teaching-pdf-viewer" aria-label={label}>
      <header className="teaching-pdf-viewer-head">
        <div className="teaching-pdf-viewer-meta">
          <strong>{fileName || "授课 PDF"}</strong>
          <span>{safePageCount > 0 ? `第 ${safePageNumber} / ${safePageCount} 页` : "正在读取页数..."}</span>
        </div>
        <div className="teaching-pdf-viewer-head-actions">
          {actionSlot}
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="teacher-ghost-btn teaching-pdf-viewer-open-btn"
          >
            <ExternalLink size={15} />
            <span>新标签页查看</span>
          </a>
        </div>
      </header>

      <div ref={viewportRef} className="teaching-pdf-viewer-stage">
        {loadError ? (
          <div className="teaching-pdf-viewer-message error" role="alert">
            <strong>PDF 渲染失败</strong>
            <p>{loadError}</p>
          </div>
        ) : null}

        <Document
          file={fileUrl}
          options={PDF_DOCUMENT_OPTIONS}
          loading={
            <div className="teaching-pdf-viewer-message" role="status" aria-live="polite">
              <LoaderCircle size={18} className="is-spinning" />
              <span>正在载入 PDF…</span>
            </div>
          }
          error={
            <div className="teaching-pdf-viewer-message error" role="alert">
              <strong>PDF 加载失败</strong>
              <p>请稍后重试，或使用右上角按钮在新标签页查看。</p>
            </div>
          }
          onLoadSuccess={({ numPages }) => {
            const nextCount = Number(numPages || 0);
            setDocumentState({
              fileUrl,
              pageCount: nextCount,
              loadError: "",
            });
            onPageCountChange?.(nextCount);
          }}
          onLoadError={(error) => {
            setDocumentState({
              fileUrl,
              pageCount: 0,
              loadError: error?.message || "PDF 渲染失败，请稍后重试。",
            });
            onPageCountChange?.(0);
          }}
        >
          <div className="teaching-pdf-viewer-page">
            <Page
              pageNumber={safePageNumber}
              width={renderedPageWidth}
              renderAnnotationLayer={false}
              renderTextLayer={false}
              loading={<span className="teaching-pdf-viewer-page-loading">页面加载中…</span>}
            />
          </div>
        </Document>
      </div>
    </section>
  );
}

function buildPdfjsAssetBaseUrl() {
  const baseUrl = import.meta.env.BASE_URL || "/";
  const normalizedBase = String(baseUrl || "/").endsWith("/")
    ? String(baseUrl || "/")
    : `${String(baseUrl || "/")}/`;
  return `${normalizedBase}pdfjs/`;
}

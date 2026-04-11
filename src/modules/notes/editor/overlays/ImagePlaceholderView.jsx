import { NodeViewWrapper } from "@tiptap/react";
import { LoaderCircle, RefreshCcw, Trash2 } from "lucide-react";

export default function ImagePlaceholderView({ node, extension }) {
  const placeholderId = String(node.attrs?.placeholderId || "").trim();
  const status = String(node.attrs?.status || "uploading").trim();
  const fileName = String(node.attrs?.fileName || "图片").trim() || "图片";
  const message = String(node.attrs?.message || "").trim();

  const canRetry = status === "error" && typeof extension.options?.onRetryUpload === "function";
  const canRemove = typeof extension.options?.onRemoveUpload === "function";

  return (
    <NodeViewWrapper
      className={`notes-image-placeholder is-${status}`}
      data-status={status}
      data-placeholder-id={placeholderId}
      contentEditable={false}
    >
      <div className="notes-image-placeholder-main">
        <div className="notes-image-placeholder-icon" aria-hidden="true">
          {status === "uploading" ? <LoaderCircle size={16} className="is-spinning" /> : "🖼️"}
        </div>
        <div className="notes-image-placeholder-copy">
          <strong>{fileName}</strong>
          <span>
            {status === "uploading"
              ? message || "正在上传图片…"
              : message || "图片上传失败"}
          </span>
        </div>
      </div>

      {status === "error" || canRemove ? (
        <div className="notes-image-placeholder-actions">
          {canRetry ? (
            <button
              type="button"
              className="notes-image-placeholder-btn"
              onClick={() => extension.options?.onRetryUpload?.(placeholderId)}
            >
              <RefreshCcw size={14} />
              <span>重试</span>
            </button>
          ) : null}
          {canRemove ? (
            <button
              type="button"
              className="notes-image-placeholder-btn danger"
              onClick={() => extension.options?.onRemoveUpload?.(placeholderId)}
            >
              <Trash2 size={14} />
              <span>移除</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </NodeViewWrapper>
  );
}

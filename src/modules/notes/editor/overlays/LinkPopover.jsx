import { useEffect, useRef, useState } from "react";

export default function LinkPopover({
  visible = false,
  position = null,
  link = { href: "", text: "" },
  mode = "full",
  onSave,
  onRemove,
  onCancel,
}) {
  const containerRef = useRef(null);
  const [href, setHref] = useState(String(link?.href || ""));
  const [text, setText] = useState(String(link?.text || ""));

  useEffect(() => {
    if (!visible) return undefined;

    const handlePointerDown = (event) => {
      if (containerRef.current?.contains(event.target)) return;
      onCancel?.();
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel?.();
      }
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onSave?.({ href, text });
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [visible, href, text, onCancel, onSave]);

  if (!visible || !position) return null;

  const left = Math.max(16, Math.min(position.left, window.innerWidth - 364));
  const top = Math.max(16, Math.min(position.top + 24, window.innerHeight - 220));
  const isTitleMode = mode === "title";

  return (
    <div
      ref={containerRef}
      className="notes-link-popover"
      style={{ left, top }}
      data-notes-link-popover
    >
      <label className="notes-link-popover-field">
        <span>{isTitleMode ? "标题" : "链接文字"}</span>
        <input
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={isTitleMode ? "显示给读者的标题" : "显示给读者的文字"}
          autoFocus
        />
      </label>

      {isTitleMode ? (
        <div className="notes-link-popover-meta" title={href}>
          {href}
        </div>
      ) : (
        <label className="notes-link-popover-field">
          <span>链接地址</span>
          <input
            type="url"
            value={href}
            onChange={(event) => setHref(event.target.value)}
            placeholder="https://example.com"
          />
        </label>
      )}

      <div className="notes-link-popover-actions">
        <button type="button" className="notes-link-popover-btn" onClick={onCancel}>
          取消
        </button>
        {!isTitleMode && typeof onRemove === "function" ? (
          <button
            type="button"
            className="notes-link-popover-btn danger"
            onClick={onRemove}
          >
            移除链接
          </button>
        ) : null}
        <button
          type="button"
          className="notes-link-popover-btn primary"
          onClick={() => onSave?.({ href, text })}
          disabled={!String((isTitleMode ? link?.href : href) || "").trim()}
        >
          保存
        </button>
      </div>
    </div>
  );
}

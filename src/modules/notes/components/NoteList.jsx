import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function buildPreview(note) {
  const summary = String(note?.summary || "").trim();
  if (summary) return summary;
  const body = String(note?.contentMarkdown || "")
    .replace(/^#+\s+/gm, "")
    .replace(/[*_`>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return body.slice(0, 80);
}

function formatStatusLabel(status) {
  if (status === "archived") return "已归档";
  if (status === "draft") return "草稿";
  return "进行中";
}

export default function NoteList({
  notes = [],
  activeNoteId = "",
  searchValue = "",
  onSearchChange,
  activeTag = "",
  onTagChange,
  availableTags = [],
  onSelect,
  onDelete,
  loading = false,
  error = "",
}) {
  const [openMetaState, setOpenMetaState] = useState(null);
  const panelRef = useRef(null);
  const popoverRef = useRef(null);
  const openMetaId = openMetaState?.id || "";
  const openMetaNote = useMemo(
    () => notes.find((item) => item.id === openMetaId) || null,
    [notes, openMetaId],
  );

  useEffect(() => {
    function handlePointerDown(event) {
      if (
        !panelRef.current?.contains(event.target) &&
        !popoverRef.current?.contains(event.target)
      ) {
        setOpenMetaState(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!openMetaState) return undefined;

    function handleClose() {
      setOpenMetaState(null);
    }

    window.addEventListener("resize", handleClose);
    window.addEventListener("scroll", handleClose, true);
    return () => {
      window.removeEventListener("resize", handleClose);
      window.removeEventListener("scroll", handleClose, true);
    };
  }, [openMetaState]);

  return (
    <section className="notes-sidebar-panel" ref={panelRef}>
      <div className="notes-filters">
        <div className="notes-search-wrap">
          <input
            type="search"
            className="notes-search-input"
            placeholder="搜索标题、内容、标签"
            value={searchValue}
            onChange={(event) => onSearchChange?.(event.target.value)}
          />
        </div>

        {availableTags.length > 0 && (
          <div className="notes-tag-row">
            {availableTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className={`notes-tag-chip${activeTag === tag ? " active" : ""}`}
                onClick={() => onTagChange?.(tag)}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {error ? <div className="notes-list-error">{error}</div> : null}

      <div className="notes-list">
        {loading ? <div className="notes-list-empty">正在加载笔记...</div> : null}
        {!loading && notes.length === 0 ? (
          <div className="notes-list-empty">还没有符合条件的笔记。</div>
        ) : null}
        {!loading &&
          notes.map((note) => (
            <div
              key={note.id}
              className={`notes-list-row${activeNoteId === note.id ? " active" : ""}`}
            >
              <button
                type="button"
                className="notes-list-item"
                onClick={() => onSelect?.(note.id)}
              >
                <span className="notes-list-item-title">
                  {note.title || buildPreview(note) || "未命名笔记"}
                </span>
              </button>

              <button
                type="button"
                className={`notes-list-meta-trigger${openMetaId === note.id ? " visible active" : ""}`}
                aria-label="查看笔记信息"
                onClick={(event) => {
                  event.stopPropagation();
                  const rect = event.currentTarget.getBoundingClientRect();
                  setOpenMetaState((current) =>
                    current?.id === note.id
                      ? null
                      : {
                          id: note.id,
                          top: rect.top + rect.height / 2,
                          left: rect.right + 8,
                        },
                  );
                }}
              >
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="3" cy="8" r="1.2" fill="currentColor" />
                  <circle cx="8" cy="8" r="1.2" fill="currentColor" />
                  <circle cx="13" cy="8" r="1.2" fill="currentColor" />
                </svg>
              </button>

            </div>
          ))}
      </div>

      {openMetaState && openMetaNote
        ? createPortal(
            <div
              ref={popoverRef}
              className="notes-list-meta-popover"
              style={{
                top: `${openMetaState.top}px`,
                left: `${openMetaState.left}px`,
                transform: "translateY(-50%)",
              }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <div className="notes-list-meta-line">
                <span>时间</span>
                <strong>{formatDateTime(openMetaNote.updatedAt) || "-"}</strong>
              </div>
              <div className="notes-list-meta-line">
                <span>状态</span>
                <strong>{formatStatusLabel(openMetaNote.status)}</strong>
              </div>
              <div className="notes-list-meta-line">
                <span>星标</span>
                <strong>{openMetaNote.starred ? "已置顶" : "未置顶"}</strong>
              </div>
              <div className="notes-list-meta-line notes-list-meta-tags">
                <span>标签</span>
                <strong>
                  {Array.isArray(openMetaNote.tags) && openMetaNote.tags.length > 0
                    ? openMetaNote.tags.slice(0, 4).map((tag) => `#${tag}`).join(" ")
                    : "暂无"}
                </strong>
              </div>
              <button
                type="button"
                className="notes-list-meta-delete"
                onClick={() => {
                  const targetId = openMetaNote.id;
                  setOpenMetaState(null);
                  onDelete?.(targetId);
                }}
              >
                删除笔记
              </button>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}

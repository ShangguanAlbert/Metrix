import { ArrowLeft, NotebookPen } from "lucide-react";

export default function NotesWorkbenchSidebar({
  onBackToChat,
  onCreate,
  backButtonLabel = "返回",
  backButtonStatusLabel = "对话",
  children,
}) {
  return (
    <aside className="sidebar notes-workbench-sidebar">
      <div className="sidebar-top">
        <div className="notes-brand-row">
          <div className="sidebar-brand-row notes-brand-copy-row">
            <div className="sidebar-brand-mark" aria-hidden="true">
              <NotebookPen size={18} />
            </div>
            <div className="sidebar-brand-copy">
              <strong className="sidebar-brand-title">笔记</strong>
            </div>
          </div>
          <button
            type="button"
            className="notes-create-btn"
            onClick={onCreate}
            aria-label="新建笔记"
            title="新建笔记"
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
              className="notes-create-icon"
            >
              <path
                d="M10 4.5V15.5M4.5 10H15.5"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>
      {children}
      <div className="notes-sidebar-bottom">
        <button
          type="button"
          className="notes-side-back-btn"
          onClick={onBackToChat}
          title={backButtonLabel}
          aria-label={backButtonLabel}
        >
          <ArrowLeft size={18} />
          <span>{backButtonLabel}</span>
          <span className="notes-side-back-status">{backButtonStatusLabel}</span>
        </button>
      </div>
    </aside>
  );
}

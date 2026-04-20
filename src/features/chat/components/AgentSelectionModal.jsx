import { useEffect } from "react";

export default function AgentSelectionModal({
  open = false,
  value = "A",
  options = [],
  onChange,
  onCancel,
  onConfirm,
}) {
  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onCancel?.();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, open]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onClick={() => onCancel?.()}
    >
      <div
        className="group-modal agent-selection-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-selection-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="agent-selection-modal-header">
          <p className="agent-selection-modal-kicker">New Chat</p>
          <h3
            id="agent-selection-modal-title"
            className="group-modal-title agent-selection-modal-title"
          >
            你想使用哪个智能体？
          </h3>
          <p className="agent-selection-modal-copy">
            选择后将创建新会话，并在整个会话期间保持锁定。
          </p>
        </div>

        <div className="agent-selection-grid">
          {(Array.isArray(options) ? options : []).map((option) => {
            const checked = option.id === value;
            return (
              <button
                key={option.id}
                type="button"
                className={`agent-selection-card${checked ? " is-selected" : ""}`}
                onClick={() => onChange?.(option.id)}
              >
                <span className="agent-selection-card-title">{option.name}</span>
                <span className="agent-selection-card-model">
                  {option.modelLabel}
                </span>
                <span className="agent-selection-card-summary">
                  {option.summary}
                </span>
              </button>
            );
          })}
        </div>

        <div className="group-modal-actions">
          <button
            type="button"
            className="group-modal-btn group-modal-btn-secondary"
            onClick={() => onCancel?.()}
          >
            取消
          </button>
          <button
            type="button"
            className="group-modal-btn group-modal-btn-primary"
            onClick={() => onConfirm?.()}
          >
            创建会话
          </button>
        </div>
      </div>
    </div>
  );
}

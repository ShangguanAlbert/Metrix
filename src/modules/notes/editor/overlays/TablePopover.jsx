import { useEffect, useRef } from "react";

export default function TablePopover({
  visible = false,
  triggerPosition = null,
  menuPosition = null,
  actions = [],
  onToggle,
  onClose,
}) {
  const menuRef = useRef(null);

  useEffect(() => {
    if (!visible) return undefined;

    const handlePointerDown = (event) => {
      if (menuRef.current?.contains(event.target)) return;
      onClose?.();
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [visible, onClose]);

  if (!triggerPosition) return null;

  const triggerLeft = Math.max(16, Math.min(triggerPosition.left, window.innerWidth - 56));
  const triggerTop = Math.max(16, Math.min(triggerPosition.top, window.innerHeight - 56));

  const resolvedMenuPosition =
    menuPosition || {
      left: triggerLeft,
      top: triggerTop + 42,
    };

  const menuLeft = Math.max(16, Math.min(resolvedMenuPosition.left, window.innerWidth - 220));
  const menuTop = Math.max(16, Math.min(resolvedMenuPosition.top, window.innerHeight - 360));

  return (
    <>
      <button
        type="button"
        className={`notes-table-popover-trigger${visible ? " active" : ""}`}
        style={{ left: triggerLeft, top: triggerTop }}
        onClick={onToggle}
        aria-label="表格操作"
        title="表格操作"
      >
        表格
      </button>

      {visible ? (
        <div
          ref={menuRef}
          className="notes-table-popover"
          style={{ left: menuLeft, top: menuTop }}
        >
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              className={`notes-table-popover-item${action.danger ? " danger" : ""}`}
              onClick={() => {
                action.onClick?.();
                onClose?.();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}

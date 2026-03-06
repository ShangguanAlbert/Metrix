import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import "../styles/portal-select.css";

export default function PortalSelect({
  value,
  options,
  onChange,
  disabled = false,
  compact = false,
  className = "",
  placeholder = "",
  ariaLabel = "",
}) {
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 });

  const normalizedOptions = Array.isArray(options) ? options.filter(Boolean) : [];
  const selected =
    normalizedOptions.find((item) => item.value === value) || normalizedOptions[0] || null;
  const menuOpen = open && !disabled && normalizedOptions.length > 0;

  useEffect(() => {
    if (!open || (!disabled && normalizedOptions.length > 0)) return;
    const timer = window.setTimeout(() => setOpen(false), 0);
    return () => window.clearTimeout(timer);
  }, [open, disabled, normalizedOptions.length]);

  const updateMenuPosition = useCallback(() => {
    const node = triggerRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const menuHeight = Math.min(300, Math.max(48, normalizedOptions.length * 42 + 12));
    const gap = 6;
    const openUpward =
      window.innerHeight - rect.bottom < menuHeight + gap &&
      rect.top > menuHeight + gap;

    setMenuPos({
      top: openUpward ? rect.top - menuHeight - gap : rect.bottom + gap,
      left: rect.left,
      width: rect.width,
    });
  }, [normalizedOptions.length]);

  useEffect(() => {
    if (!menuOpen) return;
    updateMenuPosition();

    function onDocMouseDown(event) {
      const target = event.target;
      if (triggerRef.current && triggerRef.current.contains(target)) return;
      if (menuRef.current && menuRef.current.contains(target)) return;
      setOpen(false);
    }

    function onDocKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    function onViewChanged() {
      updateMenuPosition();
    }

    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onDocKeyDown);
    window.addEventListener("resize", onViewChanged);
    window.addEventListener("scroll", onViewChanged, true);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onDocKeyDown);
      window.removeEventListener("resize", onViewChanged);
      window.removeEventListener("scroll", onViewChanged, true);
    };
  }, [menuOpen, updateMenuPosition]);

  const rootClassName = `portal-select ${className}`.trim();
  const triggerClassName = `portal-select-trigger ${compact ? "compact" : ""} ${open ? "open" : ""}`.trim();
  const menuClassName = `portal-select-menu ${className}`.trim();
  const currentLabel = selected?.label || placeholder || "";

  return (
    <div className={rootClassName} data-portal-select-root="true">
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        aria-expanded={menuOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel || currentLabel}
        data-portal-select-trigger="true"
        onClick={() => {
          if (disabled || normalizedOptions.length === 0) return;
          setOpen((prev) => !prev);
        }}
        disabled={disabled || normalizedOptions.length === 0}
      >
        <span className={!selected?.label && placeholder ? "portal-select-placeholder" : ""}>
          {currentLabel}
        </span>
        <ChevronDown size={15} className="portal-select-caret" />
      </button>

      {menuOpen &&
        createPortal(
          <div
            ref={menuRef}
            className={menuClassName}
            style={{
              top: `${menuPos.top}px`,
              left: `${menuPos.left}px`,
              width: `${menuPos.width}px`,
            }}
            role="listbox"
            data-portal-select-menu="true"
          >
            {normalizedOptions.map((item) => {
              const active = item.value === selected?.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  className={`portal-select-item ${active ? "active" : ""}`}
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange?.(item.value);
                    setOpen(false);
                  }}
                >
                  <span>{item.label}</span>
                  {active ? <Check size={15} /> : <span className="portal-select-empty" />}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}

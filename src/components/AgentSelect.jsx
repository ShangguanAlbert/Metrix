import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import "../styles/agentselect.css";

const AGENTS = [
  { id: "A", name: "Agent A" },
  { id: "B", name: "Agent B" },
  { id: "C", name: "Agent C" },
  { id: "D", name: "Agent D" },
];

export default function AgentSelect({
  value = "A",
  onChange,
  onOpenApiSettings,
  disabled = false,
  disabledTitle = "",
  displayName = "",
  readOnly = false,
}) {
  const selectedIndex = useMemo(
    () =>
      Math.max(
        0,
        AGENTS.findIndex((agent) => agent.id === value),
      ),
    [value],
  );

  const current = useMemo(() => {
    if (displayName) {
      return { id: value, name: displayName };
    }
    return AGENTS.find((agent) => agent.id === value) ?? AGENTS[0];
  }, [displayName, value]);

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => selectedIndex);

  const btnRef = useRef(null);
  const popRef = useRef(null);

  useEffect(() => {
    function onDocMouseDown(event) {
      if (!open || disabled || readOnly) return;
      const target = event.target;
      if (btnRef.current && btnRef.current.contains(target)) return;
      if (popRef.current && popRef.current.contains(target)) return;
      setOpen(false);
    }

    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [disabled, open, readOnly]);

  function commitSelect(index) {
    if (disabled || readOnly) return;
    const nextAgent = AGENTS[index];
    if (!nextAgent) return;
    onChange?.(nextAgent.id);
    setOpen(false);
    btnRef.current?.focus();
  }

  function onButtonKeyDown(event) {
    if (disabled || readOnly) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen((currentOpen) => {
        const nextOpen = !currentOpen;
        if (nextOpen) setActiveIndex(selectedIndex);
        return nextOpen;
      });
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActiveIndex(Math.min(AGENTS.length - 1, selectedIndex + 1));
      } else {
        setActiveIndex((index) => Math.min(AGENTS.length - 1, index + 1));
      }
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActiveIndex(Math.max(0, selectedIndex - 1));
      } else {
        setActiveIndex((index) => Math.max(0, index - 1));
      }
    }
  }

  function onMenuKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      btnRef.current?.focus();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(AGENTS.length - 1, index + 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      commitSelect(activeIndex);
    }
  }

  return (
    <div className={`agent${readOnly ? " is-read-only" : ""}`}>
      <span className="agent-label" />

      <button
        ref={btnRef}
        className={`agent-trigger${readOnly ? " is-read-only" : ""}`}
        type="button"
        aria-haspopup={readOnly ? undefined : "menu"}
        aria-expanded={readOnly ? undefined : open && !disabled}
        disabled={disabled}
        title={
          disabled
            ? disabledTitle
            : readOnly
              ? disabledTitle || "当前会话智能体已锁定"
              : "切换智能体"
        }
        onClick={() =>
          disabled || readOnly
            ? null
            : setOpen((currentOpen) => {
                const nextOpen = !currentOpen;
                if (nextOpen) setActiveIndex(selectedIndex);
                return nextOpen;
              })
        }
        onKeyDown={onButtonKeyDown}
      >
        <span className="agent-trigger-title">{current.name}</span>
        {!readOnly ? (
          <ChevronDown
            className="agent-caret"
            size={18}
            strokeWidth={2.4}
            aria-hidden="true"
          />
        ) : null}
      </button>

      {open && !disabled && !readOnly ? (
        <div
          ref={popRef}
          className="agent-popover"
          role="menu"
          aria-label="智能体切换"
          tabIndex={-1}
          onKeyDown={onMenuKeyDown}
        >
          {AGENTS.map((agentOption, index) => {
            const selected = agentOption.id === value;
            const active = index === activeIndex;

            return (
              <div
                key={agentOption.id}
                role="menuitemradio"
                aria-checked={selected}
                className={`agent-item ${active ? "active" : ""}`}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(selectedIndex)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => commitSelect(index)}
              >
                <span className="agent-check" aria-hidden="true">
                  {selected ? "✓" : ""}
                </span>
                <span className="agent-name">{agentOption.name}</span>
              </div>
            );
          })}

          {onOpenApiSettings ? (
            <>
              <div className="agent-divider" />
              <button
                type="button"
                className="agent-settings-item"
                onMouseEnter={() => setActiveIndex(selectedIndex)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setOpen(false);
                  onOpenApiSettings();
                }}
              >
                API 设置
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

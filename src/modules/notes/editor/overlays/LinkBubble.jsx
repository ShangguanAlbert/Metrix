import { useLayoutEffect, useRef } from "react";
import { ExternalLink, Link2, Pencil } from "lucide-react";

export default function LinkBubble({
  visible = false,
  position = null,
  onOpen,
  onEdit,
}) {
  const containerRef = useRef(null);

  useLayoutEffect(() => {
    if (!visible || !position || !containerRef.current) return undefined;

    const updatePosition = () => {
      const bubbleWidth = containerRef.current?.offsetWidth || 0;
      const bubbleHeight = containerRef.current?.offsetHeight || 0;
      const left = Math.max(
        16,
        Math.min(
          Number(position.anchorX || 0) - bubbleWidth / 2,
          window.innerWidth - bubbleWidth - 16,
        ),
      );
      const top = Math.max(
        16,
        Math.min(
          Number(position.top || 0),
          window.innerHeight - bubbleHeight - 16,
        ),
      );

      if (!containerRef.current) return;
      containerRef.current.style.left = `${left}px`;
      containerRef.current.style.top = `${top}px`;
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [visible, position]);

  if (!visible || !position) return null;

  return (
    <div
      ref={containerRef}
      className="notes-link-bubble"
      style={{ left: -9999, top: -9999 }}
    >
      <span className="notes-link-bubble-icon" aria-hidden="true">
        <Link2 size={15} />
      </span>
      <span className="notes-link-bubble-divider" aria-hidden="true" />
      <button
        type="button"
        className="notes-link-bubble-btn"
        onClick={onOpen}
        title="打开链接"
        aria-label="打开链接"
      >
        <ExternalLink size={15} />
      </button>
      <button
        type="button"
        className="notes-link-bubble-btn"
        onClick={onEdit}
        title="编辑链接标题"
        aria-label="编辑链接标题"
      >
        <Pencil size={15} />
      </button>
    </div>
  );
}

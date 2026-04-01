import { Copy, MessageSquareQuote, MoreHorizontal, SmilePlus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const AGENT_LAB_MARKDOWN_REMARK_PLUGINS = [[remarkGfm, { singleTilde: false }]];
const AGENT_LAB_MARKDOWN_COMPONENTS = {
  a: ({ node, ...props }) => {
    void node;
    return <a {...props} target="_blank" rel="noopener noreferrer" />;
  },
};

function normalizeRenderedMarkdown(value) {
  const text = String(value || "");
  if (!text) return "";

  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length - 1; index += 1) {
    const current = String(lines[index] || "").trim();
    const next = String(lines[index + 1] || "").trim();
    if (!current || !/^(?:=|-){3,}$/.test(next)) continue;
    if (
      current.startsWith("#") ||
      current.startsWith(">") ||
      current.startsWith("```") ||
      current.startsWith("~~~") ||
      current.startsWith("- ") ||
      current.startsWith("* ") ||
      current.startsWith("+ ") ||
      /^\d+\.\s/.test(current)
    ) {
      continue;
    }

    const looksLikeSentence =
      current.length >= 16 || /[,.!?;:，。！？；：）)]$/.test(current);
    if (!looksLikeSentence) continue;

    lines.splice(index + 1, 0, "");
    index += 1;
  }

  return lines.join("\n");
}

function formatDisplayTime(input) {
  if (!input) return "--";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function computeHue(text) {
  const value = String(text || "");
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 360;
  }
  return Math.abs(hash);
}

function createReplyTarget(message) {
  if (!message) return null;
  const previewText = String(message?.content || "").trim().slice(0, 120);
  return {
    id: String(message?.id || "").trim(),
    senderName: String(message?.senderName || "用户").trim() || "用户",
    previewText: previewText || "(空消息)",
  };
}

function NameAvatar({ name = "", tone = "user" }) {
  if (tone === "agent") {
    return (
      <span className="agent-lab-name-avatar agent">
        <svg viewBox="0 0 36 36" aria-hidden="true">
          <circle cx="18" cy="18" r="18" fill="#1f5dbd" />
          <circle cx="12.5" cy="15" r="2.1" fill="#ffffff" />
          <circle cx="23.5" cy="15" r="2.1" fill="#ffffff" />
          <rect x="11" y="21" width="14" height="2.7" rx="1.35" fill="#ffffff" />
          <text
            x="18"
            y="31.2"
            textAnchor="middle"
            fontSize="7.2"
            fontWeight="700"
            fill="#d9e9ff"
            fontFamily="Segoe UI, PingFang SC, sans-serif"
            letterSpacing="0.5"
          >
            AI
          </text>
        </svg>
      </span>
    );
  }

  const label = String(name || "用户").trim();
  const firstChar = label.slice(0, 1) || "用";
  const hue = computeHue(label);
  return (
    <span className="agent-lab-name-avatar">
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <circle cx="18" cy="18" r="18" fill={`hsl(${hue} 72% 43%)`} />
        <text
          x="18"
          y="22"
          textAnchor="middle"
          fontSize="16"
          fontWeight="700"
          fill="#ffffff"
          fontFamily="Segoe UI, PingFang SC, sans-serif"
        >
          {firstChar}
        </text>
      </svg>
    </span>
  );
}

function renderMessageText(content) {
  const normalizedMarkdown = normalizeRenderedMarkdown(content);
  const looksMarkdown = /(?:^|\n)\s{0,3}(?:[#>*-]|\d+\.)\s|\[[^\]]+\]\([^)]+\)|```|`[^`]+`/.test(
    normalizedMarkdown,
  );
  if (looksMarkdown) {
    return (
      <div className="agent-lab-room-message-text md-body is-markdown">
        <ReactMarkdown
          remarkPlugins={AGENT_LAB_MARKDOWN_REMARK_PLUGINS}
          components={AGENT_LAB_MARKDOWN_COMPONENTS}
        >
          {normalizedMarkdown}
        </ReactMarkdown>
      </div>
    );
  }
  return <div className="agent-lab-room-message-text">{String(content || "")}</div>;
}

export default function AgentLabRoomMessageList({
  messages = [],
  meUserId = "",
  usersById = {},
  loading = false,
  emptyText = "还没有消息，发一条开始测试吧。",
  quickReactionEmojis = [],
  onQuoteMessage,
  onToggleReaction,
  onNotify,
} = {}) {
  const viewportRef = useRef(null);
  const messageMenuRef = useRef(null);
  const latestStateRef = useRef(true);
  const messageCountRef = useRef(0);
  const [isAtLatest, setIsAtLatest] = useState(true);
  const [messageMenuState, setMessageMenuState] = useState({
    messageId: "",
    showReactions: false,
    placement: "down",
    maxHeight: 260,
  });

  const normalizedMessages = Array.isArray(messages) ? messages.filter(Boolean) : [];
  const normalizedMessageCount = normalizedMessages.length;

  const syncLatestState = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return true;
    const remain = viewport.scrollHeight - (viewport.scrollTop + viewport.clientHeight);
    const next = remain <= 12;
    latestStateRef.current = next;
    setIsAtLatest(next);
    return next;
  }, []);

  const scrollToLatest = useCallback((behavior = "auto") => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior,
    });
    requestAnimationFrame(() => {
      syncLatestState();
    });
  }, [syncLatestState]);

  const closeMessageMenu = useCallback(() => {
    setMessageMenuState({
      messageId: "",
      showReactions: false,
      placement: "down",
      maxHeight: 260,
    });
  }, []);

  const syncMessageMenuPlacement = useCallback(() => {
    if (!messageMenuState.messageId) return;
    const menuWrap = messageMenuRef.current;
    const menuPanel = menuWrap?.querySelector?.(".agent-lab-msg-menu-panel");
    const viewport = viewportRef.current;
    if (!menuWrap || !menuPanel || !viewport) return;

    const wrapRect = menuWrap.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    const panelHeight = Math.ceil(
      Math.min(
        260,
        menuPanel.scrollHeight || menuPanel.offsetHeight || menuPanel.getBoundingClientRect().height || 0,
      ),
    );
    const gap = 6;
    const safeMargin = 12;
    const spaceAbove = Math.max(0, wrapRect.top - viewportRect.top);
    const spaceBelow = Math.max(0, viewportRect.bottom - wrapRect.bottom);

    let placement = "down";
    if (spaceBelow >= panelHeight + gap) {
      placement = "down";
    } else if (spaceAbove >= panelHeight + gap) {
      placement = "up";
    } else {
      placement = spaceBelow >= spaceAbove ? "down" : "up";
    }

    const availableSpace = placement === "down" ? spaceBelow : spaceAbove;
    const maxHeight = Math.max(88, Math.min(260, Math.floor(availableSpace - safeMargin)));

    setMessageMenuState((prev) => {
      if (!prev.messageId) return prev;
      if (prev.placement === placement && prev.maxHeight === maxHeight) return prev;
      return {
        ...prev,
        placement,
        maxHeight,
      };
    });
  }, [messageMenuState.messageId]);

  useEffect(() => {
    requestAnimationFrame(() => {
      scrollToLatest("auto");
    });
  }, [scrollToLatest]);

  useEffect(() => {
    const previousCount = messageCountRef.current;
    const nextCount = normalizedMessageCount;
    messageCountRef.current = nextCount;

    if (!nextCount) return;
    if (previousCount === 0) return;
    if (nextCount <= previousCount) {
      syncLatestState();
      return;
    }
    if (!latestStateRef.current) return;

    requestAnimationFrame(() => {
      scrollToLatest("auto");
    });
  }, [normalizedMessageCount, scrollToLatest, syncLatestState]);

  useEffect(() => {
    if (!messageMenuState.messageId) return undefined;
    function handlePointerDown(event) {
      if (messageMenuRef.current && messageMenuRef.current.contains(event.target)) return;
      closeMessageMenu();
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [closeMessageMenu, messageMenuState.messageId]);

  useEffect(() => {
    if (!messageMenuState.messageId) return undefined;

    const frameId = window.requestAnimationFrame(() => {
      syncMessageMenuPlacement();
    });

    function handleViewportChange() {
      syncMessageMenuPlacement();
    }

    window.addEventListener("resize", handleViewportChange);
    document.addEventListener("scroll", handleViewportChange, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleViewportChange);
      document.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [
    messageMenuState.messageId,
    messageMenuState.showReactions,
    normalizedMessageCount,
    syncMessageMenuPlacement,
  ]);

  function toggleMessageMenu(messageId) {
    const safeMessageId = String(messageId || "").trim();
    if (!safeMessageId) return;
    setMessageMenuState((prev) =>
      prev.messageId === safeMessageId
        ? { messageId: "", showReactions: false, placement: "down", maxHeight: 260 }
        : { messageId: safeMessageId, showReactions: false, placement: "down", maxHeight: 260 },
    );
  }

  function toggleReactionPanel(messageId) {
    const safeMessageId = String(messageId || "").trim();
    if (!safeMessageId) return;
    setMessageMenuState((prev) => {
      if (prev.messageId !== safeMessageId) {
        return { messageId: safeMessageId, showReactions: true, placement: "down", maxHeight: 260 };
      }
      return {
        messageId: safeMessageId,
        showReactions: !prev.showReactions,
        placement: prev.placement || "down",
        maxHeight: prev.maxHeight || 260,
      };
    });
  }

  async function handleCopyMessage(message) {
    const content = String(message?.content || "");
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      onNotify?.("已复制");
      closeMessageMenu();
    } catch {
      onNotify?.("复制失败");
      closeMessageMenu();
    }
  }

  return (
    <div className="agent-lab-room-messages-wrap">
      <section className="agent-lab-room-messages" ref={viewportRef} onScroll={syncLatestState}>
        {loading && normalizedMessages.length === 0 ? (
          <p className="agent-lab-room-tip">正在加载消息...</p>
        ) : normalizedMessages.length === 0 ? (
          <p className="agent-lab-room-tip">{emptyText}</p>
        ) : (
          normalizedMessages.map((message) => {
            const type = String(message?.type || "").trim().toLowerCase();
            const isSystem = type === "system";
            const isAssistant = type === "assistant";
            const isMine =
              !isAssistant &&
              !isSystem &&
              String(message?.senderUserId || "").trim() === String(meUserId || "").trim();
            const senderId = String(message?.senderUserId || "").trim();
            const sender = usersById && typeof usersById === "object" ? usersById[senderId] : null;
            const senderName = isAssistant
              ? message?.senderName || "Agent Lab"
              : sender?.name || message?.senderName || "成员";
            const isMenuOpen = messageMenuState.messageId === message.id;
            const showReactions = isMenuOpen && messageMenuState.showReactions;
            const messageReactions = Array.isArray(message?.reactions) ? message.reactions : [];

            return (
              <article
                key={message.id}
                className={`agent-lab-room-message type-${type}${isMine ? " mine" : ""}${isSystem ? " system" : ""}`}
              >
                {isSystem ? (
                  <p className="agent-lab-room-system-text">{message?.content || ""}</p>
                ) : (
                  <div className="agent-lab-room-message-row">
                    <NameAvatar name={senderName} tone={isAssistant ? "agent" : "user"} />
                    <div className="agent-lab-room-message-main">
                      <div className="agent-lab-room-message-head">
                        <span className="agent-lab-room-message-sender">{senderName}</span>
                        {isAssistant ? (
                          <span className="agent-lab-room-origin-badge" title="Agent Lab 主动参与消息">
                            AI
                          </span>
                        ) : null}
                        <time className="agent-lab-room-message-time">
                          {formatDisplayTime(message?.createdAt)}
                        </time>
                      </div>

                      <div className={`agent-lab-room-message-bubble-wrap${isMine ? " mine" : ""}`}>
                        <div className={`agent-lab-room-message-bubble${isAssistant ? " is-agent" : ""}`}>
                          {message?.replyToMessageId ? (
                            <div className="agent-lab-reply-ref">
                              <span className="agent-lab-reply-ref-name">{message.replySenderName}</span>
                              <span className="agent-lab-reply-ref-text">{message.replyPreviewText}</span>
                            </div>
                          ) : null}
                          {renderMessageText(message?.content || "")}
                          {messageReactions.length > 0 ? (
                            <div className="agent-lab-message-emoji-replies">
                              {messageReactions.map((item, index) => {
                                const canCancel = String(item?.userId || "").trim() === String(meUserId || "").trim();
                                return (
                                  <span
                                    key={`${message.id}-${item.userId}-${item.emoji}-${index}`}
                                    className={`agent-lab-message-emoji-chip${canCancel ? " mine" : ""}`}
                                  >
                                    <span>{item.emoji}</span>
                                    {canCancel ? (
                                      <button
                                        type="button"
                                        className="agent-lab-message-emoji-name-btn"
                                        title="点击取消我的表情回复"
                                        onClick={() => void onToggleReaction?.(message, item.emoji)}
                                      >
                                        {item.userName}
                                      </button>
                                    ) : (
                                      <span className="agent-lab-message-emoji-name">{item.userName}</span>
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                          ) : null}
                          {isAssistant && message?.aiMeta ? (
                            <div className="agent-lab-room-message-meta">
                              <span>{message.aiMeta.modePreset || "classroom_host"}</span>
                              {message.aiMeta.provider ? <span>{message.aiMeta.provider}</span> : null}
                              {message.aiMeta.model ? <span>{message.aiMeta.model}</span> : null}
                            </div>
                          ) : null}
                        </div>

                        <div
                          className={`agent-lab-msg-menu-wrap${isMine ? " mine" : ""}${isMenuOpen ? " is-open" : ""}`}
                          ref={isMenuOpen ? messageMenuRef : null}
                        >
                          <button
                            type="button"
                            className="agent-lab-msg-menu-trigger"
                            title="更多操作"
                            onClick={() => toggleMessageMenu(message.id)}
                          >
                            <MoreHorizontal size={16} />
                          </button>

                          {isMenuOpen ? (
                            <div
                              className={`agent-lab-msg-menu-panel agent-lab-msg-menu-panel--${messageMenuState.placement}${isMine ? " align-left" : " align-right"}`}
                              role="menu"
                              style={{ maxHeight: `${messageMenuState.maxHeight}px` }}
                            >
                              <button
                                type="button"
                                className="agent-lab-msg-menu-item"
                                onClick={() => void handleCopyMessage(message)}
                              >
                                <Copy size={15} />
                                复制
                              </button>

                              <button
                                type="button"
                                className="agent-lab-msg-menu-item"
                                onClick={() => {
                                  onQuoteMessage?.(createReplyTarget(message));
                                  closeMessageMenu();
                                }}
                              >
                                <MessageSquareQuote size={15} />
                                引用
                              </button>

                              <button
                                type="button"
                                className="agent-lab-msg-menu-item"
                                onClick={() => toggleReactionPanel(message.id)}
                              >
                                <SmilePlus size={15} />
                                表情回复
                              </button>

                              {showReactions ? (
                                <div className="agent-lab-msg-reaction-row">
                                  {quickReactionEmojis.map((emoji) => (
                                    <button
                                      key={`${message.id}-${emoji}`}
                                      type="button"
                                      className="agent-lab-msg-reaction-btn"
                                      onClick={() => {
                                        void onToggleReaction?.(message, emoji);
                                        closeMessageMenu();
                                      }}
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>
      {normalizedMessages.length > 0 ? (
        <div className={`agent-lab-room-jump-latest-wrap${isAtLatest ? " is-hidden" : " is-visible"}`}>
          <button
            type="button"
            className="agent-lab-room-jump-latest-btn"
            onClick={() => scrollToLatest("auto")}
            disabled={isAtLatest}
            tabIndex={isAtLatest ? -1 : 0}
          >
            跳转到最新消息
          </button>
        </div>
      ) : null}
    </div>
  );
}

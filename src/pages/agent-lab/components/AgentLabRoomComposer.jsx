import {
  AtSign,
  FileUp,
  ImagePlus,
  Loader2,
  SendHorizontal,
  Smile,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const AGENT_LAB_COMPOSER_EMOJIS = Object.freeze(buildComposerEmojiCatalog());

function buildComposerEmojiCatalog() {
  const fallback = ["😀", "😁", "😂", "🤣", "😊", "😍", "🤔", "👍", "🎉", "🙏"];
  try {
    const emojiMatcher = /\p{Emoji_Presentation}/u;
    const seen = new Set();
    const list = [];
    const pushEmoji = (value) => {
      const text = String(value || "");
      if (!text || !emojiMatcher.test(text) || seen.has(text)) return;
      seen.add(text);
      list.push(text);
    };
    const collectRange = (start, end) => {
      for (let codePoint = start; codePoint <= end; codePoint += 1) {
        const char = String.fromCodePoint(codePoint);
        if (!emojiMatcher.test(char)) continue;
        pushEmoji(char);
      }
    };

    collectRange(0x1f300, 0x1f6ff);
    collectRange(0x1f900, 0x1f9ff);
    collectRange(0x1fa70, 0x1faff);
    collectRange(0x2600, 0x26ff);
    collectRange(0x2700, 0x27bf);

    buildSupportedFlagEmojiList().forEach((flagEmoji) => {
      pushEmoji(flagEmoji);
    });

    if (list.length === 0) return fallback;
    return list;
  } catch {
    return fallback;
  }
}

function buildSupportedFlagEmojiList() {
  try {
    if (typeof Intl === "undefined" || typeof Intl.supportedValuesOf !== "function") {
      return [];
    }
    const regionCodes = Intl.supportedValuesOf("region");
    if (!Array.isArray(regionCodes) || regionCodes.length === 0) return [];
    return regionCodes
      .filter((code) => /^[A-Z]{2}$/.test(String(code || "")))
      .map((code) => convertRegionCodeToFlagEmoji(code))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function convertRegionCodeToFlagEmoji(regionCode) {
  const text = String(regionCode || "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{2}$/.test(text)) return "";
  const first = text.charCodeAt(0) + 127397;
  const second = text.charCodeAt(1) + 127397;
  return String.fromCodePoint(first, second);
}

function readSelectionRange(selectionRef, text) {
  const currentText = String(text || "");
  const textLength = currentText.length;
  const rawStart = selectionRef?.current?.start;
  const rawEnd = selectionRef?.current?.end;
  const fallback = textLength;
  const start =
    Number.isFinite(rawStart) && rawStart != null ? Math.min(Math.max(rawStart, 0), textLength) : fallback;
  const end =
    Number.isFinite(rawEnd) && rawEnd != null ? Math.min(Math.max(rawEnd, start), textLength) : start;
  return { start, end };
}

function buildComposerInsertionText(currentText, range, insertedText) {
  const current = String(currentText || "");
  const safeInsertedText = String(insertedText || "");
  if (!safeInsertedText) {
    return {
      text: current,
      selectionStart: range.start,
      selectionEnd: range.end,
    };
  }

  const beforeText = current.slice(0, range.start);
  const afterText = current.slice(range.end);
  const prevChar = beforeText.slice(-1);
  const nextChar = afterText.charAt(0);
  const needLeadingSpace = Boolean(beforeText) && prevChar && !/\s/u.test(prevChar);
  const needTrailingSpace = !nextChar || !/\s/u.test(nextChar);
  const insertedSegment = `${needLeadingSpace ? " " : ""}${safeInsertedText}${needTrailingSpace ? " " : ""}`;
  const nextText = `${beforeText}${insertedSegment}${afterText}`;
  const caret = beforeText.length + insertedSegment.length;
  return {
    text: nextText,
    selectionStart: caret,
    selectionEnd: caret,
  };
}

function EmojiSvgGlyph({ emoji }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="agent-lab-compose-emoji-svg">
      <text
        x="50%"
        y="54%"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="24"
        fontFamily='"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'
      >
        {emoji}
      </text>
    </svg>
  );
}

export default function AgentLabRoomComposer({
  value = "",
  onChange,
  onSend,
  disabled = false,
  sending = false,
  placeholder = "请输入消息",
  pendingFollowupMode = "",
  replyTarget = null,
  onClearReply,
  mentionCandidates = [],
  onFeaturePending,
} = {}) {
  const textareaRef = useRef(null);
  const toolbarRef = useRef(null);
  const selectionRef = useRef({ start: null, end: null });
  const [showEmojiPanel, setShowEmojiPanel] = useState(false);
  const [showMentionPicker, setShowMentionPicker] = useState(false);

  useEffect(() => {
    function handlePointerDown(event) {
      const toolbar = toolbarRef.current;
      if (toolbar && toolbar.contains(event.target)) return;
      setShowEmojiPanel(false);
      setShowMentionPicker(false);
    }
    function handleKeyDown(event) {
      if (event.key !== "Escape") return;
      setShowEmojiPanel(false);
      setShowMentionPicker(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function rememberSelection() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    selectionRef.current = {
      start: Number.isFinite(textarea.selectionStart) ? textarea.selectionStart : null,
      end: Number.isFinite(textarea.selectionEnd) ? textarea.selectionEnd : null,
    };
  }

  function focusTextarea(selectionMode = "preserve") {
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus({ preventScroll: true });
      const textLength = String(textarea.value || "").length;
      const fallbackPosition = textLength;
      const nextStart =
        selectionMode === "end"
          ? fallbackPosition
          : Number.isFinite(selectionRef.current.start) && selectionRef.current.start != null
            ? Math.min(selectionRef.current.start, textLength)
            : fallbackPosition;
      const nextEnd =
        selectionMode === "end"
          ? fallbackPosition
          : Number.isFinite(selectionRef.current.end) && selectionRef.current.end != null
            ? Math.min(selectionRef.current.end, textLength)
            : nextStart;
      textarea.setSelectionRange(nextStart, nextEnd);
    });
  }

  function keepComposeFocusOnMouseDown(event) {
    rememberSelection();
    event.preventDefault();
  }

  function handleSubmit() {
    if (disabled || sending) return;
    const content = String(value || "").trim();
    if (!content) return;
    onSend?.(content);
    setShowEmojiPanel(false);
    setShowMentionPicker(false);
  }

  function patchTextareaValue(insertedText) {
    const current = String(value || "");
    const range = readSelectionRange(selectionRef, current);
    const next = buildComposerInsertionText(current, range, insertedText);
    selectionRef.current = {
      start: next.selectionStart,
      end: next.selectionEnd,
    };
    onChange?.(next.text);
    focusTextarea("preserve");
  }

  return (
    <section className="agent-lab-room-composer">
      {replyTarget ? (
        <div className="agent-lab-reply-bar">
          <span className="agent-lab-reply-label">{`引用 ${replyTarget.senderName}`}</span>
          <span className="agent-lab-reply-text">{replyTarget.previewText}</span>
          <button
            type="button"
            className="agent-lab-clear-reply-btn"
            onClick={() => onClearReply?.()}
            title="取消引用"
          >
            <X size={14} />
          </button>
        </div>
      ) : null}

      <div className="agent-lab-compose-editor">
        <div className="agent-lab-compose-toolbar" ref={toolbarRef}>
          <button
            type="button"
            className={`agent-lab-tool-btn${showEmojiPanel ? " active" : ""}`}
            title="表情"
            disabled={disabled}
            onMouseDown={keepComposeFocusOnMouseDown}
            onClick={() => {
              rememberSelection();
              setShowMentionPicker(false);
              setShowEmojiPanel((current) => !current);
              focusTextarea("preserve");
            }}
          >
            <Smile size={17} />
          </button>
          <button
            type="button"
            className={`agent-lab-tool-btn${showMentionPicker ? " active" : ""}`}
            title="@成员"
            disabled={disabled || mentionCandidates.length === 0}
            onMouseDown={keepComposeFocusOnMouseDown}
            onClick={() => {
              rememberSelection();
              setShowEmojiPanel(false);
              setShowMentionPicker((current) => !current);
              focusTextarea("preserve");
            }}
          >
            <AtSign size={17} />
          </button>
          <button
            type="button"
            className="agent-lab-tool-btn"
            title="发送图片"
            disabled={disabled}
            onClick={() => onFeaturePending?.()}
          >
            <ImagePlus size={17} />
          </button>
          <button
            type="button"
            className="agent-lab-tool-btn"
            title="发送文件"
            disabled={disabled}
            onClick={() => onFeaturePending?.()}
          >
            <FileUp size={17} />
          </button>

          {showEmojiPanel ? (
            <div className="agent-lab-compose-emoji-panel">
              {AGENT_LAB_COMPOSER_EMOJIS.map((emoji) => (
                <button
                  key={`agent-lab-compose-emoji-${emoji}`}
                  type="button"
                  className="agent-lab-compose-emoji-btn"
                  aria-label={emoji}
                  onMouseDown={keepComposeFocusOnMouseDown}
                  onClick={() => {
                    patchTextareaValue(emoji);
                    setShowEmojiPanel(false);
                  }}
                >
                  <EmojiSvgGlyph emoji={emoji} />
                </button>
              ))}
            </div>
          ) : null}

          {showMentionPicker ? (
            <div className="agent-lab-mention-picker" role="dialog" aria-label="成员">
              <div className="agent-lab-mention-picker-list">
                {mentionCandidates.map((member) => (
                  <button
                    key={`agent-lab-mention-${member.id}`}
                    type="button"
                    className="agent-lab-mention-picker-item"
                    onMouseDown={keepComposeFocusOnMouseDown}
                    onClick={() => {
                      patchTextareaValue(`@${member.name} `);
                      setShowMentionPicker(false);
                    }}
                  >
                    <span className="agent-lab-mention-picker-at" aria-hidden="true">
                      <AtSign size={16} strokeWidth={2.5} />
                    </span>
                    <span className="agent-lab-mention-picker-name">{member.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="agent-lab-compose-input-area">
          <textarea
            ref={textareaRef}
            className="agent-lab-compose-textarea"
            placeholder={placeholder}
            value={value}
            onChange={(event) => onChange?.(event.target.value)}
            onClick={rememberSelection}
            onKeyUp={rememberSelection}
            onSelect={rememberSelection}
            disabled={disabled}
            rows={4}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.shiftKey) return;
              const composing =
                Boolean(event.nativeEvent?.isComposing) ||
                Number(event.nativeEvent?.keyCode) === 229;
              if (composing) return;
              event.preventDefault();
              handleSubmit();
            }}
          />
        </div>
      </div>

      <div className="agent-lab-compose-footer">
        <span className="agent-lab-compose-hint">
          {pendingFollowupMode === "assistant"
            ? "消息已发送，Agent Lab 正在异步参与..."
            : "Enter 发送 / Shift+Enter 换行"}
        </span>
        <button
          type="button"
          className="agent-lab-send-btn"
          disabled={disabled || sending || !String(value || "").trim()}
          onClick={handleSubmit}
        >
          {sending ? <Loader2 size={16} className="spin" /> : <SendHorizontal size={16} />}
          发送
        </button>
      </div>
    </section>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bot,
  KeyRound,
  Loader2,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  getStoredAuthUser,
  getUserToken,
  resolveActiveAuthSlot,
  withAuthSlot,
} from "../../app/authStorage.js";
import {
  claimAgentLabAccess,
  fetchAgentLabAccessStatus,
  fetchAgentLabBootstrap,
  fetchAgentLabMessages,
  markAgentLabRoomRead,
  sendAgentLabTextMessage,
  toggleAgentLabMessageReaction,
} from "./agentLabApi.js";
import { createAgentLabSocketClient } from "./agentLabSocket.js";
import AgentLabMembersPanel from "./components/AgentLabMembersPanel.jsx";
import AgentLabRoomComposer from "./components/AgentLabRoomComposer.jsx";
import AgentLabRoomMessageList from "./components/AgentLabRoomMessageList.jsx";
import AgentLabTaskPanel from "./components/AgentLabTaskPanel.jsx";
import "../../styles/agent-lab.css";
import "../../styles/agent-lab-room.css";

const SOCKET_FALLBACK_POLL_MS = 5000;
const FOLLOWUP_POLL_MS = 1800;
const FOLLOWUP_POLL_TIMEOUT_MS = 25000;
const AGENT_LAB_QUICK_REACTION_EMOJIS = Object.freeze(["👍", "👏", "🎉", "😄", "🤝"]);

function readErrorMessage(error) {
  return error?.message || "请求失败，请稍后重试。";
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

function upsertMessage(list, message) {
  const safeMessage = message && typeof message === "object" ? message : null;
  if (!safeMessage?.id) return Array.isArray(list) ? list : [];
  const source = Array.isArray(list) ? list : [];
  const exists = source.some((item) => String(item?.id || "") === String(safeMessage.id || ""));
  const next = exists
    ? source.map((item) => (String(item?.id || "") === String(safeMessage.id || "") ? safeMessage : item))
    : [...source, safeMessage];
  return next.sort((a, b) => {
    const aTime = new Date(a?.createdAt || 0).getTime() || 0;
    const bTime = new Date(b?.createdAt || 0).getTime() || 0;
    if (aTime !== bTime) return aTime - bTime;
    return String(a?.id || "").localeCompare(String(b?.id || ""));
  });
}

function mergeReadState(room, readState) {
  const sourceRoom = room && typeof room === "object" ? room : null;
  if (!sourceRoom || !readState?.userId) return sourceRoom;
  const source = Array.isArray(sourceRoom.readStates) ? sourceRoom.readStates : [];
  const exists = source.some((item) => String(item?.userId || "") === String(readState.userId || ""));
  return {
    ...sourceRoom,
    readStates: exists
      ? source.map((item) => (String(item?.userId || "") === String(readState.userId || "") ? readState : item))
      : [...source, readState],
  };
}

function modePresetLabel(value) {
  if (value === "learning_companion") return "学习陪伴";
  if (value === "community_manager") return "通用社群";
  return "课堂主持";
}

function mapSocketStatusLabel(value) {
  const status = String(value || "").trim().toLowerCase();
  if (status === "joined" || status === "authed") {
    return { label: "已连接", tone: "success" };
  }
  if (status === "open" || status === "connecting") {
    return { label: "连接中", tone: "neutral" };
  }
  if (status === "fallback" || status === "reconnecting" || status === "closed" || status === "error") {
    return { label: "轮询补偿中", tone: "warning" };
  }
  return { label: "初始化中", tone: "neutral" };
}

export default function AgentLabPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeSlot = resolveActiveAuthSlot(location.search);
  const storedUser = getStoredAuthUser(activeSlot);
  const socketRef = useRef(null);
  const followupPollTimerRef = useRef(0);
  const followupPollDeadlineRef = useRef(0);
  const floatingNoticeTimerRef = useRef(0);
  const floatingNoticeSeqRef = useRef(0);

  const [accessChecked, setAccessChecked] = useState(false);
  const [accessGranted, setAccessGranted] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [bootstrapLoading, setBootstrapLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [statusError, setStatusError] = useState("");
  const [accessError, setAccessError] = useState("");
  const [messageError, setMessageError] = useState("");
  const [room, setRoom] = useState(null);
  const [me, setMe] = useState({
    id: "",
    name: String(storedUser?.profile?.name || storedUser?.username || "用户").trim() || "用户",
    role: "user",
  });
  const [usersById, setUsersById] = useState({});
  const [settings, setSettings] = useState(null);
  const [messages, setMessages] = useState([]);
  const [composeText, setComposeText] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [shadowSuggestion, setShadowSuggestion] = useState(null);
  const [socketStatus, setSocketStatus] = useState("idle");
  const [pendingFollowupMode, setPendingFollowupMode] = useState("");
  const [replyTarget, setReplyTarget] = useState(null);
  const [floatingNotice, setFloatingNotice] = useState(null);

  const latestMessageId = useMemo(
    () => String(messages[messages.length - 1]?.id || "").trim(),
    [messages],
  );
  const socketStatusInfo = useMemo(() => mapSocketStatusLabel(socketStatus), [socketStatus]);
  const socketHealthy = socketStatus === "authed" || socketStatus === "joined";
  const mentionCandidates = useMemo(() => {
    const memberIds = Array.isArray(room?.memberUserIds) ? room.memberUserIds : [];
    const selfId = String(me?.id || "").trim();
    return memberIds
      .map((id) => {
        const safeId = String(id || "").trim();
        const user = usersById?.[safeId];
        return {
          id: safeId,
          name: user?.name || user?.username || "成员",
        };
      })
      .filter((item) => item.id && item.id !== selfId)
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "zh-CN"));
  }, [me?.id, room?.memberUserIds, usersById]);

  const hydrateBootstrap = useCallback((data) => {
    setMe(data?.me && typeof data.me === "object" ? data.me : { id: "", name: "用户", role: "user" });
    setRoom(data?.room && typeof data.room === "object" ? data.room : null);
    setSettings(data?.settings && typeof data.settings === "object" ? data.settings : null);
    setShadowSuggestion(data?.shadowSuggestion && typeof data.shadowSuggestion === "object" ? data.shadowSuggestion : null);
    const users = Array.isArray(data?.users) ? data.users : [];
    setUsersById(
      users.reduce((acc, item) => {
        const id = String(item?.id || "").trim();
        if (id) acc[id] = item;
        return acc;
      }, {}),
    );
    setAccessGranted(true);
    setAccessError("");
  }, []);

  const clearFollowupPolling = useCallback(() => {
    if (followupPollTimerRef.current) {
      window.clearTimeout(followupPollTimerRef.current);
      followupPollTimerRef.current = 0;
    }
    followupPollDeadlineRef.current = 0;
    setPendingFollowupMode("");
  }, []);

  const showFloatingNotice = useCallback((text) => {
    const message = String(text || "").trim();
    if (!message) return;
    floatingNoticeSeqRef.current += 1;
    const noticeId = floatingNoticeSeqRef.current;
    setFloatingNotice({ id: noticeId, message });
    if (floatingNoticeTimerRef.current) {
      window.clearTimeout(floatingNoticeTimerRef.current);
    }
    floatingNoticeTimerRef.current = window.setTimeout(() => {
      setFloatingNotice((current) => (current?.id === noticeId ? null : current));
      floatingNoticeTimerRef.current = 0;
    }, 2000);
  }, []);

  const pollAgentLabStateOnce = useCallback(
    async (roomId) => {
      const safeRoomId = String(roomId || "").trim();
      if (!safeRoomId) return { room: null, messages: [] };
      const [bootstrapData, messagesData] = await Promise.all([
        fetchAgentLabBootstrap(),
        fetchAgentLabMessages(safeRoomId),
      ]);
      hydrateBootstrap(bootstrapData);
      const nextMessages = Array.isArray(messagesData?.messages) ? messagesData.messages : [];
      setMessages(nextMessages);
      return {
        room: bootstrapData?.room || null,
        messages: nextMessages,
        shadowSuggestion: bootstrapData?.shadowSuggestion || null,
      };
    },
    [hydrateBootstrap],
  );

  const startFollowupPolling = useCallback(
    ({
      roomId,
      followupMode,
      baselineShadowAt = "",
      baselineLastAgentAt = "",
      baselineUserMessageCreatedAt = "",
      userMessageId = "",
    }) => {
      const safeRoomId = String(roomId || "").trim();
      const safeMode = String(followupMode || "").trim();
      if (!safeRoomId || !safeMode || safeMode === "none") {
        clearFollowupPolling();
        return;
      }
      clearFollowupPolling();
      setPendingFollowupMode(safeMode);
      followupPollDeadlineRef.current = Date.now() + FOLLOWUP_POLL_TIMEOUT_MS;

      const tick = async () => {
        if (Date.now() >= followupPollDeadlineRef.current) {
          clearFollowupPolling();
          return;
        }
        try {
          const data = await pollAgentLabStateOnce(safeRoomId);
          const nextShadowAt = String(data?.shadowSuggestion?.generatedAt || "").trim();
          const nextLastAgentAt = String(data?.room?.lastAgentAt || "").trim();
          const assistantArrived = Array.isArray(data?.messages)
            ? data.messages.some((item) => {
                const type = String(item?.type || "").trim().toLowerCase();
                const createdAt = Date.parse(String(item?.createdAt || "")) || 0;
                const baselineCreatedAt = Date.parse(String(baselineUserMessageCreatedAt || "")) || 0;
                return (
                  type === "assistant" &&
                  String(item?.id || "").trim() !== String(userMessageId || "").trim() &&
                  createdAt > baselineCreatedAt
                );
              })
            : false;
          if (
            (safeMode === "shadow" && nextShadowAt && nextShadowAt !== String(baselineShadowAt || "").trim()) ||
            (safeMode === "assistant" &&
              ((nextLastAgentAt && nextLastAgentAt !== String(baselineLastAgentAt || "").trim()) || assistantArrived))
          ) {
            clearFollowupPolling();
            return;
          }
        } catch {
          // Ignore one-off poll failures; keep fallback alive until timeout.
        }
        followupPollTimerRef.current = window.setTimeout(tick, FOLLOWUP_POLL_MS);
      };

      followupPollTimerRef.current = window.setTimeout(tick, FOLLOWUP_POLL_MS);
    },
    [clearFollowupPolling, pollAgentLabStateOnce],
  );

  const loadMessages = useCallback(async (roomId) => {
    const safeRoomId = String(roomId || "").trim();
    if (!safeRoomId) return;
    setMessagesLoading(true);
    setMessageError("");
    try {
      const data = await fetchAgentLabMessages(safeRoomId);
      setMessages(Array.isArray(data?.messages) ? data.messages : []);
    } catch (error) {
      const message = readErrorMessage(error);
      if (message.includes("访问资格")) {
        setAccessGranted(false);
        setRoom(null);
        setMessages([]);
      }
      setMessageError(message);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  const loadBootstrap = useCallback(async () => {
    setBootstrapLoading(true);
    setStatusError("");
    try {
      const data = await fetchAgentLabBootstrap();
      hydrateBootstrap(data);
      await loadMessages(data?.room?.id);
    } catch (error) {
      const message = readErrorMessage(error);
      if (message.includes("访问资格")) {
        setAccessGranted(false);
        setRoom(null);
        setMessages([]);
      } else {
        setStatusError(message);
      }
    } finally {
      setBootstrapLoading(false);
    }
  }, [hydrateBootstrap, loadMessages]);

  useEffect(() => {
    let disposed = false;
    async function load() {
      setPageLoading(true);
      setStatusError("");
      try {
        const data = await fetchAgentLabAccessStatus();
        if (disposed) return;
        const granted = data?.granted === true;
        setAccessGranted(granted);
        setAccessChecked(true);
        if (granted) {
          await loadBootstrap();
        }
      } catch (error) {
        if (disposed) return;
        setAccessChecked(true);
        setStatusError(readErrorMessage(error));
      } finally {
        if (!disposed) setPageLoading(false);
      }
    }
    void load();
    return () => {
      disposed = true;
    };
  }, [loadBootstrap]);

  useEffect(() => {
    const roomId = String(room?.id || "").trim();
    const token = getUserToken(activeSlot);
    if (!accessGranted || !roomId || !token) return undefined;

    const client = createAgentLabSocketClient({
      token,
      onMessageCreated: (payload) => {
        if (String(payload?.roomId || "") !== roomId) return;
        if (payload?.message) {
          setMessages((current) => upsertMessage(current, payload.message));
          if (String(payload?.message?.type || "").trim().toLowerCase() === "assistant") {
            clearFollowupPolling();
          }
        }
      },
      onMessageReactionsUpdated: (payload) => {
        if (String(payload?.roomId || "") !== roomId) return;
        const safeMessageId = String(payload?.messageId || "").trim();
        if (!safeMessageId) return;
        setMessages((current) =>
          current.map((item) =>
            String(item?.id || "").trim() === safeMessageId
              ? {
                  ...item,
                  reactions: Array.isArray(payload?.reactions) ? payload.reactions : [],
                }
              : item,
          ),
        );
      },
      onJoined: () => {
        setSocketStatus("joined");
      },
      onRoomUpdated: (payload) => {
        if (String(payload?.roomId || "") !== roomId || !payload?.room) return;
        setRoom(payload.room);
      },
      onRoomReadStateUpdated: (payload) => {
        if (String(payload?.roomId || "") !== roomId || !payload?.readState) return;
        setRoom((current) => mergeReadState(current, payload.readState));
      },
      onRoomReset: (payload) => {
        if (String(payload?.roomId || "") !== roomId) return;
        setShadowSuggestion(null);
        void loadBootstrap();
      },
      onMemberPresenceUpdated: (payload) => {
        if (String(payload?.roomId || "") !== roomId) return;
        setRoom((current) =>
          current
            ? {
                ...current,
                onlineMemberUserIds: Array.isArray(payload?.onlineMemberUserIds)
                  ? payload.onlineMemberUserIds
                  : current.onlineMemberUserIds,
              }
            : current,
        );
      },
      onShadowSuggestionCreated: (payload) => {
        if (String(payload?.userId || "").trim() !== String(me?.id || "").trim()) return;
        if (payload?.shadowSuggestion) {
          setShadowSuggestion(payload.shadowSuggestion);
          clearFollowupPolling();
        }
      },
      onError: (payload) => {
        const message = String(payload?.message || "").trim();
        if (!message) return;
        if (message.includes("访问资格")) {
          setAccessGranted(false);
          setRoom(null);
          setMessages([]);
        }
        setMessageError(message);
      },
      onStatus: ({ status }) => {
        setSocketStatus(String(status || "").trim() || "idle");
      },
    });
    socketRef.current = client;
    client.connect();
    client.joinRoom(roomId);
    const pingTimer = window.setInterval(() => {
      client.ping();
    }, 20 * 1000);

    return () => {
      window.clearInterval(pingTimer);
      client.close();
      socketRef.current = null;
    };
  }, [accessGranted, activeSlot, clearFollowupPolling, loadBootstrap, me?.id, room?.id]);

  useEffect(() => {
    const roomId = String(room?.id || "").trim();
    if (!accessGranted || !roomId || socketHealthy) return undefined;
    const timer = window.setInterval(() => {
      void pollAgentLabStateOnce(roomId);
    }, SOCKET_FALLBACK_POLL_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [accessGranted, pollAgentLabStateOnce, room?.id, socketHealthy]);

  useEffect(() => () => clearFollowupPolling(), [clearFollowupPolling]);
  useEffect(
    () => () => {
      if (floatingNoticeTimerRef.current) {
        window.clearTimeout(floatingNoticeTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const roomId = String(room?.id || "").trim();
    if (!roomId || !latestMessageId) return;
    void markAgentLabRoomRead(roomId, { messageId: latestMessageId }).catch(() => {});
  }, [latestMessageId, room?.id]);

  async function handleClaimAccess(event) {
    event.preventDefault();
    if (claimSubmitting) return;
    setClaimSubmitting(true);
    setAccessError("");
    try {
      const data = await claimAgentLabAccess(inviteCode);
      hydrateBootstrap(data);
      setAccessChecked(true);
      setInviteCode("");
      await loadMessages(data?.room?.id);
    } catch (error) {
      setAccessError(readErrorMessage(error));
    } finally {
      setClaimSubmitting(false);
      setPageLoading(false);
    }
  }

  async function handleSendMessage(nextContent = "") {
    const roomId = String(room?.id || "").trim();
    const content = String(nextContent || composeText || "").trim();
    if (!roomId || !content || sending) return;
    setSending(true);
    setMessageError("");
    try {
      const data = await sendAgentLabTextMessage(roomId, {
        content,
        replyToMessageId: replyTarget?.id || "",
      });
      setComposeText("");
      setReplyTarget(null);
      if (data?.message) {
        setMessages((current) => upsertMessage(current, data.message));
      }
      const followupMode = String(data?.followupMode || "").trim();
      if (followupMode && followupMode !== "none") {
        if (followupMode === "shadow") {
          setShadowSuggestion(null);
        }
        startFollowupPolling({
          roomId,
          followupMode,
          baselineShadowAt: shadowSuggestion?.generatedAt,
          baselineLastAgentAt: room?.lastAgentAt,
          baselineUserMessageCreatedAt: data?.message?.createdAt,
          userMessageId: data?.message?.id,
        });
      } else {
        clearFollowupPolling();
      }
    } catch (error) {
      setMessageError(readErrorMessage(error));
    } finally {
      setSending(false);
    }
  }

  async function handleToggleReaction(message, emoji) {
    const roomId = String(room?.id || "").trim();
    const messageId = String(message?.id || "").trim();
    const safeEmoji = String(emoji || "").trim();
    if (!roomId || !messageId || !safeEmoji) return;
    try {
      const result = await toggleAgentLabMessageReaction(roomId, messageId, safeEmoji);
      setMessages((current) =>
        current.map((item) =>
          String(item?.id || "").trim() === messageId
            ? {
                ...item,
                reactions: Array.isArray(result?.reactions) ? result.reactions : [],
              }
            : item,
        ),
      );
    } catch (error) {
      setMessageError(readErrorMessage(error));
    }
  }

  function onBack() {
    navigate(withAuthSlot("/mode-selection", activeSlot));
  }

  const modeLabel = modePresetLabel(settings?.modePreset);

  if (pageLoading) {
    return (
      <div className="agent-lab-page">
        <div className="agent-lab-shell is-centered">
          <Loader2 size={20} className="is-spinning" />
          <span>正在进入 Agent Lab...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="agent-lab-page">
      <div className="agent-lab-shell">
        {statusError ? (
          <div className="agent-lab-banner is-error" role="alert">
            {statusError}
          </div>
        ) : null}

        {!accessGranted && accessChecked ? (
          <main className="agent-lab-access-card">
            <div className="agent-lab-access-icon">
              <KeyRound size={24} />
            </div>
            <h2>输入邀请码进入 Agent Lab</h2>
            <p>该测试群仅对受邀用户开放，资格开通后将永久生效。</p>
            <form className="agent-lab-access-form" onSubmit={handleClaimAccess}>
              <input
                type="text"
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value)}
                placeholder="请输入邀请码"
                autoComplete="off"
                maxLength={80}
                disabled={claimSubmitting}
              />
              <button type="submit" className="agent-lab-primary-btn" disabled={claimSubmitting}>
                {claimSubmitting ? "开通中..." : "开通访问资格"}
              </button>
            </form>
            {accessError ? (
              <div className="agent-lab-banner is-error" role="alert">
                {accessError}
              </div>
            ) : null}
          </main>
        ) : (
          <main className="agent-lab-layout">
            <aside className="agent-lab-side-panel">
              <section className="agent-lab-side-section agent-lab-side-hero">
                <div className="agent-lab-side-hero-head">
                  <div className="agent-lab-side-hero-copy">
                    <h1>Agent Lab</h1>
                  </div>
                  <button
                    type="button"
                    className="agent-lab-secondary-btn"
                    onClick={() => void loadBootstrap()}
                    disabled={bootstrapLoading}
                    title={bootstrapLoading ? "刷新中" : "刷新"}
                    aria-label={bootstrapLoading ? "刷新中" : "刷新"}
                  >
                    <RefreshCw size={15} className={bootstrapLoading ? "is-spinning" : ""} />
                  </button>
                </div>
              </section>

              <div className="agent-lab-side-panel-scroll">
                <section className="agent-lab-side-section">
                  <h3>当前状态</h3>
                  <dl className="agent-lab-side-meta">
                    <div>
                      <dt>当前用户</dt>
                      <dd>{me?.name || "用户"}</dd>
                    </div>
                    <div>
                      <dt>实时同步</dt>
                      <dd>
                        <span
                          className={`agent-lab-status-dot is-${socketStatusInfo.tone}`}
                          title={socketStatusInfo.label}
                          aria-label={socketStatusInfo.label}
                        />
                      </dd>
                    </div>
                  </dl>
                </section>

                <section className="agent-lab-side-section">
                  <h3>实验设置</h3>
                  <ul className="agent-lab-settings-list">
                    <li>{`模式：${modeLabel}`}</li>
                    <li>{`主动发言：${settings?.proactiveSpeechEnabled ? "开启" : "关闭"}`}</li>
                    <li>{`影子主持：${settings?.shadowModeratorEnabled ? "开启" : "关闭"}`}</li>
                    <li>{`阶段总结阈值：${settings?.stageSummaryMessageCount || "--"} 条`}</li>
                  </ul>
                </section>

                <section className="agent-lab-side-section">
                  <h3>影子主持建议</h3>
                  {shadowSuggestion?.content ? (
                    <div className="agent-lab-shadow-card">
                      <p>{shadowSuggestion.content}</p>
                      <small>{`生成于 ${formatDisplayTime(shadowSuggestion.generatedAt)}`}</small>
                    </div>
                  ) : pendingFollowupMode === "shadow" ? (
                    <p className="agent-lab-side-empty">影子主持正在异步生成建议...</p>
                  ) : (
                    <p className="agent-lab-side-empty">
                      当前还没有新的影子建议。关闭主动发言后，发送消息会在这里显示建议。
                    </p>
                  )}
                </section>
              </div>

              <section className="agent-lab-side-footer">
                <button
                  type="button"
                  className="agent-lab-back-btn"
                  onClick={onBack}
                  title="返回模式选择"
                  aria-label="返回模式选择"
                >
                  <ArrowLeft size={18} />
                  <span>返回</span>
                </button>
              </section>
            </aside>

            <section className="agent-lab-main-panel">
              <div className="agent-lab-room-head">
                <div>
                  <h2>{room?.name || "Agent Lab"}</h2>
                </div>
                <div className="agent-lab-room-head-actions">
                  <span className="agent-lab-chip">
                    <Users size={14} />
                    <span>{`${Array.isArray(room?.onlineMemberUserIds) ? room.onlineMemberUserIds.length : 0} 在线`}</span>
                  </span>
                  <span className="agent-lab-chip">
                    <Sparkles size={14} />
                    <span>{modeLabel}</span>
                  </span>
                  <span className="agent-lab-chip">
                    <Bot size={14} />
                    <span>{settings?.proactiveSpeechEnabled ? "主动发言" : "影子主持"}</span>
                  </span>
                </div>
              </div>

              {messageError ? (
                <div className="agent-lab-banner is-error" role="alert">
                  {messageError}
                </div>
              ) : null}

              <div className="agent-lab-room-body">
                <AgentLabRoomMessageList
                  messages={messages}
                  meUserId={me?.id}
                  usersById={usersById}
                  loading={messagesLoading}
                  emptyText="还没有消息，发一条开始测试吧。"
                  quickReactionEmojis={AGENT_LAB_QUICK_REACTION_EMOJIS}
                  onQuoteMessage={setReplyTarget}
                  onToggleReaction={handleToggleReaction}
                  onNotify={showFloatingNotice}
                />

                <AgentLabRoomComposer
                  value={composeText}
                  onChange={setComposeText}
                  onSend={(content) => void handleSendMessage(content)}
                  disabled={sending || bootstrapLoading}
                  sending={sending}
                  placeholder="输入消息，观察 Agent Lab 的影子建议或主动参与表现..."
                  pendingFollowupMode={pendingFollowupMode}
                  replyTarget={replyTarget}
                  onClearReply={() => setReplyTarget(null)}
                  mentionCandidates={mentionCandidates}
                  onFeaturePending={() => showFloatingNotice("正在开发中")}
                />
                {floatingNotice?.message ? (
                  <div
                    key={floatingNotice.id}
                    className="agent-lab-floating-notice"
                    role="status"
                    aria-live="polite"
                  >
                    {floatingNotice.message}
                  </div>
                ) : null}
              </div>
            </section>

            <aside className="agent-lab-right-panel">
              <section className="agent-lab-right-section agent-lab-task-panel">
                <div className="agent-lab-right-section-head">
                  <h3 className="agent-lab-right-section-title">课程任务</h3>
                </div>
                <div className="agent-lab-right-section-body">
                  <AgentLabTaskPanel room={room} settings={settings} />
                </div>
              </section>

              <section className="agent-lab-right-section agent-lab-members-section">
                <AgentLabMembersPanel room={room} usersById={usersById} meUserId={me?.id} />
              </section>
            </aside>
          </main>
        )}
      </div>
    </div>
  );
}

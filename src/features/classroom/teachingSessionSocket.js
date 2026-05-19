import { resolveWebSocketUrl } from "../../app/basePath.js";

const TEACHING_SESSION_WS_PATH = "/ws/teaching-session";
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 16000;

function resolveTeachingSessionSocketUrl() {
  return resolveWebSocketUrl(TEACHING_SESSION_WS_PATH);
}

function sanitizeLessonId(value) {
  return String(value || "").trim();
}

function readJsonMessage(raw) {
  const text = typeof raw === "string" ? raw : String(raw || "");
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function createTeachingSessionSocketClient({
  token = "",
  onAuthed,
  onJoined,
  onSessionUpdated,
  onRaisedHandsUpdated,
  onQuestionCreated,
  onError,
  onStatus,
} = {}) {
  const authToken = String(token || "").trim();
  let desiredLessonId = "";
  let joinedLessonId = "";
  let ws = null;
  let authed = false;
  let closedManually = false;
  let reconnectTimer = 0;
  let reconnectAttempt = 0;

  function emitStatus(status, extra = {}) {
    onStatus?.({
      status,
      ...extra,
    });
  }

  function clearReconnectTimer() {
    if (!reconnectTimer) return;
    window.clearTimeout(reconnectTimer);
    reconnectTimer = 0;
  }

  function send(payload) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    try {
      ws.send(JSON.stringify(payload || {}));
      return true;
    } catch {
      return false;
    }
  }

  function syncDesiredLesson() {
    if (!authed || !desiredLessonId) return;
    if (joinedLessonId && joinedLessonId !== desiredLessonId) {
      send({ type: "leave_lesson", lessonId: joinedLessonId });
      joinedLessonId = "";
    }
    if (desiredLessonId !== joinedLessonId) {
      send({ type: "join_lesson", lessonId: desiredLessonId });
    }
  }

  function scheduleReconnect() {
    if (closedManually) return;
    clearReconnectTimer();
    const delay = Math.min(
      RECONNECT_MAX_DELAY_MS,
      RECONNECT_BASE_DELAY_MS * 2 ** Math.min(4, reconnectAttempt),
    );
    reconnectAttempt += 1;
    emitStatus("reconnecting", { attempt: reconnectAttempt, delayMs: delay });
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = 0;
      connect();
    }, delay);
  }

  function handleServerMessage(payload) {
    const type = String(payload?.type || "").trim().toLowerCase();
    if (!type) return;

    if (type === "authed") {
      authed = true;
      reconnectAttempt = 0;
      emitStatus("authed");
      onAuthed?.(payload);
      syncDesiredLesson();
      return;
    }

    if (type === "joined") {
      joinedLessonId = sanitizeLessonId(payload?.lessonId);
      onJoined?.(payload);
      return;
    }

    if (type === "session_updated") {
      onSessionUpdated?.(payload);
      return;
    }

    if (type === "raised_hands_updated") {
      onRaisedHandsUpdated?.(payload);
      return;
    }

    if (type === "question_created") {
      onQuestionCreated?.(payload);
      return;
    }

    if (type === "error") {
      onError?.(payload);
    }
  }

  function connect() {
    clearReconnectTimer();
    if (closedManually) return;
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const url = resolveTeachingSessionSocketUrl();
    if (!url) return;

    emitStatus("connecting");
    ws = new WebSocket(url);

    ws.onopen = () => {
      emitStatus("open");
      send({
        type: "auth",
        token: authToken,
      });
    };

    ws.onmessage = (event) => {
      const payload = readJsonMessage(event.data);
      if (!payload) return;
      handleServerMessage(payload);
    };

    ws.onerror = () => {
      emitStatus("error");
    };

    ws.onclose = () => {
      ws = null;
      authed = false;
      joinedLessonId = "";
      emitStatus("closed");
      scheduleReconnect();
    };
  }

  function close() {
    closedManually = true;
    clearReconnectTimer();
    authed = false;
    joinedLessonId = "";
    if (!ws) return;
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close(1000, "client_close");
    }
    ws = null;
  }

  function selectLesson(lessonId) {
    desiredLessonId = sanitizeLessonId(lessonId);
    syncDesiredLesson();
  }

  function clearLesson() {
    if (authed && joinedLessonId) {
      send({ type: "leave_lesson", lessonId: joinedLessonId });
    }
    desiredLessonId = "";
    joinedLessonId = "";
  }

  function ping() {
    if (!authed) return;
    send({
      type: "ping",
      at: new Date().toISOString(),
    });
  }

  return {
    connect,
    close,
    selectLesson,
    clearLesson,
    ping,
  };
}

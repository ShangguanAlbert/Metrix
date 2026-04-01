import { getUserToken } from "../../app/authStorage.js";

function authHeaders(extra = {}) {
  const token = getUserToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function readJson(resp) {
  try {
    return await resp.json();
  } catch {
    return {};
  }
}

async function request(path, options = {}) {
  const resp = await fetch(path, {
    method: "GET",
    ...options,
    headers: authHeaders({
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    }),
  });
  const data = await readJson(resp);
  if (!resp.ok) {
    const message = data?.error || data?.message || `请求失败（${resp.status}）`;
    throw new Error(message);
  }
  return data;
}

export function fetchAgentLabAccessStatus() {
  return request("/api/agent-lab/access/status");
}

export function claimAgentLabAccess(code) {
  return request("/api/agent-lab/access/claim", {
    method: "POST",
    body: JSON.stringify({
      code: String(code || "").trim(),
    }),
  });
}

export function fetchAgentLabBootstrap() {
  return request("/api/agent-lab/bootstrap");
}

export function fetchAgentLabMessages(roomId, { limit = 80 } = {}) {
  const safeRoomId = String(roomId || "").trim();
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  const query = params.toString();
  return request(
    `/api/agent-lab/rooms/${encodeURIComponent(safeRoomId)}/messages${query ? `?${query}` : ""}`,
  );
}

export function markAgentLabRoomRead(roomId, { messageId = "" } = {}) {
  const safeRoomId = String(roomId || "").trim();
  return request(`/api/agent-lab/rooms/${encodeURIComponent(safeRoomId)}/read`, {
    method: "POST",
    body: JSON.stringify({
      messageId: String(messageId || "").trim(),
    }),
  });
}

export function sendAgentLabTextMessage(roomId, { content = "", replyToMessageId = "" } = {}) {
  const safeRoomId = String(roomId || "").trim();
  return request(`/api/agent-lab/rooms/${encodeURIComponent(safeRoomId)}/messages/text`, {
    method: "POST",
    body: JSON.stringify({
      content: String(content || ""),
      replyToMessageId: String(replyToMessageId || "").trim(),
    }),
  });
}

export function toggleAgentLabMessageReaction(roomId, messageId, emoji) {
  const safeRoomId = String(roomId || "").trim();
  const safeMessageId = String(messageId || "").trim();
  return request(
    `/api/agent-lab/rooms/${encodeURIComponent(safeRoomId)}/messages/${encodeURIComponent(safeMessageId)}/reactions/toggle`,
    {
      method: "POST",
      body: JSON.stringify({
        emoji: String(emoji || "").trim(),
      }),
    },
  );
}

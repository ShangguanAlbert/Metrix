import { Buffer } from "node:buffer";
import { createAgentLabModels } from "../agent-lab/store.js";

const AGENT_LAB_WS_PATH = "/ws/agent-lab";
const AGENT_LAB_WS_AUTH_TIMEOUT_MS = 10 * 1000;
const AGENT_LAB_WS_MAX_PAYLOAD_BYTES = 128 * 1024;

function sanitizeId(value, fallback = "") {
  const text = String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[.$]/g, "")
    .slice(0, 80);
  return text || fallback;
}

function readJsonMessage(raw) {
  let text = "";
  if (typeof raw === "string") {
    text = raw;
  } else if (Buffer.isBuffer(raw)) {
    text = raw.toString("utf8");
  } else if (raw instanceof ArrayBuffer) {
    text = Buffer.from(raw).toString("utf8");
  } else if (Array.isArray(raw)) {
    try {
      const chunks = raw.map((chunk) => (Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      text = Buffer.concat(chunks).toString("utf8");
    } catch {
      text = "";
    }
  } else {
    text = String(raw || "");
  }
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function sendPayload(socket, payload) {
  if (!socket || socket.readyState !== 1) return false;
  try {
    socket.send(JSON.stringify(payload || {}));
    return true;
  } catch {
    return false;
  }
}

export function createAgentLabRealtimeHub(deps) {
  const {
    WebSocketServer,
    verifyToken,
    AuthUser,
    markUserOnlinePresence,
    mongoose,
  } = deps;
  const { AgentLabRoom, AgentLabAccessGrant } = createAgentLabModels(mongoose);

  const roomSockets = new Map();
  const metaBySocket = new Map();
  const roomOnlineCounts = new Map();
  const socketsByUserId = new Map();

  function getOnlineUserIdsByRoom(roomId) {
    const safeRoomId = sanitizeId(roomId, "");
    const counter = roomOnlineCounts.get(safeRoomId);
    if (!counter) return [];
    return Array.from(counter.entries())
      .filter(([, count]) => Number(count) > 0)
      .map(([userId]) => sanitizeId(userId, ""))
      .filter(Boolean);
  }

  function incrementRoomOnline(roomId, userId) {
    const safeRoomId = sanitizeId(roomId, "");
    const safeUserId = sanitizeId(userId, "");
    if (!safeRoomId || !safeUserId) return;
    const counter = roomOnlineCounts.get(safeRoomId) || new Map();
    counter.set(safeUserId, Number(counter.get(safeUserId) || 0) + 1);
    roomOnlineCounts.set(safeRoomId, counter);
  }

  function decrementRoomOnline(roomId, userId) {
    const safeRoomId = sanitizeId(roomId, "");
    const safeUserId = sanitizeId(userId, "");
    const counter = roomOnlineCounts.get(safeRoomId);
    if (!counter) return;
    const next = Math.max(0, Number(counter.get(safeUserId) || 0) - 1);
    if (next <= 0) {
      counter.delete(safeUserId);
    } else {
      counter.set(safeUserId, next);
    }
    if (counter.size === 0) {
      roomOnlineCounts.delete(safeRoomId);
    } else {
      roomOnlineCounts.set(safeRoomId, counter);
    }
  }

  function attachSocketToUser(socket, userId) {
    const safeUserId = sanitizeId(userId, "");
    if (!safeUserId) return;
    const set = socketsByUserId.get(safeUserId) || new Set();
    set.add(socket);
    socketsByUserId.set(safeUserId, set);
  }

  function detachSocketFromUser(socket, userId) {
    const safeUserId = sanitizeId(userId, "");
    const set = socketsByUserId.get(safeUserId);
    if (!set) return;
    set.delete(socket);
    if (set.size === 0) {
      socketsByUserId.delete(safeUserId);
    }
  }

  function broadcastToRoom(roomId, payload) {
    const safeRoomId = sanitizeId(roomId, "");
    const sockets = roomSockets.get(safeRoomId);
    if (!sockets) return;
    Array.from(sockets).forEach((socket) => {
      sendPayload(socket, payload);
    });
  }

  function broadcastToUser(userId, payload) {
    const safeUserId = sanitizeId(userId, "");
    const sockets = socketsByUserId.get(safeUserId);
    if (!sockets) return;
    Array.from(sockets).forEach((socket) => {
      sendPayload(socket, payload);
    });
  }

  function detachSocketFromRoom(socket, roomId) {
    const safeRoomId = sanitizeId(roomId, "");
    const meta = metaBySocket.get(socket);
    if (!safeRoomId || !meta) return;
    if (!meta.joinedRoomIds.has(safeRoomId)) return;
    meta.joinedRoomIds.delete(safeRoomId);
    const sockets = roomSockets.get(safeRoomId);
    if (sockets) {
      sockets.delete(socket);
      if (sockets.size === 0) {
        roomSockets.delete(safeRoomId);
      }
    }
    decrementRoomOnline(safeRoomId, meta.userId);
    broadcastToRoom(safeRoomId, {
      type: "member_presence_updated",
      roomId: safeRoomId,
      userId: meta.userId,
      onlineMemberUserIds: getOnlineUserIdsByRoom(safeRoomId),
    });
  }

  function detachSocketFromAllRooms(socket) {
    const meta = metaBySocket.get(socket);
    if (!meta) return;
    Array.from(meta.joinedRoomIds).forEach((roomId) => {
      detachSocketFromRoom(socket, roomId);
    });
  }

  async function authenticateSocket(socket, token) {
    const payload = verifyToken(String(token || "").trim());
    if (!payload || payload.scope !== "chat" || !payload.uid) {
      sendPayload(socket, { type: "error", message: "登录状态无效或已过期，请重新登录。" });
      socket.close(1008, "invalid_token");
      return;
    }
    const user = await AuthUser.findById(payload.uid).lean();
    if (!user) {
      sendPayload(socket, { type: "error", message: "账号不存在，请重新登录。" });
      socket.close(1008, "missing_user");
      return;
    }
    const meta = metaBySocket.get(socket);
    if (!meta) return;
    meta.authed = true;
    meta.userId = sanitizeId(user?._id, "");
    meta.user = user;
    if (meta.authTimer) {
      clearTimeout(meta.authTimer);
      meta.authTimer = 0;
    }
    markUserOnlinePresence(user);
    attachSocketToUser(socket, meta.userId);
    sendPayload(socket, {
      type: "authed",
      user: {
        id: meta.userId,
        name: String(user?.profile?.name || user?.username || "用户").trim() || "用户",
      },
    });
  }

  async function canJoinRoom(userId, roomId) {
    const safeUserId = sanitizeId(userId, "");
    const safeRoomId = sanitizeId(roomId, "");
    if (!safeUserId || !safeRoomId) return false;
    const [grant, room] = await Promise.all([
      AgentLabAccessGrant.findOne({ userId: safeUserId }).lean(),
      AgentLabRoom.findById(safeRoomId).lean(),
    ]);
    if (!grant || !room) return false;
    const memberUserIds = Array.isArray(room.memberUserIds) ? room.memberUserIds : [];
    return memberUserIds.includes(safeUserId);
  }

  async function handleJoinRoom(socket, roomId) {
    const meta = metaBySocket.get(socket);
    const safeRoomId = sanitizeId(roomId, "");
    if (!meta?.authed || !meta.userId || !safeRoomId) {
      sendPayload(socket, { type: "error", message: "加入 Agent Lab 房间失败。" });
      return;
    }
    const allowed = await canJoinRoom(meta.userId, safeRoomId);
    if (!allowed) {
      sendPayload(socket, { type: "error", message: "当前无权加入该 Agent Lab 房间。" });
      return;
    }
    if (meta.joinedRoomIds.has(safeRoomId)) {
      sendPayload(socket, { type: "joined", roomId: safeRoomId });
      return;
    }
    meta.joinedRoomIds.add(safeRoomId);
    const sockets = roomSockets.get(safeRoomId) || new Set();
    sockets.add(socket);
    roomSockets.set(safeRoomId, sockets);
    incrementRoomOnline(safeRoomId, meta.userId);
    sendPayload(socket, { type: "joined", roomId: safeRoomId });
    broadcastToRoom(safeRoomId, {
      type: "member_presence_updated",
      roomId: safeRoomId,
      userId: meta.userId,
      onlineMemberUserIds: getOnlineUserIdsByRoom(safeRoomId),
    });
  }

  function closeUserSocketsForUser(userId, code = 4003, reason = "agent_lab_access_revoked") {
    const safeUserId = sanitizeId(userId, "");
    const sockets = socketsByUserId.get(safeUserId);
    if (!sockets) return;
    Array.from(sockets).forEach((socket) => {
      try {
        sendPayload(socket, { type: "error", message: "Agent Lab 访问资格已变更，请重新进入。" });
        socket.close(code, reason);
      } catch {
        // ignore
      }
    });
  }

  function clearRoomSockets(roomId, code = 4000, reason = "agent_lab_room_reset") {
    const safeRoomId = sanitizeId(roomId, "");
    const sockets = roomSockets.get(safeRoomId);
    if (!sockets) return;
    Array.from(sockets).forEach((socket) => {
      try {
        socket.close(code, reason);
      } catch {
        // ignore
      }
    });
    roomSockets.delete(safeRoomId);
    roomOnlineCounts.delete(safeRoomId);
  }

  return {
    initWebSocketServer(server) {
      const wss = new WebSocketServer({
        noServer: true,
        path: AGENT_LAB_WS_PATH,
        maxPayload: AGENT_LAB_WS_MAX_PAYLOAD_BYTES,
      });

      server.on("upgrade", (request, socket, head) => {
        let pathname = "";
        try {
          pathname = new URL(request.url || "", "http://localhost").pathname;
        } catch {
          pathname = "";
        }
        if (pathname !== AGENT_LAB_WS_PATH) return;
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit("connection", ws, request);
        });
      });

      wss.on("connection", (socket) => {
        const authTimer = setTimeout(() => {
          const meta = metaBySocket.get(socket);
          if (!meta?.authed) {
            try {
              sendPayload(socket, { type: "error", message: "Agent Lab 连接鉴权超时。" });
              socket.close(1008, "auth_timeout");
            } catch {
              // ignore
            }
          }
        }, AGENT_LAB_WS_AUTH_TIMEOUT_MS);

        metaBySocket.set(socket, {
          authed: false,
          userId: "",
          user: null,
          joinedRoomIds: new Set(),
          authTimer,
        });

        socket.on("message", async (raw) => {
          const payload = readJsonMessage(raw);
          const type = String(payload?.type || "").trim().toLowerCase();
          if (!type) return;
          if (type === "auth") {
            await authenticateSocket(socket, payload?.token);
            return;
          }
          if (type === "join_room") {
            await handleJoinRoom(socket, payload?.roomId);
            return;
          }
          if (type === "leave_room") {
            detachSocketFromRoom(socket, payload?.roomId);
            return;
          }
          if (type === "ping") {
            sendPayload(socket, { type: "pong", at: new Date().toISOString() });
          }
        });

        socket.on("close", () => {
          clearTimeout(authTimer);
          const meta = metaBySocket.get(socket);
          if (meta?.userId) {
            detachSocketFromUser(socket, meta.userId);
          }
          detachSocketFromAllRooms(socket);
          metaBySocket.delete(socket);
        });

        socket.on("error", () => {
          // ignore socket errors
        });
      });

      return wss;
    },
    getOnlineUserIdsByRoom,
    broadcastMessageCreated(roomId, message) {
      broadcastToRoom(roomId, { type: "message_created", roomId: sanitizeId(roomId, ""), message });
    },
    broadcastMessageReactionsUpdated(roomId, message) {
      broadcastToRoom(roomId, {
        type: "message_reactions_updated",
        roomId: sanitizeId(roomId, ""),
        messageId: sanitizeId(message?.id, ""),
        reactions: Array.isArray(message?.reactions) ? message.reactions : [],
      });
    },
    broadcastRoomUpdated(roomId, room) {
      broadcastToRoom(roomId, { type: "room_updated", roomId: sanitizeId(roomId, ""), room });
    },
    broadcastRoomReadStateUpdated(roomId, readState) {
      broadcastToRoom(roomId, {
        type: "room_read_state_updated",
        roomId: sanitizeId(roomId, ""),
        readState,
      });
    },
    broadcastRoomReset(roomId, room) {
      broadcastToRoom(roomId, {
        type: "room_reset",
        roomId: sanitizeId(roomId, ""),
        room,
        message: "Agent Lab 房间已重置。",
      });
    },
    broadcastShadowSuggestionCreated(userId, shadowSuggestion) {
      broadcastToUser(userId, {
        type: "shadow_suggestion_created",
        userId: sanitizeId(userId, ""),
        shadowSuggestion,
      });
    },
    closeUserSocketsForUser,
    clearRoomSockets,
  };
}

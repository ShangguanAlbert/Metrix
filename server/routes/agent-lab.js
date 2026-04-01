import {
  AGENT_LAB_DEFAULT_ROOM_KEY,
  AGENT_LAB_INVITE_CODE,
  AGENT_LAB_MAX_REACTIONS_PER_MESSAGE,
  AGENT_LAB_REPLY_PREVIEW_MAX_LENGTH,
  AGENT_LAB_SETTINGS_KEY,
  buildAgentLabDisplayName,
  buildAgentLabPublicSettings,
  createAgentLabModels,
  ensureAgentLabDefaultRoom,
  ensureAgentLabMember,
  ensureAgentLabSettings,
  normalizeAgentLabAccessGrantDoc,
  normalizeAgentLabMessageDoc,
  normalizeAgentLabMessageReactions,
  normalizeAgentLabRoomDoc,
  normalizeAgentLabShadowSuggestion,
  readAgentLabUsersByIds,
  sanitizeAgentLabMessageText,
  sanitizeAgentLabTaskConfigPayload,
  sanitizeAgentLabSettingsPayload,
  sanitizeFetchMessagesLimit,
  updateAgentLabRoomReadState,
} from "../agent-lab/store.js";
import { runAgentLabAiTurn } from "../agent-lab/ai-orchestrator.js";

function sanitizeId(value, fallback = "") {
  const text = String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[.$]/g, "")
    .slice(0, 80);
  return text || fallback;
}

function buildReadStatePayload(roomDoc, userId) {
  const safeUserId = sanitizeId(userId, "");
  const readStates = Array.isArray(roomDoc?.readStates) ? roomDoc.readStates : [];
  const matched = readStates.find((item) => String(item?.userId || "") === safeUserId);
  if (!matched) return null;
  return {
    userId: safeUserId,
    lastReadMessageId: String(matched?.lastReadMessageId || "").trim(),
    updatedAt: matched?.updatedAt ? new Date(matched.updatedAt).toISOString() : "",
  };
}

async function resolveAgentLabReplyMeta({ AgentLabMessage, roomId, rawReplyToMessageId }) {
  const replyToMessageId = sanitizeId(rawReplyToMessageId, "");
  const safeRoomId = sanitizeId(roomId, "");
  if (!replyToMessageId || !safeRoomId) {
    return {
      replyToMessageId: "",
      replyPreviewText: "",
      replySenderName: "",
    };
  }
  const replyDoc = await AgentLabMessage.findOne(
    { _id: replyToMessageId, roomId: safeRoomId },
    {
      content: 1,
      senderName: 1,
    },
  ).lean();
  if (!replyDoc) {
    return {
      replyToMessageId: "",
      replyPreviewText: "",
      replySenderName: "",
    };
  }
  return {
    replyToMessageId,
    replyPreviewText: String(replyDoc?.content || "").trim().slice(0, AGENT_LAB_REPLY_PREVIEW_MAX_LENGTH),
    replySenderName: String(replyDoc?.senderName || "用户").trim().slice(0, 60),
  };
}

export function registerAgentLabRoutes(app, deps) {
  const {
    mongoose,
    AuthUser,
    requireChatAuth,
    requireAdminAuth,
    agentLabRealtimeHub,
  } = deps;
  const {
    AgentLabRoom,
    AgentLabMessage,
    AgentLabAccessGrant,
    AgentLabSettings,
    AgentLabStoredFile,
  } = createAgentLabModels(mongoose);

  async function readAccessGrant(userId) {
    const safeUserId = sanitizeId(userId, "");
    if (!safeUserId) return null;
    return AgentLabAccessGrant.findOne({ userId: safeUserId }).lean();
  }

  async function ensureAuthorizedRoom(userId) {
    const safeUserId = sanitizeId(userId, "");
    if (!safeUserId) {
      return { accessGrant: null, room: null, joined: false };
    }
    const accessGrant = await readAccessGrant(safeUserId);
    if (!accessGrant) {
      return { accessGrant: null, room: null, joined: false };
    }
    const baseRoom = await ensureAgentLabDefaultRoom({ AgentLabRoom });
    const membership = await ensureAgentLabMember({
      AgentLabRoom,
      roomId: String(baseRoom?._id || ""),
      userId: safeUserId,
    });
    return {
      accessGrant,
      room: membership.room || baseRoom,
      joined: membership.joined,
    };
  }

  async function assertAgentLabAccess(req, res) {
    const userId = sanitizeId(req.authUser?._id, "");
    if (!userId) {
      res.status(400).json({ error: "无效用户身份。" });
      return null;
    }
    const roomBundle = await ensureAuthorizedRoom(userId);
    if (!roomBundle.accessGrant) {
      res.status(403).json({ error: "当前账号尚未开通 Agent Lab 访问资格。" });
      return null;
    }
    if (!roomBundle.room) {
      res.status(500).json({ error: "Agent Lab 默认实验群初始化失败，请稍后重试。" });
      return null;
    }
    if (roomBundle.joined) {
      const normalizedRoom = normalizeAgentLabRoomDoc(roomBundle.room, {
        viewerUserId: userId,
        onlineMemberUserIds: agentLabRealtimeHub.getOnlineUserIdsByRoom(String(roomBundle.room?._id || "")),
      });
      agentLabRealtimeHub.broadcastRoomUpdated(String(roomBundle.room?._id || ""), normalizedRoom);
    }
    return roomBundle;
  }

  async function buildBootstrapResponse(req, roomDoc, accessGrantDoc) {
    const userId = sanitizeId(req.authUser?._id, "");
    const settingsDoc = await ensureAgentLabSettings({ AgentLabSettings });
    const normalizedRoom = normalizeAgentLabRoomDoc(roomDoc, {
      viewerUserId: userId,
      onlineMemberUserIds: agentLabRealtimeHub.getOnlineUserIdsByRoom(String(roomDoc?._id || "")),
    });
    const users = await readAgentLabUsersByIds({
      AuthUser,
      userIds: normalizedRoom?.memberUserIds || [],
    });
    return {
      ok: true,
      me: {
        id: userId,
        name: buildAgentLabDisplayName(req.authUser),
        role: String(req.authUser?.role || "user").trim().toLowerCase() || "user",
      },
      access: normalizeAgentLabAccessGrantDoc(accessGrantDoc, req.authUser),
      shadowSuggestion: normalizeAgentLabShadowSuggestion(accessGrantDoc?.lastShadowSuggestion),
      room: normalizedRoom,
      users,
      settings: buildAgentLabPublicSettings(settingsDoc),
    };
  }

  async function runAgentLabAiFollowup({
    roomId,
    room,
    userId,
    authStorageUserId,
    authTeacherScopeKey,
    userMessage,
  }) {
    try {
      const settingsDoc = await ensureAgentLabSettings({ AgentLabSettings });
      const recentDocs = await AgentLabMessage.find({ roomId })
        .sort({ createdAt: 1 })
        .limit(24)
        .lean();
      const recentMessages = recentDocs.map((item) => normalizeAgentLabMessageDoc(item)).filter(Boolean);
      const aiTurn = await runAgentLabAiTurn({
        deps,
        settings: settingsDoc,
        room,
        messages: recentMessages,
        userMessage,
        chatUserId: userId,
        chatStorageUserId: authStorageUserId,
        teacherScopeKey: authTeacherScopeKey,
      });

      if (aiTurn?.shadowSuggestion?.content) {
        const normalizedShadowSuggestion = normalizeAgentLabShadowSuggestion(aiTurn.shadowSuggestion);
        if (normalizedShadowSuggestion) {
          await AgentLabAccessGrant.findOneAndUpdate(
            { userId },
            {
              $set: {
                lastShadowSuggestion: normalizedShadowSuggestion,
                updatedAt: new Date(),
              },
            },
            { new: true },
          );
          agentLabRealtimeHub.broadcastShadowSuggestionCreated(userId, normalizedShadowSuggestion);
        }
      }

      if (aiTurn?.assistantMessageDraft?.content) {
        const assistantDoc = await AgentLabMessage.create({
          roomId,
          type: "assistant",
          senderUserId: "agent-lab-assistant",
          senderName: "Agent Lab",
          content: aiTurn.assistantMessageDraft.content,
          aiMeta: aiTurn.assistantMessageDraft.aiMeta,
        });
        const assistantMessage = normalizeAgentLabMessageDoc(assistantDoc);
        const updatedRoom = await AgentLabRoom.findByIdAndUpdate(
          roomId,
          {
            $set: {
              updatedAt: new Date(),
              lastAgentAt: new Date(),
            },
          },
          { new: true },
        );
        agentLabRealtimeHub.broadcastMessageCreated(roomId, assistantMessage);
        agentLabRealtimeHub.broadcastRoomUpdated(
          roomId,
          normalizeAgentLabRoomDoc(updatedRoom, {
            viewerUserId: userId,
            onlineMemberUserIds: agentLabRealtimeHub.getOnlineUserIdsByRoom(roomId),
          }),
        );
      }
    } catch (error) {
      console.error("[agent-lab] async ai follow-up failed:", error);
    }
  }

  app.get("/api/agent-lab/access/status", requireChatAuth, async (req, res) => {
    const userId = sanitizeId(req.authUser?._id, "");
    if (!userId) {
      res.status(400).json({ error: "无效用户身份。" });
      return;
    }
    try {
      const accessGrant = await readAccessGrant(userId);
      res.json({
        ok: true,
        granted: !!accessGrant,
        access: normalizeAgentLabAccessGrantDoc(accessGrant, req.authUser),
      });
    } catch (error) {
      res.status(500).json({
        error: error?.message || "读取 Agent Lab 资格失败，请稍后重试。",
      });
    }
  });

  app.post("/api/agent-lab/access/claim", requireChatAuth, async (req, res) => {
    const userId = sanitizeId(req.authUser?._id, "");
    const inviteCode = String(req.body?.code || "").trim();
    if (!userId) {
      res.status(400).json({ error: "无效用户身份。" });
      return;
    }
    if (inviteCode !== AGENT_LAB_INVITE_CODE) {
      res.status(403).json({ error: "邀请码无效，请核对后重试。" });
      return;
    }

    try {
      const accessGrant = await AgentLabAccessGrant.findOneAndUpdate(
        { userId },
        {
          $set: {
            code: AGENT_LAB_INVITE_CODE,
            claimedAt: new Date(),
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      );
      const roomBundle = await ensureAuthorizedRoom(userId);
      const payload = await buildBootstrapResponse(req, roomBundle.room, accessGrant);
      res.json(payload);
    } catch (error) {
      res.status(500).json({
        error: error?.message || "开通 Agent Lab 资格失败，请稍后重试。",
      });
    }
  });

  app.get("/api/agent-lab/bootstrap", requireChatAuth, async (req, res) => {
    try {
      const bundle = await assertAgentLabAccess(req, res);
      if (!bundle) return;
      const payload = await buildBootstrapResponse(req, bundle.room, bundle.accessGrant);
      res.json(payload);
    } catch (error) {
      res.status(500).json({
        error: error?.message || "读取 Agent Lab 数据失败，请稍后重试。",
      });
    }
  });

  app.get("/api/agent-lab/rooms/:roomId/messages", requireChatAuth, async (req, res) => {
    const roomId = sanitizeId(req.params?.roomId, "");
    if (!roomId) {
      res.status(400).json({ error: "无效 Agent Lab 房间 ID。" });
      return;
    }

    try {
      const bundle = await assertAgentLabAccess(req, res);
      if (!bundle) return;
      if (String(bundle.room?._id || "") !== roomId) {
        res.status(404).json({ error: "未找到该 Agent Lab 房间。" });
        return;
      }
      const limit = sanitizeFetchMessagesLimit(req.query?.limit);
      const docs = await AgentLabMessage.find({ roomId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      const messages = docs
        .map((item) => normalizeAgentLabMessageDoc(item))
        .filter(Boolean)
        .reverse();
      res.json({
        ok: true,
        messages,
      });
    } catch (error) {
      res.status(500).json({
        error: error?.message || "读取 Agent Lab 消息失败，请稍后重试。",
      });
    }
  });

  app.post("/api/agent-lab/rooms/:roomId/read", requireChatAuth, async (req, res) => {
    const roomId = sanitizeId(req.params?.roomId, "");
    const messageId = sanitizeId(req.body?.messageId, "");
    const userId = sanitizeId(req.authUser?._id, "");
    if (!roomId || !userId) {
      res.status(400).json({ error: "无效参数。" });
      return;
    }

    try {
      const bundle = await assertAgentLabAccess(req, res);
      if (!bundle) return;
      if (String(bundle.room?._id || "") !== roomId) {
        res.status(404).json({ error: "未找到该 Agent Lab 房间。" });
        return;
      }
      const updatedRoom = await updateAgentLabRoomReadState({
        AgentLabRoom,
        roomId,
        userId,
        messageId,
      });
      const readState = buildReadStatePayload(updatedRoom, userId);
      if (readState) {
        agentLabRealtimeHub.broadcastRoomReadStateUpdated(roomId, readState);
      }
      res.json({
        ok: true,
        readState,
      });
    } catch (error) {
      res.status(500).json({
        error: error?.message || "同步 Agent Lab 已读状态失败，请稍后重试。",
      });
    }
  });

  app.post("/api/agent-lab/rooms/:roomId/messages/text", requireChatAuth, async (req, res) => {
    const roomId = sanitizeId(req.params?.roomId, "");
    const userId = sanitizeId(req.authUser?._id, "");
    const content = sanitizeAgentLabMessageText(req.body?.content);
    const rawReplyToMessageId = sanitizeId(req.body?.replyToMessageId, "");
    if (!roomId || !userId) {
      res.status(400).json({ error: "无效参数。" });
      return;
    }
    if (!content) {
      res.status(400).json({ error: "消息不能为空。" });
      return;
    }

    try {
      const bundle = await assertAgentLabAccess(req, res);
      if (!bundle) return;
      if (String(bundle.room?._id || "") !== roomId) {
        res.status(404).json({ error: "未找到该 Agent Lab 房间。" });
        return;
      }

      const senderName = buildAgentLabDisplayName(req.authUser);
      const replyMeta = await resolveAgentLabReplyMeta({
        AgentLabMessage,
        roomId,
        rawReplyToMessageId,
      });
      const messageDoc = await AgentLabMessage.create({
        roomId,
        type: "text",
        senderUserId: userId,
        senderName,
        content,
        replyToMessageId: replyMeta.replyToMessageId,
        replyPreviewText: replyMeta.replyPreviewText,
        replySenderName: replyMeta.replySenderName,
      });
      const normalizedMessage = normalizeAgentLabMessageDoc(messageDoc);
      await AgentLabRoom.findByIdAndUpdate(roomId, {
        $set: { updatedAt: new Date() },
      });
      const roomAfterRead = await updateAgentLabRoomReadState({
        AgentLabRoom,
        roomId,
        userId,
        messageId: String(messageDoc?._id || ""),
      });
      const normalizedRoom = normalizeAgentLabRoomDoc(roomAfterRead || bundle.room, {
        viewerUserId: userId,
        onlineMemberUserIds: agentLabRealtimeHub.getOnlineUserIdsByRoom(roomId),
      });

      agentLabRealtimeHub.broadcastMessageCreated(roomId, normalizedMessage);
      agentLabRealtimeHub.broadcastRoomUpdated(roomId, normalizedRoom);
      const readState = buildReadStatePayload(roomAfterRead, userId);
      if (readState) {
        agentLabRealtimeHub.broadcastRoomReadStateUpdated(roomId, readState);
      }

      const settingsDoc = await ensureAgentLabSettings({ AgentLabSettings });
      const normalizedSettings = buildAgentLabPublicSettings(settingsDoc);
      const followupMode = normalizedSettings.proactiveSpeechEnabled
        ? "assistant"
        : normalizedSettings.shadowModeratorEnabled
          ? "shadow"
          : "none";

      res.json({
        ok: true,
        message: normalizedMessage,
        followupMode,
      });

      void runAgentLabAiFollowup({
        roomId,
        room: normalizedRoom,
        userId,
        authStorageUserId: String(req.authStorageUserId || ""),
        authTeacherScopeKey: req.authTeacherScopeKey,
        userMessage: normalizedMessage,
      });
    } catch (error) {
      res.status(500).json({
        error: error?.message || "发送 Agent Lab 消息失败，请稍后重试。",
      });
    }
  });

  app.post(
    "/api/agent-lab/rooms/:roomId/messages/:messageId/reactions/toggle",
    requireChatAuth,
    async (req, res) => {
      const roomId = sanitizeId(req.params?.roomId, "");
      const messageId = sanitizeId(req.params?.messageId, "");
      const userId = sanitizeId(req.authUser?._id, "");
      const emoji = String(req.body?.emoji || "").trim().slice(0, 24);
      if (!roomId || !messageId || !userId || !emoji) {
        res.status(400).json({ error: "无效参数。" });
        return;
      }

      try {
        const bundle = await assertAgentLabAccess(req, res);
        if (!bundle) return;
        if (String(bundle.room?._id || "") !== roomId) {
          res.status(404).json({ error: "未找到该 Agent Lab 房间。" });
          return;
        }

        const messageDoc = await AgentLabMessage.findOne({ _id: messageId, roomId });
        if (!messageDoc) {
          res.status(404).json({ error: "未找到该条 Agent Lab 消息。" });
          return;
        }
        if (String(messageDoc?.type || "").trim().toLowerCase() === "system") {
          res.status(400).json({ error: "系统消息不支持表情回复。" });
          return;
        }

        const currentReactions = normalizeAgentLabMessageReactions(messageDoc.reactions);
        const currentByUser = new Map(currentReactions.map((item) => [String(item.userId || ""), item]));
        const existing = currentByUser.get(userId);
        if (existing && existing.emoji === emoji) {
          currentByUser.delete(userId);
        } else {
          currentByUser.set(userId, {
            userId,
            userName: buildAgentLabDisplayName(req.authUser),
            emoji,
            createdAt: new Date().toISOString(),
          });
        }

        const nextReactions = Array.from(currentByUser.values())
          .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
          .slice(-AGENT_LAB_MAX_REACTIONS_PER_MESSAGE);

        messageDoc.reactions = nextReactions.map((item) => ({
          userId: item.userId,
          userName: item.userName,
          emoji: item.emoji,
          createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
        }));
        await messageDoc.save();

        const normalizedMessage = normalizeAgentLabMessageDoc(messageDoc);
        agentLabRealtimeHub.broadcastMessageReactionsUpdated(roomId, normalizedMessage);
        res.json({
          ok: true,
          messageId,
          reactions: normalizedMessage?.reactions || [],
        });
      } catch (error) {
        res.status(500).json({
          error: error?.message || "表情回复失败，请稍后重试。",
        });
      }
    },
  );

  app.get("/api/auth/admin/agent-lab/overview", requireAdminAuth, async (_req, res) => {
    try {
      const [roomDoc, settingsDoc, accessGrantCount] = await Promise.all([
        ensureAgentLabDefaultRoom({ AgentLabRoom }),
        ensureAgentLabSettings({ AgentLabSettings }),
        AgentLabAccessGrant.countDocuments({}),
      ]);
      const roomId = String(roomDoc?._id || "");
      const [messageCount, users] = await Promise.all([
        roomId ? AgentLabMessage.countDocuments({ roomId }) : 0,
        readAgentLabUsersByIds({
          AuthUser,
          userIds: Array.isArray(roomDoc?.memberUserIds) ? roomDoc.memberUserIds : [],
        }),
      ]);
      const normalizedRoom = normalizeAgentLabRoomDoc(roomDoc, {
        onlineMemberUserIds: agentLabRealtimeHub.getOnlineUserIdsByRoom(roomId),
      });
      res.json({
        ok: true,
        generatedAt: new Date().toISOString(),
        room: normalizedRoom,
        users,
        settings: buildAgentLabPublicSettings(settingsDoc),
        counts: {
          accessGrantCount,
          messageCount,
          onlineCount: normalizedRoom?.onlineMemberUserIds?.length || 0,
          memberCount: normalizedRoom?.memberCount || 0,
        },
      });
    } catch (error) {
      res.status(500).json({
        error: error?.message || "读取 Agent Lab 后台概览失败，请稍后重试。",
      });
    }
  });

  app.get("/api/auth/admin/agent-lab/access-grants", requireAdminAuth, async (_req, res) => {
    try {
      const grants = await AgentLabAccessGrant.find({}).sort({ createdAt: -1 }).lean();
      const users = await AuthUser.find(
        {
          _id: {
            $in: grants.map((item) => sanitizeId(item?.userId, "")).filter(Boolean),
          },
        },
        {
          username: 1,
          role: 1,
          profile: 1,
        },
      ).lean();
      const userMap = new Map(users.map((user) => [sanitizeId(user?._id, ""), user]));
      res.json({
        ok: true,
        grants: grants
          .map((item) => normalizeAgentLabAccessGrantDoc(item, userMap.get(sanitizeId(item?.userId, ""))))
          .filter(Boolean),
      });
    } catch (error) {
      res.status(500).json({
        error: error?.message || "读取 Agent Lab 邀请名单失败，请稍后重试。",
      });
    }
  });

  app.delete("/api/auth/admin/agent-lab/access-grants/:userId", requireAdminAuth, async (req, res) => {
    const userId = sanitizeId(req.params?.userId, "");
    if (!userId) {
      res.status(400).json({ error: "无效用户 ID。" });
      return;
    }

    try {
      await AgentLabAccessGrant.deleteOne({ userId });
      const roomDoc = await ensureAgentLabDefaultRoom({ AgentLabRoom });
      const roomId = String(roomDoc?._id || "");
      let updatedRoom = await AgentLabRoom.findByIdAndUpdate(
        roomId,
        {
          $pull: {
            memberUserIds: userId,
            readStates: { userId },
          },
          $set: { updatedAt: new Date() },
        },
        { new: true },
      );
      if (updatedRoom) {
        updatedRoom = await AgentLabRoom.findByIdAndUpdate(
          roomId,
          {
            $set: {
              memberCount: Array.isArray(updatedRoom.memberUserIds) ? updatedRoom.memberUserIds.length : 0,
            },
          },
          { new: true },
        );
      }
      agentLabRealtimeHub.closeUserSocketsForUser(userId);
      agentLabRealtimeHub.broadcastRoomUpdated(
        roomId,
        normalizeAgentLabRoomDoc(updatedRoom, {
          onlineMemberUserIds: agentLabRealtimeHub.getOnlineUserIdsByRoom(roomId),
        }),
      );
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({
        error: error?.message || "撤销 Agent Lab 资格失败，请稍后重试。",
      });
    }
  });

  app.post("/api/auth/admin/agent-lab/room/reset", requireAdminAuth, async (_req, res) => {
    try {
      const roomDoc = await ensureAgentLabDefaultRoom({ AgentLabRoom });
      const roomId = String(roomDoc?._id || "");
      await Promise.all([
        AgentLabMessage.deleteMany({ roomId }),
        AgentLabStoredFile.deleteMany({ roomId }),
      ]);
      const updatedRoom = await AgentLabRoom.findByIdAndUpdate(
        roomId,
        {
          $set: {
            memberUserIds: [],
            memberCount: 0,
            readStates: [],
            updatedAt: new Date(),
            lastAgentAt: null,
          },
        },
        { new: true },
      );
      const normalizedRoom = normalizeAgentLabRoomDoc(updatedRoom, {
        onlineMemberUserIds: [],
      });
      agentLabRealtimeHub.broadcastRoomReset(roomId, normalizedRoom);
      agentLabRealtimeHub.clearRoomSockets(roomId);
      res.json({
        ok: true,
        room: normalizedRoom,
      });
    } catch (error) {
      res.status(500).json({
        error: error?.message || "重置 Agent Lab 房间失败，请稍后重试。",
      });
    }
  });

  app.put("/api/auth/admin/agent-lab/room", requireAdminAuth, async (req, res) => {
    try {
      const roomDoc = await ensureAgentLabDefaultRoom({ AgentLabRoom });
      const roomId = String(roomDoc?._id || "");
      const taskConfig = sanitizeAgentLabTaskConfigPayload(req.body?.taskConfig);
      const updatedRoom = await AgentLabRoom.findByIdAndUpdate(
        roomId,
        {
          $set: {
            taskConfig,
            updatedAt: new Date(),
          },
        },
        { new: true },
      );
      const normalizedRoom = normalizeAgentLabRoomDoc(updatedRoom, {
        onlineMemberUserIds: agentLabRealtimeHub.getOnlineUserIdsByRoom(roomId),
      });
      agentLabRealtimeHub.broadcastRoomUpdated(roomId, normalizedRoom);
      res.json({
        ok: true,
        room: normalizedRoom,
      });
    } catch (error) {
      res.status(500).json({
        error: error?.message || "保存 Agent Lab 课程任务失败，请稍后重试。",
      });
    }
  });

  app.get("/api/auth/admin/agent-lab/settings", requireAdminAuth, async (_req, res) => {
    try {
      const settings = await ensureAgentLabSettings({ AgentLabSettings });
      res.json({
        ok: true,
        settings: buildAgentLabPublicSettings(settings),
      });
    } catch (error) {
      res.status(500).json({
        error: error?.message || "读取 Agent Lab 设置失败，请稍后重试。",
      });
    }
  });

  app.put("/api/auth/admin/agent-lab/settings", requireAdminAuth, async (req, res) => {
    try {
      const payload = sanitizeAgentLabSettingsPayload(req.body);
      const settings = await AgentLabSettings.findOneAndUpdate(
        { key: AGENT_LAB_SETTINGS_KEY },
        {
          $set: {
            key: AGENT_LAB_SETTINGS_KEY,
            ...payload,
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      );
      res.json({
        ok: true,
        settings: buildAgentLabPublicSettings(settings),
      });
    } catch (error) {
      res.status(500).json({
        error: error?.message || "保存 Agent Lab 设置失败，请稍后重试。",
      });
    }
  });
}

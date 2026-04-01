import { Buffer } from "node:buffer";

export const AGENT_LAB_INVITE_CODE = "HZNU2026-agent";
export const AGENT_LAB_DEFAULT_ROOM_KEY = "default";
export const AGENT_LAB_DEFAULT_ROOM_NAME = "Agent Lab 测试群";
export const AGENT_LAB_SETTINGS_KEY = "default";
export const AGENT_LAB_MESSAGE_TEXT_MAX_LENGTH = 4000;
export const AGENT_LAB_REPLY_PREVIEW_MAX_LENGTH = 120;
export const AGENT_LAB_FETCH_MESSAGES_LIMIT_DEFAULT = 80;
export const AGENT_LAB_FETCH_MESSAGES_LIMIT_MAX = 200;
export const AGENT_LAB_MAX_REACTIONS_PER_MESSAGE = 32;
export const AGENT_LAB_MODE_PRESETS = Object.freeze([
  { value: "classroom_host", label: "课堂主持" },
  { value: "learning_companion", label: "学习陪伴" },
  { value: "community_manager", label: "通用社群" },
]);
export const AGENT_LAB_PROACTIVITY_LEVELS = Object.freeze([
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
]);

const AGENT_LAB_TASK_LIST_MAX_ITEMS = 8;

function sanitizeId(value, fallback = "") {
  const text = String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[.$]/g, "")
    .slice(0, 80);
  return text || fallback;
}

function sanitizeText(value, fallback = "", maxLength = 2000) {
  const text = String(value || "").replace(/\r\n/g, "\n").trim().slice(0, maxLength);
  return text || fallback;
}

function sanitizeOptionalText(value, maxLength = 2000) {
  return String(value || "").replace(/\r\n/g, "\n").trim().slice(0, maxLength);
}

function sanitizeStringList(value, { maxItems = AGENT_LAB_TASK_LIST_MAX_ITEMS, maxLength = 240 } = {}) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => sanitizeOptionalText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function sanitizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return fallback;
}

function sanitizeInteger(value, fallback, min, max) {
  const num = Number.parseInt(String(value || "").trim(), 10);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

function sanitizeIsoDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

function sanitizeModePreset(value, fallback = "classroom_host") {
  const text = sanitizeText(value, "", 40).toLowerCase();
  const allowed = new Set(AGENT_LAB_MODE_PRESETS.map((item) => item.value));
  return allowed.has(text) ? text : fallback;
}

function sanitizeProactivityLevel(value, fallback = "medium") {
  const text = sanitizeText(value, "", 20).toLowerCase();
  const allowed = new Set(AGENT_LAB_PROACTIVITY_LEVELS.map((item) => item.value));
  return allowed.has(text) ? text : fallback;
}

export function buildAgentLabDisplayName(user) {
  const profileName = sanitizeText(user?.profile?.name, "", 40);
  if (profileName) return profileName;
  return sanitizeText(user?.username, "用户", 40);
}

export function buildDefaultAgentLabSettings() {
  return {
    shadowModeratorEnabled: true,
    proactiveSpeechEnabled: false,
    proactivityLevel: "medium",
    modePreset: "classroom_host",
    silenceTriggerMs: 3 * 60 * 1000,
    repeatWindowMessages: 6,
    stageSummaryMessageCount: 8,
    systemPersonaPrompt: "",
    baseAgentId: "A",
  };
}

export function normalizeAgentLabSettingsDoc(doc) {
  const defaults = buildDefaultAgentLabSettings();
  const source = doc && typeof doc === "object" ? doc : {};
  return {
    key: sanitizeText(source.key, AGENT_LAB_SETTINGS_KEY, 60),
    shadowModeratorEnabled: sanitizeBoolean(
      source.shadowModeratorEnabled,
      defaults.shadowModeratorEnabled,
    ),
    proactiveSpeechEnabled: sanitizeBoolean(
      source.proactiveSpeechEnabled,
      defaults.proactiveSpeechEnabled,
    ),
    proactivityLevel: sanitizeProactivityLevel(source.proactivityLevel, defaults.proactivityLevel),
    modePreset: sanitizeModePreset(source.modePreset, defaults.modePreset),
    silenceTriggerMs: sanitizeInteger(source.silenceTriggerMs, defaults.silenceTriggerMs, 15_000, 24 * 60 * 60 * 1000),
    repeatWindowMessages: sanitizeInteger(
      source.repeatWindowMessages,
      defaults.repeatWindowMessages,
      2,
      20,
    ),
    stageSummaryMessageCount: sanitizeInteger(
      source.stageSummaryMessageCount,
      defaults.stageSummaryMessageCount,
      2,
      50,
    ),
    systemPersonaPrompt: sanitizeOptionalText(
      source.systemPersonaPrompt,
      4000,
    ),
    baseAgentId: sanitizeText(source.baseAgentId, defaults.baseAgentId, 10).toUpperCase(),
  };
}

export function sanitizeAgentLabSettingsPayload(payload) {
  return normalizeAgentLabSettingsDoc({
    key: AGENT_LAB_SETTINGS_KEY,
    ...(payload && typeof payload === "object" ? payload : {}),
  });
}

export function buildAgentLabPublicSettings(settings) {
  const normalized = normalizeAgentLabSettingsDoc(settings);
  return {
    shadowModeratorEnabled: normalized.shadowModeratorEnabled,
    proactiveSpeechEnabled: normalized.proactiveSpeechEnabled,
    proactivityLevel: normalized.proactivityLevel,
    modePreset: normalized.modePreset,
    silenceTriggerMs: normalized.silenceTriggerMs,
    repeatWindowMessages: normalized.repeatWindowMessages,
    stageSummaryMessageCount: normalized.stageSummaryMessageCount,
    systemPersonaPrompt: normalized.systemPersonaPrompt,
  };
}

export function sanitizeAgentLabMessageText(value) {
  return sanitizeOptionalText(value, AGENT_LAB_MESSAGE_TEXT_MAX_LENGTH);
}

export function normalizeAgentLabMessageReactions(rawReactions) {
  if (!Array.isArray(rawReactions)) return [];
  const byUser = new Map();
  rawReactions.forEach((item) => {
    const userId = sanitizeId(item?.userId, "");
    const userName = sanitizeText(item?.userName, "", 60);
    const emoji = sanitizeText(item?.emoji, "", 24);
    const createdAt = sanitizeIsoDate(item?.createdAt);
    if (!userId || !emoji) return;
    byUser.set(userId, {
      userId,
      userName: userName || "用户",
      emoji,
      createdAt,
    });
  });
  return Array.from(byUser.values())
    .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
    .slice(-AGENT_LAB_MAX_REACTIONS_PER_MESSAGE);
}

export function normalizeAgentLabRoomDoc(doc, { viewerUserId = "", onlineMemberUserIds = [] } = {}) {
  if (!doc) return null;
  const id = sanitizeId(doc?._id, "");
  if (!id) return null;
  const memberUserIds = Array.isArray(doc?.memberUserIds)
    ? Array.from(
        new Set(doc.memberUserIds.map((item) => sanitizeId(item, "")).filter(Boolean)),
      )
    : [];
  const safeViewerUserId = sanitizeId(viewerUserId, "");
  const onlineIds = Array.from(
    new Set((Array.isArray(onlineMemberUserIds) ? onlineMemberUserIds : []).map((item) => sanitizeId(item, "")).filter(Boolean)),
  ).filter((userId) => memberUserIds.includes(userId));
  const room = {
    id,
    roomKey: sanitizeText(doc?.roomKey, AGENT_LAB_DEFAULT_ROOM_KEY, 40),
    name: sanitizeText(doc?.name, AGENT_LAB_DEFAULT_ROOM_NAME, 80),
    description: sanitizeOptionalText(doc?.description, 240),
    taskConfig: normalizeAgentLabTaskConfig(doc?.taskConfig),
    memberUserIds,
    memberCount: Math.max(
      memberUserIds.length,
      sanitizeInteger(doc?.memberCount, memberUserIds.length || 0, 0, 9999),
    ),
    onlineMemberUserIds: onlineIds,
    lastAgentAt: sanitizeIsoDate(doc?.lastAgentAt),
    createdAt: sanitizeIsoDate(doc?.createdAt),
    updatedAt: sanitizeIsoDate(doc?.updatedAt),
  };
  if (safeViewerUserId && memberUserIds.includes(safeViewerUserId)) {
    room.readStates = Array.isArray(doc?.readStates)
      ? doc.readStates
          .map((item) => ({
            userId: sanitizeId(item?.userId, ""),
            lastReadMessageId: sanitizeId(item?.lastReadMessageId, ""),
            updatedAt: sanitizeIsoDate(item?.updatedAt),
          }))
          .filter((item) => item.userId && memberUserIds.includes(item.userId))
      : [];
  }
  return room;
}

export function buildDefaultAgentLabTaskConfig() {
  return {
    title: "Agent Lab 课程任务",
    objective: "",
    requirements: [],
    expectedOutputs: [],
  };
}

export function normalizeAgentLabTaskConfig(value) {
  const defaults = buildDefaultAgentLabTaskConfig();
  const source = value && typeof value === "object" ? value : {};
  return {
    title: sanitizeText(source.title, defaults.title, 80),
    objective: sanitizeOptionalText(source.objective, 1000),
    requirements: sanitizeStringList(source.requirements, { maxItems: 8, maxLength: 240 }),
    expectedOutputs: sanitizeStringList(source.expectedOutputs, { maxItems: 8, maxLength: 240 }),
  };
}

export function sanitizeAgentLabTaskConfigPayload(payload) {
  return normalizeAgentLabTaskConfig(payload);
}

export function normalizeAgentLabMessageDoc(doc) {
  if (!doc) return null;
  const id = sanitizeId(doc?._id, "");
  const roomId = sanitizeId(doc?.roomId, "");
  if (!id || !roomId) return null;
  const type = sanitizeText(doc?.type, "text", 20).toLowerCase();
  return {
    id,
    roomId,
    type,
    senderUserId: sanitizeId(doc?.senderUserId, ""),
    senderName: sanitizeText(doc?.senderName, type === "assistant" ? "Agent Lab" : "用户", 60),
    content: sanitizeOptionalText(doc?.content, AGENT_LAB_MESSAGE_TEXT_MAX_LENGTH),
    replyToMessageId: sanitizeId(doc?.replyToMessageId, ""),
    replyPreviewText: sanitizeText(doc?.replyPreviewText, "", AGENT_LAB_REPLY_PREVIEW_MAX_LENGTH),
    replySenderName: sanitizeText(doc?.replySenderName, "", 60),
    createdAt: sanitizeIsoDate(doc?.createdAt),
    reactions: normalizeAgentLabMessageReactions(doc?.reactions),
    aiMeta:
      doc?.aiMeta && typeof doc.aiMeta === "object"
        ? {
            modePreset: sanitizeModePreset(doc.aiMeta.modePreset, "classroom_host"),
            proactivityLevel: sanitizeProactivityLevel(doc.aiMeta.proactivityLevel, "medium"),
            triggerReasons: Array.isArray(doc.aiMeta.triggerReasons)
              ? doc.aiMeta.triggerReasons.map((item) => sanitizeText(item, "", 40)).filter(Boolean)
              : [],
            reasoningApplied: sanitizeText(doc.aiMeta.reasoningApplied, "", 20),
            provider: sanitizeText(doc.aiMeta.provider, "", 40),
            model: sanitizeText(doc.aiMeta.model, "", 120),
            shadow: sanitizeBoolean(doc.aiMeta.shadow, false),
          }
        : null,
  };
}

export function normalizeAgentLabShadowSuggestion(value) {
  const source = value && typeof value === "object" ? value : null;
  if (!source) return null;
  const content = sanitizeOptionalText(source.content, 2000);
  if (!content) return null;
  return {
    content,
    generatedAt: sanitizeIsoDate(source.generatedAt || source.createdAt || Date.now()),
    modePreset: sanitizeModePreset(source.modePreset, "classroom_host"),
    triggerReasons: Array.isArray(source.triggerReasons)
      ? source.triggerReasons.map((item) => sanitizeText(item, "", 40)).filter(Boolean)
      : [],
    runtime:
      source.runtime && typeof source.runtime === "object"
        ? {
            provider: sanitizeText(source.runtime.provider, "", 40),
            model: sanitizeText(source.runtime.model, "", 120),
            reasoningApplied: sanitizeText(source.runtime.reasoningApplied, "", 20),
          }
        : {
            provider: "",
            model: "",
            reasoningApplied: "",
          },
  };
}

export function normalizeAgentLabAccessGrantDoc(doc, user = null) {
  if (!doc) return null;
  const userId = sanitizeId(doc?.userId, "");
  if (!userId) return null;
  return {
    id: sanitizeId(doc?._id, ""),
    userId,
    code: sanitizeText(doc?.code, "", 120),
    claimedAt: sanitizeIsoDate(doc?.claimedAt || doc?.createdAt),
    createdAt: sanitizeIsoDate(doc?.createdAt),
    updatedAt: sanitizeIsoDate(doc?.updatedAt),
    lastShadowSuggestion: normalizeAgentLabShadowSuggestion(doc?.lastShadowSuggestion),
    user: user
      ? {
          id: sanitizeId(user?._id, userId),
          username: sanitizeText(user?.username, "", 60),
          role: sanitizeText(user?.role, "user", 20),
          name: buildAgentLabDisplayName(user),
          profile:
            user?.profile && typeof user.profile === "object"
              ? {
                  name: sanitizeText(user.profile.name, "", 60),
                  className: sanitizeText(user.profile.className, "", 60),
                  studentId: sanitizeText(user.profile.studentId, "", 60),
                  grade: sanitizeText(user.profile.grade, "", 40),
                }
              : {},
        }
      : null,
  };
}

export function sanitizeFetchMessagesLimit(value) {
  return sanitizeInteger(
    value,
    AGENT_LAB_FETCH_MESSAGES_LIMIT_DEFAULT,
    1,
    AGENT_LAB_FETCH_MESSAGES_LIMIT_MAX,
  );
}

export function createAgentLabModels(mongoose) {
  const safeMongoose = mongoose;

  const readStateSchema =
    safeMongoose.models.AgentLabRoomReadState?.schema ||
    new safeMongoose.Schema(
      {
        userId: { type: String, required: true },
        lastReadMessageId: { type: String, default: "" },
        updatedAt: { type: Date, default: Date.now },
      },
      { _id: false },
    );

  const roomSchema =
    safeMongoose.models.AgentLabRoom?.schema ||
    new safeMongoose.Schema(
      {
        roomKey: { type: String, required: true, unique: true, index: true },
        name: { type: String, required: true, trim: true },
        description: { type: String, default: "" },
        taskConfig: {
          type: new safeMongoose.Schema(
            {
              title: { type: String, default: "Agent Lab 课程任务" },
              objective: { type: String, default: "" },
              requirements: { type: [String], default: () => [] },
              expectedOutputs: { type: [String], default: () => [] },
            },
            { _id: false },
          ),
          default: () => buildDefaultAgentLabTaskConfig(),
        },
        memberUserIds: { type: [String], default: () => [] },
        memberCount: { type: Number, default: 0, min: 0 },
        readStates: { type: [readStateSchema], default: () => [] },
        lastAgentAt: { type: Date, default: null },
      },
      {
        timestamps: true,
        collection: "agent_lab_rooms",
      },
    );
  roomSchema.index({ memberUserIds: 1, updatedAt: -1 }, { name: "ix_agent_lab_room_members_updated_desc" });

  const reactionSchema =
    safeMongoose.models.AgentLabMessageReaction?.schema ||
    new safeMongoose.Schema(
      {
        userId: { type: String, required: true },
        userName: { type: String, default: "" },
        emoji: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
      { _id: false },
    );

  const messageSchema =
    safeMongoose.models.AgentLabMessage?.schema ||
    new safeMongoose.Schema(
      {
        roomId: { type: String, required: true, index: true },
        type: {
          type: String,
          enum: ["text", "assistant", "system"],
          default: "text",
        },
        senderUserId: { type: String, default: "" },
        senderName: { type: String, default: "" },
        content: { type: String, default: "" },
        replyToMessageId: { type: String, default: "" },
        replyPreviewText: { type: String, default: "" },
        replySenderName: { type: String, default: "" },
        reactions: { type: [reactionSchema], default: () => [] },
        aiMeta: {
          type: new safeMongoose.Schema(
            {
              modePreset: { type: String, default: "" },
              proactivityLevel: { type: String, default: "" },
              triggerReasons: { type: [String], default: () => [] },
              provider: { type: String, default: "" },
              model: { type: String, default: "" },
              reasoningApplied: { type: String, default: "" },
              shadow: { type: Boolean, default: false },
            },
            { _id: false },
          ),
          default: null,
        },
      },
      {
        timestamps: true,
        collection: "agent_lab_messages",
      },
    );
  messageSchema.index({ roomId: 1, createdAt: -1 }, { name: "ix_agent_lab_messages_room_created_desc" });

  const accessGrantSchema =
    safeMongoose.models.AgentLabAccessGrant?.schema ||
    new safeMongoose.Schema(
      {
        userId: { type: String, required: true, unique: true, index: true },
        code: { type: String, default: AGENT_LAB_INVITE_CODE },
        claimedAt: { type: Date, default: Date.now },
        lastShadowSuggestion: {
          type: new safeMongoose.Schema(
            {
              content: { type: String, default: "" },
              generatedAt: { type: Date, default: Date.now },
              modePreset: { type: String, default: "classroom_host" },
              triggerReasons: { type: [String], default: () => [] },
              runtime: {
                type: new safeMongoose.Schema(
                  {
                    provider: { type: String, default: "" },
                    model: { type: String, default: "" },
                    reasoningApplied: { type: String, default: "" },
                  },
                  { _id: false },
                ),
                default: () => ({}),
              },
            },
            { _id: false },
          ),
          default: null,
        },
      },
      {
        timestamps: true,
        collection: "agent_lab_access_grants",
      },
    );

  const settingsSchema =
    safeMongoose.models.AgentLabSettings?.schema ||
    new safeMongoose.Schema(
      {
        key: { type: String, required: true, unique: true, index: true },
        shadowModeratorEnabled: { type: Boolean, default: true },
        proactiveSpeechEnabled: { type: Boolean, default: false },
        proactivityLevel: { type: String, default: "medium" },
        modePreset: { type: String, default: "classroom_host" },
        silenceTriggerMs: { type: Number, default: 3 * 60 * 1000 },
        repeatWindowMessages: { type: Number, default: 6 },
        stageSummaryMessageCount: { type: Number, default: 8 },
        systemPersonaPrompt: { type: String, default: "" },
        baseAgentId: { type: String, default: "A" },
      },
      {
        timestamps: true,
        collection: "agent_lab_settings",
      },
    );

  const storedFileSchema =
    safeMongoose.models.AgentLabStoredFile?.schema ||
    new safeMongoose.Schema(
      {
        roomId: { type: String, required: true, index: true },
        messageId: { type: String, default: "", index: true },
        uploaderUserId: { type: String, default: "" },
        fileName: { type: String, default: "" },
        mimeType: { type: String, default: "" },
        size: { type: Number, default: 0 },
        data: { type: Buffer, default: Buffer.alloc(0) },
      },
      {
        timestamps: true,
        collection: "agent_lab_files",
      },
    );

  return {
    AgentLabRoom:
      safeMongoose.models.AgentLabRoom || safeMongoose.model("AgentLabRoom", roomSchema),
    AgentLabMessage:
      safeMongoose.models.AgentLabMessage || safeMongoose.model("AgentLabMessage", messageSchema),
    AgentLabAccessGrant:
      safeMongoose.models.AgentLabAccessGrant ||
      safeMongoose.model("AgentLabAccessGrant", accessGrantSchema),
    AgentLabSettings:
      safeMongoose.models.AgentLabSettings ||
      safeMongoose.model("AgentLabSettings", settingsSchema),
    AgentLabStoredFile:
      safeMongoose.models.AgentLabStoredFile ||
      safeMongoose.model("AgentLabStoredFile", storedFileSchema),
  };
}

export async function ensureAgentLabDefaultRoom({ AgentLabRoom }) {
  let room = await AgentLabRoom.findOne({ roomKey: AGENT_LAB_DEFAULT_ROOM_KEY });
  if (room) return room;
  try {
    room = await AgentLabRoom.create({
      roomKey: AGENT_LAB_DEFAULT_ROOM_KEY,
      name: AGENT_LAB_DEFAULT_ROOM_NAME,
      description: "仅对邀请码用户开放的 Agent Lab 测试群。",
      taskConfig: buildDefaultAgentLabTaskConfig(),
      memberUserIds: [],
      memberCount: 0,
    });
    return room;
  } catch {
    return AgentLabRoom.findOne({ roomKey: AGENT_LAB_DEFAULT_ROOM_KEY });
  }
}

export async function ensureAgentLabSettings({ AgentLabSettings }) {
  let settings = await AgentLabSettings.findOne({ key: AGENT_LAB_SETTINGS_KEY });
  if (settings) return settings;
  try {
    settings = await AgentLabSettings.create({
      key: AGENT_LAB_SETTINGS_KEY,
      ...buildDefaultAgentLabSettings(),
    });
    return settings;
  } catch {
    return AgentLabSettings.findOne({ key: AGENT_LAB_SETTINGS_KEY });
  }
}

export async function ensureAgentLabMember({ AgentLabRoom, roomId, userId }) {
  const safeRoomId = sanitizeId(roomId, "");
  const safeUserId = sanitizeId(userId, "");
  if (!safeRoomId || !safeUserId) {
    return { room: null, joined: false };
  }
  let room = await AgentLabRoom.findById(safeRoomId);
  if (!room) return { room: null, joined: false };
  const alreadyJoined = Array.isArray(room.memberUserIds) && room.memberUserIds.includes(safeUserId);
  if (alreadyJoined) return { room, joined: false };
  room = await AgentLabRoom.findByIdAndUpdate(
    safeRoomId,
    {
      $addToSet: { memberUserIds: safeUserId },
      $set: { updatedAt: new Date() },
      $inc: { memberCount: 1 },
    },
    { new: true },
  );
  return { room, joined: true };
}

export async function readAgentLabUsersByIds({ AuthUser, userIds = [] }) {
  const ids = Array.from(new Set((Array.isArray(userIds) ? userIds : []).map((item) => sanitizeId(item, "")).filter(Boolean)));
  if (ids.length === 0) return [];
  const users = await AuthUser.find(
    { _id: { $in: ids } },
    {
      username: 1,
      role: 1,
      profile: 1,
    },
  ).lean();
  const userById = new Map(
    users.map((user) => [
      sanitizeId(user?._id, ""),
      {
        id: sanitizeId(user?._id, ""),
        username: sanitizeText(user?.username, "", 60),
        role: sanitizeText(user?.role, "user", 20),
        name: buildAgentLabDisplayName(user),
        profile:
          user?.profile && typeof user.profile === "object"
            ? {
                name: sanitizeText(user.profile.name, "", 60),
                className: sanitizeText(user.profile.className, "", 60),
                studentId: sanitizeText(user.profile.studentId, "", 60),
                grade: sanitizeText(user.profile.grade, "", 40),
              }
            : {},
      },
    ]),
  );
  return ids.map((id) => userById.get(id)).filter(Boolean);
}

export function buildAgentLabReadStateMap(room) {
  const map = new Map();
  const readStates = Array.isArray(room?.readStates) ? room.readStates : [];
  readStates.forEach((item) => {
    const userId = sanitizeId(item?.userId, "");
    if (!userId) return;
    map.set(userId, {
      userId,
      lastReadMessageId: sanitizeId(item?.lastReadMessageId, ""),
      updatedAt: sanitizeIsoDate(item?.updatedAt) || new Date().toISOString(),
    });
  });
  return map;
}

export async function updateAgentLabRoomReadState({
  AgentLabRoom,
  roomId,
  userId,
  messageId,
}) {
  const safeRoomId = sanitizeId(roomId, "");
  const safeUserId = sanitizeId(userId, "");
  const safeMessageId = sanitizeId(messageId, "");
  if (!safeRoomId || !safeUserId) return null;
  const room = await AgentLabRoom.findById(safeRoomId).lean();
  if (!room) return null;
  const readStateMap = buildAgentLabReadStateMap(room);
  readStateMap.set(safeUserId, {
    userId: safeUserId,
    lastReadMessageId: safeMessageId,
    updatedAt: new Date().toISOString(),
  });
  const readStates = Array.from(readStateMap.values()).map((item) => ({
    userId: item.userId,
    lastReadMessageId: item.lastReadMessageId,
    updatedAt: item.updatedAt,
  }));
  return AgentLabRoom.findByIdAndUpdate(
    safeRoomId,
    {
      $set: {
        readStates,
        updatedAt: new Date(),
      },
    },
    { new: true },
  );
}

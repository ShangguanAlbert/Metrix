import { buildPartyActivityExportFiles } from "./activity-export.js";
import { PARTY_CLIENT_EVENTS } from "../../../shared/party-activity.js";
import { getPartyLearningEventModel } from "./model.js";
import { getPartyCodeArchiveModel, getPartyRoomArchiveModel } from "./activity-model.js";
import * as Y from "yjs";

const CLIENT_TYPES = new Set(PARTY_CLIENT_EVENTS);
const id = (value) => String(value || "").slice(0, 120);

export function normalizeClientActivity(raw, { roomId, userId, userName }) {
  if (!CLIENT_TYPES.has(raw?.eventType) || !/^[\w-]{16,120}$/.test(raw?.eventId || "")
    || !/^[\w-]{16,120}$/.test(raw?.sessionId || "")
    || !Number.isSafeInteger(raw.sequence) || raw.sequence < 1
    || !Number.isFinite(Date.parse(raw.occurredAt))) return null;
  const allowed = ["lessonId", "publicationKey", "fileId", "fileName", "messageId", "replyToMessageId",
    "senderKind", "visible", "focused", "status", "activeWorkspace", "document", "action",
    "inputType", "changedCharacters", "selectionFrom", "selectionTo", "lastInteractionAt",
    "elapsedMs", "url", "label", "error", "revision", "documentEpoch", "relatedAiMessageId", "reason", "captureStorage"];
  const metadata = {};
  for (const key of allowed) {
    const value = raw.metadata?.[key];
    if (["number", "boolean"].includes(typeof value)) metadata[key] = value;
    else if (typeof value === "string") metadata[key] = value.slice(0, key === "url" ? 2000 : 500);
  }
  return { eventId: `${userId}:${raw.eventId}`, roomId, userId, userName,
    eventType: raw.eventType, sessionId: raw.sessionId, sequence: raw.sequence,
    occurredAt: raw.occurredAt, source: "client_observation", authorized: true, metadata };
}

export async function canReadActivityRoom(deps, admin, room) {
  if (!room || !["admin", "teacher"].includes(admin?.role)) return false;
  if (deps.PLATFORM_ADMIN_ACCOUNT_TAG && admin.accountTag === deps.PLATFORM_ADMIN_ACCOUNT_TAG) return true;
  const classes = new Set(admin.authorizedClassNames || []);
  const history = new Map((room.historicalMembers || []).map((member) => [member.userId, member]));
  const members = [...new Set([...(room.memberUserIds || []), ...history.keys()])];
  if (!members.length || !classes.size) return false;
  const students = await deps.AuthUser.find({ _id: { $in: members } }, { "profile.className": 1 }).lean();
  const current = new Map(students.map((student) => [String(student._id), student]));
  return members.every((memberId) => classes.has(current.get(memberId)?.profile?.className || history.get(memberId)?.className));
}

export function buildActivityFilter(roomId, query = {}) {
  const filter = { roomId };
  if (query.userId) filter.userId = id(query.userId);
  if (query.eventType) filter.eventType = id(query.eventType);
  if (query.sessionId) filter.sessionId = id(query.sessionId);
  if (query.from || query.to) {
    filter.occurredAt = {};
    for (const [key, op] of [["from", "$gte"], ["to", "$lte"]]) {
      if (!query[key]) continue;
      if (!Number.isFinite(Date.parse(query[key]))) throw new Error("无效的时间范围。");
      filter.occurredAt[op] = new Date(query[key]);
    }
  }
  if (query.cursor) {
    const cursor = JSON.parse(Buffer.from(String(query.cursor), "base64url").toString());
    if (!/^[a-f0-9]{24}$/i.test(cursor.id) || !Number.isFinite(Date.parse(cursor.at))) throw new Error("无效的分页位置。");
    filter.$or = [{ occurredAt: { $lt: new Date(cursor.at) } }, { occurredAt: new Date(cursor.at), _id: { $lt: cursor.id } }];
  }
  return filter;
}

export function registerPartyActivityRoutes(app, deps) {
  const Event = getPartyLearningEventModel(deps.mongoose);
  const Code = getPartyCodeArchiveModel(deps.mongoose);
  const Archive = getPartyRoomArchiveModel(deps.mongoose);
  app.get("/api/auth/admin/collaboration-activity-rooms", async (req, res) => {
    try {
      const admin = await deps.authenticateAdminRequest(req, res); if (!admin) return;
      const [live, archived] = await Promise.all([
        deps.GroupChatRoom.find({ teacherScopeKey: "shi-gaojun" }).setOptions({ includeArchived: true }).lean(),
        Archive.find({ teacherScopeKey: "shi-gaojun" }).lean(),
      ]);
      const rooms = [];
      for (const room of [...live, ...archived]) {
        if (!await canReadActivityRoom(deps, admin, room)) continue;
        const members = await deps.AuthUser.find({ _id: { $in: room.memberUserIds } }, { username: 1, "profile.name": 1 }).lean();
        rooms.push({ id: String(room.roomId || room._id), name: room.name || room.room?.name || "协作小组", archived: !!room.archivedAt,
          members: [...new Map([...(room.historicalMembers || []).map((member) => [member.userId, { id: member.userId, name: member.name }]),
            ...members.map((member) => [String(member._id), { id: String(member._id), name: member.profile?.name || member.username }])]).values()] });
      }
      res.json({ ok: true, rooms });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });
  app.post("/api/group-chat/rooms/:roomId/activity", deps.requireChatAuth, async (req, res) => {
    try {
      const roomId = id(req.params.roomId), userId = id(req.authUser?._id);
      if (!/^[a-f0-9]{24}$/i.test(roomId) || req.authTeacherScopeKey !== "shi-gaojun") return res.status(403).json({ error: "无权记录该课堂。" });
      const room = await deps.GroupChatRoom.findOne({ _id: roomId, teacherScopeKey: "shi-gaojun", memberUserIds: userId }).setOptions({ includeArchived: true }).lean()
        || await Archive.findOne({ roomId, memberUserIds: userId }).setOptions({ includeArchived: true }).lean();
      if (!room) return res.status(403).json({ error: "无权记录该课堂。" });
      const raw = req.body?.events;
      if (!Array.isArray(raw) || raw.length > 100 || JSON.stringify(raw).length > 256_000) return res.status(400).json({ error: "无效的记录批次。" });
      const events = raw.map((event) => normalizeClientActivity(event, {
        roomId, userId, userName: req.authUser.profile?.name || req.authUser.username || "成员",
      }));
      if (events.some((event) => !event)) return res.status(400).json({ error: "无效的过程记录。" });
      await deps.partyActivity.accept(events);
      res.json({ ok: true, accepted: raw.map((event) => event.eventId) });
    } catch { res.status(503).json({ error: "记录暂未接收，将自动重试。" }); }
  });

  async function authorize(req, res) {
    const admin = await deps.authenticateAdminRequest(req, res);
    if (!admin) return null;
    const roomId = id(req.params.roomId);
    if (!/^[a-f0-9]{24}$/i.test(roomId)) { res.status(400).json({ error: "无效的小组。" }); return null; }
    const room = await deps.GroupChatRoom.findOne({ _id: roomId, teacherScopeKey: "shi-gaojun" }).setOptions({ includeArchived: true }).lean()
      || await Archive.findOne({ roomId, teacherScopeKey: "shi-gaojun" }).lean();
    if (!await canReadActivityRoom(deps, admin, room)) { res.status(403).json({ error: "无权查看该小组记录。" }); return null; }
    return roomId;
  }
  app.get("/api/auth/admin/collaboration-classrooms/:roomId/activity", async (req, res) => {
    try {
      const roomId = await authorize(req, res); if (!roomId) return;
      const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
      let filter;
      try { filter = buildActivityFilter(roomId, req.query); } catch { return res.status(400).json({ error: "无效的筛选或分页参数。" }); }
      const rows = await Event.find(filter).sort({ occurredAt: -1, _id: -1 }).limit(limit + 1).lean();
      const more = rows.length > limit; const events = rows.slice(0, limit); const last = events.at(-1);
      res.json({ ok: true, events, nextCursor: more ? Buffer.from(JSON.stringify({ at: last.occurredAt, id: String(last._id) })).toString("base64url") : "",
        recording: await deps.partyActivity.status() });
    } catch (error) { res.status(500).json({ error: error.message || "读取过程记录失败。" }); }
  });
  app.get("/api/auth/admin/collaboration-classrooms/:roomId/activity/code/:eventId", async (req, res) => {
    try {
      const roomId = await authorize(req, res); if (!roomId) return;
      const code = await Code.findOne({ roomId, eventId: req.params.eventId }).lean();
      if (!code) return res.status(404).json({ error: "该代码档案尚未入库。" });
      if (code.kind === "update") {
        const scope = { roomId, documentEpoch: code.documentEpoch, activeWorkspace: code.activeWorkspace, processId: code.processId };
        const baseline = await Code.findOne({ ...scope, kind: "checkpoint", sequence: { $lt: code.sequence } }).sort({ sequence: -1 }).lean();
        if (!baseline?.update) return res.status(503).json({ error: "对应代码基线尚未同步完成，请稍后重试。" });
        const doc = new Y.Doc();
        try {
          Y.applyUpdate(doc, Buffer.from(baseline.update, "base64"));
          for await (const delta of Code.find({ ...scope, kind: "update", sequence: { $gt: baseline.sequence, $lte: code.sequence } }).sort({ sequence: 1 }).cursor()) {
            Y.applyUpdate(doc, Buffer.from(delta.update, "base64"));
          }
          code.html = doc.getText("html").toString(); code.css = doc.getText("css").toString();
        } finally { doc.destroy(); }
      }
      res.json({ ok: true, code });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });
  app.get("/api/auth/admin/collaboration-classrooms/:roomId/activity/export", async (req, res) => {
    try {
      const roomId = await authorize(req, res); if (!roomId) return;
      const files = await buildPartyActivityExportFiles(deps, [roomId]);
      const zip = deps.buildZipBuffer(files);
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="learning-process-${roomId}.zip"`);
      res.send(zip);
    } catch (error) { if (!res.headersSent) res.status(500).json({ error: error.message }); else res.destroy(error); }
  });
  app.get("/api/auth/admin/collaboration-activity/export", async (req, res) => {
    try {
      const admin = await deps.authenticateAdminRequest(req, res); if (!admin) return;
      const [live, archived] = await Promise.all([
        deps.GroupChatRoom.find({ teacherScopeKey: "shi-gaojun" }).setOptions({ includeArchived: true }).lean(),
        Archive.find({ teacherScopeKey: "shi-gaojun" }).lean(),
      ]);
      const roomIds = [];
      for (const room of [...live, ...archived]) {
        if (await canReadActivityRoom(deps, admin, room)) roomIds.push(String(room.roomId || room._id));
      }
      const files = await buildPartyActivityExportFiles(deps, roomIds);
      const zip = deps.buildZipBuffer(files);
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", 'attachment; filename="learning-process-all-rooms.zip"');
      res.send(zip);
    } catch (error) { res.status(500).json({ error: error.message || "导出学习过程失败。" }); }
  });

}

import { registerPartyImageRoutes } from "./image-routes.js";
import { getPartyTemplateModel, readRoomTemplate } from "./template-service.js";
import { normalizeWorkspace } from "./workspace-state.js";
import { canDriveParty, rotatePartyRoles } from "../../../shared/party-roles.js";
import { createPartyLearningService } from "./learning-service.js";
import { getPartyWebWorkspaceModel } from "./model.js";
import { ensurePartyPairRoles } from "./pair-roles.js";
import { createPartyCodingRealtime } from "./realtime.js";

const SHI_GAOJUN_TEACHER_SCOPE_KEY = "shi-gaojun";
const MAX_DOCUMENT_LENGTH = 200_000;
const MAX_DIAGNOSTIC_LENGTH = 300;
const TASK_STAGES = new Set(["understand", "plan", "build", "debug", "reflect"]);

function sanitizeDocument(value) {
  return String(value || "").replace(/\r\n/g, "\n").slice(0, MAX_DOCUMENT_LENGTH);
}

function sanitizeDiagnostics(value) {
  return (Array.isArray(value) ? value : [])
    .map((item) => String(item || "").replace(/\s+/g, " ").trim().slice(0, MAX_DIAGNOSTIC_LENGTH))
    .filter(Boolean)
    .slice(0, 20);
}


export function registerPartyCodingRoutes(app, deps) {
  const {
    GroupChatRoom,
    requireChatAuth,
    sanitizeId,
    isMongoObjectIdLike,
    broadcastGroupChatWsPayload,
  } = deps;
  const Workspace = getPartyWebWorkspaceModel(deps.mongoose);
  const collaboration = createPartyCodingRealtime(deps);
  const learning = createPartyLearningService(deps);

  async function requireCodingMember(req, res) {
    const userId = sanitizeId(req.authUser?._id, "");
    const roomId = sanitizeId(req.params?.roomId, "");
    if (String(req.authTeacherScopeKey || "").trim().toLowerCase() !== SHI_GAOJUN_TEACHER_SCOPE_KEY) {
      res.status(403).json({ error: "网页结对编程仅面向 PAIA 授课范围开放。" });
      return null;
    }
    if (!userId || !roomId || !isMongoObjectIdLike(roomId)) {
      res.status(400).json({ error: "无效派房间。" });
      return null;
    }
    const room = await GroupChatRoom.findOne(
      { _id: roomId, memberUserIds: userId },
      { ownerUserId: 1, memberUserIds: 1, announcement: 1 },
    ).lean();
    if (!room) {
      res.status(403).json({ error: "你不是该派成员，无法使用网页结对编程。" });
      return null;
    }
    return {
      roomId,
      userId,
      userName: String(req.authUser?.profile?.name || req.authUser?.username || "成员").trim().slice(0, 60) || "成员",
      isOwner: sanitizeId(room.ownerUserId, "") === userId,
      memberUserIds: (Array.isArray(room.memberUserIds) ? room.memberUserIds : [])
        .map((item) => sanitizeId(item, ""))
        .filter(Boolean)
        .slice(0, 3),
      taskText: String(room.announcement || "").trim().slice(0, 500),
    };
  }

  async function ensurePairRoles(member) {
    return ensurePartyPairRoles({
      Workspace,
      roomId: member.roomId,
      memberUserIds: member.memberUserIds,
    });
  }

  registerPartyImageRoutes(app, deps, { requireCodingMember, collaboration });

  const Template = getPartyTemplateModel(deps.mongoose);
  async function readTemplate(member) {
    return readRoomTemplate({ Template, AuthUser: deps.AuthUser, memberUserIds: member.memberUserIds });
  }

  app.get("/api/group-chat/rooms/:roomId/coding/template", requireChatAuth, async (req, res) => {
    try {
      const member = await requireCodingMember(req, res);
      if (!member) return;
      res.json({ ok: true, template: await readTemplate(member) });
    } catch (error) { res.status(500).json({ error: error?.message || "读取本课模板失败。" }); }
  });

  app.post("/api/group-chat/rooms/:roomId/coding/template/load", requireChatAuth, async (req, res) => {
    try {
      const member = await requireCodingMember(req, res);
      if (!member) return;
      const template = await readTemplate(member);
      if (!template || template.lessonId !== req.body?.lessonId || template.version !== req.body?.version) {
        res.status(409).json({ error: "模板已更新，请刷新后确认本课模板。" }); return;
      }
      const requestId = String(req.body?.requestId || "");
      if (!/^[a-zA-Z0-9-]{16,80}$/.test(requestId)) {
        res.status(400).json({ error: "无效的模板载入请求。" }); return;
      }
      const workspace = await collaboration.replaceRoomDocuments({
        roomId: member.roomId, html: template.html, css: template.css, template, requestId,
        expectedEpoch: req.body?.documentEpoch, expectedStateVector: req.body?.stateVector,
        author: { userId: member.userId, name: member.userName },
      });
      res.json({ ok: true, workspace });
    } catch (error) { res.status(error.status || 500).json({ error: error?.message || "载入本课模板失败。" }); }
  });

  app.get("/api/group-chat/rooms/:roomId/coding", requireChatAuth, async (req, res) => {
    try {
      const member = await requireCodingMember(req, res);
      if (!member) return;
      const [workspace, intervention] = await Promise.all([
        ensurePairRoles(member),
        learning.getLatestIntervention(member.roomId),
      ]);
      res.json({
        ok: true,
        workspace: normalizeWorkspace(workspace),
        taskText: member.taskText,
        latestIntervention: intervention,
      });
    } catch (error) {
      res.status(500).json({ error: error?.message || "读取网页协作空间失败。" });
    }
  });

  app.put("/api/group-chat/rooms/:roomId/coding", requireChatAuth, async (req, res) => {
    try {
      const member = await requireCodingMember(req, res);
      if (!member) return;
      const current = await ensurePairRoles(member);
      if (!sanitizeId(current?.driverUserId, "") || !sanitizeId(current?.navigatorUserId, "")) {
        res.status(409).json({ error: "请等待第二名学生加入，结对角色分配后再开始编程。" });
        return;
      }
      if (!canDriveParty(current, member.userId)) {
        res.status(403).json({ error: "当前由 Driver 操作代码。" });
        return;
      }
      const workspace = await collaboration.replaceRoomDocuments({
        roomId: member.roomId,
        requireDriver: true,
        html: sanitizeDocument(req.body?.html),
        css: sanitizeDocument(req.body?.css),
        author: { userId: member.userId, name: member.userName },
      });
      res.json({ ok: true, workspace });
    } catch (error) {
      res.status(500).json({ error: error?.message || "保存网页代码失败。" });
    }
  });

  app.post("/api/group-chat/rooms/:roomId/coding/restore", requireChatAuth, async (req, res) => {
    try {
      const member = await requireCodingMember(req, res);
      if (!member) return;
      if (!member.isOwner) {
        res.status(403).json({ error: "仅派主可恢复代码版本。" });
        return;
      }
      const revisionToRestore = Number(req.body?.revision || 0);
      const current = await Workspace.findOne({ roomId: member.roomId }).lean();
      const source = (current?.versions || []).find((item) => Number(item?.revision) === revisionToRestore);
      if (!source) {
        res.status(404).json({ error: "代码版本不存在。" });
        return;
      }
      const workspace = await collaboration.replaceRoomDocuments({
        roomId: member.roomId,
        html: source.html,
        css: source.css,
        author: { userId: member.userId, name: member.userName },
      });
      res.json({ ok: true, workspace });
    } catch (error) {
      res.status(500).json({ error: error?.message || "恢复代码版本失败。" });
    }
  });

  app.patch("/api/group-chat/rooms/:roomId/coding/session", requireChatAuth, async (req, res) => {
    try {
      const member = await requireCodingMember(req, res);
      if (!member) return;
      return await collaboration.withRoomLock(member.roomId, async () => {
      const current = await ensurePairRoles(member);
      const action = String(req.body?.action || "").trim().toLowerCase();
      const nextStage = String(req.body?.taskStage || "").trim().toLowerCase();
      let update = null;
      let eventType = "";
      let metadata = {};
      if (action === "rotate") {
        if (!current?.driverUserId || !current?.navigatorUserId) {
          res.status(409).json({ error: "至少安排两名学生后才能轮换角色。" });
          return;
        }
        if (sanitizeId(current.driverUserId, "") !== member.userId) {
          res.status(403).json({ error: "当前只有 Driver 可以完成本轮并交棒。" });
          return;
        }
        const nextRoles = rotatePartyRoles(member.memberUserIds, current);
        update = {
          $set: {
            driverUserId: nextRoles.driverUserId,
            navigatorUserId: nextRoles.navigatorUserId,
            navigatorUserIds: nextRoles.navigatorUserIds,
            rolesUpdatedAt: new Date(),
          },
          $inc: { roleRotationCount: 1 },
        };
        eventType = "role_rotation";
        metadata = {
          previousDriverUserId: current.driverUserId,
          nextDriverUserId: nextRoles.driverUserId,
          memberUserIds: member.memberUserIds,
        };
      } else if (action === "stage" && TASK_STAGES.has(nextStage)) {
        update = { $set: { taskStage: nextStage } };
        eventType = "task_stage_change";
        metadata = { previousStage: current.taskStage, nextStage };
      } else {
        res.status(400).json({ error: "无效的协作会话操作。" });
        return;
      }
      const workspace = await Workspace.findOneAndUpdate(
        { roomId: member.roomId, ...(action === "rotate" ? { driverUserId: current.driverUserId, roleRotationCount: current.roleRotationCount || 0 } : {}) },
        update,
        { new: true },
      ).lean();
      if (!workspace) {
        res.status(409).json({ error: "角色已发生变化，请刷新后重试。" });
        return;
      }
      await learning.recordEvent({
        roomId: member.roomId,
        userId: member.userId,
        userName: member.userName,
        eventType,
        metadata,
        workspace: action === "rotate" ? current : workspace,
      });
      const normalized = normalizeWorkspace(workspace);
      broadcastGroupChatWsPayload(member.roomId, {
        type: "coding_collab_workspace_updated",
        roomId: member.roomId,
        workspace: normalized,
      });
      res.json({ ok: true, workspace: normalized });
      });
    } catch (error) {
      res.status(500).json({ error: error?.message || "更新协作角色或阶段失败。" });
    }
  });

  app.post("/api/group-chat/rooms/:roomId/coding/preview", requireChatAuth, async (req, res) => {
    try {
      const member = await requireCodingMember(req, res);
      if (!member) return;
      const current = await ensurePairRoles(member);
      if (!sanitizeId(current?.driverUserId, "") || !sanitizeId(current?.navigatorUserId, "")) {
        res.status(409).json({ error: "请等待第二名学生加入，结对角色分配后再刷新预览。" });
        return;
      }
      if (!canDriveParty(current, member.userId)) {
        res.status(403).json({ error: "当前由 Driver 刷新网页预览。" });
        return;
      }
      const diagnostics = sanitizeDiagnostics(req.body?.diagnostics);
      const workspace = await Workspace.findOneAndUpdate(
        { roomId: member.roomId },
        {
          $set: {
            lastPreviewAt: new Date(),
            lastPreviewByUserId: member.userId,
            lastDiagnostics: diagnostics,
          },
        },
        { new: true },
      ).lean();
      await learning.recordEvent({
        roomId: member.roomId,
        userId: member.userId,
        userName: member.userName,
        eventType: "preview",
        metadata: { diagnosticCount: diagnostics.length, revision: workspace?.revision || 1 },
        workspace,
      });
      if (diagnostics.length) {
        await learning.recordEvent({
          roomId: member.roomId,
          userId: member.userId,
          userName: member.userName,
          eventType: "diagnostic_error",
          metadata: { diagnostics },
          workspace,
        });
      }
      const normalized = normalizeWorkspace(workspace);
      broadcastGroupChatWsPayload(member.roomId, {
        type: "coding_collab_workspace_updated",
        roomId: member.roomId,
        workspace: normalized,
      });
      res.json({ ok: true, workspace: normalized });
    } catch (error) {
      res.status(500).json({ error: error?.message || "记录网页预览失败。" });
    }
  });

  app.patch("/api/group-chat/rooms/:roomId/coding/interventions/:interventionId/feedback", requireChatAuth, async (req, res) => {
    try {
      const member = await requireCodingMember(req, res);
      if (!member) return;
      const intervention = await learning.submitFeedback({
        roomId: member.roomId,
        interventionId: sanitizeId(req.params?.interventionId, ""),
        userId: member.userId,
        feedback: req.body?.feedback,
        note: req.body?.note,
      });
      if (!intervention) {
        res.status(400).json({ error: "无效的 PAIA 判断反馈。" });
        return;
      }
      broadcastGroupChatWsPayload(member.roomId, {
        type: "coding_collab_intervention",
        roomId: member.roomId,
        intervention,
      });
      res.json({ ok: true, intervention });
    } catch (error) {
      res.status(500).json({ error: error?.message || "提交 PAIA 判断反馈失败。" });
    }
  });

  return collaboration;
}

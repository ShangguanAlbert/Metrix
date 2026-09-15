import { normalizeWorkspace } from "./workspace-state.js";
import { getPartyWebWorkspaceModel } from "./model.js";
import { ensurePartyPairRoles } from "./pair-roles.js";
import { buildPairClassroomMonitoringFields } from "./classroom-management.js";

export function registerPartyMemberRoutes(app, deps) {
  const { mongoose, GroupChatRoom, AuthUser, authenticateAdminRequest,
    canManageStudent, sanitizeId, isMongoObjectIdLike,
    normalizeGroupChatRoomDoc, broadcastGroupChatRoomUpdated,
    broadcastGroupChatWsPayload, broadcastGroupChatMemberJoined } = deps;
  const Workspace = getPartyWebWorkspaceModel(mongoose);

  app.post("/api/auth/admin/collaboration-classrooms/:roomId/members", async (req, res) => {
    const admin = await authenticateAdminRequest(req, res);
    if (!admin) return;
    const roomId = sanitizeId(req.params.roomId, "");
    const userId = sanitizeId(req.body?.studentUserId, "");
    if (!isMongoObjectIdLike(roomId) || !isMongoObjectIdLike(userId)) {
      res.status(400).json({ error: "请选择有效的小教室和学生。" });
      return;
    }
    try {
      const room = await GroupChatRoom.findOne({ _id: roomId, teacherScopeKey: "shi-gaojun" }).lean();
      if (!room) { res.status(404).json({ error: "小教室不存在。" }); return; }
      const previousMembers = room.memberUserIds.map(String);
      if (previousMembers.length !== 2 || previousMembers.includes(userId)) {
        res.status(409).json({ error: "只能向两人小组添加一名新成员。" }); return;
      }
      const members = [...previousMembers, userId];
      const students = await AuthUser.find({ _id: { $in: members } }).lean();
      if (students.length !== 3 || students.some((student) =>
        student.role !== "user" || student.lockedTeacherScopeKey !== "shi-gaojun"
        || !canManageStudent(admin, student))) {
        res.status(403).json({ error: "只能安排自己授权班级和课堂范围内的学生。" }); return;
      }
      if (new Set(students.map((student) => String(student.profile?.className || "").trim())).size !== 1) {
        res.status(400).json({ error: "请选择同一班级的学生。" }); return;
      }
      const occupied = await GroupChatRoom.exists({ teacherScopeKey: "shi-gaojun", memberUserIds: userId });
      if (occupied) { res.status(409).json({ error: "该学生已在其他小组。" }); return; }
      const now = new Date();
      const history = room.membershipHistory?.length ? room.membershipHistory : [{
        memberUserIds: previousMembers, effectiveAt: room.createdAt || now, changedByAdminId: "",
      }];
      const updated = await GroupChatRoom.findOneAndUpdate(
        { _id: roomId, memberUserIds: previousMembers },
        { $set: {
          memberUserIds: members, memberCount: members.length,
          membershipHistory: [...history, { memberUserIds: members, effectiveAt: now, changedByAdminId: String(admin._id) }],
          ...(room.paiaMonitoringEnabled ? buildPairClassroomMonitoringFields(true, { now, adminId: String(admin._id) }) : {}),
        } }, { new: true },
      ).lean();
      if (!updated) { res.status(409).json({ error: "小组成员已变化，请刷新后重试。" }); return; }
      const workspace = await ensurePartyPairRoles({ Workspace, roomId, memberUserIds: members });
      broadcastGroupChatRoomUpdated(roomId, normalizeGroupChatRoomDoc(updated));
      const joined = students.find((student) => String(student._id) === userId);
      broadcastGroupChatMemberJoined(roomId, { id: userId, name: joined.profile?.name || joined.username });
      broadcastGroupChatWsPayload(roomId, { type: "coding_collab_workspace_updated", roomId, workspace: normalizeWorkspace(workspace) });
      res.json({ ok: true, roomId });
    } catch (error) {
      res.status(500).json({ error: error?.message || "添加小组成员失败。" });
    }
  });
}

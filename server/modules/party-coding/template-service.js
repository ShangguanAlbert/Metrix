import { readPublishedLesson } from "../../../shared/classroomPublication.js";
import { createHash } from "node:crypto";
import { normalizeProgrammingTemplate } from "../../../shared/party-template.js";

export function getPartyTemplateModel(mongoose) {
  const schema = new mongoose.Schema({
    lessonId: { type: String, required: true, unique: true },
    courseId: String,
    lessonName: String,
    className: String,
    teacherScopeKey: String,
    html: String,
    css: String,
    editMode: String,
    editableRanges: mongoose.Schema.Types.Mixed,
    version: String,
    publishedAt: Date,
    publishedBy: String,
  }, { collection: "party_lesson_templates" });
  return mongoose.models.PartyLessonTemplate || mongoose.model("PartyLessonTemplate", schema);
}

export function buildPublishedTemplate(lesson, adminId, now = new Date()) {
  const content = normalizeProgrammingTemplate(lesson.programmingTemplate);
  return {
    ...content,
    lessonId: String(lesson.id), courseId: String(lesson.courseId || ""),
    lessonName: String(lesson.courseName || ""), className: String(lesson.className || ""),
    teacherScopeKey: "shi-gaojun",
    version: createHash("sha256").update(JSON.stringify(content)).digest("hex").slice(0, 20),
    publishedAt: now, publishedBy: String(adminId),
  };
}

export function getProgrammingTemplatePublicationError(value, { allowEmpty = false } = {}) {
  const template = normalizeProgrammingTemplate(value);
  if (!template.html.trim() && !template.css.trim()) {
    return allowEmpty ? "" : "请先填写 HTML 或 CSS 模板。";
  }
  if (template.editMode === "fill" && !template.editableRanges.html.length && !template.editableRanges.css.length) {
    return "请至少设置一个学生填写区，或切换为自由编程。";
  }
  return "";
}

export async function readRoomTemplate({ Template, AuthUser, AdminConfig, memberUserIds }) {
  const students = await AuthUser.find({ _id: { $in: memberUserIds } }, { profile: 1, lockedTeacherScopeKey: 1 }).lean();
  const classes = [...new Set(students.map((student) => String(student.profile?.className || "")))];
  if (students.length !== memberUserIds.length || classes.length !== 1 || !classes[0]
    || students.some((student) => student.lockedTeacherScopeKey !== "shi-gaojun")) return null;
  const [standaloneTemplate, config] = await Promise.all([
    Template.findOne({ className: classes[0], teacherScopeKey: "shi-gaojun" }).sort({ publishedAt: -1 }).lean(),
    AdminConfig ? AdminConfig.findOne({ key: "global" }, { teacherCoursePlans: 1 }).lean() : null,
  ]);
  const lessons = config?.teacherCoursePlans || [];
  let doc = standaloneTemplate;
  // Both publication entry points expose the same template. Read lesson snapshots
  // directly so publishing a lesson cannot leave a second template copy stale.
  for (const lesson of lessons) {
    const published = lesson.publication?.snapshot;
    const publishedAt = Date.parse(lesson.publication?.publishedAt);
    if (!published || published.enabled === false || published.className !== classes[0] || !Number.isFinite(publishedAt)
      || getProgrammingTemplatePublicationError(published.programmingTemplate)) continue;
    if (!doc || publishedAt >= (Date.parse(doc.publishedAt) || 0)) {
      doc = buildPublishedTemplate({ ...published, id: lesson.id }, "", new Date(publishedAt));
    }
  }
  if (!doc) return null;
  const { lessonId, version, publishedAt } = doc;
  const publishedLesson = readPublishedLesson(lessons.find((lesson) => lesson.id === lessonId));
  const lessonName = publishedLesson?.courseName || doc.lessonName;
  return { lessonId, lessonName, version, publishedAt, ...normalizeProgrammingTemplate(doc) };
}

export function registerPartyTemplateAdminRoutes(app, deps) {
  const { mongoose, AdminConfig, TeachingCourse, AuthUser, GroupChatRoom,
    authenticateAdminRequest, canManageCourse, broadcastGroupChatWsPayload } = deps;
  const Template = getPartyTemplateModel(mongoose);
  app.post("/api/auth/admin/collaboration-lessons/:lessonId/template/publish", async (req, res) => {
    const admin = await authenticateAdminRequest(req, res);
    if (!admin) return;
    try {
      const config = await AdminConfig.findOne({ key: "global" }, { teacherCoursePlans: 1 }).lean();
      const lesson = config?.teacherCoursePlans?.find((item) => item.id === req.params.lessonId);
      if (!lesson) { res.status(404).json({ error: "课时不存在，请先保存课时。" }); return; }
      const course = lesson.courseId ? await TeachingCourse.findById(lesson.courseId).lean() : null;
      if (!course || !canManageCourse(admin, course) || !course.classNames?.includes(lesson.className)) {
        res.status(403).json({ error: "只能发布自己课程和班级的模板。" }); return;
      }
      const template = buildPublishedTemplate(lesson, admin._id);
      const templateError = getProgrammingTemplatePublicationError(template);
      if (templateError) { res.status(400).json({ error: templateError }); return; }
      await Template.findOneAndUpdate({ lessonId: template.lessonId }, { $set: template }, { upsert: true });
      const students = await AuthUser.find({ lockedTeacherScopeKey: "shi-gaojun", "profile.className": lesson.className }, { _id: 1 }).lean();
      const ids = students.map((student) => String(student._id));
      const rooms = await GroupChatRoom.find({ teacherScopeKey: "shi-gaojun", memberUserIds: { $in: ids } }, { _id: 1 }).lean();
      for (const room of rooms) broadcastGroupChatWsPayload(String(room._id), {
        type: "coding_collab_template_published", roomId: String(room._id),
      });
      res.json({ ok: true, version: template.version, publishedAt: template.publishedAt });
    } catch (error) {
      res.status(500).json({ error: error?.message || "发布编程模板失败。" });
    }
  });
}

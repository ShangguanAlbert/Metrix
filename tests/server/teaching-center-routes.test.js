import assert from "node:assert/strict";
import test from "node:test";

import { registerAuthUserClassroomRoutes } from "../../server/routes/auth-user-classroom.js";
import {
  normalizeAdminConfigDoc,
  normalizeClassroomTeachingQuestionDoc,
  normalizeClassroomTeachingSessionDoc,
  sanitizeAdminClassroomTeachingConfigPayload,
  sanitizeStudentClassroomTeachingConfigPayload,
} from "../../server/services/core-runtime.js";

function createAppDouble() {
  const routes = [];
  return {
    routes,
    use() {
      return this;
    },
    get(path, ...handlers) {
      routes.push({ method: "get", path, handlers });
      return this;
    },
    post(path, ...handlers) {
      routes.push({ method: "post", path, handlers });
      return this;
    },
    put(path, ...handlers) {
      routes.push({ method: "put", path, handlers });
      return this;
    },
    delete(path, ...handlers) {
      routes.push({ method: "delete", path, handlers });
      return this;
    },
  };
}

function createResponseDouble() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

function createTeachingCenterDeps() {
  const noopMiddleware = (_req, _res, next) => {
    if (typeof next === "function") next();
  };
  const sanitizeText = (value, fallback = "", maxLength = 80) =>
    String(value ?? fallback)
      .trim()
      .slice(0, maxLength);
  const sanitizeId = (value, fallback = "") => {
    const safe = String(value ?? "").trim();
    return safe || fallback;
  };
  const sanitizeIsoDate = (value) => {
    const safe = String(value || "").trim();
    return safe || "";
  };
  const sanitizeRuntimeBoolean = (value, fallback = false) => {
    if (typeof value === "boolean") return value;
    if (value === "true") return true;
    if (value === "false") return false;
    return fallback;
  };
  const sanitizeRuntimeInteger = (value, fallback, min, max) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
  };

  let configState = normalizeAdminConfigDoc({
    key: "admin-config",
    teacherCoursePlans: [
      {
        id: "lesson-1",
        courseName: "第1节课",
        className: "810班",
        enabled: true,
        files: [
          {
            id: "lesson-file-1",
            name: "课件一.pdf",
            mimeType: "application/pdf",
            size: 1024,
            uploadedAt: "2026-05-18T10:00:00.000Z",
          },
          {
            id: "lesson-file-2",
            name: "课件二.pdf",
            mimeType: "application/pdf",
            size: 2048,
            uploadedAt: "2026-05-18T10:05:00.000Z",
          },
        ],
        teachingConfig: {
          pdfFiles: [
            { fileId: "lesson-file-1", sortOrder: 0, enabled: true },
          ],
          defaultPdfFileId: "lesson-file-1",
          allowQuestions: true,
          teacherNotes: "原始教师讲稿",
          welcomeText: "欢迎上课",
          updatedAt: "2026-05-18T10:00:00.000Z",
        },
      },
    ],
  });
  const sessions = new Map();
  const questions = [];

  const deps = {
    cors: () => noopMiddleware,
    express: {
      json: () => noopMiddleware,
    },
    requireChatAuth: noopMiddleware,
    requireAdminAuth: noopMiddleware,
    authenticateAdminRequest: async () => ({
      _id: "admin-1",
      username: "teacher-admin",
      role: "admin",
    }),
    studentHomeworkUpload: {
      array: () => noopMiddleware,
    },
    teacherClassroomFileUpload: {
      array: () => noopMiddleware,
    },
    SHANGGUAN_FUZE_TEACHER_SCOPE_KEY: "shangguan-fuze",
    ADMIN_CONFIG_KEY: "admin-config",
    CLASSROOM_FIRST_LESSON_DATE: "2026-03-11",
    CLASSROOM_QUESTIONNAIRE_URL: "",
    ADMIN_CLASSROOM_TEACHING_QUESTION_MAX_LENGTH: 300,
    sanitizeTeacherScopeKey: (value) => String(value || "").trim().toLowerCase(),
    sanitizeId,
    sanitizeText,
    sanitizeIsoDate,
    sanitizeRuntimeBoolean,
    sanitizeRuntimeInteger,
    sanitizeUserProfile: (profile) =>
      profile && typeof profile === "object" ? profile : {},
    getTeacherScopeLabel: () => "上官福泽",
    sortAdminClassroomCoursePlans: (plans) =>
      Array.isArray(plans) ? [...plans] : [],
    sanitizeAdminClassroomSeatLayoutsByClassPayload: () => ({}),
    normalizeAdminClassroomSeatLayoutsByClassPayload: () => ({}),
    sanitizeAdminClassroomSeatLayoutPayload: () => ({
      rows: 6,
      columns: 8,
      seats: [],
      studentFillEnabled: true,
      teacherLocked: false,
      updatedAt: "",
    }),
    readAdminAgentConfig: async () => configState,
    normalizeAdminConfigDoc,
    sanitizeAdminClassroomTeachingConfigPayload,
    sanitizeStudentClassroomTeachingConfigPayload,
    normalizeClassroomTeachingSessionDoc,
    normalizeClassroomTeachingQuestionDoc,
    createClassroomTeachingSessionId: () => "session-created",
    createClassroomTeachingQuestionId: () => "question-created",
    TeachingSession: {
      findOne(query) {
        return {
          lean: async () => sessions.get(String(query?.lessonId || "")) || null,
        };
      },
      findOneAndUpdate(query, update) {
        const lessonId = String(query?.lessonId || "").trim();
        const current = sessions.get(lessonId) || {};
        const next = {
          ...current,
          ...(update?.$set || {}),
        };
        sessions.set(lessonId, next);
        return {
          lean: async () => next,
        };
      },
    },
    ClassroomTeachingQuestion: {
      find(query) {
        const rows = questions.filter(
          (item) =>
            String(item.lessonId || "") === String(query?.lessonId || "") &&
            String(item.sessionId || "") === String(query?.sessionId || ""),
        );
        return {
          sort() {
            return this;
          },
          limit() {
            return this;
          },
          lean: async () => rows,
        };
      },
      async create(doc) {
        questions.push(doc);
        return doc;
      },
    },
    AdminConfig: {
      findOneAndUpdate(_query, update) {
        configState = normalizeAdminConfigDoc({
          ...configState,
          ...(update?.$set || {}),
        });
        return {
          lean: async () => configState,
        };
      },
    },
    userOnlinePresenceByUserId: new Map(),
    readJsonLikeField(value) {
      return value;
    },
  };

  return {
    deps,
    setSession(lessonId, session) {
      sessions.set(String(lessonId || "").trim(), session);
    },
  };
}

test("save teaching config persists ordered pdf refs and question flag", async () => {
  const app = createAppDouble();
  const { deps } = createTeachingCenterDeps();
  registerAuthUserClassroomRoutes(app, deps);

  const route = app.routes.find(
    (item) =>
      item.method === "put" &&
      item.path === "/api/auth/admin/classroom-plans/:lessonId/teaching-config",
  );
  assert.ok(route, "expected admin teaching config route");

  const handler = route.handlers[route.handlers.length - 1];
  const res = createResponseDouble();
  await handler(
    {
      params: { lessonId: "lesson-1" },
      body: {
        teachingConfig: {
          pdfFiles: [
            { fileId: "lesson-file-2", sortOrder: 0, enabled: true },
            { fileId: "lesson-file-1", sortOrder: 1, enabled: true },
          ],
          defaultPdfFileId: "lesson-file-2",
          allowQuestions: false,
          teacherNotes: "新的教师讲稿",
        },
      },
      authAdmin: { _id: "admin-1" },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.teacherCoursePlans[0].teachingConfig.defaultPdfFileId, "lesson-file-2");
  assert.equal(res.payload.teacherCoursePlans[0].teachingConfig.allowQuestions, false);
  assert.equal(res.payload.teacherCoursePlans[0].teachingConfig.teacherNotes, "新的教师讲稿");
});

test("student task settings strips teacher notes from teaching config", async () => {
  const app = createAppDouble();
  const { deps } = createTeachingCenterDeps();
  registerAuthUserClassroomRoutes(app, deps);

  const route = app.routes.find(
    (item) => item.method === "get" && item.path === "/api/classroom/tasks/settings",
  );
  assert.ok(route, "expected classroom task settings route");

  const handler = route.handlers[route.handlers.length - 1];
  const res = createResponseDouble();
  await handler(
    {
      authTeacherScopeKey: "shangguan-fuze",
      authUser: {
        profile: { className: "810班" },
      },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      res.payload.teacherCoursePlans[0].teachingConfig,
      "teacherNotes",
    ),
    false,
  );
  assert.equal(
    res.payload.teacherCoursePlans[0].teachingConfig.defaultPdfFileId,
    "lesson-file-1",
  );
});

test("teacher start session opens default pdf page one", async () => {
  const app = createAppDouble();
  const { deps } = createTeachingCenterDeps();
  registerAuthUserClassroomRoutes(app, deps);

  const route = app.routes.find(
    (item) =>
      item.method === "post" &&
      item.path === "/api/auth/admin/classroom-plans/:lessonId/teaching-session/start",
  );
  assert.ok(route, "expected start teaching session route");

  const handler = route.handlers[route.handlers.length - 1];
  const res = createResponseDouble();
  await handler(
    {
      params: { lessonId: "lesson-1" },
      authAdmin: { _id: "admin-1" },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.session.activePdfFileId, "lesson-file-1");
  assert.equal(res.payload.session.activePage, 1);
  assert.equal(res.payload.session.status, "live");
});

test("teacher restore session resumes from last checkpoint", async () => {
  const app = createAppDouble();
  const { deps, setSession } = createTeachingCenterDeps();
  setSession("lesson-1", {
    sessionId: "session-existing",
    lessonId: "lesson-1",
    teacherScopeKey: "shangguan-fuze",
    className: "810班",
    status: "ended",
    activePdfFileId: "lesson-file-1",
    activePage: 1,
    pageCount: 0,
    startedAt: "2026-05-18T10:00:00.000Z",
    endedAt: "2026-05-18T10:10:00.000Z",
    lastCheckpoint: {
      pdfFileId: "lesson-file-2",
      page: 18,
      savedAt: "2026-05-18T10:10:00.000Z",
    },
  });
  registerAuthUserClassroomRoutes(app, deps);

  const route = app.routes.find(
    (item) =>
      item.method === "post" &&
      item.path === "/api/auth/admin/classroom-plans/:lessonId/teaching-session/restore",
  );
  assert.ok(route, "expected restore teaching session route");

  const handler = route.handlers[route.handlers.length - 1];
  const res = createResponseDouble();
  await handler(
    {
      params: { lessonId: "lesson-1" },
      authAdmin: { _id: "admin-1" },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.session.activePdfFileId, "lesson-file-2");
  assert.equal(res.payload.session.activePage, 18);
  assert.equal(res.payload.session.status, "live");
});

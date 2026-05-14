import assert from "node:assert/strict";
import test from "node:test";

import { registerAuthUserClassroomRoutes } from "../../server/routes/auth-user-classroom.js";

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

function createClassFilterDeps() {
  const noopMiddleware = (_req, _res, next) => {
    if (typeof next === "function") next();
  };
  const identityText = (value, fallback = "", maxLength = 80) =>
    String(value ?? fallback)
      .trim()
      .slice(0, maxLength);
  let lastHomeworkFindQuery = null;
  const deps = {
    cors: () => noopMiddleware,
    express: {
      json: () => noopMiddleware,
    },
    requireChatAuth: noopMiddleware,
    requireAdminAuth: noopMiddleware,
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
    sanitizeTeacherScopeKey: (value) => String(value || "").trim().toLowerCase(),
    sanitizeId: (value) => String(value || "").trim(),
    sanitizeText: identityText,
    sanitizeIsoDate: (value) => String(value || "").trim(),
    sanitizeRuntimeBoolean(value, fallback = false) {
      if (typeof value === "boolean") return value;
      if (value === "true") return true;
      if (value === "false") return false;
      return fallback;
    },
    sanitizeRuntimeInteger(value, fallback, min, max) {
      const numeric = Number.parseInt(value, 10);
      if (!Number.isFinite(numeric)) return fallback;
      return Math.max(min, Math.min(max, numeric));
    },
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
    readAdminAgentConfig: async () => ({
      shangguanClassTaskProductImprovementEnabled: false,
      seatLayoutsByClass: {},
      teacherCoursePlans: [
        {
          id: "lesson-810-open",
          courseName: "第1节课-810",
          className: "810班",
          enabled: true,
          courseStartAt: "2026-05-10T10:00:00.000Z",
        },
        {
          id: "lesson-810-closed",
          courseName: "第2节课-810",
          className: "810班",
          enabled: false,
          courseStartAt: "2026-05-11T10:00:00.000Z",
        },
        {
          id: "lesson-811-open",
          courseName: "第1节课-811",
          className: "811班",
          enabled: true,
          courseStartAt: "2026-05-12T10:00:00.000Z",
        },
      ],
    }),
    ClassroomHomeworkFile: {
      find(query) {
        lastHomeworkFindQuery = query;
        return {
          sort() {
            return this;
          },
          lean: async () => [
            {
              lessonId: "lesson-810-open",
              fileId: "file-1",
              fileName: "我的作业.pdf",
              mimeType: "application/pdf",
              size: 1024,
              uploadedAt: "2026-05-10T11:00:00.000Z",
            },
          ],
        };
      },
    },
    normalizeClassroomHomeworkFileDoc: (doc) => ({
      id: String(doc?.fileId || ""),
      name: String(doc?.fileName || ""),
      mimeType: String(doc?.mimeType || ""),
      size: Number(doc?.size || 0),
      uploadedAt: String(doc?.uploadedAt || ""),
    }),
  };
  return {
    deps,
    readLastHomeworkFindQuery() {
      return lastHomeworkFindQuery;
    },
  };
}

test("classroom task settings only expose the student's own class lessons while history keeps closed lessons from that class", async () => {
  const app = createAppDouble();
  const { deps } = createClassFilterDeps();
  registerAuthUserClassroomRoutes(app, deps);

  const route = app.routes.find(
    (item) => item.method === "get" && item.path === "/api/classroom/tasks/settings",
  );
  assert.ok(route, "expected classroom task settings route to be registered");

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
  assert.deepEqual(
    res.payload.teacherCoursePlans.map((lesson) => lesson.id),
    ["lesson-810-open"],
  );
  assert.deepEqual(
    res.payload.teacherHistoryCoursePlans.map((lesson) => lesson.id),
    ["lesson-810-open", "lesson-810-closed"],
  );
});

test("homework submissions route only reads lessons from the student's own class", async () => {
  const app = createAppDouble();
  const { deps, readLastHomeworkFindQuery } = createClassFilterDeps();
  registerAuthUserClassroomRoutes(app, deps);

  const route = app.routes.find(
    (item) =>
      item.method === "get" &&
      item.path === "/api/classroom/homework/submissions/me",
  );
  assert.ok(route, "expected homework submissions route to be registered");

  const handler = route.handlers[route.handlers.length - 1];
  const res = createResponseDouble();
  await handler(
    {
      authTeacherScopeKey: "shangguan-fuze",
      authUser: {
        _id: "student-810",
        profile: { className: "810班" },
      },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(
    res.payload.lessons.map((lesson) => lesson.id),
    ["lesson-810-open", "lesson-810-closed"],
  );
  assert.deepEqual(
    readLastHomeworkFindQuery()?.lessonId?.$in,
    ["lesson-810-open", "lesson-810-closed"],
  );
  assert.equal(
    Array.isArray(res.payload.submissionsByLesson["lesson-811-open"]),
    false,
  );
});

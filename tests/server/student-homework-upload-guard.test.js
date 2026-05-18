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

function createUploadGuardDeps() {
  const noopMiddleware = (_req, _res, next) => {
    if (typeof next === "function") next();
  };
  return {
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
    STUDENT_HOMEWORK_MAX_FILES_PER_LESSON_PER_STUDENT: 20,
    STUDENT_HOMEWORK_MAX_FILE_SIZE_BYTES: 50 * 1024 * 1024,
    sanitizeTeacherScopeKey: (value) => String(value || "").trim().toLowerCase(),
    sanitizeId: (value) => String(value || "").trim(),
    sanitizeRuntimeBoolean(value, fallback = false) {
      if (typeof value === "boolean") return value;
      return fallback;
    },
    sanitizeRuntimeInteger(value, fallback) {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : fallback;
    },
    sanitizeText: (value, fallback = "", maxLength = 80) =>
      String(value ?? fallback)
        .trim()
        .slice(0, maxLength),
    sanitizeGroupChatFileName: (value) => String(value || "").trim(),
    sanitizeGroupChatFileMimeType: (value) =>
      String(value || "").trim() || "application/octet-stream",
    sanitizeGroupChatOssObjectKey: (value) => String(value || "").trim(),
    sanitizeAliyunOssBucket: (value) => String(value || "").trim(),
    sanitizeAliyunOssRegion: (value) => String(value || "").trim(),
    sanitizeGroupChatHttpUrl: (value) => String(value || "").trim(),
    sanitizeUserProfile: (value) =>
      value && typeof value === "object" ? value : {},
    normalizeMultipartUploadFile: (file) => file,
    readJsonLikeField(value, fallback = null) {
      try {
        return JSON.parse(String(value || ""));
      } catch {
        return fallback;
      }
    },
    readAdminAgentConfig: async () => ({
      teacherCoursePlans: [
        {
          id: "lesson-1",
          courseName: "第1节课",
          enabled: true,
          homeworkUploadEnabled: true,
          lateSubmissionEnabled: false,
          courseStartAt: "2099-01-01T10:00:00.000Z",
        },
      ],
    }),
    ClassroomHomeworkFile: {
      countDocuments: async () => 0,
    },
  };
}

test("student homework upload rejects directory selections before storing files", async () => {
  const app = createAppDouble();
  registerAuthUserClassroomRoutes(app, createUploadGuardDeps());

  const route = app.routes.find(
    (item) =>
      item.method === "post" &&
      item.path === "/api/classroom/homework/submissions/:lessonId/files",
  );
  assert.ok(route, "expected student homework upload route to be registered");

  const handler = route.handlers[route.handlers.length - 1];
  const res = createResponseDouble();
  await handler(
    {
      params: { lessonId: "lesson-1" },
      authTeacherScopeKey: "shangguan-fuze",
      authUser: {
        _id: "student-1",
        username: "student-1",
        profile: { name: "张同学" },
      },
      files: [
        {
          originalname: "report.pdf",
          mimetype: "application/pdf",
          buffer: Buffer.from("demo"),
          size: 4,
        },
      ],
      body: {
        selectionEntries: JSON.stringify([
          { kind: "directory", name: "作业文件夹" },
          { kind: "file", name: "report.pdf" },
        ]),
      },
    },
    res,
  );

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.payload, {
    error: "不支持上传文件夹，请先压缩为 zip、rar 或 7z 后再上传。",
  });
});

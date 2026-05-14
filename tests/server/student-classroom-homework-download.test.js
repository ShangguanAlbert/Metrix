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
    headers: {},
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
    send(payload) {
      this.payload = payload;
      return this;
    },
  };
}

function createMinimalDeps() {
  const noopMiddleware = (_req, _res, next) => {
    if (typeof next === "function") next();
  };
  const identityText = (value, fallback = "", maxLength = 80) =>
    String(value ?? fallback)
      .trim()
      .slice(0, maxLength);
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
    sanitizeTeacherScopeKey: (value) => String(value || "").trim().toLowerCase(),
    sanitizeId: (value) => String(value || "").trim(),
    sanitizeText: identityText,
    sanitizeGroupChatFileName: (value) => String(value || "").trim(),
    sanitizeGroupChatFileMimeType: (value) =>
      String(value || "").trim() || "application/octet-stream",
    sanitizeGroupChatFileStorageType: (value) => String(value || "").trim().toLowerCase(),
    sanitizeGroupChatOssObjectKey: (value) => String(value || "").trim(),
    buildTeacherLessonFileDownloadUrl: async ({ ossKey }) =>
      `https://oss.example.com/${ossKey}?Signature=test`,
    buildAttachmentContentDisposition: (fileName) => `attachment; filename="${fileName}"`,
    ClassroomHomeworkFile: {
      findOne() {
        return {
          lean: async () => ({
            key: "admin-config",
            teacherScopeKey: "shangguan-fuze",
            fileId: "file-1",
            studentUserId: "student-1",
            fileName: "我的作业.pdf",
            mimeType: "application/pdf",
            storageType: "oss",
            ossKey: "homework/file-1.pdf",
            binary: Buffer.alloc(0),
          }),
        };
      },
    },
  };
}

test("student homework download route returns signed url for the owner's oss file", async () => {
  const app = createAppDouble();
  registerAuthUserClassroomRoutes(app, createMinimalDeps());

  const route = app.routes.find(
    (item) =>
      item.method === "get" &&
      item.path === "/api/classroom/homework/files/:fileId/download",
  );

  assert.ok(route, "expected student homework download route to be registered");

  const handler = route.handlers[route.handlers.length - 1];
  const res = createResponseDouble();
  await handler(
    {
      params: { fileId: "file-1" },
      authUser: { _id: "student-1" },
      authTeacherScopeKey: "shangguan-fuze",
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.match(String(res.payload.downloadUrl || ""), /Signature=test/);
  assert.equal(res.payload.fileName, "我的作业.pdf");
});

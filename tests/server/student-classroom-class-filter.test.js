import assert from "node:assert/strict";
import test from "node:test";

import { registerAuthUserClassroomRoutes } from "../../server/routes/auth-user-classroom.js";
import { readRoomTemplate } from "../../server/modules/party-coding/template-service.js";

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
    SHI_GAOJUN_TEACHER_SCOPE_KEY: "shi-gaojun",
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
          homeworkRequirementText: "提交实验报告 PDF 和源码压缩包。",
        },
        {
          id: "lesson-810-closed",
          courseName: "第2节课-810",
          className: "810班",
          enabled: false,
          courseStartAt: "2026-05-11T10:00:00.000Z",
          homeworkRequirementText: "补交课堂观察记录。",
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
  assert.deepEqual(
    res.payload.lessons.map((lesson) => ({
      id: lesson.id,
      homeworkRequirementText: lesson.homeworkRequirementText,
    })),
    [
      {
        id: "lesson-810-open",
        homeworkRequirementText: "提交实验报告 PDF 和源码压缩包。",
      },
      {
        id: "lesson-810-closed",
        homeworkRequirementText: "补交课堂观察记录。",
      },
    ],
  );
});

for (const scope of ["shangguan-fuze", "shi-gaojun"]) {
  test(`${scope} students receive saved task content and files with the same class and open-lesson permissions`, async () => {
    const app = createAppDouble();
    const { deps } = createClassFilterDeps();
    const readConfig = deps.readAdminAgentConfig;
    deps.readAdminAgentConfig = async () => {
      const config = await readConfig();
      config.teacherCoursePlans[0].tasks = [{ id: "task-1", title: "推荐卡内容收集", content: "收集作品名、推荐语、评分、标签", files: [{ id: "attachment-1", name: "推荐卡.txt" }] }];
      return config;
    };
    registerAuthUserClassroomRoutes(app, deps);
    const handler = app.routes.find((route) => route.path === "/api/classroom/tasks/settings").handlers.at(-1);
    const res = createResponseDouble();
    await handler({ authTeacherScopeKey: scope, authUser: { profile: { className: "810班" } } }, res);
    assert.equal(res.payload.classroomTaskEnabled, true);
    assert.deepEqual(res.payload.teacherCoursePlans.map((lesson) => lesson.id), ["lesson-810-open"]);
    assert.equal(res.payload.teacherCoursePlans[0].tasks[0].title, "推荐卡内容收集");
    assert.equal(res.payload.teacherCoursePlans[0].tasks[0].files[0].name, "推荐卡.txt");
    assert.equal(res.payload.teacherHistoryCoursePlans.length, 2);
    const unassigned = createResponseDouble();
    await handler({ authTeacherScopeKey: scope, authUser: { profile: {} } }, unassigned);
    assert.deepEqual(unassigned.payload.teacherCoursePlans, []);
    assert.deepEqual(unassigned.payload.teacherHistoryCoursePlans, []);
  });
}

for (const scope of ["shangguan-fuze", "shi-gaojun"]) {
  for (const storageType of ["mongo", "oss"]) {
    test(`${scope} downloads open lesson ${storageType} attachments, but cannot download another class or closed lesson`, async () => {
      const app = createAppDouble();
      const { deps } = createClassFilterDeps();
      const lesson = { id: "lesson-810-open", enabled: true, className: "810班" };
      let reads = 0;
      Object.assign(deps, {
        findAdminClassroomLessonByFileId: (_plans, fileId) => fileId === "file-1" ? {
          lesson, task: { type: "text" }, file: { name: "推荐卡.txt", mimeType: "text/plain" },
        } : null,
        AdminClassroomLessonFile: { findOne: () => {
          reads += 1;
          return Promise.resolve({ storageType, ossKey: storageType === "oss" ? "task/file.txt" : "", binary: Buffer.from("推荐卡") });
        } },
        sanitizeGroupChatFileName: (value) => value,
        sanitizeGroupChatFileMimeType: (value) => value,
        sanitizeGroupChatFileStorageType: (value) => value,
        sanitizeGroupChatOssObjectKey: (value) => value,
        buildTeacherLessonFileDownloadUrl: async () => "https://example.com/signed-task-file",
        buildAttachmentContentDisposition: () => "attachment",
      });
      registerAuthUserClassroomRoutes(app, deps);
      const handler = app.routes.find((route) => route.path === "/api/classroom/lessons/files/:fileId/download").handlers.at(-1);
      const request = { authTeacherScopeKey: scope, params: { fileId: "file-1" }, authUser: { profile: { className: "810班" } } };
      const response = () => Object.assign(createResponseDouble(), { setHeader() {}, send(payload) { this.payload = payload; } });
      const allowed = response();
      await handler(request, allowed);
      assert.equal(allowed.statusCode, 200);
      if (storageType === "oss") assert.equal(allowed.payload.downloadUrl, "https://example.com/signed-task-file");
      else assert.equal(allowed.payload.toString(), "推荐卡");
      assert.equal(reads, 1);
      for (const className of ["811班", ""]) {
        const denied = response();
        await handler({ ...request, authUser: { profile: { className } } }, denied);
        assert.equal(denied.statusCode, 403);
      }
      lesson.enabled = false;
      const closed = response();
      await handler(request, closed);
      assert.equal(closed.statusCode, 404);
      assert.equal(reads, 1, "unauthorized requests must not reach file storage");
    });
  }
}

test("students receive the last publication while teacher saves title/content edits or removes draft attachments", async () => {
  const app = createAppDouble();
  const { deps } = createClassFilterDeps();
  const oldLesson = { id: "published", courseName: "旧名称", className: "810班", enabled: true,
    tasks: [{ id: "task", content: "已发布内容", files: [{ id: "old-file", name: "推荐卡.txt" }] }] };
  deps.readAdminAgentConfig = async () => ({ teacherCoursePlans: [
    { ...oldLesson, courseName: "尚未发布的新名称", tasks: [], publication: { snapshot: oldLesson } },
    { id: "new", className: "810班", enabled: true, publication: { snapshot: null } },
  ] });
  registerAuthUserClassroomRoutes(app, deps);
  const handler = app.routes.find((route) => route.path === "/api/classroom/tasks/settings").handlers.at(-1);
  const res = createResponseDouble();
  await handler({ authTeacherScopeKey: "shi-gaojun", authUser: { profile: { className: "810班" } } }, res);
  assert.equal(res.payload.teacherCoursePlans.length, 1);
  assert.equal(res.payload.teacherCoursePlans[0].courseName, "旧名称");
  assert.equal(res.payload.teacherCoursePlans[0].tasks[0].files[0].id, "old-file");
});

for (const scenario of ["owner", "other-teacher", "stale", "concurrent"]) {
  test(`lesson publication checks authorization and saved revision: ${scenario}`, async () => {
    const app = createAppDouble();
    const { deps } = createClassFilterDeps();
    const lesson = { id: "lesson", courseId: "course", courseName: "新名称", className: "810班", enabled: true, updatedAt: "saved-v2", tasks: [] };
    let stored = null;
    Object.assign(deps, {
      authenticateAdminRequest: async () => ({ _id: "teacher", username: "teacher" }),
      normalizeFinalTestUsernameKey: (value) => value,
      TERMINAL_ADMIN_USERNAME_KEY: "platform",
      readAdminAgentConfig: async () => ({ teacherCoursePlans: [lesson] }),
      TeachingCourse: { findById: () => ({ lean: async () => ({ ownerTeacherId: scenario === "other-teacher" ? "other" : "teacher", classNames: ["810班"] }) }) },
      AdminConfig: { updateOne: async (query, update) => {
        assert.equal(query.teacherCoursePlans.$elemMatch.updatedAt, "saved-v2");
        stored = update.$set["teacherCoursePlans.$.publication"];
        return { matchedCount: scenario === "concurrent" ? 0 : 1 };
      } },
      AuthUser: { find: (query) => {
        assert.equal(query["profile.className"], "810班");
        return { lean: async () => [{ _id: "student-810" }] };
      } },
      GroupChatRoom: {
        updateMany: async (query) => {
          assert.equal(query.teacherScopeKey, "shi-gaojun");
          assert.deepEqual(query.memberUserIds, { $in: ["student-810"], $not: { $elemMatch: { $nin: ["student-810"] } } });
        },
        find: () => ({ lean: async () => [] }),
      },
    });
    registerAuthUserClassroomRoutes(app, deps);
    const handler = app.routes.find((route) => route.path.endsWith("/:lessonId/publish")).handlers.at(-1);
    const res = createResponseDouble();
    await handler({ params: { lessonId: "lesson" }, body: { expectedUpdatedAt: scenario === "stale" ? "old" : "saved-v2" } }, res);
    assert.equal(res.statusCode, scenario === "owner" ? 200 : scenario === "other-teacher" ? 403 : 409);
    if (scenario === "owner") assert.equal(stored.snapshot.courseName, "新名称");
    if (["other-teacher", "stale"].includes(scenario)) assert.equal(stored, null);
  });
}

for (const action of ["save", "delete-own", "steal-id"]) {
  test(`teacher draft save preserves other courses and publication boundaries: ${action}`, async () => {
    const app = createAppDouble();
    const { deps } = createClassFilterDeps();
    const own = { id: "own", courseId: "course-a", courseName: "已发布名称", className: "810班", tasks: [], files: [], updatedAt: "2026-09-21T01:00:00.000Z" };
    const other = { ...own, id: "other", courseId: "course-b", courseName: "其他教师课时" };
    let saved;
    Object.assign(deps, {
      authenticateAdminRequest: async () => ({ _id: "teacher", username: "teacher", authorizedClassNames: ["810班"] }),
      normalizeFinalTestUsernameKey: (value) => value,
      TERMINAL_ADMIN_USERNAME_KEY: "platform",
      readAdminAgentConfig: async () => ({ teacherCoursePlans: [own, other] }),
      TeachingCourse: { find: () => ({ lean: async () => [{ _id: "course-a", ownerTeacherId: "teacher", classNames: ["810班"] }] }) },
      sanitizeAdminClassroomCoursePlansPayload: (value) => value,
      sanitizeAdminClassroomCourseFilesPayload: (value) => value,
      sanitizeAdminClassroomDisciplineConfigPayload: () => ({}),
      collectAdminClassroomFileIdsFromLesson: () => [],
      normalizeAdminConfigDoc: (value) => value,
      AdminConfig: { findOneAndUpdate: (_query, update) => ({ lean: async () => { saved = update.$set; return saved; } }) },
    });
    registerAuthUserClassroomRoutes(app, deps);
    const handler = app.routes.find((route) => route.method === "put" && route.path === "/api/auth/admin/classroom-plans").handlers.at(-1);
    const res = createResponseDouble();
    await handler({ body: { teacherCoursePlans: action === "delete-own" ? [] : [{ ...own, id: action === "steal-id" ? "other" : "own", courseName: "新草稿名称", publication: { snapshot: { courseName: "伪造发布版本" } } }] } }, res);
    assert.equal(res.statusCode, action === "steal-id" ? 403 : 200);
    if (action === "steal-id") { assert.equal(saved, undefined); return; }
    assert.deepEqual(saved.teacherCoursePlans.find((lesson) => lesson.id === "other"), other);
    if (action === "save") assert.equal(saved.teacherCoursePlans.find((lesson) => lesson.id === "own").publication.snapshot.courseName, "已发布名称");
    else assert.deepEqual(saved.teacherCoursePlans.map((lesson) => lesson.id), ["other"]);
  });
}

for (const mode of ["free", "fill", "fill-without-ranges"]) {
  test(`发布课时路由同步编程快照并校验填写区：${mode}`, async () => {
    const app = createAppDouble();
    const { deps } = createClassFilterDeps();
    const lesson = { id: "today", courseId: "course", className: "810班", courseName: "本节课", updatedAt: "saved",
      tasks: [{ id: "task", content: "今天的文字任务" }], publication: { snapshot: null },
      programmingTemplate: { html: "<p>____</p>", css: "p { color: red; }", editMode: mode === "free" ? "free" : "fill",
        editableRanges: { html: mode === "fill-without-ranges" ? [] : [{ id: "answer", from: 3, to: 7 }], css: [] } },
    };
    const broadcasts = [];
    let writes = 0;
    Object.assign(deps, {
      authenticateAdminRequest: async () => ({ _id: "teacher", username: "teacher" }),
      normalizeFinalTestUsernameKey: (value) => value,
      TERMINAL_ADMIN_USERNAME_KEY: "platform",
      readAdminAgentConfig: async () => ({ teacherCoursePlans: [lesson] }),
      TeachingCourse: { findById: () => ({ lean: async () => ({ ownerTeacherId: "teacher", classNames: ["810班"] }) }) },
      AdminConfig: {
        updateOne: async (_query, update) => {
          writes += 1;
          lesson.publication = update.$set["teacherCoursePlans.$.publication"];
          return { matchedCount: 1 };
        },
        findOne: () => ({ lean: async () => ({ teacherCoursePlans: [lesson] }) }),
      },
      AuthUser: { find: () => ({ lean: async () => [{ _id: "student", profile: { className: "810班" }, lockedTeacherScopeKey: "shi-gaojun" }] }) },
      GroupChatRoom: {
        updateMany: async () => {},
        find: () => ({ lean: async () => [{ _id: "room" }] }),
      },
      broadcastGroupChatRoomUpdated: () => {},
      broadcastGroupChatWsPayload: (_roomId, payload) => broadcasts.push(payload),
    });
    registerAuthUserClassroomRoutes(app, deps);
    const handler = app.routes.find((route) => route.path === "/api/auth/admin/classroom-plans/:lessonId/publish").handlers.at(-1);
    const res = createResponseDouble();
    await handler({ params: { lessonId: "today" }, body: { expectedUpdatedAt: "saved" } }, res);
    if (mode === "fill-without-ranges") {
      assert.equal(res.statusCode, 400);
      assert.match(res.payload.error, /填写区/);
      assert.equal(writes, 0);
      assert.equal(broadcasts.length, 0);
      return;
    }
    assert.equal(res.statusCode, 200);
    assert.equal(lesson.publication.snapshot.tasks[0].content, "今天的文字任务");
    const template = await readRoomTemplate({ ...deps, memberUserIds: ["student"],
      Template: { findOne: () => ({ sort() { return this; }, lean: async () => null }) },
    });
    assert.equal(template.lessonId, "today");
    assert.equal(template.html, lesson.programmingTemplate.html);
    assert.equal(template.css, lesson.programmingTemplate.css);
    assert.equal(template.editMode, mode);
    assert.deepEqual(template.editableRanges, lesson.programmingTemplate.editableRanges);
    assert.equal(broadcasts[0].type, "coding_collab_template_published");
    assert.equal(broadcasts[0].roomId, "room");
  });
}

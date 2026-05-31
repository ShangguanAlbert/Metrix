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

function createFinalTestSessionModelDouble() {
  const store = new Map();

  function normalizeKey(query) {
    return [
      String(query?.teacherScopeKey || ""),
      String(query?.studentUserId || ""),
      String(query?.className || ""),
    ].join("::");
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  return {
    async findOne(query) {
      return clone(store.get(normalizeKey(query)) || null);
    },
    async findOneAndUpdate(query, update, options = {}) {
      const key = normalizeKey(query);
      const current = clone(store.get(key) || {});
      const setPayload = update?.$set && typeof update.$set === "object" ? update.$set : {};
      const next = {
        ...current,
        ...setPayload,
      };
      if (!next.teacherScopeKey) next.teacherScopeKey = String(query?.teacherScopeKey || "");
      if (!next.studentUserId) next.studentUserId = String(query?.studentUserId || "");
      if (!next.className) next.className = String(query?.className || "");
      store.set(key, clone(next));
      return options?.lean ? clone(next) : next;
    },
  };
}

function createAdminConfigModelDouble(initial = {}) {
  let store = {
    key: "admin-config",
    updatedAt: "2026-05-31T00:00:00.000Z",
    ...JSON.parse(JSON.stringify(initial)),
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  return {
    read() {
      return clone(store);
    },
    findOneAndUpdate(query, update) {
      const setPayload = update?.$set && typeof update.$set === "object" ? update.$set : {};
      store = {
        ...store,
        ...clone(setPayload),
        key: String(query?.key || store.key || "admin-config"),
        updatedAt: "2026-05-31T08:00:00.000Z",
      };
      return {
        lean: async () => clone(store),
      };
    },
  };
}

function createFinalTestDeps() {
  const env = {
    FINAL_TEST_TURNBACK_PASSPHRASE: "test-turnback-passphrase",
    FINAL_TEST_RESTART_PASSPHRASE: "test-restart-passphrase",
  };
  const noopMiddleware = (_req, _res, next) => {
    if (typeof next === "function") next();
  };
  const identityText = (value, fallback = "", maxLength = 80) =>
    String(value ?? fallback)
      .trim()
      .slice(0, maxLength);
  const FinalTestSession = createFinalTestSessionModelDouble();
  const AdminConfig = createAdminConfigModelDouble({
    shangguanClassTaskProductImprovementEnabled: false,
    seatLayoutsByClass: {},
    finalTestConfig: {
      introText: "本次期末测试分为两个部分。第一个部分是改进任务，第二个部分是创新任务。",
      tasks: [
        {
          id: "task-1",
          title: "任务 1：改进普通书包",
          description: "请围绕普通书包提出改进方案，尽量写清楚你发现的问题、改进思路和使用方式。",
          mode: "platform",
        },
        {
          id: "task-2",
          title: "任务 2：创新任务",
          description: "任务 2：创新任务在线下独立完成，不在本页面提交。",
          mode: "offline",
        },
      ],
    },
    teacherCoursePlans: [
      {
        id: "lesson-810-open",
        courseName: "第1节课-810",
        className: "810班",
        enabled: true,
        courseStartAt: "2026-05-10T10:00:00.000Z",
      },
      {
        id: "lesson-811-open",
        courseName: "第1节课-811",
        className: "811班",
        enabled: true,
        courseStartAt: "2026-05-12T10:00:00.000Z",
      },
    ],
  });
  return {
    cors: () => noopMiddleware,
    express: {
      json: () => noopMiddleware,
    },
    env,
    requireChatAuth: noopMiddleware,
    requireAdminAuth: noopMiddleware,
    studentHomeworkUpload: {
      array: () => noopMiddleware,
    },
    teacherClassroomFileUpload: {
      array: () => noopMiddleware,
    },
    authenticateAdminRequest: async () => ({
      _id: "admin-1",
      username: "teacher",
      role: "admin",
    }),
    SHANGGUAN_FUZE_TEACHER_SCOPE_KEY: "shangguan-fuze",
    DEFAULT_TEACHER_SCOPE_KEY: "default",
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
    readAdminAgentConfig: async () => AdminConfig.read(),
    AdminConfig,
    ClassroomHomeworkFile: {
      find() {
        return {
          sort() {
            return this;
          },
          lean: async () => [],
        };
      },
    },
    normalizeClassroomHomeworkFileDoc: (doc) => doc,
    FinalTestSession,
  };
}

test("classroom task settings expose final test variant and duration by class", async () => {
  const app = createAppDouble();
  const deps = createFinalTestDeps();
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
        _id: "student-810",
        profile: { className: "810班" },
      },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.experimentTask.enabled, true);
  assert.equal(res.payload.experimentTask.variant, "three-stage-guided");
  assert.equal(res.payload.experimentTask.durationMinutes, 20);
  assert.equal(res.payload.finalTestConfig.taskTitle, "任务 1：改进普通书包");
  assert.match(res.payload.finalTestConfig.taskDescription, /普通书包/);
  assert.equal(res.payload.finalTestConfig.tasks.length, 2);
});

test("admin final test config routes persist the teacher-authored test content", async () => {
  const app = createAppDouble();
  const deps = createFinalTestDeps();
  registerAuthUserClassroomRoutes(app, deps);

  const getRoute = app.routes.find(
    (item) => item.method === "get" && item.path === "/api/auth/admin/final-test-config",
  );
  const putRoute = app.routes.find(
    (item) => item.method === "put" && item.path === "/api/auth/admin/final-test-config",
  );
  assert.ok(getRoute, "expected admin final test config get route");
  assert.ok(putRoute, "expected admin final test config put route");

  const getHandler = getRoute.handlers[getRoute.handlers.length - 1];
  const putHandler = putRoute.handlers[putRoute.handlers.length - 1];

  const initialRes = createResponseDouble();
  await getHandler({}, initialRes);
  assert.equal(initialRes.statusCode, 200);
  assert.equal(initialRes.payload.finalTestConfig.taskTitle, "任务 1：改进普通书包");

  const saveRes = createResponseDouble();
  await putHandler(
    {
      body: {
        finalTestConfig: {
          introText: "本次期末测试先完成平台内改进任务，再完成线下创新任务。",
          tasks: [
            {
              id: "task-1",
              title: "任务 1：改进教室储物柜",
              description: "请围绕教室储物柜提出改进方案，写清楚问题、改进办法和使用流程。",
              mode: "platform",
            },
            {
              id: "task-2",
              title: "任务 2：线下创新",
              description: "任务 2 线下完成，可以结合画图表达。",
              mode: "offline",
            },
          ],
        },
      },
    },
    saveRes,
  );
  assert.equal(saveRes.statusCode, 200);
  assert.equal(saveRes.payload.finalTestConfig.taskTitle, "任务 1：改进教室储物柜");
  assert.match(saveRes.payload.finalTestConfig.task2OfflineText, /线下完成/);
  assert.equal(saveRes.payload.finalTestConfig.tasks.length, 2);

  const afterSaveRes = createResponseDouble();
  await getHandler({}, afterSaveRes);
  assert.equal(afterSaveRes.statusCode, 200);
  assert.equal(afterSaveRes.payload.finalTestConfig.taskTitle, "任务 1：改进教室储物柜");
  assert.match(afterSaveRes.payload.finalTestConfig.taskDescription, /储物柜/);
  assert.equal(afterSaveRes.payload.finalTestConfig.tasks[1].mode, "offline");
});

test("starting a final test session creates a 20-minute timed session", async () => {
  const app = createAppDouble();
  const deps = createFinalTestDeps();
  registerAuthUserClassroomRoutes(app, deps);

  const route = app.routes.find(
    (item) =>
      item.method === "post" &&
      item.path === "/api/classroom/final-test/session/start",
  );
  assert.ok(route, "expected final test start route");

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
  assert.equal(res.payload.session.variant, "three-stage-guided");
  assert.equal(res.payload.session.status, "stage1_draft");
  assert.equal(res.payload.session.durationMinutes, 20);
  assert.ok(res.payload.session.startedAt);
  assert.ok(res.payload.session.deadlineAt);
});

test("turnback with the expected passphrase opens a new editable stage version", async () => {
  const app = createAppDouble();
  const deps = createFinalTestDeps();
  registerAuthUserClassroomRoutes(app, deps);

  const startRoute = app.routes.find(
    (item) =>
      item.method === "post" &&
      item.path === "/api/classroom/final-test/session/start",
  );
  const turnbackRoute = app.routes.find(
    (item) =>
      item.method === "post" &&
      item.path === "/api/classroom/final-test/session/turnback",
  );
  assert.ok(startRoute, "expected final test start route");
  assert.ok(turnbackRoute, "expected final test turnback route");

  const startHandler = startRoute.handlers[startRoute.handlers.length - 1];
  const turnbackHandler = turnbackRoute.handlers[turnbackRoute.handlers.length - 1];

  await startHandler(
    {
      authTeacherScopeKey: "shangguan-fuze",
      authUser: {
        _id: "student-810",
        profile: { className: "810班" },
      },
    },
    createResponseDouble(),
  );

  const res = createResponseDouble();
  await turnbackHandler(
    {
      authTeacherScopeKey: "shangguan-fuze",
      authUser: {
        _id: "student-810",
        profile: { className: "810班" },
      },
      body: {
        fromStage: "stage3",
        toStage: "stage2",
        passphrase: "test-turnback-passphrase",
        reason: "误点提交",
      },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.session.status, "stage2_active");
  assert.equal(res.payload.session.turnbackEvents.length, 1);
  assert.equal(res.payload.session.turnbackEvents[0].reason, "误点提交");
});

test("restart with the expected passphrase resets the session and records the event", async () => {
  const app = createAppDouble();
  const deps = createFinalTestDeps();
  registerAuthUserClassroomRoutes(app, deps);

  const startRoute = app.routes.find(
    (item) =>
      item.method === "post" &&
      item.path === "/api/classroom/final-test/session/start",
  );
  const restartRoute = app.routes.find(
    (item) =>
      item.method === "post" &&
      item.path === "/api/classroom/final-test/session/restart",
  );
  assert.ok(startRoute, "expected final test start route");
  assert.ok(restartRoute, "expected final test restart route");

  const startHandler = startRoute.handlers[startRoute.handlers.length - 1];
  const restartHandler = restartRoute.handlers[restartRoute.handlers.length - 1];

  await startHandler(
    {
      authTeacherScopeKey: "shangguan-fuze",
      authUser: {
        _id: "student-810",
        profile: { className: "810班" },
      },
    },
    createResponseDouble(),
  );

  await deps.FinalTestSession.findOneAndUpdate(
    {
      key: "admin-config",
      teacherScopeKey: "shangguan-fuze",
      studentUserId: "student-810",
      className: "810班",
    },
    {
      $set: {
        status: "stage3_active",
        payload: {
          stage1: {
            ideas: [{ id: "idea-1", text: "旧内容" }],
            lockedAt: "",
            submittedAt: "",
            pasteBlockedCount: 0,
          },
          stage2: {
            messages: [{ id: "msg-1", role: "assistant", content: "旧 AI 回复" }],
            promptCardClicks: [],
            promptCardCopies: [],
            transfers: [],
            riskEvents: [],
            draftText: "旧草稿",
            submittedAt: "",
          },
          stage3: {
            draft: {},
            finalText: "旧定稿",
            pasteEvents: [],
            riskEvents: [],
            submittedAt: "",
          },
          turnbackEvents: [],
          riskLog: [{ type: "tab_hidden" }],
        },
      },
    },
    { lean: true },
  );

  const res = createResponseDouble();
  await restartHandler(
    {
      authTeacherScopeKey: "shangguan-fuze",
      authUser: {
        _id: "student-810",
        profile: { className: "810班" },
      },
      body: {
        passphrase: "test-restart-passphrase",
        reason: "误操作，需要重新作答",
      },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.session.status, "stage1_draft");
  assert.deepEqual(res.payload.session.stage1.ideas, []);
  assert.equal(res.payload.session.stage2.draftText, "");
  assert.equal(res.payload.session.stage3.finalText, "");
  assert.equal(res.payload.session.turnbackEvents.length, 1);
  assert.equal(res.payload.session.turnbackEvents[0].kind, "restart");
  assert.equal(res.payload.session.turnbackEvents[0].reason, "误操作，需要重新作答");
  assert.equal(res.payload.session.turnbackEvents[0].previousSession.stage3.finalText, "旧定稿");
  assert.equal(res.payload.session.turnbackEvents[0].previousSession.stage2.draftText, "旧草稿");
  assert.equal(res.payload.session.turnbackEvents[0].previousSession.stage1.ideas[0].text, "旧内容");
});

test("debug-mode final test requests bypass automatic timeout locking", async () => {
  const app = createAppDouble();
  const deps = createFinalTestDeps();
  registerAuthUserClassroomRoutes(app, deps);

  const startRoute = app.routes.find(
    (item) =>
      item.method === "post" &&
      item.path === "/api/classroom/final-test/session/start",
  );
  const getRoute = app.routes.find(
    (item) =>
      item.method === "get" &&
      item.path === "/api/classroom/final-test/session",
  );
  assert.ok(startRoute, "expected final test start route");
  assert.ok(getRoute, "expected final test session route");

  const startHandler = startRoute.handlers[startRoute.handlers.length - 1];
  const getHandler = getRoute.handlers[getRoute.handlers.length - 1];

  await startHandler(
    {
      authTeacherScopeKey: "shangguan-fuze",
      authUser: {
        _id: "student-810",
        profile: { className: "810班" },
      },
    },
    createResponseDouble(),
  );

  await deps.FinalTestSession.findOneAndUpdate(
    {
      key: "admin-config",
      teacherScopeKey: "shangguan-fuze",
      studentUserId: "student-810",
      className: "810班",
    },
    {
      $set: {
        status: "stage1_draft",
        deadlineAt: "2026-05-31T10:00:00.000Z",
        payload: {
          stage1: { ideas: [], lockedAt: "", submittedAt: "", pasteBlockedCount: 0 },
          stage2: { messages: [], promptCardClicks: [], promptCardCopies: [], transfers: [], riskEvents: [], submittedAt: "" },
          stage3: { draft: {}, pasteEvents: [], riskEvents: [], submittedAt: "" },
          turnbackEvents: [],
          riskLog: [],
        },
      },
    },
    { lean: true },
  );

  const res = createResponseDouble();
  await getHandler(
    {
      authTeacherScopeKey: "shangguan-fuze",
      authUser: {
        _id: "student-810",
        profile: { className: "810班" },
      },
      query: {
        finalTestDebug: "1",
      },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.session.status, "stage1_draft");
  assert.equal(res.payload.session.timeExpired, false);
});

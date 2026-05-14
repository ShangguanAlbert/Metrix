# Student Homework History Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only student sidebar module that lists started lessons, shows whether the current student submitted homework for each lesson, and allows downloading only the student's own historical homework files.

**Architecture:** Reuse the existing student homepage and classroom homework data flow instead of adding a new route or model. Add one student-scoped download endpoint on the backend, one API helper on the frontend, and a small pure helper module to derive historical lesson state for the new panel.

**Tech Stack:** React 19, Vite, Express 5, Node `node:test`, ESLint

---

### Task 1: Add a pure history helper with TDD

**Files:**
- Create: `src/features/classroom/studentHomeworkHistory.js`
- Create: `tests/chat/student-homework-history.test.js`

- [ ] **Step 1: Write the failing test**

```js
import assert from "node:assert/strict";
import test from "node:test";

async function loadModule() {
  try {
    return await import("../../src/features/classroom/studentHomeworkHistory.js");
  } catch {
    return null;
  }
}

test("getStudentHomeworkHistoryLessons keeps only started enabled lessons and annotates submission state", async () => {
  const mod = await loadModule();
  assert.ok(mod, "studentHomeworkHistory module should exist");
  assert.equal(typeof mod.getStudentHomeworkHistoryLessons, "function");

  const result = mod.getStudentHomeworkHistoryLessons(
    [
      { id: "future", courseName: "第3节课", enabled: true, courseStartAt: "2099-01-01T10:00:00.000Z" },
      { id: "past-a", courseName: "第1节课", enabled: true, courseStartAt: "2026-05-10T10:00:00.000Z" },
      { id: "past-b", courseName: "第2节课", enabled: true, courseStartAt: "2026-05-12T10:00:00.000Z" },
      { id: "closed", courseName: "第4节课", enabled: false, courseStartAt: "2026-05-09T10:00:00.000Z" },
    ],
    {
      "past-a": [{ id: "file-1" }],
      "past-b": [],
    },
    { nowMs: Date.parse("2026-05-14T00:00:00.000Z") },
  );

  assert.deepEqual(
    result.map((item) => ({
      id: item.id,
      submitted: item.submitted,
      submissionCount: item.submissionCount,
    })),
    [
      { id: "past-b", submitted: false, submissionCount: 0 },
      { id: "past-a", submitted: true, submissionCount: 1 },
    ],
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/chat/student-homework-history.test.js`
Expected: FAIL because `studentHomeworkHistory` module or export does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```js
function parseIsoTimeMs(value) {
  const time = Date.parse(String(value || ""));
  return Number.isFinite(time) ? time : Number.NaN;
}

export function getStudentHomeworkHistoryLessons(lessons = [], submissionsByLesson = {}, options = {}) {
  const nowMs = Number.isFinite(options?.nowMs) ? options.nowMs : Date.now();
  return (Array.isArray(lessons) ? lessons : [])
    .filter((lesson) => lesson && lesson.enabled !== false)
    .map((lesson) => {
      const id = String(lesson?.id || "").trim();
      const submissions = Array.isArray(submissionsByLesson?.[id]) ? submissionsByLesson[id] : [];
      return {
        ...lesson,
        id,
        startMs: parseIsoTimeMs(lesson?.courseStartAt),
        submissions,
        submitted: submissions.length > 0,
        submissionCount: submissions.length,
      };
    })
    .filter((lesson) => lesson.id && Number.isFinite(lesson.startMs) && lesson.startMs <= nowMs)
    .sort((a, b) => b.startMs - a.startMs);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/chat/student-homework-history.test.js`
Expected: PASS

### Task 2: Add the student homework download route with TDD

**Files:**
- Create: `tests/server/student-classroom-homework-download.test.js`
- Modify: `server/routes/auth-user-classroom.js`

- [ ] **Step 1: Write the failing test**

```js
import assert from "node:assert/strict";
import test from "node:test";

import { registerAuthUserClassroomRoutes } from "../../server/routes/auth-user-classroom.js";

function createAppDouble() {
  const routes = [];
  return {
    routes,
    use() { return this; },
    get(path, ...handlers) { routes.push({ method: "get", path, handlers }); return this; },
    post(path, ...handlers) { routes.push({ method: "post", path, handlers }); return this; },
    put(path, ...handlers) { routes.push({ method: "put", path, handlers }); return this; },
    delete(path, ...handlers) { routes.push({ method: "delete", path, handlers }); return this; },
  };
}

function createResponseDouble() {
  return {
    statusCode: 200,
    headers: {},
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
    setHeader(name, value) { this.headers[name] = value; },
    send(payload) { this.payload = payload; return this; },
  };
}

test("student homework download route returns signed url for the owner's oss file", async () => {
  const app = createAppDouble();
  registerAuthUserClassroomRoutes(app, createMinimalDeps());

  const route = app.routes.find(
    (item) => item.method === "get" && item.path === "/api/classroom/homework/files/:fileId/download",
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/server/student-classroom-homework-download.test.js`
Expected: FAIL because the route is not registered yet.

- [ ] **Step 3: Write minimal implementation**

Add `GET /api/classroom/homework/files/:fileId/download` in `server/routes/auth-user-classroom.js` using the same OSS-first response shape as the existing admin homework download route, but scoped to:

```js
{
  key: ADMIN_CONFIG_KEY,
  teacherScopeKey,
  fileId,
  studentUserId,
}
```

and return:

```js
res.json({
  ok: true,
  downloadUrl,
  fileName,
  mimeType,
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/server/student-classroom-homework-download.test.js`
Expected: PASS

### Task 3: Wire the frontend API and panel

**Files:**
- Modify: `src/pages/classroom/classroomApi.js`
- Modify: `src/pages/ModeSelectionPage.jsx`
- Modify: `shared/classroomFileLabels.js` only if existing homework label helper needs reuse without changes

- [ ] **Step 1: Write the failing test**

Reuse `tests/chat/student-homework-history.test.js` to assert the helper keeps all started lessons, including ones with zero submissions.

- [ ] **Step 2: Run test to verify it fails if helper semantics are wrong**

Run: `node --test tests/chat/student-homework-history.test.js`
Expected: FAIL if the helper hides unsubmitted history lessons or includes future lessons.

- [ ] **Step 3: Write minimal implementation**

In `src/pages/classroom/classroomApi.js`, add:

```js
export async function downloadClassroomHomeworkFile(fileId, { fileKind } = {}) {
  // mirror downloadClassroomLessonFile but call /api/classroom/homework/files/:fileId/download
}
```

In `src/pages/ModeSelectionPage.jsx`:

- add sidebar item `history-homework`
- compute history lessons from `teacherCoursePlans` + `homeworkSubmissionsByLesson`
- render a read-only panel
- show `已提交 / 未提交`
- show file name, size, upload time, and download button
- remove upload/delete controls from this panel entirely

- [ ] **Step 4: Run tests and checks**

Run:

```bash
node --test tests/chat/student-homework-history.test.js tests/server/student-classroom-homework-download.test.js
npx eslint src/pages/ModeSelectionPage.jsx src/pages/classroom/classroomApi.js src/features/classroom/studentHomeworkHistory.js server/routes/auth-user-classroom.js tests/chat/student-homework-history.test.js tests/server/student-classroom-homework-download.test.js
node --check src/pages/classroom/classroomApi.js
node --check server/routes/auth-user-classroom.js
```

Expected: all commands exit 0

# Teaching Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a teacher-side teaching center, resumable lesson teaching sessions, and a student-side PDF session viewer on top of the existing classroom lesson model.

**Architecture:** Keep `teacherCoursePlans` as the single lesson source of truth, add low-frequency `teachingConfig` onto each lesson, and store high-frequency live teaching state in a separate lightweight session store. Reuse existing lesson-file upload/download paths for PDF assets, and add thin session snapshot plus room-event APIs for live viewing.

**Tech Stack:** React 19, Vite, Express 5, MongoDB, existing WebSocket room infrastructure, Node `node:test`

---

## File Map

- Modify: `server/services/core-runtime.js`
  - Extend lesson payload sanitization with `teachingConfig`
  - Add `TeachingSession` and `TeachingQuestion` models/helpers
- Modify: `server/routes/auth-user-classroom.js`
  - Add teacher teaching-config and session APIs
  - Add student session snapshot/question/raise-hand APIs
- Modify: `src/pages/TeacherHomePage.jsx`
  - Add `teaching-center` panel and route state
- Modify: `src/pages/ModeSelectionPage.jsx`
  - Add student entry into teaching session / read-only viewer
- Modify: `src/pages/classroom/classroomApi.js`
  - Add teacher/student teaching center request helpers
- Modify: `src/features/classroom/routes.js`
  - Add student teaching session route if needed
- Create: `src/features/classroom/pages/TeachingSessionPage.jsx`
  - Student viewer page
- Create: `src/features/classroom/pages/TeacherTeachingSessionPage.jsx`
  - Teacher live session page
- Create: `src/features/classroom/teachingSessionStore.js`
  - Shared client-side lesson session state helpers
- Create: `tests/server/teaching-center-routes.test.js`
  - Backend contract tests for config/session APIs
- Create: `tests/chat/teaching-session-state.test.js`
  - Client-side state helper tests

### Task 1: Backend lesson teaching config

**Files:**
- Modify: `server/services/core-runtime.js`
- Modify: `server/routes/auth-user-classroom.js`
- Test: `tests/server/teaching-center-routes.test.js`

- [ ] **Step 1: Write the failing config tests**

```js
test("save teaching config persists ordered pdf refs and question flag", async () => {
  const { route, deps } = createAdminTeachingConfigRouteHarness();
  const res = await invokeJsonRoute(route, {
    params: { lessonId: "lesson-1" },
    body: {
      teachingConfig: {
        pdfFiles: [{ fileId: "lesson-file-1", sortOrder: 0, enabled: true }],
        defaultPdfFileId: "lesson-file-1",
        allowQuestions: true,
        teacherNotes: "only teacher",
      },
    },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.teacherCoursePlans[0].teachingConfig.defaultPdfFileId, "lesson-file-1");
});

test("student task settings strips teacher notes from teaching config", async () => {
  const res = await invokeStudentTaskSettingsRouteWithTeachingConfig();
  assert.equal("teacherNotes" in res.payload.teacherCoursePlans[0].teachingConfig, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/server/teaching-center-routes.test.js`
Expected: FAIL because teaching config routes/helpers do not exist yet.

- [ ] **Step 3: Implement minimal lesson teaching config sanitizers and route**

```js
function sanitizeAdminLessonTeachingConfigPayload(input) {
  return {
    pdfFiles: sanitizeTeachingPdfRefs(input?.pdfFiles),
    defaultPdfFileId: sanitizeId(input?.defaultPdfFileId, ""),
    allowQuestions: sanitizeRuntimeBoolean(input?.allowQuestions, true),
    teacherNotes: sanitizeTrimmedString(input?.teacherNotes, TEACHER_NOTES_MAX_LENGTH),
    welcomeText: sanitizeTrimmedString(input?.welcomeText, WELCOME_TEXT_MAX_LENGTH),
    updatedAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/server/teaching-center-routes.test.js`
Expected: PASS for config persistence and student payload filtering.

- [ ] **Step 5: Commit**

```bash
git add server/services/core-runtime.js server/routes/auth-user-classroom.js tests/server/teaching-center-routes.test.js
git commit -m "feat: add lesson teaching config"
```

### Task 2: Backend live teaching session state and restore rules

**Files:**
- Modify: `server/services/core-runtime.js`
- Modify: `server/routes/auth-user-classroom.js`
- Test: `tests/server/teaching-center-routes.test.js`

- [ ] **Step 1: Write the failing session tests**

```js
test("teacher start session opens default pdf page one", async () => {
  const res = await invokeStartTeachingSessionRoute({
    lessonId: "lesson-1",
    teachingConfig: { defaultPdfFileId: "lesson-file-1" },
  });
  assert.equal(res.payload.session.activePdfFileId, "lesson-file-1");
  assert.equal(res.payload.session.activePage, 1);
});

test("teacher restore session resumes from last checkpoint", async () => {
  const res = await invokeRestoreTeachingSessionRoute({
    lessonId: "lesson-1",
    checkpoint: { pdfFileId: "lesson-file-2", page: 18 },
  });
  assert.equal(res.payload.session.activePdfFileId, "lesson-file-2");
  assert.equal(res.payload.session.activePage, 18);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/server/teaching-center-routes.test.js`
Expected: FAIL because teaching session store/routes do not exist yet.

- [ ] **Step 3: Implement minimal session models and routes**

```js
const teachingSessionSchema = new mongoose.Schema({
  lessonId: { type: String, index: true },
  status: { type: String, default: "idle" },
  activePdfFileId: { type: String, default: "" },
  activePage: { type: Number, default: 1 },
  lastCheckpoint: {
    pdfFileId: { type: String, default: "" },
    page: { type: Number, default: 1 },
    savedAt: { type: String, default: "" },
  },
}, { timestamps: true });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/server/teaching-center-routes.test.js`
Expected: PASS for start/end/restore snapshot rules.

- [ ] **Step 5: Commit**

```bash
git add server/services/core-runtime.js server/routes/auth-user-classroom.js tests/server/teaching-center-routes.test.js
git commit -m "feat: add live teaching session routes"
```

### Task 3: Teacher teaching center UI

**Files:**
- Modify: `src/pages/TeacherHomePage.jsx`
- Modify: `src/pages/classroom/classroomApi.js`
- Test: `tests/chat/teaching-session-state.test.js`

- [ ] **Step 1: Write the failing client-state tests**

```js
test("buildTeachingCenterLessons marks configured and live states", () => {
  const lessons = buildTeachingCenterLessons([
    { id: "lesson-1", teachingConfig: { defaultPdfFileId: "file-1" } },
  ], [{ lessonId: "lesson-1", status: "live" }]);
  assert.equal(lessons[0].teachingStatus, "live");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/chat/teaching-session-state.test.js`
Expected: FAIL because helper does not exist.

- [ ] **Step 3: Implement minimal teacher panel**

```jsx
{ key: "teaching-center", label: "授课中心", icon: Presentation }
```

and render a split view that:

- reads mirrored lessons from `teacherCoursePlans`
- edits `teachingConfig`
- starts teacher session page in a new tab

- [ ] **Step 4: Run focused checks**

Run: `node --test tests/chat/teaching-session-state.test.js`
Run: `npx eslint src/pages/TeacherHomePage.jsx src/pages/classroom/classroomApi.js`
Expected: PASS / no ESLint errors in touched files.

- [ ] **Step 5: Commit**

```bash
git add src/pages/TeacherHomePage.jsx src/pages/classroom/classroomApi.js tests/chat/teaching-session-state.test.js
git commit -m "feat: add teacher teaching center panel"
```

### Task 4: Teacher and student teaching session pages

**Files:**
- Create: `src/features/classroom/pages/TeacherTeachingSessionPage.jsx`
- Create: `src/features/classroom/pages/TeachingSessionPage.jsx`
- Modify: `src/features/classroom/routes.js`
- Modify: `src/pages/ModeSelectionPage.jsx`
- Modify: `src/pages/classroom/classroomApi.js`

- [ ] **Step 1: Write the failing viewer-state tests**

```js
test("student viewer leaves follow mode on manual page change and can rejoin teacher page", () => {
  let state = createTeachingViewerState({ activePage: 5 });
  state = reduceTeachingViewerState(state, { type: "student_page_changed", page: 3 });
  assert.equal(state.followingTeacher, false);
  state = reduceTeachingViewerState(state, { type: "jump_to_teacher", page: 6 });
  assert.equal(state.followingTeacher, true);
  assert.equal(state.page, 6);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/chat/teaching-session-state.test.js`
Expected: FAIL because viewer reducer does not exist.

- [ ] **Step 3: Implement minimal pages**

```jsx
<Route path="/classroom/teaching/:lessonId" component={TeachingSessionPage} auth="user" />
<Route path="/teacher/teaching/:lessonId" component={TeacherTeachingSessionPage} auth="admin" />
```

Teacher page responsibilities:

- snapshot load
- one live room subscription
- current PDF/page controls
- restore progress / end session

Student page responsibilities:

- snapshot load
- weak-follow mode
- raise hand / submit question
- ended-state read-only fallback

- [ ] **Step 4: Run focused checks**

Run: `node --test tests/chat/teaching-session-state.test.js`
Run: `npx eslint src/features/classroom/pages/TeacherTeachingSessionPage.jsx src/features/classroom/pages/TeachingSessionPage.jsx src/features/classroom/routes.js src/pages/ModeSelectionPage.jsx src/pages/classroom/classroomApi.js`
Expected: PASS / no ESLint errors in touched files.

- [ ] **Step 5: Commit**

```bash
git add src/features/classroom/pages/TeacherTeachingSessionPage.jsx src/features/classroom/pages/TeachingSessionPage.jsx src/features/classroom/routes.js src/pages/ModeSelectionPage.jsx src/pages/classroom/classroomApi.js tests/chat/teaching-session-state.test.js
git commit -m "feat: add teaching session pages"
```

### Task 5: Verification

**Files:**
- Modify: touched files only if verification finds defects

- [ ] **Step 1: Run targeted backend tests**

Run: `node --test tests/server/teaching-center-routes.test.js`
Expected: PASS

- [ ] **Step 2: Run targeted client tests**

Run: `node --test tests/chat/teaching-session-state.test.js`
Expected: PASS

- [ ] **Step 3: Run syntax and lint checks**

Run: `node --check server/routes/auth-user-classroom.js`
Run: `node --check server/services/core-runtime.js`
Run: `npx eslint src/pages/TeacherHomePage.jsx src/pages/ModeSelectionPage.jsx src/pages/classroom/classroomApi.js src/features/classroom/routes.js src/features/classroom/pages/TeacherTeachingSessionPage.jsx src/features/classroom/pages/TeachingSessionPage.jsx`
Expected: PASS

- [ ] **Step 4: Review git diff and status**

Run: `git status --short`
Run: `git diff --stat`
Expected: only intended feature files changed; `.superpowers/` remains untracked and excluded from commits.

- [ ] **Step 5: Commit final fixes**

```bash
git add <touched files>
git commit -m "feat: complete teaching center flow"
```

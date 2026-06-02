# Final Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a student-side `期末测试` workspace with class-based 810/811 flows, a 15-minute timed session, session recovery, Stage 1/Stage 3 paste controls, risk logging, and Stage 2-to-Stage 3 internal transfer.

**Architecture:** Keep the student shell in `ModeSelectionPage` and add a dedicated `final-test` panel there. Persist final-test session state through new classroom APIs and a dedicated session document, but reuse the existing `/api/chat/stream` endpoint for Stage 2 AI generation so the test UI stays custom while the model runtime stays shared.

**Tech Stack:** React 19, React Router 7 with `BrowserRouter`, Express 5 route registration, MongoDB via Mongoose, node:test.

---

### Task 1: Define backend contract and task-session model

**Files:**
- Modify: `server/services/core-runtime.js`
- Modify: `server/routes/auth-user-classroom.js`
- Test: `tests/server/final-test-routes.test.js`

- [ ] **Step 1: Write the failing route-contract test**

```js
test("classroom task settings expose final test variant and duration by class", async () => {
  const app = createAppDouble();
  const deps = createFinalTestDeps();
  registerAuthUserClassroomRoutes(app, deps);

  const route = app.routes.find(
    (item) => item.method === "get" && item.path === "/api/classroom/tasks/settings",
  );
  const handler = route.handlers[route.handlers.length - 1];
  const res = createResponseDouble();

  await handler(
    {
      authTeacherScopeKey: "shangguan-fuze",
      authUser: { profile: { className: "810班" } },
    },
    res,
  );

  assert.equal(res.payload.experimentTask.enabled, true);
  assert.equal(res.payload.experimentTask.variant, "three-stage-guided");
  assert.equal(res.payload.experimentTask.durationMinutes, 15);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/server/final-test-routes.test.js`
Expected: FAIL because `experimentTask` is missing from the payload.

- [ ] **Step 3: Add the minimal session schema and settings payload**

```js
const finalTestSessionSchema = new mongoose.Schema(
  {
    key: { type: String, default: ADMIN_CONFIG_KEY, index: true },
    teacherScopeKey: { type: String, default: DEFAULT_TEACHER_SCOPE_KEY, index: true },
    studentUserId: { type: String, default: "", index: true },
    className: { type: String, default: "", index: true },
    variant: { type: String, default: "" },
    status: { type: String, default: "not_started" },
    startedAt: { type: Date, default: null },
    deadlineAt: { type: Date, default: null },
    lockedAt: { type: Date, default: null },
    submittedAt: { type: Date, default: null },
    payload: { type: Object, default: () => ({}) },
  },
  {
    timestamps: true,
    collection: "final_test_sessions",
  },
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/server/final-test-routes.test.js`
Expected: PASS for the settings payload assertion.

### Task 2: Add final-test session APIs

**Files:**
- Modify: `server/routes/auth-user-classroom.js`
- Modify: `src/pages/classroom/classroomApi.js`
- Test: `tests/server/final-test-routes.test.js`

- [ ] **Step 1: Write the failing API lifecycle tests**

```js
test("starting a final test session creates a 15-minute timed session", async () => {
  const app = createAppDouble();
  const deps = createFinalTestDeps();
  registerAuthUserClassroomRoutes(app, deps);

  const route = app.routes.find(
    (item) => item.method === "post" && item.path === "/api/classroom/final-test/session/start",
  );
  const handler = route.handlers[route.handlers.length - 1];
  const res = createResponseDouble();

  await handler(
    {
      authTeacherScopeKey: "shangguan-fuze",
      authUser: { _id: "student-810", profile: { className: "810班" } },
    },
    res,
  );

  assert.equal(res.payload.session.status, "stage1_draft");
  assert.equal(res.payload.session.durationMinutes, 15);
  assert.ok(res.payload.session.deadlineAt);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/server/final-test-routes.test.js`
Expected: FAIL because the route is not registered.

- [ ] **Step 3: Implement the minimal session endpoints**

```js
app.get("/api/classroom/final-test/session", requireChatAuth, async (req, res) => {
  const session = await readOrCreateFinalTestSession(req);
  res.json({ ok: true, session });
});

app.post("/api/classroom/final-test/session/start", requireChatAuth, async (req, res) => {
  const session = await startFinalTestSession(req);
  res.json({ ok: true, session });
});

app.put("/api/classroom/final-test/session", requireChatAuth, async (req, res) => {
  const session = await patchFinalTestSession(req, req.body || {});
  res.json({ ok: true, session });
});

app.post("/api/classroom/final-test/session/submit", requireChatAuth, async (req, res) => {
  const session = await submitFinalTestSession(req);
  res.json({ ok: true, session });
});
```

- [ ] **Step 4: Run targeted tests**

Run: `node --test tests/server/final-test-routes.test.js`
Expected: PASS for settings and session lifecycle tests.

### Task 3: Add pure final-test state helpers and TDD them

**Files:**
- Create: `src/features/classroom/finalTestState.js`
- Test: `tests/chat/final-test-state.test.js`

- [ ] **Step 1: Write failing pure-state tests**

```js
test("lockExpiredSession moves an active session into time_expired_locked", () => {
  const session = {
    status: "stage3_active",
    startedAt: "2026-05-31T10:00:00.000Z",
    deadlineAt: "2026-05-31T10:15:00.000Z",
  };

  const next = lockExpiredSession(session, "2026-05-31T10:15:01.000Z");

  assert.equal(next.status, "time_expired_locked");
  assert.equal(next.timeExpired, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/chat/final-test-state.test.js`
Expected: FAIL because `lockExpiredSession` does not exist.

- [ ] **Step 3: Implement the pure helpers**

```js
export function lockExpiredSession(session, nowIso) {
  const deadlineMs = Date.parse(String(session?.deadlineAt || ""));
  const nowMs = Date.parse(String(nowIso || ""));
  if (!Number.isFinite(deadlineMs) || !Number.isFinite(nowMs) || nowMs < deadlineMs) {
    return session;
  }
  return {
    ...session,
    status: "time_expired_locked",
    timeExpired: true,
    lockedAt: nowIso,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/chat/final-test-state.test.js`
Expected: PASS.

### Task 4: Add the student-shell `期末测试` entry and landing panel

**Files:**
- Modify: `src/pages/ModeSelectionPage.jsx`
- Modify: `src/features/classroom/routes.js`
- Create: `src/features/classroom/components/StudentFinalTestPanel.jsx`
- Create: `src/styles/final-test.css`
- Test: `tests/contracts/student-home-style-contract.test.js`

- [ ] **Step 1: Write a failing contract test for the new entry**

```js
test("student home shell exposes the final test entry", async () => {
  const source = await fs.readFile("src/pages/ModeSelectionPage.jsx", "utf8");
  assert.match(source, /label:\s*"期末测试"/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/contracts/student-home-style-contract.test.js`
Expected: FAIL because the sidebar entry is missing.

- [ ] **Step 3: Add the minimal panel and squared visual direction**

```jsx
{
  key: "final-test",
  label: "期末测试",
  icon: FileText,
  hint: "进入期末测试任务区",
}
```

```css
.final-test-panel,
.final-test-stage,
.final-test-field,
.final-test-action {
  border-radius: 0;
}
```

- [ ] **Step 4: Run the contract test**

Run: `node --test tests/contracts/student-home-style-contract.test.js`
Expected: PASS.

### Task 5: Implement the 810 and 811 stage flows with recovery and risk logging

**Files:**
- Create: `src/features/classroom/components/FinalTestWorkspace.jsx`
- Modify: `src/features/classroom/components/StudentFinalTestPanel.jsx`
- Modify: `src/pages/classroom/classroomApi.js`
- Test: `tests/chat/final-test-state.test.js`

- [ ] **Step 1: Write failing state tests for paste policy and internal transfer**

```js
test("stage1 blocks paste while stage3 allows paste and marks risk", () => {
  assert.equal(canPasteInStage("stage1_draft"), false);
  assert.equal(canPasteInStage("stage3_active"), true);
});

test("buildInternalTransferEvent records the source text and target field", () => {
  const event = buildInternalTransferEvent({
    sourceMessageId: "msg-1",
    sourceRole: "assistant",
    selectedText: "组合这两个想法",
    targetField: "coreFeatures",
  });

  assert.equal(event.insertMethod, "internal_stage2_transfer");
  assert.equal(event.targetField, "coreFeatures");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/chat/final-test-state.test.js`
Expected: FAIL because the helpers are missing.

- [ ] **Step 3: Implement the workspace behavior**

```js
export function canPasteInStage(status) {
  return status === "stage3_active";
}

export function buildInternalTransferEvent(payload) {
  return {
    insertEventId: createLocalEventId("insert"),
    sourceMessageId: String(payload?.sourceMessageId || ""),
    sourceRole: String(payload?.sourceRole || ""),
    selectedText: String(payload?.selectedText || ""),
    targetField: String(payload?.targetField || ""),
    insertedAt: new Date().toISOString(),
    insertMethod: "internal_stage2_transfer",
  };
}
```

- [ ] **Step 4: Run the state tests**

Run: `node --test tests/chat/final-test-state.test.js`
Expected: PASS.

### Task 6: Verify the integrated surface

**Files:**
- Modify: `tests/server/final-test-routes.test.js`
- Modify: `tests/chat/final-test-state.test.js`
- Modify: `tests/contracts/student-home-style-contract.test.js`

- [ ] **Step 1: Run the targeted verification set**

Run: `node --test tests/server/final-test-routes.test.js tests/chat/final-test-state.test.js tests/contracts/student-home-style-contract.test.js`
Expected: PASS.

- [ ] **Step 2: Run targeted lint on touched frontend/backend files**

Run: `npx eslint src/pages/ModeSelectionPage.jsx src/pages/classroom/classroomApi.js src/features/classroom/routes.js src/features/classroom/components/StudentFinalTestPanel.jsx src/features/classroom/components/FinalTestWorkspace.jsx src/features/classroom/finalTestState.js server/routes/auth-user-classroom.js`
Expected: PASS.

- [ ] **Step 3: Re-read the approved spec and diff against implementation**

Checklist:
- `期末测试` left-nav entry exists
- 810/811 auto routing exists
- 15-minute timer exists
- Stage 1 paste is blocked
- Stage 3 paste is allowed and logged
- internal Stage 2 transfer exists
- time-expired locked state exists
- recovery path exists

- [ ] **Step 4: Stop and report actual verification evidence**

Commands to report:
- `node --test tests/server/final-test-routes.test.js tests/chat/final-test-state.test.js tests/contracts/student-home-style-contract.test.js`
- `npx eslint ...`

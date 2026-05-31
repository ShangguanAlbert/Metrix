const FINAL_TEST_DURATION_MINUTES = 20;

function createLocalEventId(prefix = "evt") {
  const nowPart = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${nowPart}-${randomPart}`;
}

export function resolveFinalTestVariant(className) {
  const text = String(className || "").trim();
  if (text.includes("810")) return "three-stage-guided";
  if (text.includes("811")) return "two-stage-free";
  return "disabled";
}

export function resolveFinalTestInitialStatus(variant) {
  if (variant === "three-stage-guided") return "stage1_draft";
  if (variant === "two-stage-free") return "stage2_active";
  return "disabled";
}

export function resolveFinalTestStageFromStatus(status) {
  const safe = String(status || "").trim();
  if (safe === "stage1_draft" || safe === "stage1_locked") return "stage1";
  if (safe === "stage2_active") return "stage2";
  if (safe === "stage3_active") return "stage3";
  if (safe === "time_expired_locked") return "time_expired";
  if (safe === "submitted") return "submitted";
  return "not_started";
}

export function canPasteInStage(status) {
  return String(status || "").trim() !== "stage1_draft";
}

export function createFinalTestSessionBase({
  studentUserId = "",
  className = "",
  variant = "disabled",
  startedAt = "",
  nowIso = "",
} = {}) {
  const safeVariant = String(variant || "disabled").trim();
  const safeStartedAt = String(startedAt || nowIso || new Date().toISOString()).trim();
  const deadlineAt = new Date(
    Date.parse(safeStartedAt) + FINAL_TEST_DURATION_MINUTES * 60 * 1000,
  ).toISOString();
  return {
    key: "admin-config",
    studentUserId: String(studentUserId || "").trim(),
    className: String(className || "").trim(),
    variant: safeVariant,
    status: resolveFinalTestInitialStatus(safeVariant),
    startedAt: safeStartedAt,
    deadlineAt,
    lockedAt: "",
    submittedAt: "",
    timeExpired: false,
    durationMinutes: FINAL_TEST_DURATION_MINUTES,
    stage1: {
      ideas: [],
      lockedAt: "",
      submittedAt: "",
      pasteBlockedCount: 0,
    },
    stage2: {
      messages: [],
      promptCardClicks: [],
      promptCardCopies: [],
      transfers: [],
      riskEvents: [],
      draftText: "",
      submittedAt: "",
    },
    stage3: {
      draft: {},
      finalText: "",
      pasteEvents: [],
      riskEvents: [],
      submittedAt: "",
    },
    turnbackEvents: [],
    riskLog: [],
  };
}

export function lockExpiredSession(session, nowIso) {
  const safeSession = session && typeof session === "object" ? session : {};
  const deadlineMs = Date.parse(String(safeSession.deadlineAt || ""));
  const nowMs = Date.parse(String(nowIso || ""));
  if (!Number.isFinite(deadlineMs) || !Number.isFinite(nowMs) || nowMs < deadlineMs) {
    return safeSession;
  }
  if (String(safeSession.status || "") === "submitted") {
    return safeSession;
  }
  return {
    ...safeSession,
    status: "time_expired_locked",
    timeExpired: true,
    lockedAt: safeSession.lockedAt || nowIso || new Date().toISOString(),
  };
}

export function buildInternalTransferEvent({
  sourceMessageId = "",
  sourceRole = "",
  selectedText = "",
  targetField = "",
  insertedAt = "",
} = {}) {
  return {
    insertEventId: createLocalEventId("insert"),
    sourceMessageId: String(sourceMessageId || "").trim(),
    sourceRole: String(sourceRole || "").trim(),
    selectedText: String(selectedText || "").trim(),
    targetField: String(targetField || "").trim(),
    insertedAt: String(insertedAt || new Date().toISOString()).trim(),
    insertMethod: "internal_stage2_transfer",
  };
}

export function buildFinalTestRiskSnapshot(events = []) {
  const list = Array.isArray(events) ? events : [];
  const pasteCount = list.filter((item) => String(item?.type || "") === "paste").length;
  const pasteBlockedCount = list.filter(
    (item) => String(item?.type || "") === "paste_blocked",
  ).length;
  const pasteAllowedCount = list.filter(
    (item) => String(item?.type || "") === "paste_allowed",
  ).length;
  const largeInsertCount = list.filter(
    (item) => String(item?.type || "") === "large_insert",
  ).length;
  const tabHiddenCount = list.filter(
    (item) => String(item?.type || "") === "tab_hidden",
  ).length;
  const windowBlurCount = list.filter(
    (item) => String(item?.type || "") === "window_blur",
  ).length;
  const idleThenLargeInsertCount = list.filter(
    (item) => String(item?.type || "") === "idle_then_large_insert",
  ).length;
  const riskScore =
    pasteBlockedCount * 4 +
    pasteCount * 2 +
    pasteAllowedCount +
    largeInsertCount * 2 +
    tabHiddenCount +
    windowBlurCount +
    idleThenLargeInsertCount * 3;
  const riskFlags = [];
  if (pasteBlockedCount > 0) riskFlags.push("stage1_paste_blocked");
  if (largeInsertCount > 0) riskFlags.push("large_paste");
  if (tabHiddenCount > 0) riskFlags.push("tab_switch_before_insert");
  if (idleThenLargeInsertCount > 0) riskFlags.push("idle_then_large_insert");
  return {
    pasteCount,
    pasteBlockedCount,
    pasteAllowedCount,
    largeInsertCount,
    tabHiddenCount,
    windowBlurCount,
    idleThenLargeInsertCount,
    riskFlags,
    riskScore,
  };
}

export function applyFinalTestPatch(session, patch = {}) {
  const safeSession = session && typeof session === "object" ? session : {};
  const safePatch = patch && typeof patch === "object" ? patch : {};
  const nextPayload = {
    ...(safeSession.payload && typeof safeSession.payload === "object" ? safeSession.payload : {}),
    ...(safePatch.payload && typeof safePatch.payload === "object" ? safePatch.payload : {}),
  };
  const next = {
    ...safeSession,
    payload: nextPayload,
  };
  if (typeof safePatch.status === "string" && safePatch.status.trim()) {
    next.status = safePatch.status.trim();
  }
  if (typeof safePatch.lockedAt === "string") next.lockedAt = safePatch.lockedAt;
  if (typeof safePatch.submittedAt === "string") next.submittedAt = safePatch.submittedAt;
  if (typeof safePatch.timeExpired === "boolean") next.timeExpired = safePatch.timeExpired;
  if (Array.isArray(safePatch.turnbackEvents)) {
    next.turnbackEvents = safePatch.turnbackEvents;
    next.payload.turnbackEvents = safePatch.turnbackEvents;
  }
  if (Array.isArray(safePatch.riskLog)) {
    next.riskLog = safePatch.riskLog;
    next.payload.riskLog = safePatch.riskLog;
  }
  if (safePatch.stage1 && typeof safePatch.stage1 === "object") {
    next.stage1 = safePatch.stage1;
    next.payload.stage1 = safePatch.stage1;
  }
  if (safePatch.stage2 && typeof safePatch.stage2 === "object") {
    next.stage2 = safePatch.stage2;
    next.payload.stage2 = safePatch.stage2;
  }
  if (safePatch.stage3 && typeof safePatch.stage3 === "object") {
    next.stage3 = safePatch.stage3;
    next.payload.stage3 = safePatch.stage3;
  }
  return next;
}

export function normalizeFinalTestSession(session) {
  const safe = session && typeof session === "object" ? session : {};
  const payload = safe.payload && typeof safe.payload === "object" ? safe.payload : {};
  return {
    key: String(safe.key || "admin-config").trim(),
    studentUserId: String(safe.studentUserId || "").trim(),
    className: String(safe.className || "").trim(),
    variant: String(safe.variant || "disabled").trim(),
    status: String(safe.status || "disabled").trim(),
    startedAt: String(safe.startedAt || "").trim(),
    deadlineAt: String(safe.deadlineAt || "").trim(),
    lockedAt: String(safe.lockedAt || "").trim(),
    submittedAt: String(safe.submittedAt || "").trim(),
    timeExpired: safe.timeExpired === true,
    durationMinutes: Number(safe.durationMinutes || FINAL_TEST_DURATION_MINUTES),
    payload,
    stage1: payload.stage1 && typeof payload.stage1 === "object" ? payload.stage1 : safe.stage1 || {},
    stage2: payload.stage2 && typeof payload.stage2 === "object" ? payload.stage2 : safe.stage2 || {},
    stage3: payload.stage3 && typeof payload.stage3 === "object" ? payload.stage3 : safe.stage3 || {},
    turnbackEvents: Array.isArray(payload.turnbackEvents)
      ? payload.turnbackEvents
      : Array.isArray(safe.turnbackEvents)
        ? safe.turnbackEvents
        : [],
    riskLog: Array.isArray(payload.riskLog)
      ? payload.riskLog
      : Array.isArray(safe.riskLog)
        ? safe.riskLog
        : [],
  };
}

export { FINAL_TEST_DURATION_MINUTES };

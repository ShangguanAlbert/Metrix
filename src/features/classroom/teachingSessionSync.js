function sanitizeMode(value) {
  return String(value || "").trim().toLowerCase() === "live" ? "live" : "readonly";
}

function sanitizePdfFileId(value) {
  return String(value || "").trim();
}

function sanitizePage(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 1) return 1;
  return Math.floor(number);
}

export function createTeachingSyncState(snapshot = {}) {
  const mode = sanitizeMode(snapshot.mode);
  const teacherPdfFileId = sanitizePdfFileId(snapshot.activePdfFileId);
  const teacherPage = sanitizePage(snapshot.activePage);
  return {
    mode,
    followTeacher: mode === "live",
    teacherPdfFileId,
    teacherPage,
    currentPdfFileId: teacherPdfFileId,
    currentPage: teacherPage,
  };
}

export function applyTeacherViewport(state, snapshot = {}) {
  const previous = state && typeof state === "object" ? state : createTeachingSyncState();
  const mode = sanitizeMode(snapshot.mode || previous.mode);
  const teacherPdfFileId = sanitizePdfFileId(
    snapshot.activePdfFileId || previous.teacherPdfFileId,
  );
  const teacherPage = sanitizePage(snapshot.activePage || previous.teacherPage);
  const shouldFollow = mode === "live" && previous.followTeacher !== false;
  const isEnteringReadonly = previous.mode === "live" && mode !== "live";
  const shouldResetToTeacherViewport = shouldFollow || isEnteringReadonly;

  return {
    mode,
    followTeacher: shouldFollow,
    teacherPdfFileId,
    teacherPage,
    currentPdfFileId:
      shouldResetToTeacherViewport ? teacherPdfFileId : previous.currentPdfFileId,
    currentPage:
      shouldResetToTeacherViewport ? teacherPage : sanitizePage(previous.currentPage),
  };
}

export function applyStudentViewport(state, viewport = {}) {
  const previous = state && typeof state === "object" ? state : createTeachingSyncState();
  return {
    ...previous,
    followTeacher: false,
    currentPdfFileId: sanitizePdfFileId(
      viewport.pdfFileId || previous.currentPdfFileId || previous.teacherPdfFileId,
    ),
    currentPage: sanitizePage(viewport.page || previous.currentPage),
  };
}

export function resyncTeachingViewport(state) {
  const previous = state && typeof state === "object" ? state : createTeachingSyncState();
  return {
    ...previous,
    followTeacher: previous.mode === "live",
    currentPdfFileId: previous.teacherPdfFileId,
    currentPage: sanitizePage(previous.teacherPage),
  };
}

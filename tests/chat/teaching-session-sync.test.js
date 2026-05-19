import assert from "node:assert/strict";
import test from "node:test";

import {
  createTeachingSyncState,
  applyTeacherViewport,
  applyStudentViewport,
  resyncTeachingViewport,
} from "../../src/features/classroom/teachingSessionSync.js";

test("live session starts in follow mode and mirrors teacher viewport", () => {
  const state = createTeachingSyncState({
    mode: "live",
    activePdfFileId: "pdf-1",
    activePage: 3,
  });

  assert.equal(state.followTeacher, true);
  assert.equal(state.currentPdfFileId, "pdf-1");
  assert.equal(state.currentPage, 3);
  assert.equal(state.teacherPdfFileId, "pdf-1");
  assert.equal(state.teacherPage, 3);
});

test("student manual page change exits follow mode but keeps teacher checkpoint", () => {
  const initial = createTeachingSyncState({
    mode: "live",
    activePdfFileId: "pdf-1",
    activePage: 3,
  });

  const next = applyStudentViewport(initial, {
    pdfFileId: "pdf-1",
    page: 5,
  });

  assert.equal(next.followTeacher, false);
  assert.equal(next.currentPdfFileId, "pdf-1");
  assert.equal(next.currentPage, 5);
  assert.equal(next.teacherPdfFileId, "pdf-1");
  assert.equal(next.teacherPage, 3);
});

test("teacher movement does not override student local page during weak sync escape", () => {
  const initial = applyStudentViewport(
    createTeachingSyncState({
      mode: "live",
      activePdfFileId: "pdf-1",
      activePage: 2,
    }),
    {
      pdfFileId: "pdf-1",
      page: 6,
    },
  );

  const next = applyTeacherViewport(initial, {
    mode: "live",
    activePdfFileId: "pdf-2",
    activePage: 4,
  });

  assert.equal(next.followTeacher, false);
  assert.equal(next.currentPdfFileId, "pdf-1");
  assert.equal(next.currentPage, 6);
  assert.equal(next.teacherPdfFileId, "pdf-2");
  assert.equal(next.teacherPage, 4);
});

test("resync jumps student back to the latest teacher viewport", () => {
  const escaped = applyTeacherViewport(
    applyStudentViewport(
      createTeachingSyncState({
        mode: "live",
        activePdfFileId: "pdf-1",
        activePage: 2,
      }),
      {
        pdfFileId: "pdf-1",
        page: 7,
      },
    ),
    {
      mode: "live",
      activePdfFileId: "pdf-3",
      activePage: 9,
    },
  );

  const next = resyncTeachingViewport(escaped);

  assert.equal(next.followTeacher, true);
  assert.equal(next.currentPdfFileId, "pdf-3");
  assert.equal(next.currentPage, 9);
});

test("ended session switches to readonly browsing while preserving the final teacher page", () => {
  const state = applyTeacherViewport(
    createTeachingSyncState({
      mode: "live",
      activePdfFileId: "pdf-1",
      activePage: 2,
    }),
    {
      mode: "readonly",
      activePdfFileId: "pdf-2",
      activePage: 10,
    },
  );

  assert.equal(state.followTeacher, false);
  assert.equal(state.currentPdfFileId, "pdf-2");
  assert.equal(state.currentPage, 10);
  assert.equal(state.mode, "readonly");
});

test("readonly browsing keeps the student's local pdf and page when later snapshots arrive", () => {
  const readonly = applyTeacherViewport(
    createTeachingSyncState({
      mode: "live",
      activePdfFileId: "pdf-1",
      activePage: 2,
    }),
    {
      mode: "readonly",
      activePdfFileId: "pdf-2",
      activePage: 10,
    },
  );

  const localBrowse = applyStudentViewport(readonly, {
    pdfFileId: "pdf-3",
    page: 4,
  });

  const next = applyTeacherViewport(localBrowse, {
    mode: "readonly",
    activePdfFileId: "pdf-2",
    activePage: 10,
  });

  assert.equal(next.followTeacher, false);
  assert.equal(next.currentPdfFileId, "pdf-3");
  assert.equal(next.currentPage, 4);
  assert.equal(next.teacherPdfFileId, "pdf-2");
  assert.equal(next.teacherPage, 10);
});

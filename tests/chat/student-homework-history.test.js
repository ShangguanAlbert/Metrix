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
      {
        id: "future",
        courseName: "第3节课",
        enabled: true,
        courseStartAt: "2099-01-01T10:00:00.000Z",
      },
      {
        id: "past-a",
        courseName: "第1节课",
        enabled: true,
        courseStartAt: "2026-05-10T10:00:00.000Z",
      },
      {
        id: "past-b",
        courseName: "第2节课",
        enabled: true,
        courseStartAt: "2026-05-12T10:00:00.000Z",
      },
      {
        id: "closed",
        courseName: "第4节课",
        enabled: false,
        courseStartAt: "2026-05-09T10:00:00.000Z",
      },
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

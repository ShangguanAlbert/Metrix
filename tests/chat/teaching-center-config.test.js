import assert from "node:assert/strict";
import test from "node:test";

import {
  appendTeachingCenterPdfFiles,
  normalizeTeachingCenterConfig,
} from "../../src/features/classroom/teachingCenterConfig.js";

test("appendTeachingCenterPdfFiles appends new file ids and preserves existing order", () => {
  const next = appendTeachingCenterPdfFiles(
    {
      pdfFiles: [{ fileId: "file-1", sortOrder: 0, enabled: true }],
      defaultPdfFileId: "file-1",
      allowQuestions: true,
      teacherNotes: "",
      welcomeText: "",
    },
    ["file-2", "file-3", "file-1"],
  );

  assert.deepEqual(
    next.pdfFiles.map((item) => item.fileId),
    ["file-1", "file-2", "file-3"],
  );
  assert.equal(next.defaultPdfFileId, "file-1");
});

test("appendTeachingCenterPdfFiles sets first uploaded file as default when no default exists", () => {
  const next = appendTeachingCenterPdfFiles(
    normalizeTeachingCenterConfig({}),
    ["file-9"],
  );

  assert.deepEqual(next.pdfFiles, [
    { fileId: "file-9", sortOrder: 0, enabled: true },
  ]);
  assert.equal(next.defaultPdfFileId, "file-9");
});

test("appendTeachingCenterPdfFiles preserves existing teaching settings", () => {
  const next = appendTeachingCenterPdfFiles(
    {
      pdfFiles: [{ fileId: "file-1", sortOrder: 0, enabled: true }],
      defaultPdfFileId: "file-1",
      allowQuestions: false,
      teacherNotes: "讲稿 A",
      welcomeText: "欢迎来到课堂",
    },
    ["file-2"],
  );

  assert.equal(next.allowQuestions, false);
  assert.equal(next.teacherNotes, "讲稿 A");
  assert.equal(next.welcomeText, "欢迎来到课堂");
});

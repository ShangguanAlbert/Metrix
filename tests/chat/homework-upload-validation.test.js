import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeHomeworkFileSelection,
  CLASSROOM_HOMEWORK_DIRECTORY_UPLOAD_ERROR,
} from "../../src/features/classroom/homeworkUploadValidation.js";

test("analyzeHomeworkFileSelection rejects drag selections that contain directories", () => {
  const result = analyzeHomeworkFileSelection({
    files: [
      { name: "report.pdf", size: 1024 },
    ],
    items: [
      {
        webkitGetAsEntry() {
          return { isDirectory: true };
        },
      },
    ],
  });

  assert.equal(result.error, CLASSROOM_HOMEWORK_DIRECTORY_UPLOAD_ERROR);
  assert.deepEqual(result.files, []);
});

test("analyzeHomeworkFileSelection rejects files with relative paths from folder picks", () => {
  const result = analyzeHomeworkFileSelection({
    files: [
      {
        name: "main.py",
        size: 512,
        webkitRelativePath: "作业文件夹/main.py",
      },
    ],
  });

  assert.equal(result.error, CLASSROOM_HOMEWORK_DIRECTORY_UPLOAD_ERROR);
  assert.deepEqual(result.files, []);
});

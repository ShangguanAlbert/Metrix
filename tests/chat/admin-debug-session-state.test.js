import assert from "node:assert/strict";
import test from "node:test";

import {
  createStoredDebugSourceFiles,
  hasUnreplayableDebugSourceFiles,
} from "../../src/features/admin/services/debugSessionState.js";

test("createStoredDebugSourceFiles strips raw local file payloads before storing debug history", () => {
  const sourceFiles = [
    {
      kind: "local",
      file: { name: "huge.pdf", sentinel: "raw-binary-payload" },
      name: "huge.pdf",
      size: 512 * 1024 * 1024,
      type: "application/pdf",
    },
  ];

  const stored = createStoredDebugSourceFiles(sourceFiles);

  assert.deepEqual(stored, [
    {
      kind: "local",
      name: "huge.pdf",
      size: 512 * 1024 * 1024,
      type: "application/pdf",
    },
  ]);
  assert.equal(hasUnreplayableDebugSourceFiles(stored), true);
});

test("createStoredDebugSourceFiles keeps replayable debug refs without raw file payloads", () => {
  const sourceFiles = [
    {
      kind: "prepared_ref",
      file: { name: "report.pdf" },
      name: "report.pdf",
      size: 2048,
      type: "application/pdf",
      mimeType: "application/pdf",
      preparedToken: "prepared-123",
    },
    {
      kind: "volc_ref",
      file: { name: "diagram.png" },
      name: "diagram.png",
      size: 1024,
      type: "image/png",
      mimeType: "image/png",
      inputType: "input_image",
      fileId: "file-123",
      url: "https://example.com/diagram.png",
      ossKey: "oss/diagram.png",
    },
  ];

  const stored = createStoredDebugSourceFiles(sourceFiles);

  assert.deepEqual(stored, [
    {
      kind: "prepared_ref",
      name: "report.pdf",
      size: 2048,
      type: "application/pdf",
      mimeType: "application/pdf",
      preparedToken: "prepared-123",
    },
    {
      kind: "volc_ref",
      name: "diagram.png",
      size: 1024,
      type: "image/png",
      mimeType: "image/png",
      inputType: "input_image",
      fileId: "file-123",
      url: "https://example.com/diagram.png",
      ossKey: "oss/diagram.png",
    },
  ]);
  assert.equal(hasUnreplayableDebugSourceFiles(stored), false);
});

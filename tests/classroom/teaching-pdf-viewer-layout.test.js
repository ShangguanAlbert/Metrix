import assert from "node:assert/strict";
import test from "node:test";

import {
  clampTeachingPdfZoom,
  resolveTeachingPdfDefaultZoom,
  resolveTeachingPdfOrientation,
} from "../../src/features/classroom/teachingPdfViewerLayout.js";

test("resolveTeachingPdfOrientation detects portrait pages", () => {
  assert.equal(resolveTeachingPdfOrientation(768, 1024), "portrait");
});

test("resolveTeachingPdfOrientation detects landscape pages", () => {
  assert.equal(resolveTeachingPdfOrientation(1366, 768), "landscape");
});

test("resolveTeachingPdfDefaultZoom keeps landscape pages at fit width", () => {
  assert.equal(resolveTeachingPdfDefaultZoom(1366, 768), 1);
});

test("resolveTeachingPdfDefaultZoom slightly enlarges portrait textbook pages", () => {
  assert.equal(resolveTeachingPdfDefaultZoom(768, 1024), 1.12);
});

test("clampTeachingPdfZoom enforces the supported zoom range", () => {
  assert.equal(clampTeachingPdfZoom(0.5), 0.85);
  assert.equal(clampTeachingPdfZoom(1.36), 1.36);
  assert.equal(clampTeachingPdfZoom(3), 2.2);
});


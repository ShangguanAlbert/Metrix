import test from "node:test";
import assert from "node:assert/strict";

import { resolveBasePathAwareWebSocketPaths } from "../../server/config/base-path.js";
import { withBasePath } from "../../src/app/basePath.js";

test("resolveBasePathAwareWebSocketPaths keeps both root and base-prefixed websocket paths", () => {
  assert.deepEqual(
    resolveBasePathAwareWebSocketPaths("/ws/group-chat", "/hznu/metaxfang/"),
    ["/ws/group-chat", "/hznu/metaxfang/ws/group-chat"],
  );
});

test("resolveBasePathAwareWebSocketPaths avoids duplicates for root deployments", () => {
  assert.deepEqual(resolveBasePathAwareWebSocketPaths("/ws/group-chat", "/"), [
    "/ws/group-chat",
  ]);
});

test("withBasePath restores the configured app prefix for app-relative routes", () => {
  assert.equal(
    withBasePath("/admin/settings?teacherPanel=classroom", "/hznu/metaxfang/"),
    "/hznu/metaxfang/admin/settings?teacherPanel=classroom",
  );
});

test("withBasePath keeps already-prefixed routes unchanged", () => {
  assert.equal(
    withBasePath("/hznu/metaxfang/admin/settings?teacherPanel=classroom", "/hznu/metaxfang/"),
    "/hznu/metaxfang/admin/settings?teacherPanel=classroom",
  );
});

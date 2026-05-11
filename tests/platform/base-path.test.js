import test from "node:test";
import assert from "node:assert/strict";

import { resolveBasePathAwareWebSocketPaths } from "../../server/config/base-path.js";

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

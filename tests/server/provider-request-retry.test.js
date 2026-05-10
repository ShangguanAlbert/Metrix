import test from "node:test";
import assert from "node:assert/strict";

import { isRetryableRequestFailure } from "../../server/services/core-runtime.js";

test("isRetryableRequestFailure treats EPIPE as retryable for upstream reconnect flows", () => {
  assert.equal(
    isRetryableRequestFailure({
      message: "fetch failed",
      cause: {
        code: "EPIPE",
        message: "write EPIPE",
      },
    }),
    true,
  );
});

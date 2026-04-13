import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeChatBootstrapResponse,
  sanitizeChatSessionId,
} from "../../shared/contracts/chat.js";

test("sanitizeChatSessionId trims whitespace and strips illegal characters", () => {
  assert.equal(sanitizeChatSessionId("  a .b$ c  "), "abc");
});

test("normalizeChatBootstrapResponse provides stable object fallbacks", () => {
  const normalized = normalizeChatBootstrapResponse({
    ok: 1,
    teacherScopeKey: "teacher-a",
    state: null,
  });

  assert.equal(normalized.ok, true);
  assert.equal(normalized.teacherScopeKey, "teacher-a");
  assert.deepEqual(normalized.state, {});
  assert.deepEqual(normalized.agentRuntimeConfigs, {});
  assert.deepEqual(normalized.agentProviderDefaults, {});
});

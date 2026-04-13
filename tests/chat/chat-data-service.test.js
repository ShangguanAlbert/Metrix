import assert from "node:assert/strict";
import test from "node:test";
import { createChatDataService } from "../../src/features/chat/services/ChatDataService.js";

test("ChatDataService routes save operations to injected deps", async () => {
  const calls = [];
  const service = createChatDataService({
    fetchChatBootstrap: async () => ({ ok: true }),
    saveChatState: async (payload) => calls.push(["state", payload]),
    saveChatStateMeta: async (payload) => calls.push(["meta", payload]),
    saveChatSessionMessages: async (payload) => calls.push(["messages", payload]),
    saveUserProfile: async (payload) => calls.push(["profile", payload]),
    clearChatSmartContext: async (payload) => calls.push(["clear", payload]),
    startStreamDraft: (sessionId, draft) => calls.push(["startDraft", sessionId, draft]),
    updateStreamDraft: (sessionId, updater) => calls.push(["updateDraft", sessionId, typeof updater]),
    getStreamDraft: (sessionId) => ({ id: sessionId }),
    clearStreamDraft: (sessionId) => calls.push(["clearDraft", sessionId]),
    clearManyStreamDrafts: (ids) => calls.push(["clearDrafts", ids]),
    replaceAllStreamDrafts: (next) => calls.push(["replaceDrafts", next]),
    primeAllStreamDrafts: (next) => calls.push(["primeDrafts", next]),
    createNewSessionRecord: () => ({ session: { id: "s1" } }),
    createWelcomeMessage: () => ({ id: "m1" }),
    hasUserTurn: () => true,
  });

  await service.saveState({ a: 1 });
  await service.saveStateMeta({ b: 2 });
  await service.saveSessionMessages({ c: 3 });
  await service.saveUserProfile({ d: 4 });
  await service.clearSmartContext("s1");
  service.startDraft("s1", { id: "d1" });
  assert.deepEqual(service.getDraft("s1"), { id: "s1" });
  service.clearDraft("s1");
  service.clearDrafts(["s1"]);
  service.replaceDrafts({});
  service.primeDrafts({});

  assert.deepEqual(calls, [
    ["state", { a: 1 }],
    ["meta", { b: 2 }],
    ["messages", { c: 3 }],
    ["profile", { d: 4 }],
    ["clear", "s1"],
    ["startDraft", "s1", { id: "d1" }],
    ["clearDraft", "s1"],
    ["clearDrafts", ["s1"]],
    ["replaceDrafts", {}],
    ["primeDrafts", {}],
  ]);
  assert.deepEqual(service.createSessionRecord(), { session: { id: "s1" } });
  assert.deepEqual(service.createWelcomeMessage(), { id: "m1" });
  assert.equal(service.hasUserTurn([]), true);
});

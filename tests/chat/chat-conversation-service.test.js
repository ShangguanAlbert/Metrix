import assert from "node:assert/strict";
import test from "node:test";
import {
  buildApiMessages,
  buildSessionRenameQuestion,
  fallbackSessionTitleFromQuestion,
  mergeAttachmentsWithUploadedLinks,
  pickRecentRounds,
  resolveBootstrapTargetSessionId,
} from "../../src/features/chat/services/ChatConversationService.js";

test("resolveBootstrapTargetSessionId prefers restore session then active session", () => {
  const sessions = [{ id: "s1" }, { id: "s2" }];
  assert.equal(
    resolveBootstrapTargetSessionId({
      sessions,
      activeId: "s1",
      restoreSessionId: "s2",
    }),
    "s2",
  );
  assert.equal(
    resolveBootstrapTargetSessionId({
      sessions,
      activeId: "s1",
      restoreSessionId: "missing",
    }),
    "s1",
  );
});

test("pickRecentRounds keeps only the latest user rounds", () => {
  const list = [
    { id: "1", role: "user" },
    { id: "2", role: "assistant" },
    { id: "3", role: "user" },
    { id: "4", role: "assistant" },
    { id: "5", role: "user" },
  ];
  assert.deepEqual(
    pickRecentRounds(list, 2).map((item) => item.id),
    ["3", "4", "5"],
  );
});

test("buildApiMessages preserves supported file refs for volcengine responses", () => {
  const result = buildApiMessages(
    [
      {
        id: "u1",
        role: "user",
        content: "hello",
        attachments: [{ fileId: "file-1", inputType: "input_file" }],
      },
    ],
    { useVolcengineResponsesFileRefs: true },
  );

  assert.equal(result[0].role, "user");
  assert.deepEqual(result[0].content, [
    { type: "text", text: "hello" },
    { type: "input_file", file_id: "file-1" },
  ]);
});

test("mergeAttachmentsWithUploadedLinks backfills missing urls", () => {
  const merged = mergeAttachmentsWithUploadedLinks(
    [{ name: "demo.pdf", type: "application/pdf", size: 123 }],
    [{ fileName: "demo.pdf", mimeType: "application/pdf", size: 123, url: "https://x.test/a" }],
  );

  assert.equal(merged[0].url, "https://x.test/a");
});

test("session rename helpers generate stable fallback title", () => {
  const question = buildSessionRenameQuestion({
    content: "### 你好，这是一个测试标题",
    attachments: [{ name: "文档A.pdf" }],
  });
  assert.match(question, /测试标题/);
  assert.equal(fallbackSessionTitleFromQuestion(question), "你好，这是一个测试标题");
});

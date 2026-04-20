import assert from "node:assert/strict";
import test from "node:test";

import {
  createReasoningTagStreamResolver,
  resolveReasoningTaggedText,
} from "../../shared/reasoningTags.js";

test("resolveReasoningTaggedText separates embedded think blocks from visible content", () => {
  const result = resolveReasoningTaggedText(
    "<think>先判断是否支持读图。</think>可以，我能读取并分析图片内容。",
  );

  assert.equal(result.reasoning, "先判断是否支持读图。");
  assert.equal(result.content, "可以，我能读取并分析图片内容。");
});

test("createReasoningTagStreamResolver handles think tags split across streaming chunks", () => {
  const resolver = createReasoningTagStreamResolver();

  const first = resolver.push("<thi");
  const second = resolver.push("nk>思考中");
  const third = resolver.push("</thi");
  const fourth = resolver.push("nk>最终回答");
  const tail = resolver.flush();

  assert.deepEqual(first, { content: "", reasoning: "" });
  assert.deepEqual(second, { content: "", reasoning: "思考中" });
  assert.deepEqual(third, { content: "", reasoning: "" });
  assert.deepEqual(fourth, { content: "最终回答", reasoning: "" });
  assert.deepEqual(tail, { content: "", reasoning: "" });
});

test("resolveReasoningTaggedText keeps plain text unchanged when no think tags exist", () => {
  const result = resolveReasoningTaggedText("这是正常回答，没有隐藏思路。");

  assert.equal(result.reasoning, "");
  assert.equal(result.content, "这是正常回答，没有隐藏思路。");
});

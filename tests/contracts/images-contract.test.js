import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeImageHistoryClearResponse,
  normalizeImageHistoryDeleteResponse,
  normalizeImageHistoryLimit,
  normalizeImageHistoryListResponse,
} from "../../shared/contracts/images.js";

test("normalizeImageHistoryLimit clamps values into supported range", () => {
  assert.equal(normalizeImageHistoryLimit("0"), 1);
  assert.equal(normalizeImageHistoryLimit("250"), 200);
  assert.equal(normalizeImageHistoryLimit("40"), 40);
});

test("normalizeImageHistoryListResponse normalizes item arrays", () => {
  const normalized = normalizeImageHistoryListResponse({
    ok: true,
    items: [{ _id: 123, prompt: "hello" }],
  });

  assert.equal(normalized.ok, true);
  assert.deepEqual(normalized.items, [
    {
      _id: "123",
      prompt: "hello",
      imageUrl: "",
      imageStorageType: "",
      responseFormat: "",
      size: "",
      model: "",
      createdAt: "",
    },
  ]);
});

test("normalize delete responses keep counters and boolean flags stable", () => {
  assert.deepEqual(
    normalizeImageHistoryDeleteResponse({
      ok: true,
      deleted: 1,
      deletedCount: "2",
      failedOssKeys: ["a"],
    }),
    {
      ok: true,
      deleted: true,
      deletedCount: 2,
      deletedOssObjectCount: 0,
      failedOssKeys: ["a"],
    },
  );

  assert.deepEqual(normalizeImageHistoryClearResponse({ deletedCount: "7" }), {
    ok: false,
    deletedCount: 7,
    deletedOssObjectCount: 0,
    failedOssKeys: [],
  });
});

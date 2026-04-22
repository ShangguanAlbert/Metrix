import assert from "node:assert/strict";
import test from "node:test";

import {
  clearLyricsHistoryHandler,
  deleteLyricsHistoryItemHandler,
  generateLyricsHandler,
  listLyricsHistoryHandler,
  renameLyricsHistoryItemHandler,
} from "../../server/modules/music/services/lyrics.js";

function createResponseDouble() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

const depsDouble = {
  sanitizeId(value) {
    return String(value || "").trim();
  },
  sanitizeText(value, fallback = "", maxLength = 2000) {
    return String(value ?? fallback).trim().slice(0, maxLength);
  },
  safeReadText: async (response) => await response.text(),
  formatProviderUpstreamError: (_provider, _protocol, status, detail) =>
    `错误 ${status}: ${detail}`,
  toGeneratedLyricsHistoryItem(doc) {
    return {
      _id: String(doc?._id || ""),
      title: String(doc?.title || ""),
      mode: String(doc?.mode || ""),
      prompt: String(doc?.prompt || ""),
      sourceLyrics: String(doc?.sourceLyrics || ""),
      songTitle: String(doc?.songTitle || ""),
      styleTags: String(doc?.styleTags || ""),
      lyrics: String(doc?.lyrics || ""),
      createdAt: String(doc?.createdAt || ""),
    };
  },
};

test("generateLyricsHandler stores song title and style tags", async () => {
  const req = {
    authUser: { _id: "u1" },
    authStorageUserId: "u1",
    body: {
      mode: "write_full_song",
      prompt: "毕业季、钢琴、抒情",
      title: "我们的夏天",
    },
  };
  const res = createResponseDouble();
  const deps = {
    ...depsDouble,
    getProviderConfig() {
      return {
        apiKey: "mm-key",
        lyricsEndpoint: "https://api.minimaxi.com/v1/lyrics_generation",
        missingKeyMessage: "",
      };
    },
    GeneratedLyricsHistory: {
      async create(payload) {
        return { _id: "l1", ...payload };
      },
    },
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    text: async () =>
      JSON.stringify({
        song_title: "我们的夏天",
        style_tags: "Mandopop, Piano",
        lyrics: "[Verse]\n你好",
        base_resp: {
          status_code: 0,
          status_msg: "success",
        },
      }),
  });

  try {
    await generateLyricsHandler(req, res, deps);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.ok, true);
  assert.equal(res.payload.item.songTitle, "我们的夏天");
  assert.equal(res.payload.item.styleTags, "Mandopop, Piano");
});

test("lyrics history handlers support list rename delete and clear", async () => {
  const reqBase = {
    authUser: { _id: "u1" },
    authStorageUserId: "u1",
    query: { limit: "2" },
    params: { lyricsId: "l1" },
    body: { title: "新的标题" },
  };
  const deps = {
    ...depsDouble,
    GeneratedLyricsHistory: {
      find() {
        return {
          sort() {
            return this;
          },
          limit() {
            return this;
          },
          lean: async () => [{ _id: "l1", songTitle: "旧标题", styleTags: "Pop" }],
        };
      },
      findOneAndUpdate(_query, update) {
        return {
          lean: async () => ({
            _id: "l1",
            title: update?.$set?.title || "",
            songTitle: "旧标题",
            styleTags: "Pop",
          }),
        };
      },
      findOneAndDelete: async () => ({ _id: "l1" }),
      deleteMany: async () => ({ deletedCount: 1 }),
    },
  };

  const listRes = createResponseDouble();
  const renameRes = createResponseDouble();
  const deleteRes = createResponseDouble();
  const clearRes = createResponseDouble();

  await listLyricsHistoryHandler(reqBase, listRes, deps);
  await renameLyricsHistoryItemHandler(reqBase, renameRes, deps);
  await deleteLyricsHistoryItemHandler(reqBase, deleteRes, deps);
  await clearLyricsHistoryHandler(reqBase, clearRes, deps);

  assert.equal(listRes.payload.items[0]._id, "l1");
  assert.equal(renameRes.payload.item.title, "新的标题");
  assert.equal(deleteRes.payload.deleted, true);
  assert.equal(clearRes.payload.deletedCount, 1);
});

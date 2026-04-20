import assert from "node:assert/strict";
import test from "node:test";

import {
  clearMusicHistoryHandler,
  deleteMusicHistoryItemHandler,
  getMusicHistoryContentHandler,
  getMusicHistoryDownloadLinkHandler,
  listMusicHistoryHandler,
  renameMusicHistoryItemHandler,
} from "../../server/modules/music/services/history.js";

function createResponseDouble() {
  return {
    statusCode: 200,
    headers: {},
    payload: null,
    redirectUrl: "",
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
    redirect(url) {
      this.redirectUrl = url;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
    send(payload) {
      this.payload = payload;
      return this;
    },
  };
}

const baseDeps = {
  sanitizeId: (value) => String(value || "").trim(),
  sanitizeText: (value, fallback = "", maxLength = 80) =>
    String(value ?? fallback).trim().slice(0, maxLength),
  sanitizeGroupChatFileName: (value) => String(value || "").trim(),
  sanitizeGroupChatHttpUrl: (value) => String(value || "").trim(),
  sanitizeGroupChatOssObjectKey: (value) => String(value || "").trim(),
  buildGroupChatOssObjectUrl: (value) => `https://oss.example.com/${value}`,
  buildGroupChatFileSignedDownloadUrl: async ({ ossKey }) =>
    `https://oss.example.com/${ossKey}?Expires=1777777777&Signature=test`,
  normalizeGeneratedMusicFormat: (value) =>
    String(value || "mp3").trim().toLowerCase() || "mp3",
  normalizeGeneratedMusicMimeType: (value, format) => {
    if (value) return String(value);
    return format === "wav" ? "audio/wav" : "audio/mpeg";
  },
  toGeneratedMusicHistoryItem: (doc) => ({
    ...doc,
    _id: String(doc?._id || ""),
    hasOssBackup: !!String(doc?.ossKey || "").trim(),
  }),
};

test("listMusicHistoryHandler returns normalized items with OSS backup marker", async () => {
  const req = {
    authUser: { _id: "u1" },
    authStorageUserId: "u1",
    query: { limit: "2" },
  };
  const res = createResponseDouble();
  const deps = {
    ...baseDeps,
    GeneratedMusicHistory: {
      find() {
        return {
          sort() {
            return this;
          },
          limit() {
            return this;
          },
          lean: async () => [
            { _id: "m1", model: "music-2.6", ossKey: "music/a.mp3" },
          ],
        };
      },
    },
  };

  await listMusicHistoryHandler(req, res, deps);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.items[0]._id, "m1");
  assert.equal(res.payload.items[0].hasOssBackup, true);
});

test("renameMusicHistoryItemHandler persists custom title", async () => {
  const req = {
    authUser: { _id: "u1" },
    authStorageUserId: "u1",
    params: { musicId: "m1" },
    body: { title: "新的任务标题" },
  };
  const res = createResponseDouble();
  const deps = {
    ...baseDeps,
    GeneratedMusicHistory: {
      findOneAndUpdate(_query, update) {
        return {
          lean: async () => ({
            _id: "m1",
            title: update?.$set?.title || "",
            ossKey: "music/a.mp3",
          }),
        };
      },
    },
  };

  await renameMusicHistoryItemHandler(req, res, deps);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.item.title, "新的任务标题");
});

test("getMusicHistoryDownloadLinkHandler returns signed 30-day url for oss-backed music", async () => {
  const req = {
    authUser: { _id: "u1" },
    authStorageUserId: "u1",
    params: { musicId: "m1" },
  };
  const res = createResponseDouble();
  let receivedExpires = 0;
  const deps = {
    ...baseDeps,
    buildGroupChatFileSignedDownloadUrl: async ({
      ossKey,
      expiresInSeconds,
    }) => {
      receivedExpires = Number(expiresInSeconds || 0);
      return `https://oss.example.com/${ossKey}?Expires=1777777777&Signature=test`;
    },
    GeneratedMusicHistory: {
      findOne() {
        return {
          lean: async () => ({
            _id: "m1",
            format: "mp3",
            ossKey: "music/m1.mp3",
          }),
        };
      },
    },
  };

  await getMusicHistoryDownloadLinkHandler(req, res, deps);
  assert.equal(res.statusCode, 200);
  assert.equal(receivedExpires, 30 * 24 * 60 * 60);
  assert.match(String(res.payload.downloadUrl || ""), /Signature=test/);
  assert.equal(res.payload.fileName, "educhat-music-m1.mp3");
  assert.equal(res.payload.expiresAt, "2026-05-03T03:09:37.000Z");
});

test("getMusicHistoryContentHandler streams OSS-backed audio for preview", async () => {
  const req = {
    authUser: { _id: "u1" },
    authStorageUserId: "u1",
    params: { musicId: "m1" },
  };
  const res = createResponseDouble();
  const deps = {
    ...baseDeps,
    fetch: async () => ({
      ok: true,
      headers: {
        get(name) {
          return String(name || "").toLowerCase() === "content-type"
            ? "audio/mpeg"
            : "";
        },
      },
      arrayBuffer: async () => Uint8Array.from([1, 2, 3, 4]).buffer,
    }),
    GeneratedMusicHistory: {
      findOne() {
        return {
          lean: async () => ({
            _id: "m1",
            format: "mp3",
            ossKey: "music/m1.mp3",
            audioUrl: "https://oss.example.com/music/m1.mp3",
          }),
        };
      },
    },
  };

  await getMusicHistoryContentHandler(req, res, deps);
  assert.equal(res.redirectUrl, "");
  assert.equal(res.headers["Content-Type"], "audio/mpeg");
  assert.equal(res.headers["Content-Disposition"], 'inline; filename="educhat-music-m1.mp3"');
  assert.deepEqual(Array.from(res.payload), [1, 2, 3, 4]);
});

test("music history delete stops when OSS deletion fails", async () => {
  const req = {
    authUser: { _id: "u1" },
    authStorageUserId: "u1",
    params: { musicId: "m1" },
  };
  const deleteRes = createResponseDouble();
  const clearRes = createResponseDouble();
  let deleteManyCalled = false;
  let findOneAndDeleteCalled = false;
  const deps = {
    ...baseDeps,
    GeneratedMusicHistory: {
      findOne() {
        return {
          lean: async () => ({ _id: "m1", ossKey: "music/m1.mp3" }),
        };
      },
      find() {
        return {
          lean: async () => [{ _id: "m1", ossKey: "music/m1.mp3" }],
        };
      },
      deleteMany: async () => {
        deleteManyCalled = true;
        return { deletedCount: 1 };
      },
      findOneAndDelete: async () => {
        findOneAndDeleteCalled = true;
        return { _id: "m1" };
      },
    },
    deleteGeneratedMusicHistoryOssObjects: async () => ({
      deletedCount: 0,
      failedKeys: ["music/m1.mp3"],
    }),
  };

  await deleteMusicHistoryItemHandler(req, deleteRes, deps);
  await clearMusicHistoryHandler(req, clearRes, deps);

  assert.equal(deleteRes.statusCode, 500);
  assert.equal(clearRes.statusCode, 500);
  assert.equal(findOneAndDeleteCalled, false);
  assert.equal(deleteManyCalled, false);
});

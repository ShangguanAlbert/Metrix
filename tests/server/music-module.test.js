import assert from "node:assert/strict";
import test from "node:test";

import { generateMusicHandler } from "../../server/modules/music/services/generate.js";
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
  sanitizeRuntimeBoolean(value, fallback = false) {
    if (typeof value === "boolean") return value;
    if (value === "true") return true;
    if (value === "false") return false;
    return fallback;
  },
  sanitizeRuntimeInteger(value, fallback, min, max) {
    const numeric = Number.parseInt(value, 10);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(min, Math.min(max, numeric));
  },
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
  safeReadText: async (response) => await response.text(),
  formatProviderUpstreamError: (_provider, _protocol, status, detail) =>
    `错误 ${status}: ${detail}`,
  toGeneratedMusicHistoryItem: (doc) => ({
    ...doc,
    _id: String(doc?._id || ""),
    hasOssBackup: !!String(doc?.ossKey || "").trim(),
    hasReferenceAudioBackup: !!String(doc?.referenceAudioOssKey || "").trim(),
  }),
};

test("listMusicHistoryHandler returns normalized items with reference audio metadata", async () => {
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
            {
              _id: "m1",
              model: "music-cover",
              ossKey: "music/a.mp3",
              referenceAudioOssKey: "music/ref.mp3",
              referenceAudioFileName: "ref.mp3",
            },
          ],
        };
      },
    },
  };

  await listMusicHistoryHandler(req, res, deps);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.items[0]._id, "m1");
  assert.equal(res.payload.items[0].hasOssBackup, true);
  assert.equal(res.payload.items[0].hasReferenceAudioBackup, true);
});

test("renameMusicHistoryItemHandler persists expanded history fields", async () => {
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
            generationType: "cover",
            ossKey: "music/a.mp3",
            referenceAudioOssKey: "music/ref.mp3",
            referenceAudioFileName: "ref.mp3",
          }),
        };
      },
    },
  };

  await renameMusicHistoryItemHandler(req, res, deps);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.item.title, "新的任务标题");
  assert.equal(res.payload.item.generationType, "cover");
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
    buildGroupChatFileSignedDownloadUrl: async ({ ossKey, expiresInSeconds }) => {
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

test("delete and clear music history delete both output and reference audio OSS backups", async () => {
  const req = {
    authUser: { _id: "u1" },
    authStorageUserId: "u1",
    params: { musicId: "m1" },
  };
  const deleteRes = createResponseDouble();
  const clearRes = createResponseDouble();
  const deps = {
    ...baseDeps,
    GeneratedMusicHistory: {
      findOne() {
        return {
          lean: async () => ({
            _id: "m1",
            ossKey: "music/m1.mp3",
            referenceAudioOssKey: "music/ref.mp3",
          }),
        };
      },
      find() {
        return {
          lean: async () => [
            {
              _id: "m1",
              ossKey: "music/m1.mp3",
              referenceAudioOssKey: "music/ref.mp3",
            },
          ],
        };
      },
      deleteMany: async () => ({ deletedCount: 1 }),
      findOneAndDelete: async () => ({ _id: "m1" }),
    },
    deleteGeneratedMusicHistoryOssObjects: async (items) => {
      assert.equal(items[0].referenceAudioOssKey, "music/ref.mp3");
      return {
        deletedCount: 2,
        failedKeys: [],
      };
    },
  };

  await deleteMusicHistoryItemHandler(req, deleteRes, deps);
  await clearMusicHistoryHandler(req, clearRes, deps);

  assert.equal(deleteRes.payload.deleted, true);
  assert.equal(clearRes.payload.deletedCount, 1);
});

test("generateMusicHandler backs up reference audio before requesting MiniMax", async () => {
  const req = {
    authUser: { _id: "u1" },
    authStorageUserId: "u1",
    body: {
      model: "music-cover-free",
      prompt: "女声翻唱",
      lyrics: "",
    },
    file: {
      originalname: "ref.mp3",
      mimetype: "audio/mpeg",
      size: 4,
      buffer: Buffer.from([1, 2, 3, 4]),
    },
  };
  const res = createResponseDouble();
  let uploadedReferenceFirst = false;
  const deps = {
    ...baseDeps,
    getProviderConfig() {
      return {
        apiKey: "mm-key",
        musicEndpoint: "https://api.minimaxi.com/v1/music_generation",
        missingKeyMessage: "",
      };
    },
    async uploadBufferToGroupChatOss({ scope, fileName }) {
      if (scope === "music-generation-reference-audio") {
        uploadedReferenceFirst = true;
        return {
          fileName,
          mimeType: "audio/mpeg",
          size: 4,
          ossKey: "music/ref.mp3",
          ossBucket: "demo",
          ossRegion: "hz",
          fileUrl: "https://oss.example.com/music/ref.mp3",
        };
      }
      assert.equal(uploadedReferenceFirst, true);
      return {
        fileName,
        mimeType: "audio/mpeg",
        size: 4,
        ossKey: "music/out.mp3",
        ossBucket: "demo",
        ossRegion: "hz",
        fileUrl: "https://oss.example.com/music/out.mp3",
      };
    },
    GeneratedMusicHistory: {
      async create(payload) {
        return { _id: "m1", ...payload };
      },
    },
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).startsWith("https://oss.example.com/")) {
      return {
        ok: true,
        arrayBuffer: async () => Uint8Array.from([9, 8, 7, 6]).buffer,
      };
    }
    return {
      ok: true,
      text: async () =>
        JSON.stringify({
          data: {
            status: 2,
            audio: "https://oss.example.com/tmp/final.mp3",
          },
          extra_info: {
            music_duration: 20000,
          },
          base_resp: {
            status_code: 0,
            status_msg: "success",
          },
        }),
    };
  };

  try {
    await generateMusicHandler(req, res, deps);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.ok, true);
  assert.equal(res.payload.item.generationType, "cover");
  assert.equal(res.payload.item.referenceAudioFileName, "ref.mp3");
  assert.equal(res.payload.item.hasReferenceAudioBackup, true);
});

test("generateMusicHandler stops if reference audio backup fails", async () => {
  const req = {
    authUser: { _id: "u1" },
    authStorageUserId: "u1",
    body: {
      model: "music-cover",
      prompt: "男声翻唱",
    },
    file: {
      originalname: "ref.mp3",
      mimetype: "audio/mpeg",
      size: 4,
      buffer: Buffer.from([1, 2, 3, 4]),
    },
  };
  const res = createResponseDouble();
  const deps = {
    ...baseDeps,
    getProviderConfig() {
      return {
        apiKey: "mm-key",
        musicEndpoint: "https://api.minimaxi.com/v1/music_generation",
        missingKeyMessage: "",
      };
    },
    async uploadBufferToGroupChatOss() {
      return null;
    },
  };

  await generateMusicHandler(req, res, deps);
  assert.equal(res.statusCode, 500);
  assert.match(String(res.payload?.error || ""), /参考音频备份/);
});

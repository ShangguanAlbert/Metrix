import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeMusicDownloadLinkResponse,
  normalizeMusicGenerationResponse,
  normalizeMusicHistoryDeleteResponse,
  normalizeMusicHistoryLimit,
  normalizeMusicHistoryListResponse,
} from "../../shared/contracts/music.js";

test("normalizeMusicHistoryLimit clamps into supported range", () => {
  assert.equal(normalizeMusicHistoryLimit("0"), 1);
  assert.equal(normalizeMusicHistoryLimit("200"), 100);
  assert.equal(normalizeMusicHistoryLimit("24"), 24);
});

test("normalizeMusicHistoryListResponse keeps item fields stable", () => {
  const normalized = normalizeMusicHistoryListResponse({
    ok: true,
    items: [
      {
        _id: 123,
        model: "music-2.6",
        prompt: "hello",
        isInstrumental: 1,
        bitrate: "256000",
      },
    ],
  });

  assert.deepEqual(normalized, {
    ok: true,
    items: [
      {
        _id: "123",
        model: "music-2.6",
        prompt: "hello",
        lyrics: "",
        isInstrumental: true,
        lyricsOptimizer: false,
        format: "",
        sampleRate: 0,
        bitrate: 256000,
        durationMs: 0,
        audioSize: 0,
        hasOssBackup: false,
        createdAt: "",
        contentPath: "",
      },
    ],
  });
});

test("normalizeMusicGenerationResponse and delete response preserve booleans", () => {
  assert.deepEqual(
    normalizeMusicGenerationResponse({
      ok: true,
      item: { _id: "m1", model: "music-2.6-free" },
    }),
    {
      ok: true,
      item: {
        _id: "m1",
        model: "music-2.6-free",
        prompt: "",
        lyrics: "",
        isInstrumental: false,
        lyricsOptimizer: false,
        format: "",
        sampleRate: 0,
        bitrate: 0,
        durationMs: 0,
        audioSize: 0,
        hasOssBackup: false,
        createdAt: "",
        contentPath: "",
      },
    },
  );

  assert.deepEqual(
    normalizeMusicHistoryDeleteResponse({
      ok: true,
      deleted: 1,
      deletedCount: "3",
    }),
    {
      ok: true,
      deleted: true,
      deletedCount: 3,
    },
  );
});

test("normalizeMusicDownloadLinkResponse keeps signed link fields", () => {
  assert.deepEqual(
    normalizeMusicDownloadLinkResponse({
      ok: true,
      downloadUrl: "https://oss.example.com/a.mp3?Expires=1",
      fileName: "a.mp3",
      expiresAt: "2026-05-01T00:00:00.000Z",
    }),
    {
      ok: true,
      downloadUrl: "https://oss.example.com/a.mp3?Expires=1",
      fileName: "a.mp3",
      expiresAt: "2026-05-01T00:00:00.000Z",
    },
  );
});

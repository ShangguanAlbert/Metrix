import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeLyricsGenerationResponse,
  normalizeLyricsHistoryDeleteResponse,
  normalizeLyricsHistoryListResponse,
  normalizeLyricsHistoryRenameResponse,
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

test("normalizeMusicHistoryListResponse keeps expanded item fields stable", () => {
  const normalized = normalizeMusicHistoryListResponse({
    ok: true,
    items: [
      {
        _id: 123,
        model: "music-cover",
        prompt: "hello",
        generationType: "cover",
        isInstrumental: 1,
        bitrate: "256000",
        referenceAudioFileName: "demo.mp3",
        referenceAudioSize: "4096",
        hasReferenceAudioBackup: 1,
      },
    ],
  });

  assert.deepEqual(normalized, {
    ok: true,
    items: [
      {
        _id: "123",
        title: "",
        model: "music-cover",
        prompt: "hello",
        lyrics: "",
        generationType: "cover",
        isInstrumental: true,
        lyricsOptimizer: false,
        format: "",
        sampleRate: 0,
        bitrate: 256000,
        durationMs: 0,
        audioSize: 0,
        hasOssBackup: false,
        referenceAudioFileName: "demo.mp3",
        referenceAudioMimeType: "",
        referenceAudioSize: 4096,
        hasReferenceAudioBackup: true,
        createdAt: "",
        contentPath: "",
      },
    ],
  });
});

test("normalizeMusicGenerationResponse preserves expanded cover fields", () => {
  assert.deepEqual(
    normalizeMusicGenerationResponse({
      ok: true,
      item: {
        _id: "m1",
        model: "music-cover-free",
        generationType: "cover",
        referenceAudioFileName: "ref.wav",
        hasReferenceAudioBackup: true,
      },
    }),
    {
      ok: true,
      item: {
        _id: "m1",
        title: "",
        model: "music-cover-free",
        prompt: "",
        lyrics: "",
        generationType: "cover",
        isInstrumental: false,
        lyricsOptimizer: false,
        format: "",
        sampleRate: 0,
        bitrate: 0,
        durationMs: 0,
        audioSize: 0,
        hasOssBackup: false,
        referenceAudioFileName: "ref.wav",
        referenceAudioMimeType: "",
        referenceAudioSize: 0,
        hasReferenceAudioBackup: true,
        createdAt: "",
        contentPath: "",
      },
    },
  );
});

test("normalizeLyricsHistory responses preserve song fields", () => {
  const list = normalizeLyricsHistoryListResponse({
    ok: true,
    items: [
      {
        _id: 99,
        mode: "edit",
        songTitle: "夏夜未眠",
        styleTags: "Mandopop, Piano",
      },
    ],
  });
  assert.deepEqual(list, {
    ok: true,
    items: [
      {
        _id: "99",
        title: "",
        mode: "edit",
        prompt: "",
        sourceLyrics: "",
        songTitle: "夏夜未眠",
        styleTags: "Mandopop, Piano",
        lyrics: "",
        createdAt: "",
      },
    ],
  });

  assert.deepEqual(
    normalizeLyricsGenerationResponse({
      ok: true,
      item: { _id: "l1", songTitle: "白日梦", styleTags: "Folk" },
    }),
    {
      ok: true,
      item: {
        _id: "l1",
        title: "",
        mode: "",
        prompt: "",
        sourceLyrics: "",
        songTitle: "白日梦",
        styleTags: "Folk",
        lyrics: "",
        createdAt: "",
      },
    },
  );

  assert.deepEqual(
    normalizeLyricsHistoryRenameResponse({
      ok: true,
      item: { _id: "l2", title: "新的标题" },
    }),
    {
      ok: true,
      item: {
        _id: "l2",
        title: "新的标题",
        mode: "",
        prompt: "",
        sourceLyrics: "",
        songTitle: "",
        styleTags: "",
        lyrics: "",
        createdAt: "",
      },
    },
  );
});

test("delete and download responses remain stable", () => {
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

  assert.deepEqual(
    normalizeLyricsHistoryDeleteResponse({
      ok: true,
      deleted: 1,
      deletedCount: "2",
    }),
    {
      ok: true,
      deleted: true,
      deletedCount: 2,
    },
  );

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

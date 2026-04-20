import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMiniMaxChatPayload,
  buildMiniMaxProviderConfig,
  formatMiniMaxUpstreamError,
} from "../../server/providers/minimax/index.js";
import { buildMiniMaxMusicRequest } from "../../server/modules/music/services/generate.js";

const musicDepsDouble = {
  sanitizeText(value, fallback = "", maxLength = 2000) {
    const text = String(value ?? fallback).trim();
    return text.slice(0, maxLength);
  },
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
  normalizeGeneratedMusicFormat(value) {
    const format = String(value || "").trim().toLowerCase();
    return format || "mp3";
  },
};

test("buildMiniMaxProviderConfig reads defaults and api key", () => {
  const config = buildMiniMaxProviderConfig({
    env: {
      MINIMAX_API_KEY: "mm-key",
    },
  });

  assert.equal(config.apiKey, "mm-key");
  assert.equal(
    config.chatEndpoint,
    "https://api.minimaxi.com/v1/chat/completions",
  );
  assert.equal(
    config.musicEndpoint,
    "https://api.minimaxi.com/v1/music_generation",
  );
});

test("buildMiniMaxChatPayload merges system prompts into a single MiniMax system message", () => {
  const payload = buildMiniMaxChatPayload({
    model: "MiniMax-M2.7",
    messages: [
      { role: "system", content: "额外规则" },
      { role: "user", content: "hello" },
    ],
    systemPrompt: "你是助手",
    config: {
      maxOutputTokens: 8192,
      temperature: 0.7,
      topP: 0.8,
    },
    reasoningEnabled: true,
  });

  assert.deepEqual(payload.messages[0], {
    role: "system",
    content: "你是助手\n\n额外规则",
  });
  assert.equal(
    payload.messages.filter((message) => message.role === "system").length,
    1,
  );
  assert.equal(payload.messages[1].content, "hello");
  assert.equal(payload.max_tokens, 8192);
  assert.equal(payload.temperature, 0.7);
  assert.equal(payload.top_p, 0.8);
  assert.deepEqual(payload.extra_body, {
    reasoning_split: true,
  });
});

test("formatMiniMaxUpstreamError maps common upstream codes to stable Chinese messages", () => {
  assert.equal(
    formatMiniMaxUpstreamError({ status: 401, code: "1004" }),
    "MiniMax 认证失败：请检查 MINIMAX_API_KEY 是否正确且仍有效。",
  );
  assert.equal(
    formatMiniMaxUpstreamError({ status: 400, code: "1008" }),
    "MiniMax 账号余额不足，请充值后重试。",
  );
  assert.equal(
    formatMiniMaxUpstreamError({ status: 429 }),
    "MiniMax 当前请求过于频繁，请稍后再试。",
  );
});

test("buildMiniMaxMusicRequest validates instrumental and lyric modes", () => {
  const instrumental = buildMiniMaxMusicRequest(
    {
      model: "music-2.6-free",
      prompt: "温暖木吉他与钢琴",
      isInstrumental: true,
      format: "wav",
      sampleRate: 32000,
      bitrate: 128000,
    },
    musicDepsDouble,
  );

  assert.equal(instrumental.payload.is_instrumental, true);
  assert.equal(instrumental.payload.audio_setting.format, "wav");
  assert.equal(instrumental.meta.sampleRate, 32000);

  assert.throws(
    () =>
      buildMiniMaxMusicRequest(
        {
          model: "music-2.6",
          prompt: "",
          lyrics: "",
          isInstrumental: false,
          lyricsOptimizer: false,
        },
        musicDepsDouble,
      ),
    /非纯音乐需要填写歌词/,
  );
});

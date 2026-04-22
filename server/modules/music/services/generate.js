import { Buffer } from "node:buffer";
import multer from "multer";
import { normalizeMusicGenerationResponse } from "../../../../shared/contracts/music.js";

const COMPOSE_MODELS = new Set(["music-2.6", "music-2.6-free"]);
const COVER_MODELS = new Set(["music-cover", "music-cover-free"]);
const ALL_MUSIC_MODELS = new Set([...COMPOSE_MODELS, ...COVER_MODELS]);
const MAX_MONGO_AUDIO_BYTES = 12 * 1024 * 1024;
const MUSIC_SYNC_MAX_ATTEMPTS = 12;
const MUSIC_SYNC_WAIT_MS = 3000;
const MUSIC_REFERENCE_AUDIO_MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const MUSIC_REFERENCE_AUDIO_UPLOAD = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: MUSIC_REFERENCE_AUDIO_MAX_FILE_SIZE_BYTES,
  },
});
const FIXED_AUDIO_SETTING = {
  format: "mp3",
  sampleRate: 44100,
  bitrate: 256000,
};

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function sanitizeMusicModel(value) {
  const model = String(value || "").trim();
  return ALL_MUSIC_MODELS.has(model) ? model : "music-2.6-free";
}

function isCoverModel(model) {
  return COVER_MODELS.has(String(model || "").trim());
}

function sanitizeAudioSetting() {
  return {
    format: FIXED_AUDIO_SETTING.format,
    sampleRate: FIXED_AUDIO_SETTING.sampleRate,
    bitrate: FIXED_AUDIO_SETTING.bitrate,
  };
}

function normalizeUploadFile(file, deps) {
  if (!file || !Buffer.isBuffer(file?.buffer) || !file.buffer.length) {
    return null;
  }
  return {
    fileName: deps.sanitizeGroupChatFileName(
      file?.originalname || "reference-audio.bin",
    ),
    mimeType: String(file?.mimetype || "application/octet-stream").trim() ||
      "application/octet-stream",
    size: Number(file?.size || file.buffer.length || 0),
    buffer: file.buffer,
  };
}

function decodeHexAudio(value) {
  const text = String(value || "").trim();
  if (!text || !/^[0-9a-f]+$/i.test(text) || text.length % 2 !== 0) {
    return Buffer.alloc(0);
  }
  return Buffer.from(text, "hex");
}

async function readAudioBufferFromMiniMaxResponse(audio, apiKey) {
  const audioText = String(audio || "").trim();
  if (!audioText) return Buffer.alloc(0);

  if (/^https?:\/\//i.test(audioText)) {
    const response = await fetch(audioText, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });
    if (!response.ok) {
      throw new Error(`音乐文件下载失败（${response.status}）。`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  return decodeHexAudio(audioText);
}

export function buildMiniMaxMusicRequest(body, deps, options = {}) {
  const model = sanitizeMusicModel(body?.model);
  const prompt = deps.sanitizeText(body?.prompt, "", 2000);
  const lyrics = deps.sanitizeText(body?.lyrics, "", 3500);
  const isInstrumental = deps.sanitizeRuntimeBoolean(body?.isInstrumental, false);
  const lyricsOptimizer = deps.sanitizeRuntimeBoolean(body?.lyricsOptimizer, false);
  const aigcWatermark = deps.sanitizeRuntimeBoolean(body?.aigcWatermark, false);
  const referenceAudioFile = normalizeUploadFile(options?.referenceAudioFile, deps);

  if (isCoverModel(model)) {
    if (!prompt) {
      throw new Error("翻唱模式需要填写目标风格描述。");
    }
    if (!referenceAudioFile) {
      throw new Error("翻唱模式需要上传参考音频。");
    }
    return {
      meta: {
        model,
        prompt,
        lyrics,
        generationType: "cover",
        isInstrumental: false,
        lyricsOptimizer: false,
        aigcWatermark: false,
        format: "mp3",
        sampleRate: 0,
        bitrate: 0,
        referenceAudioFileName: referenceAudioFile.fileName,
        referenceAudioMimeType: referenceAudioFile.mimeType,
        referenceAudioSize: referenceAudioFile.size,
      },
      payload: {
        model,
        prompt,
        lyrics,
        stream: false,
        output_format: "url",
        audio_base64: referenceAudioFile.buffer.toString("base64"),
      },
      referenceAudioFile,
    };
  }

  const audioSetting = sanitizeAudioSetting();
  if (isInstrumental && !prompt) {
    throw new Error("生成纯音乐时需要填写风格/场景描述。");
  }
  if (!isInstrumental && !lyrics && !lyricsOptimizer) {
    throw new Error("非纯音乐需要填写歌词，或开启自动歌词优化。");
  }
  if (!lyrics && lyricsOptimizer && !prompt) {
    throw new Error("自动生成歌词时需要填写风格/场景描述。");
  }

  return {
    meta: {
      model,
      prompt,
      lyrics,
      generationType: "compose",
      isInstrumental,
      lyricsOptimizer,
      aigcWatermark,
      format: audioSetting.format,
      sampleRate: audioSetting.sampleRate,
      bitrate: audioSetting.bitrate,
      referenceAudioFileName: "",
      referenceAudioMimeType: "",
      referenceAudioSize: 0,
    },
    payload: {
      model,
      prompt,
      lyrics,
      stream: false,
      output_format: "url",
      aigc_watermark: aigcWatermark,
      lyrics_optimizer: lyricsOptimizer,
      is_instrumental: isInstrumental,
      audio_setting: {
        sample_rate: audioSetting.sampleRate,
        bitrate: audioSetting.bitrate,
        format: audioSetting.format,
      },
    },
    referenceAudioFile: null,
  };
}

async function callMiniMaxMusicEndpoint(providerConfig, payload, deps) {
  const upstreamResponse = await fetch(providerConfig.musicEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${providerConfig.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  const raw = await deps.safeReadText(upstreamResponse);
  let json = {};
  try {
    json = raw ? JSON.parse(raw) : {};
  } catch {
    json = {};
  }

  if (!upstreamResponse.ok) {
    throw new Error(
      deps.formatProviderUpstreamError(
        "minimax",
        "music",
        upstreamResponse.status,
        raw,
      ),
    );
  }

  const statusCode = Number(json?.base_resp?.status_code ?? 0);
  if (statusCode !== 0) {
    throw new Error(
      deps.formatProviderUpstreamError(
        "minimax",
        "music",
        400,
        JSON.stringify(json),
      ),
    );
  }

  return json;
}

async function waitForCompletedMusic({ providerConfig, payload, deps }) {
  let lastJson = {};
  for (let attempt = 1; attempt <= MUSIC_SYNC_MAX_ATTEMPTS; attempt += 1) {
    const json = await callMiniMaxMusicEndpoint(providerConfig, payload, deps);
    lastJson = json;

    const audioBuffer = await readAudioBufferFromMiniMaxResponse(
      json?.data?.audio,
      providerConfig.apiKey,
    );
    if (audioBuffer.length > 0) {
      return { json, audioBuffer };
    }

    const status = Number(json?.data?.status || 0);
    if (status !== 1) {
      break;
    }

    if (attempt < MUSIC_SYNC_MAX_ATTEMPTS) {
      await sleep(MUSIC_SYNC_WAIT_MS);
    }
  }

  throw new Error(
    Number(lastJson?.data?.status || 0) === 1
      ? "MiniMax 仍在生成中，请稍后重试。"
      : "MiniMax 未返回可保存的音乐内容。",
  );
}

async function backupReferenceAudioToOss({
  req,
  deps,
  referenceAudioFile,
}) {
  if (!referenceAudioFile) {
    return null;
  }

  const userId = deps.sanitizeId(req.authStorageUserId || req.authUser?._id, "");
  if (!userId) {
    throw new Error("无效用户身份。");
  }

  const uploaded = await deps.uploadBufferToGroupChatOss({
    scope: "music-generation-reference-audio",
    userId,
    fileName: referenceAudioFile.fileName,
    mimeType: referenceAudioFile.mimeType,
    dataBuffer: referenceAudioFile.buffer,
    cacheControl: "private, no-store",
  });
  if (!uploaded) {
    throw new Error("参考音频备份到阿里云 OSS 失败，请稍后重试。");
  }

  return uploaded;
}

async function persistGeneratedMusic({
  req,
  deps,
  meta,
  audioBuffer,
  upstream,
  referenceAudioBackup,
}) {
  const userId = deps.sanitizeId(req.authStorageUserId || req.authUser?._id, "");
  if (!userId) {
    throw new Error("无效用户身份。");
  }

  const mimeType = deps.normalizeGeneratedMusicMimeType("", meta.format);
  const durationMs = deps.sanitizeRuntimeInteger(
    upstream?.extra_info?.music_duration,
    0,
    0,
    24 * 60 * 60 * 1000,
  );
  const fileName = `minimax-music-${Date.now()}.${meta.format}`;
  let uploaded = null;
  if (audioBuffer.length > 0) {
    uploaded = await deps.uploadBufferToGroupChatOss({
      scope: "music-generation-outputs",
      userId,
      fileName,
      mimeType,
      dataBuffer: audioBuffer,
      cacheControl: "private, no-store",
    });
  }

  if (!uploaded) {
    if (audioBuffer.length > MAX_MONGO_AUDIO_BYTES) {
      throw new Error("音乐文件过大，且 OSS 未配置，无法稳定保存历史记录。");
    }
    throw new Error("未配置阿里云 OSS，无法为生成音乐创建可长期下载的备份。");
  }

  const doc = await deps.GeneratedMusicHistory.create({
    userId,
    title: "",
    model: meta.model,
    prompt: meta.prompt,
    lyrics: meta.lyrics,
    generationType: meta.generationType,
    isInstrumental: meta.isInstrumental,
    lyricsOptimizer: meta.lyricsOptimizer,
    format: meta.format,
    sampleRate: meta.sampleRate,
    bitrate: meta.bitrate,
    durationMs,
    audioStorageType: "oss",
    audioUrl: uploaded.fileUrl || "",
    ossKey: uploaded.ossKey || "",
    ossBucket: uploaded.ossBucket || "",
    ossRegion: uploaded.ossRegion || "",
    audioMimeType: uploaded.mimeType || mimeType,
    audioSize: uploaded.size || audioBuffer.length,
    audioData: Buffer.alloc(0),
    referenceAudioStorageType: referenceAudioBackup ? "oss" : "",
    referenceAudioUrl: referenceAudioBackup?.fileUrl || "",
    referenceAudioOssKey: referenceAudioBackup?.ossKey || "",
    referenceAudioOssBucket: referenceAudioBackup?.ossBucket || "",
    referenceAudioOssRegion: referenceAudioBackup?.ossRegion || "",
    referenceAudioMimeType: meta.referenceAudioMimeType || "",
    referenceAudioSize: meta.referenceAudioSize || 0,
    referenceAudioFileName: meta.referenceAudioFileName || "",
  });

  return deps.toGeneratedMusicHistoryItem(doc);
}

export async function generateMusicHandler(req, res, deps) {
  const providerConfig = deps.getProviderConfig("minimax");
  if (!providerConfig.apiKey) {
    res.status(500).json({ error: providerConfig.missingKeyMessage });
    return;
  }
  if (!providerConfig.musicEndpoint) {
    res.status(500).json({ error: "当前 MiniMax 未配置音乐生成端点。" });
    return;
  }

  let request;
  try {
    request = buildMiniMaxMusicRequest(req.body || {}, deps, {
      referenceAudioFile: req.file || null,
    });
  } catch (error) {
    res.status(400).json({ error: error?.message || "音乐生成参数无效。" });
    return;
  }

  let referenceAudioBackup = null;
  try {
    referenceAudioBackup = await backupReferenceAudioToOss({
      req,
      deps,
      referenceAudioFile: request.referenceAudioFile,
    });

    const completed = await waitForCompletedMusic({
      providerConfig,
      payload: request.payload,
      deps,
    });

    const item = await persistGeneratedMusic({
      req,
      deps,
      meta: request.meta,
      audioBuffer: completed.audioBuffer,
      upstream: completed.json,
      referenceAudioBackup,
    });
    res.json(normalizeMusicGenerationResponse({ ok: true, item }));
  } catch (error) {
    if (referenceAudioBackup?.ossKey && deps.deleteGroupChatOssObject) {
      try {
        await deps.deleteGroupChatOssObject(referenceAudioBackup.ossKey);
      } catch {
        // Ignore cleanup failures here; the main error is more important to users.
      }
    }
    res.status(500).json({
      error: error?.message || "音乐生成失败，请稍后重试。",
    });
  }
}

export function registerMusicGenerationRoutes(app, deps) {
  app.post(
    "/api/music/generate",
    deps.requireChatAuth,
    MUSIC_REFERENCE_AUDIO_UPLOAD.single("referenceAudio"),
    async (req, res) => {
      await generateMusicHandler(req, res, deps);
    },
  );
}

import { normalizeMusicGenerationResponse } from "../../../../shared/contracts/music.js";

const MUSIC_MODELS = new Set(["music-2.6", "music-2.6-free"]);
const MAX_MONGO_AUDIO_BYTES = 12 * 1024 * 1024;
const FIXED_AUDIO_SETTING = {
  format: "mp3",
  sampleRate: 44100,
  bitrate: 256000,
};

function sanitizeMusicModel(value) {
  const model = String(value || "").trim();
  return MUSIC_MODELS.has(model) ? model : "music-2.6-free";
}

function sanitizeAudioSetting(body, deps) {
  void body;
  void deps;
  return {
    format: FIXED_AUDIO_SETTING.format,
    sampleRate: FIXED_AUDIO_SETTING.sampleRate,
    bitrate: FIXED_AUDIO_SETTING.bitrate,
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
    const resp = await fetch(audioText, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });
    if (!resp.ok) {
      throw new Error(`音乐文件下载失败（${resp.status}）。`);
    }
    return Buffer.from(await resp.arrayBuffer());
  }

  return decodeHexAudio(audioText);
}

export function buildMiniMaxMusicRequest(body, deps) {
  const model = sanitizeMusicModel(body?.model);
  const prompt = deps.sanitizeText(body?.prompt, "", 2000);
  const lyrics = deps.sanitizeText(body?.lyrics, "", 3500);
  const isInstrumental = deps.sanitizeRuntimeBoolean(body?.isInstrumental, false);
  const lyricsOptimizer = deps.sanitizeRuntimeBoolean(body?.lyricsOptimizer, false);
  const aigcWatermark = deps.sanitizeRuntimeBoolean(body?.aigcWatermark, false);
  const audioSetting = sanitizeAudioSetting(body, deps);

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
      isInstrumental,
      lyricsOptimizer,
      aigcWatermark,
      format: audioSetting.format,
      sampleRate: audioSetting.sampleRate,
      bitrate: audioSetting.bitrate,
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
  };
}

async function persistGeneratedMusic({
  req,
  deps,
  meta,
  audioBuffer,
  upstream,
  providerConfig,
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
    model: meta.model,
    prompt: meta.prompt,
    lyrics: meta.lyrics,
    isInstrumental: meta.isInstrumental,
    lyricsOptimizer: meta.lyricsOptimizer,
    format: meta.format,
    sampleRate: meta.sampleRate,
    bitrate: meta.bitrate,
    durationMs,
    audioStorageType: "oss",
    audioUrl: uploaded?.fileUrl || "",
    ossKey: uploaded?.ossKey || "",
    ossBucket: uploaded?.ossBucket || "",
    ossRegion: uploaded?.ossRegion || "",
    audioMimeType: uploaded?.mimeType || mimeType,
    audioSize: uploaded?.size || audioBuffer.length,
    audioData: Buffer.alloc(0),
  });

  void providerConfig;
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
    request = buildMiniMaxMusicRequest(req.body || {}, deps);
  } catch (error) {
    res.status(400).json({ error: error?.message || "音乐生成参数无效。" });
    return;
  }

  try {
    const upstreamResp = await fetch(providerConfig.musicEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${providerConfig.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(request.payload),
    });
    const raw = await deps.safeReadText(upstreamResp);
    let json = {};
    try {
      json = raw ? JSON.parse(raw) : {};
    } catch {
      json = {};
    }

    if (!upstreamResp.ok) {
      res.status(upstreamResp.status).json({
        error: deps.formatProviderUpstreamError(
          "minimax",
          "music",
          upstreamResp.status,
          raw,
        ),
      });
      return;
    }

    const statusCode = Number(json?.base_resp?.status_code ?? 0);
    if (statusCode !== 0) {
      res.status(400).json({
        error: deps.formatProviderUpstreamError(
          "minimax",
          "music",
          400,
          JSON.stringify(json),
        ),
      });
      return;
    }

    const audio = String(json?.data?.audio || "").trim();
    const audioBuffer = await readAudioBufferFromMiniMaxResponse(
      audio,
      providerConfig.apiKey,
    );
    if (!audioBuffer.length) {
      res.status(502).json({ error: "MiniMax 未返回可保存的音乐内容。" });
      return;
    }

    const item = await persistGeneratedMusic({
      req,
      deps,
      meta: request.meta,
      audioBuffer,
      upstream: json,
      providerConfig,
    });
    res.json(normalizeMusicGenerationResponse({ ok: true, item }));
  } catch (error) {
    res.status(500).json({
      error: error?.message || "音乐生成失败，请稍后重试。",
    });
  }
}

export function registerMusicGenerationRoutes(app, deps) {
  app.post("/api/music/generate", deps.requireChatAuth, async (req, res) => {
    await generateMusicHandler(req, res, deps);
  });
}

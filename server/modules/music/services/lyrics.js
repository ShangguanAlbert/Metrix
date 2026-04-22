import {
  normalizeLyricsGenerationResponse,
  normalizeLyricsHistoryDeleteResponse,
  normalizeLyricsHistoryLimit,
  normalizeLyricsHistoryListResponse,
  normalizeLyricsHistoryRenameResponse,
} from "../../../../shared/contracts/music.js";

function sanitizeLyricsMode(value) {
  const mode = String(value || "").trim();
  return mode === "edit" ? "edit" : "write_full_song";
}

export function buildMiniMaxLyricsRequest(body, deps) {
  const mode = sanitizeLyricsMode(body?.mode);
  const prompt = deps.sanitizeText(body?.prompt, "", 2000);
  const title = deps.sanitizeText(body?.title, "", 160);
  const sourceLyrics = deps.sanitizeText(body?.lyrics, "", 3500);

  if (mode === "edit" && !sourceLyrics) {
    throw new Error("编辑或续写歌词时需要填写原歌词。");
  }

  return {
    meta: {
      mode,
      prompt,
      title,
      sourceLyrics,
    },
    payload: {
      mode,
      prompt,
      lyrics: sourceLyrics,
      title,
    },
  };
}

async function createLyricsHistoryItem(req, deps, requestMeta, upstreamJson) {
  const userId = deps.sanitizeId(req.authStorageUserId || req.authUser?._id, "");
  if (!userId) {
    throw new Error("无效用户身份。");
  }

  const doc = await deps.GeneratedLyricsHistory.create({
    userId,
    title: requestMeta.title,
    mode: requestMeta.mode,
    prompt: requestMeta.prompt,
    sourceLyrics: requestMeta.sourceLyrics,
    songTitle: deps.sanitizeText(upstreamJson?.song_title, "", 160),
    styleTags: deps.sanitizeText(upstreamJson?.style_tags, "", 500),
    lyrics: deps.sanitizeText(upstreamJson?.lyrics, "", 3500),
  });
  return deps.toGeneratedLyricsHistoryItem(doc);
}

export async function generateLyricsHandler(req, res, deps) {
  const providerConfig = deps.getProviderConfig("minimax");
  if (!providerConfig.apiKey) {
    res.status(500).json({ error: providerConfig.missingKeyMessage });
    return;
  }
  if (!providerConfig.lyricsEndpoint) {
    res.status(500).json({ error: "当前 MiniMax 未配置歌词生成端点。" });
    return;
  }

  let request;
  try {
    request = buildMiniMaxLyricsRequest(req.body || {}, deps);
  } catch (error) {
    res.status(400).json({ error: error?.message || "歌词生成参数无效。" });
    return;
  }

  try {
    const upstreamResponse = await fetch(providerConfig.lyricsEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${providerConfig.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(request.payload),
    });
    const raw = await deps.safeReadText(upstreamResponse);
    let json = {};
    try {
      json = raw ? JSON.parse(raw) : {};
    } catch {
      json = {};
    }

    if (!upstreamResponse.ok) {
      res.status(upstreamResponse.status).json({
        error: deps.formatProviderUpstreamError(
          "minimax",
          "lyrics",
          upstreamResponse.status,
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
          "lyrics",
          400,
          JSON.stringify(json),
        ),
      });
      return;
    }

    const item = await createLyricsHistoryItem(req, deps, request.meta, json);
    res.json(normalizeLyricsGenerationResponse({ ok: true, item }));
  } catch (error) {
    res.status(500).json({
      error: error?.message || "歌词生成失败，请稍后重试。",
    });
  }
}

export async function listLyricsHistoryHandler(req, res, deps) {
  const userId = deps.sanitizeId(req.authStorageUserId || req.authUser?._id, "");
  if (!userId) {
    res.status(400).json({ error: "无效用户身份。" });
    return;
  }

  const limit = normalizeLyricsHistoryLimit(req.query?.limit);
  try {
    const docs = await deps.GeneratedLyricsHistory.find(
      { userId },
      {
        title: 1,
        mode: 1,
        prompt: 1,
        sourceLyrics: 1,
        songTitle: 1,
        styleTags: 1,
        lyrics: 1,
        createdAt: 1,
      },
    )
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json(
      normalizeLyricsHistoryListResponse({
        ok: true,
        items: docs.map((doc) => deps.toGeneratedLyricsHistoryItem(doc)),
      }),
    );
  } catch (error) {
    res.status(500).json({
      error: error?.message || "读取歌词历史失败，请稍后重试。",
    });
  }
}

export async function renameLyricsHistoryItemHandler(req, res, deps) {
  const userId = deps.sanitizeId(req.authStorageUserId || req.authUser?._id, "");
  const lyricsId = deps.sanitizeId(req.params?.lyricsId, "");
  if (!userId || !lyricsId) {
    res.status(400).json({ error: "无效参数。" });
    return;
  }

  const title = deps.sanitizeText(req.body?.title, "", 80);

  try {
    const updated = await deps.GeneratedLyricsHistory.findOneAndUpdate(
      { _id: lyricsId, userId },
      { $set: { title } },
      {
        new: true,
        projection: {
          title: 1,
          mode: 1,
          prompt: 1,
          sourceLyrics: 1,
          songTitle: 1,
          styleTags: 1,
          lyrics: 1,
          createdAt: 1,
        },
      },
    ).lean();

    if (!updated) {
      res.status(404).json({ error: "歌词不存在。" });
      return;
    }

    res.json(
      normalizeLyricsHistoryRenameResponse({
        ok: true,
        item: deps.toGeneratedLyricsHistoryItem(updated),
      }),
    );
  } catch (error) {
    if (String(error?.name || "") === "CastError") {
      res.status(400).json({ error: "无效歌词 ID。" });
      return;
    }
    res.status(500).json({
      error: error?.message || "重命名歌词任务失败，请稍后重试。",
    });
  }
}

export async function deleteLyricsHistoryItemHandler(req, res, deps) {
  const userId = deps.sanitizeId(req.authStorageUserId || req.authUser?._id, "");
  const lyricsId = deps.sanitizeId(req.params?.lyricsId, "");
  if (!userId || !lyricsId) {
    res.status(400).json({ error: "无效参数。" });
    return;
  }

  try {
    const deleted = await deps.GeneratedLyricsHistory.findOneAndDelete({
      _id: lyricsId,
      userId,
    });
    res.json(
      normalizeLyricsHistoryDeleteResponse({
        ok: true,
        deleted: !!deleted,
        deletedCount: deleted ? 1 : 0,
      }),
    );
  } catch (error) {
    if (String(error?.name || "") === "CastError") {
      res.status(400).json({ error: "无效歌词 ID。" });
      return;
    }
    res.status(500).json({
      error: error?.message || "删除歌词历史失败，请稍后重试。",
    });
  }
}

export async function clearLyricsHistoryHandler(req, res, deps) {
  const userId = deps.sanitizeId(req.authStorageUserId || req.authUser?._id, "");
  if (!userId) {
    res.status(400).json({ error: "无效用户身份。" });
    return;
  }

  try {
    const result = await deps.GeneratedLyricsHistory.deleteMany({ userId });
    res.json(
      normalizeLyricsHistoryDeleteResponse({
        ok: true,
        deleted: Number(result?.deletedCount || 0) > 0,
        deletedCount: Number(result?.deletedCount || 0),
      }),
    );
  } catch (error) {
    res.status(500).json({
      error: error?.message || "清空歌词历史失败，请稍后重试。",
    });
  }
}

export function registerLyricsRoutes(app, deps) {
  app.post("/api/music/lyrics/generate", deps.requireChatAuth, async (req, res) => {
    await generateLyricsHandler(req, res, deps);
  });

  app.get("/api/music/lyrics/history", deps.requireChatAuth, async (req, res) => {
    await listLyricsHistoryHandler(req, res, deps);
  });

  app.patch(
    "/api/music/lyrics/history/:lyricsId",
    deps.requireChatAuth,
    async (req, res) => {
      await renameLyricsHistoryItemHandler(req, res, deps);
    },
  );

  app.delete(
    "/api/music/lyrics/history/:lyricsId",
    deps.requireChatAuth,
    async (req, res) => {
      await deleteLyricsHistoryItemHandler(req, res, deps);
    },
  );

  app.delete("/api/music/lyrics/history", deps.requireChatAuth, async (req, res) => {
    await clearLyricsHistoryHandler(req, res, deps);
  });
}

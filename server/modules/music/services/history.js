import {
  normalizeMusicDownloadLinkResponse,
  normalizeMusicHistoryDeleteResponse,
  normalizeMusicHistoryLimit,
  normalizeMusicHistoryListResponse,
  normalizeMusicHistoryRenameResponse,
} from "../../../../shared/contracts/music.js";

const MUSIC_DOWNLOAD_LINK_TTL_SECONDS = 30 * 24 * 60 * 60;

function buildMusicHistoryFileName(doc, musicId, deps) {
  const safeId = deps.sanitizeId(musicId || doc?._id, "");
  const format = deps.normalizeGeneratedMusicFormat(doc?.format);
  return deps.sanitizeGroupChatFileName(
    `educhat-music-${safeId || "history"}.${format}`,
  );
}

function readSignedUrlExpiryIso(url) {
  const safeUrl = String(url || "").trim();
  if (!safeUrl) return "";
  try {
    const parsed = new URL(safeUrl);
    const epochText =
      parsed.searchParams.get("Expires") ||
      parsed.searchParams.get("x-oss-expires") ||
      "";
    const epoch = Number(epochText);
    if (!Number.isFinite(epoch) || epoch <= 0) return "";
    return new Date(epoch * 1000).toISOString();
  } catch {
    return "";
  }
}

async function buildMusicHistorySignedDownloadLink(doc, musicId, deps) {
  const ossKey = deps.sanitizeGroupChatOssObjectKey(doc?.ossKey);
  const fileName = buildMusicHistoryFileName(doc, musicId, deps);
  if (!ossKey) {
    return {
      downloadUrl: "",
      fileName,
      expiresAt: "",
    };
  }

  const downloadUrl = deps.sanitizeGroupChatHttpUrl(
    await deps.buildGroupChatFileSignedDownloadUrl({
      ossKey,
      fileName,
      disposition: "attachment",
      expiresInSeconds: MUSIC_DOWNLOAD_LINK_TTL_SECONDS,
    }),
  );

  return {
    downloadUrl,
    fileName,
    expiresAt: readSignedUrlExpiryIso(downloadUrl),
  };
}

async function readMusicHistoryOssBuffer(doc, musicId, deps) {
  const ossKey = deps.sanitizeGroupChatOssObjectKey(doc?.ossKey);
  if (!ossKey) {
    return null;
  }

  const signed = await buildMusicHistorySignedDownloadLink(doc, musicId, deps);
  const ossUrl =
    signed.downloadUrl ||
    deps.sanitizeGroupChatHttpUrl(doc?.audioUrl) ||
    deps.buildGroupChatOssObjectUrl(ossKey);
  if (!/^https?:\/\//i.test(ossUrl)) {
    return null;
  }

  const response = await (deps.fetch || fetch)(ossUrl);
  if (!response.ok) {
    throw new Error(`音乐文件读取失败（${response.status}）。`);
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mimeType: String(response.headers.get("content-type") || "").trim(),
  };
}

export async function listMusicHistoryHandler(req, res, deps) {
  const userId = deps.sanitizeId(req.authStorageUserId || req.authUser?._id, "");
  if (!userId) {
    res.status(400).json({ error: "无效用户身份。" });
    return;
  }

  const limit = normalizeMusicHistoryLimit(req.query?.limit);
  try {
    const docs = await deps.GeneratedMusicHistory.find(
      { userId },
      {
        title: 1,
        prompt: 1,
        lyrics: 1,
        isInstrumental: 1,
        lyricsOptimizer: 1,
        model: 1,
        format: 1,
        sampleRate: 1,
        bitrate: 1,
        durationMs: 1,
        audioSize: 1,
        audioStorageType: 1,
        ossKey: 1,
        createdAt: 1,
      },
    )
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json(
      normalizeMusicHistoryListResponse({
        ok: true,
        items: docs.map((doc) => deps.toGeneratedMusicHistoryItem(doc)),
      }),
    );
  } catch (error) {
    res.status(500).json({
      error: error?.message || "读取音乐历史失败，请稍后重试。",
    });
  }
}

export async function getMusicHistoryDownloadLinkHandler(req, res, deps) {
  const userId = deps.sanitizeId(req.authStorageUserId || req.authUser?._id, "");
  const musicId = deps.sanitizeId(req.params?.musicId, "");
  if (!userId || !musicId) {
    res.status(400).json({ error: "无效参数。" });
    return;
  }

  try {
    const doc = await deps.GeneratedMusicHistory.findOne(
      { _id: musicId, userId },
      {
        format: 1,
        ossKey: 1,
      },
    ).lean();
    if (!doc) {
      res.status(404).json({ error: "音乐不存在。" });
      return;
    }

    const result = await buildMusicHistorySignedDownloadLink(doc, musicId, deps);
    if (!result.downloadUrl) {
      res.status(400).json({
        error: "该音乐尚未成功备份到阿里云 OSS，暂不支持生成 30 天下载链接。",
      });
      return;
    }

    res.json(
      normalizeMusicDownloadLinkResponse({
        ok: true,
        downloadUrl: result.downloadUrl,
        fileName: result.fileName,
        expiresAt: result.expiresAt,
      }),
    );
  } catch (error) {
    if (String(error?.name || "") === "CastError") {
      res.status(400).json({ error: "无效音乐 ID。" });
      return;
    }
    res.status(500).json({
      error: error?.message || "生成音乐下载链接失败，请稍后重试。",
    });
  }
}

export async function getMusicHistoryContentHandler(req, res, deps) {
  const userId = deps.sanitizeId(req.authStorageUserId || req.authUser?._id, "");
  const musicId = deps.sanitizeId(req.params?.musicId, "");
  if (!userId || !musicId) {
    res.status(400).json({ error: "无效参数。" });
    return;
  }

  try {
    const doc = await deps.GeneratedMusicHistory.findOne(
      { _id: musicId, userId },
      {
        audioUrl: 1,
        audioData: 1,
        audioMimeType: 1,
        format: 1,
        ossKey: 1,
      },
    ).lean();
    if (!doc) {
      res.status(404).json({ error: "音乐不存在。" });
      return;
    }

    const ossFile = await readMusicHistoryOssBuffer(doc, musicId, deps);
    if (ossFile?.buffer?.length) {
      const format = deps.normalizeGeneratedMusicFormat(doc?.format);
      const mimeType = deps.normalizeGeneratedMusicMimeType(
        ossFile.mimeType || doc?.audioMimeType,
        format,
      );
      res.setHeader("Content-Type", mimeType);
      res.setHeader("Content-Length", String(ossFile.buffer.length));
      res.setHeader(
        "Content-Disposition",
        `inline; filename="educhat-music-${musicId}.${format}"`,
      );
      res.setHeader("Cache-Control", "private, no-store");
      res.send(ossFile.buffer);
      return;
    }

    const buffer = Buffer.isBuffer(doc?.audioData)
      ? doc.audioData
      : Buffer.from(doc?.audioData?.buffer || []);
    if (!buffer.length) {
      res.status(404).json({ error: "音乐内容不存在。" });
      return;
    }

    const format = deps.normalizeGeneratedMusicFormat(doc?.format);
    const mimeType = deps.normalizeGeneratedMusicMimeType(
      doc?.audioMimeType,
      format,
    );
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", String(buffer.length));
    res.setHeader(
      "Content-Disposition",
      `inline; filename="educhat-music-${musicId}.${format}"`,
    );
    res.setHeader("Cache-Control", "private, no-store");
    res.send(buffer);
  } catch (error) {
    if (String(error?.name || "") === "CastError") {
      res.status(400).json({ error: "无效音乐 ID。" });
      return;
    }
    res.status(500).json({
      error: error?.message || "读取音乐内容失败，请稍后重试。",
    });
  }
}

export async function clearMusicHistoryHandler(req, res, deps) {
  const userId = deps.sanitizeId(req.authStorageUserId || req.authUser?._id, "");
  if (!userId) {
    res.status(400).json({ error: "无效用户身份。" });
    return;
  }

  try {
    const docs = await deps.GeneratedMusicHistory.find(
      { userId },
      { _id: 1, ossKey: 1 },
    ).lean();
    const deletedOss = await deps.deleteGeneratedMusicHistoryOssObjects(docs);
    if (Array.isArray(deletedOss?.failedKeys) && deletedOss.failedKeys.length > 0) {
      res.status(500).json({
        error: "部分音乐 OSS 备份删除失败，请稍后重试。",
      });
      return;
    }

    const result = await deps.GeneratedMusicHistory.deleteMany({ userId });
    res.json(
      normalizeMusicHistoryDeleteResponse({
        ok: true,
        deleted: Number(result?.deletedCount || 0) > 0,
        deletedCount: Number(result?.deletedCount || 0),
      }),
    );
  } catch (error) {
    res.status(500).json({
      error: error?.message || "清空音乐历史失败，请稍后重试。",
    });
  }
}

export async function deleteMusicHistoryItemHandler(req, res, deps) {
  const userId = deps.sanitizeId(req.authStorageUserId || req.authUser?._id, "");
  const musicId = deps.sanitizeId(req.params?.musicId, "");
  if (!userId || !musicId) {
    res.status(400).json({ error: "无效参数。" });
    return;
  }

  try {
    const existing = await deps.GeneratedMusicHistory.findOne(
      { _id: musicId, userId },
      { _id: 1, ossKey: 1 },
    ).lean();
    if (!existing) {
      res.json(
        normalizeMusicHistoryDeleteResponse({
          ok: true,
          deleted: false,
          deletedCount: 0,
        }),
      );
      return;
    }

    const deletedOss = await deps.deleteGeneratedMusicHistoryOssObjects([existing]);
    if (Array.isArray(deletedOss?.failedKeys) && deletedOss.failedKeys.length > 0) {
      res.status(500).json({
        error: "音乐 OSS 备份删除失败，请稍后重试。",
      });
      return;
    }

    const deleted = await deps.GeneratedMusicHistory.findOneAndDelete(
      { _id: musicId, userId },
      { projection: { _id: 1, ossKey: 1 } },
    );
    res.json(
      normalizeMusicHistoryDeleteResponse({
        ok: true,
        deleted: !!deleted,
        deletedCount: deleted ? 1 : 0,
      }),
    );
  } catch (error) {
    if (String(error?.name || "") === "CastError") {
      res.status(400).json({ error: "无效音乐 ID。" });
      return;
    }
    res.status(500).json({
      error: error?.message || "删除音乐历史失败，请稍后重试。",
    });
  }
}

export async function renameMusicHistoryItemHandler(req, res, deps) {
  const userId = deps.sanitizeId(req.authStorageUserId || req.authUser?._id, "");
  const musicId = deps.sanitizeId(req.params?.musicId, "");
  if (!userId || !musicId) {
    res.status(400).json({ error: "无效参数。" });
    return;
  }

  const title = deps.sanitizeText(req.body?.title, "", 80);

  try {
    const updated = await deps.GeneratedMusicHistory.findOneAndUpdate(
      { _id: musicId, userId },
      { $set: { title } },
      {
        new: true,
        projection: {
          title: 1,
          prompt: 1,
          lyrics: 1,
          isInstrumental: 1,
          lyricsOptimizer: 1,
          model: 1,
          format: 1,
          sampleRate: 1,
          bitrate: 1,
          durationMs: 1,
          audioSize: 1,
          audioStorageType: 1,
          ossKey: 1,
          createdAt: 1,
        },
      },
    ).lean();

    if (!updated) {
      res.status(404).json({ error: "音乐不存在。" });
      return;
    }

    res.json(
      normalizeMusicHistoryRenameResponse({
        ok: true,
        item: deps.toGeneratedMusicHistoryItem(updated),
      }),
    );
  } catch (error) {
    if (String(error?.name || "") === "CastError") {
      res.status(400).json({ error: "无效音乐 ID。" });
      return;
    }
    res.status(500).json({
      error: error?.message || "重命名音乐任务失败，请稍后重试。",
    });
  }
}

export function registerMusicHistoryRoutes(app, deps) {
  app.get("/api/music/history", deps.requireChatAuth, async (req, res) => {
    await listMusicHistoryHandler(req, res, deps);
  });

  app.get("/api/music/history/:musicId/download-link", deps.requireChatAuth, async (req, res) => {
    await getMusicHistoryDownloadLinkHandler(req, res, deps);
  });

  app.get("/api/music/history/:musicId/content", deps.requireChatAuth, async (req, res) => {
    await getMusicHistoryContentHandler(req, res, deps);
  });

  app.patch("/api/music/history/:musicId", deps.requireChatAuth, async (req, res) => {
    await renameMusicHistoryItemHandler(req, res, deps);
  });

  app.delete("/api/music/history", deps.requireChatAuth, async (req, res) => {
    await clearMusicHistoryHandler(req, res, deps);
  });

  app.delete("/api/music/history/:musicId", deps.requireChatAuth, async (req, res) => {
    await deleteMusicHistoryItemHandler(req, res, deps);
  });
}

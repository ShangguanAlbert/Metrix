import {
  normalizeImageHistoryClearResponse,
  normalizeImageHistoryDeleteResponse,
  normalizeImageHistoryLimit,
  normalizeImageHistoryListResponse,
} from "../../../../shared/contracts/images.js";

export async function listImageHistoryHandler(req, res, deps) {
  const userId = deps.sanitizeId(req.authStorageUserId || req.authUser?._id, "");
  if (!userId) {
    res.status(400).json({ error: "无效用户身份。" });
    return;
  }

  const limit = normalizeImageHistoryLimit(req.query?.limit, 80);
  let docs = [];
  try {
    docs = await deps.GeneratedImageHistory.find(
      {
        userId,
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: null },
          { expiresAt: { $gt: new Date() } },
        ],
      },
      {
        prompt: 1,
        imageUrl: 1,
        imageStorageType: 1,
        responseFormat: 1,
        size: 1,
        model: 1,
        createdAt: 1,
      },
    )
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  } catch (error) {
    res.status(500).json({
      error: error?.message || "读取图片历史失败，请稍后重试。",
    });
    return;
  }

  res.json(
    normalizeImageHistoryListResponse({
      ok: true,
      items: Array.isArray(docs) ? docs.map((doc) => deps.toGeneratedImageHistoryItem(doc)) : [],
    }),
  );
}

export async function getImageHistoryContentHandler(req, res, deps) {
  const userId = deps.resolveImageHistoryAuthUserId(req);
  const imageId = deps.sanitizeId(req.params?.imageId, "");
  if (!userId || !imageId) {
    res.status(401).json({ error: "登录状态无效或已过期，请重新登录。" });
    return;
  }

  try {
    const doc = await deps.GeneratedImageHistory.findOne(
      {
        _id: imageId,
        userId,
      },
      {
        imageUrl: 1,
        ossKey: 1,
        imageData: 1,
        imageMimeType: 1,
        imageStorageType: 1,
        expiresAt: 1,
      },
    ).lean();
    if (!doc) {
      res.status(404).json({ error: "图片不存在或已过期。" });
      return;
    }

    const expiresAt = deps.sanitizeIsoDate(doc?.expiresAt);
    const imageStorageType = deps.normalizeGeneratedImageStorageType(doc?.imageStorageType);
    if (imageStorageType !== "oss" && expiresAt && Date.parse(expiresAt) <= Date.now()) {
      res.status(410).json({ error: "图片已过期。" });
      return;
    }

    const ossKey = deps.sanitizeGroupChatOssObjectKey(doc?.ossKey);
    if (ossKey) {
      const ossUrl =
        deps.sanitizeGroupChatHttpUrl(doc?.imageUrl) || deps.buildGroupChatOssObjectUrl(ossKey);
      if (/^https?:\/\//i.test(ossUrl)) {
        res.redirect(ossUrl);
        return;
      }
    }

    const imageBuffer = deps.extractGeneratedImageDataBuffer(doc?.imageData);
    const imageMimeType = deps.normalizeGeneratedImageMimeType(doc?.imageMimeType);
    if (imageBuffer.length > 0) {
      res.setHeader("Content-Type", imageMimeType || "image/png");
      res.setHeader("Content-Length", String(imageBuffer.length));
      res.setHeader("Cache-Control", "private, no-store");
      res.send(imageBuffer);
      return;
    }

    const fallbackUrl = deps.normalizeGeneratedImageStoreUrl(doc?.imageUrl || "");
    if (/^https?:\/\//i.test(fallbackUrl)) {
      res.redirect(fallbackUrl);
      return;
    }
    const fallbackParsedDataUrl = deps.parseGeneratedImageDataUrl(fallbackUrl);
    if (fallbackParsedDataUrl) {
      res.setHeader("Content-Type", fallbackParsedDataUrl.mimeType || "image/png");
      res.setHeader("Content-Length", String(fallbackParsedDataUrl.data.length));
      res.setHeader("Cache-Control", "private, no-store");
      res.send(fallbackParsedDataUrl.data);
      return;
    }

    res.status(404).json({ error: "图片不存在或已过期。" });
  } catch (error) {
    if (String(error?.name || "") === "CastError") {
      res.status(400).json({ error: "无效图片 ID。" });
      return;
    }
    res.status(500).json({
      error: error?.message || "读取图片内容失败，请稍后重试。",
    });
  }
}

export async function clearImageHistoryHandler(req, res, deps) {
  const userId = deps.sanitizeId(req.authStorageUserId || req.authUser?._id, "");
  if (!userId) {
    res.status(400).json({ error: "无效用户身份。" });
    return;
  }

  try {
    const historyDocs = await deps.GeneratedImageHistory.find({ userId }, { _id: 1, ossKey: 1 }).lean();
    const deleteOssSummary = await deps.deleteGeneratedImageHistoryOssObjects(historyDocs);
    const result = await deps.GeneratedImageHistory.deleteMany({ userId });
    res.json(
      normalizeImageHistoryClearResponse({
        ok: true,
        deletedCount: Number(result?.deletedCount || 0),
        deletedOssObjectCount: Number(deleteOssSummary?.deletedCount || 0),
        failedOssKeys: Array.isArray(deleteOssSummary?.failedKeys)
          ? deleteOssSummary.failedKeys
          : [],
      }),
    );
  } catch (error) {
    res.status(500).json({
      error: error?.message || "批量清空图片历史失败，请稍后重试。",
    });
  }
}

export async function deleteImageHistoryItemHandler(req, res, deps) {
  const userId = deps.sanitizeId(req.authStorageUserId || req.authUser?._id, "");
  const imageId = deps.sanitizeId(req.params?.imageId, "");
  if (!userId || !imageId) {
    res.status(400).json({ error: "无效参数。" });
    return;
  }

  try {
    const deleted = await deps.GeneratedImageHistory.findOneAndDelete(
      { _id: imageId, userId },
      {
        projection: {
          _id: 1,
          ossKey: 1,
        },
      },
    );
    const deleteOssSummary = await deps.deleteGeneratedImageHistoryOssObjects(deleted ? [deleted] : []);
    res.json(
      normalizeImageHistoryDeleteResponse({
        ok: true,
        deleted: !!deleted,
        deletedOssObjectCount: Number(deleteOssSummary?.deletedCount || 0),
        failedOssKeys: Array.isArray(deleteOssSummary?.failedKeys)
          ? deleteOssSummary.failedKeys
          : [],
      }),
    );
  } catch (error) {
    if (String(error?.name || "") === "CastError") {
      res.status(400).json({ error: "无效图片 ID。" });
      return;
    }
    res.status(500).json({
      error: error?.message || "删除图片历史失败，请稍后重试。",
    });
  }
}

export function registerImageHistoryRoutes(app, deps) {
  app.get("/api/images/history", deps.requireChatAuth, async (req, res) => {
    await listImageHistoryHandler(req, res, deps);
  });

  app.get("/api/images/history/:imageId/content", async (req, res) => {
    await getImageHistoryContentHandler(req, res, deps);
  });

  app.delete("/api/images/history", deps.requireChatAuth, async (req, res) => {
    await clearImageHistoryHandler(req, res, deps);
  });

  app.delete("/api/images/history/:imageId", deps.requireChatAuth, async (req, res) => {
    await deleteImageHistoryItemHandler(req, res, deps);
  });
}

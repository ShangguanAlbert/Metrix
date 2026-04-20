export const DEFAULT_MUSIC_HISTORY_LIMIT = 40;
export const MAX_MUSIC_HISTORY_LIMIT = 100;

function clampInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return parsed;
}

export function normalizeMusicHistoryLimit(
  value,
  fallback = DEFAULT_MUSIC_HISTORY_LIMIT,
) {
  return clampInteger(value, fallback, 1, MAX_MUSIC_HISTORY_LIMIT);
}

export function normalizeMusicHistoryItem(item = {}) {
  return {
    _id: String(item?._id || item?.id || ""),
    title: String(item?.title || ""),
    model: String(item?.model || ""),
    prompt: String(item?.prompt || ""),
    lyrics: String(item?.lyrics || ""),
    isInstrumental: !!item?.isInstrumental,
    lyricsOptimizer: !!item?.lyricsOptimizer,
    format: String(item?.format || ""),
    sampleRate: clampInteger(item?.sampleRate, 0, 0, Number.MAX_SAFE_INTEGER),
    bitrate: clampInteger(item?.bitrate, 0, 0, Number.MAX_SAFE_INTEGER),
    durationMs: clampInteger(item?.durationMs, 0, 0, Number.MAX_SAFE_INTEGER),
    audioSize: clampInteger(item?.audioSize, 0, 0, Number.MAX_SAFE_INTEGER),
    hasOssBackup: !!item?.hasOssBackup,
    createdAt: String(item?.createdAt || ""),
    contentPath: String(item?.contentPath || ""),
  };
}

export function normalizeMusicHistoryListResponse(payload = {}) {
  return {
    ok: !!payload?.ok,
    items: Array.isArray(payload?.items)
      ? payload.items.map((item) => normalizeMusicHistoryItem(item))
      : [],
  };
}

export function normalizeMusicHistoryDeleteResponse(payload = {}) {
  return {
    ok: !!payload?.ok,
    deleted: !!payload?.deleted,
    deletedCount: clampInteger(payload?.deletedCount, 0, 0, Number.MAX_SAFE_INTEGER),
  };
}

export function normalizeMusicHistoryRenameResponse(payload = {}) {
  return {
    ok: !!payload?.ok,
    item: payload?.item ? normalizeMusicHistoryItem(payload.item) : null,
  };
}

export function normalizeMusicDownloadLinkResponse(payload = {}) {
  return {
    ok: !!payload?.ok,
    downloadUrl: String(payload?.downloadUrl || ""),
    fileName: String(payload?.fileName || ""),
    expiresAt: String(payload?.expiresAt || ""),
  };
}

export function normalizeMusicGenerationResponse(payload = {}) {
  return {
    ok: !!payload?.ok,
    item: payload?.item ? normalizeMusicHistoryItem(payload.item) : null,
  };
}

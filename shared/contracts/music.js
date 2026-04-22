export const DEFAULT_MUSIC_HISTORY_LIMIT = 40;
export const MAX_MUSIC_HISTORY_LIMIT = 100;

export const DEFAULT_LYRICS_HISTORY_LIMIT = 40;
export const MAX_LYRICS_HISTORY_LIMIT = 100;

function clampInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return parsed;
}

function normalizeText(value) {
  return String(value || "");
}

export function normalizeMusicHistoryLimit(
  value,
  fallback = DEFAULT_MUSIC_HISTORY_LIMIT,
) {
  return clampInteger(value, fallback, 1, MAX_MUSIC_HISTORY_LIMIT);
}

export function normalizeLyricsHistoryLimit(
  value,
  fallback = DEFAULT_LYRICS_HISTORY_LIMIT,
) {
  return clampInteger(value, fallback, 1, MAX_LYRICS_HISTORY_LIMIT);
}

export function normalizeMusicHistoryItem(item = {}) {
  return {
    _id: String(item?._id || item?.id || ""),
    title: normalizeText(item?.title),
    model: normalizeText(item?.model),
    prompt: normalizeText(item?.prompt),
    lyrics: normalizeText(item?.lyrics),
    generationType: normalizeText(item?.generationType),
    isInstrumental: !!item?.isInstrumental,
    lyricsOptimizer: !!item?.lyricsOptimizer,
    format: normalizeText(item?.format),
    sampleRate: clampInteger(item?.sampleRate, 0, 0, Number.MAX_SAFE_INTEGER),
    bitrate: clampInteger(item?.bitrate, 0, 0, Number.MAX_SAFE_INTEGER),
    durationMs: clampInteger(item?.durationMs, 0, 0, Number.MAX_SAFE_INTEGER),
    audioSize: clampInteger(item?.audioSize, 0, 0, Number.MAX_SAFE_INTEGER),
    hasOssBackup: !!item?.hasOssBackup,
    referenceAudioFileName: normalizeText(item?.referenceAudioFileName),
    referenceAudioMimeType: normalizeText(item?.referenceAudioMimeType),
    referenceAudioSize: clampInteger(
      item?.referenceAudioSize,
      0,
      0,
      Number.MAX_SAFE_INTEGER,
    ),
    hasReferenceAudioBackup: !!item?.hasReferenceAudioBackup,
    createdAt: normalizeText(item?.createdAt),
    contentPath: normalizeText(item?.contentPath),
  };
}

export function normalizeLyricsHistoryItem(item = {}) {
  return {
    _id: String(item?._id || item?.id || ""),
    title: normalizeText(item?.title),
    mode: normalizeText(item?.mode),
    prompt: normalizeText(item?.prompt),
    sourceLyrics: normalizeText(item?.sourceLyrics),
    songTitle: normalizeText(item?.songTitle),
    styleTags: normalizeText(item?.styleTags),
    lyrics: normalizeText(item?.lyrics),
    createdAt: normalizeText(item?.createdAt),
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

export function normalizeLyricsHistoryListResponse(payload = {}) {
  return {
    ok: !!payload?.ok,
    items: Array.isArray(payload?.items)
      ? payload.items.map((item) => normalizeLyricsHistoryItem(item))
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

export function normalizeLyricsHistoryDeleteResponse(payload = {}) {
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

export function normalizeLyricsHistoryRenameResponse(payload = {}) {
  return {
    ok: !!payload?.ok,
    item: payload?.item ? normalizeLyricsHistoryItem(payload.item) : null,
  };
}

export function normalizeMusicDownloadLinkResponse(payload = {}) {
  return {
    ok: !!payload?.ok,
    downloadUrl: normalizeText(payload?.downloadUrl),
    fileName: normalizeText(payload?.fileName),
    expiresAt: normalizeText(payload?.expiresAt),
  };
}

export function normalizeMusicGenerationResponse(payload = {}) {
  return {
    ok: !!payload?.ok,
    item: payload?.item ? normalizeMusicHistoryItem(payload.item) : null,
  };
}

export function normalizeLyricsGenerationResponse(payload = {}) {
  return {
    ok: !!payload?.ok,
    item: payload?.item ? normalizeLyricsHistoryItem(payload.item) : null,
  };
}

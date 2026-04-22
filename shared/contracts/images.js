export const DEFAULT_IMAGE_HISTORY_LIMIT = 80;
export const MAX_IMAGE_HISTORY_LIMIT = 200;

function clampInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return parsed;
}

export function normalizeImageHistoryLimit(value, fallback = DEFAULT_IMAGE_HISTORY_LIMIT) {
  return clampInteger(value, fallback, 1, MAX_IMAGE_HISTORY_LIMIT);
}

export function normalizeImageHistoryItem(item = {}) {
  const normalizedId = String(item?._id || item?.id || "");
  const normalizedUrl = String(item?.imageUrl || item?.url || "");
  return {
    _id: normalizedId,
    id: normalizedId,
    prompt: String(item?.prompt || ""),
    imageUrl: normalizedUrl,
    url: normalizedUrl,
    imageStorageType: String(item?.imageStorageType || ""),
    responseFormat: String(item?.responseFormat || ""),
    size: String(item?.size || ""),
    model: String(item?.model || ""),
    createdAt: String(item?.createdAt || ""),
  };
}

export function normalizeImageHistoryListResponse(payload = {}) {
  return {
    ok: !!payload?.ok,
    items: Array.isArray(payload?.items)
      ? payload.items.map((item) => normalizeImageHistoryItem(item))
      : [],
  };
}

export function normalizeImageHistoryClearResponse(payload = {}) {
  return {
    ok: !!payload?.ok,
    deletedCount: clampInteger(payload?.deletedCount, 0, 0, Number.MAX_SAFE_INTEGER),
    deletedOssObjectCount: clampInteger(
      payload?.deletedOssObjectCount,
      0,
      0,
      Number.MAX_SAFE_INTEGER,
    ),
    failedOssKeys: Array.isArray(payload?.failedOssKeys)
      ? payload.failedOssKeys.map((item) => String(item || "")).filter(Boolean)
      : [],
  };
}

export function normalizeImageHistoryDeleteResponse(payload = {}) {
  const normalized = normalizeImageHistoryClearResponse(payload);
  return {
    ...normalized,
    deleted: !!payload?.deleted,
  };
}

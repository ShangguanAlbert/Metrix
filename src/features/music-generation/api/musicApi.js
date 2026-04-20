import { getAuthTokenHeader } from "../../chat/api/chatApi.js";
import {
  DEFAULT_MUSIC_HISTORY_LIMIT,
  normalizeMusicDownloadLinkResponse,
  normalizeMusicGenerationResponse,
  normalizeMusicHistoryDeleteResponse,
  normalizeMusicHistoryLimit,
  normalizeMusicHistoryListResponse,
  normalizeMusicHistoryRenameResponse,
} from "../../../../shared/contracts/music.js";

async function readJsonSafe(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function readErrorMessage(data, response) {
  return (
    String(data?.error || data?.message || "").trim() ||
    `请求失败（${response.status}）`
  );
}

export async function generateMusic(payload = {}) {
  const response = await fetch("/api/music/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthTokenHeader(),
    },
    body: JSON.stringify(payload),
  });
  const data = await readJsonSafe(response);
  if (!response.ok) {
    throw new Error(readErrorMessage(data, response));
  }
  return normalizeMusicGenerationResponse(data);
}

export async function fetchMusicHistory({ limit = DEFAULT_MUSIC_HISTORY_LIMIT } = {}) {
  const safeLimit = normalizeMusicHistoryLimit(limit, DEFAULT_MUSIC_HISTORY_LIMIT);
  const response = await fetch(`/api/music/history?limit=${safeLimit}`, {
    method: "GET",
    headers: {
      ...getAuthTokenHeader(),
    },
  });
  const data = await readJsonSafe(response);
  if (!response.ok) {
    throw new Error(readErrorMessage(data, response));
  }
  return normalizeMusicHistoryListResponse(data);
}

export async function deleteMusicHistoryItem(musicId) {
  const safeId = String(musicId || "").trim();
  if (!safeId) {
    throw new Error("无效音乐 ID。");
  }
  const response = await fetch(`/api/music/history/${encodeURIComponent(safeId)}`, {
    method: "DELETE",
    headers: {
      ...getAuthTokenHeader(),
    },
  });
  const data = await readJsonSafe(response);
  if (!response.ok) {
    throw new Error(readErrorMessage(data, response));
  }
  return normalizeMusicHistoryDeleteResponse(data);
}

export async function clearMusicHistory() {
  const response = await fetch("/api/music/history", {
    method: "DELETE",
    headers: {
      ...getAuthTokenHeader(),
    },
  });
  const data = await readJsonSafe(response);
  if (!response.ok) {
    throw new Error(readErrorMessage(data, response));
  }
  return normalizeMusicHistoryDeleteResponse(data);
}

export async function renameMusicHistoryItem(musicId, title) {
  const safeId = String(musicId || "").trim();
  if (!safeId) {
    throw new Error("无效音乐 ID。");
  }
  const response = await fetch(`/api/music/history/${encodeURIComponent(safeId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getAuthTokenHeader(),
    },
    body: JSON.stringify({
      title: String(title || ""),
    }),
  });
  const data = await readJsonSafe(response);
  if (!response.ok) {
    throw new Error(readErrorMessage(data, response));
  }
  return normalizeMusicHistoryRenameResponse(data);
}

export async function fetchMusicHistoryContent(musicId) {
  const safeId = String(musicId || "").trim();
  if (!safeId) {
    throw new Error("无效音乐 ID。");
  }
  const response = await fetch(
    `/api/music/history/${encodeURIComponent(safeId)}/content`,
    {
      method: "GET",
      headers: {
        ...getAuthTokenHeader(),
      },
    },
  );
  if (!response.ok) {
    const data = await readJsonSafe(response);
    throw new Error(readErrorMessage(data, response));
  }
  const blob = await response.blob();
  const contentDisposition = String(response.headers.get("content-disposition") || "");
  const match = contentDisposition.match(/filename="?([^";]+)"?/i);
  return {
    blob,
    fileName: String(match?.[1] || "").trim(),
  };
}

export async function fetchMusicHistoryDownloadLink(musicId) {
  const safeId = String(musicId || "").trim();
  if (!safeId) {
    throw new Error("无效音乐 ID。");
  }
  const response = await fetch(
    `/api/music/history/${encodeURIComponent(safeId)}/download-link`,
    {
      method: "GET",
      headers: {
        ...getAuthTokenHeader(),
      },
    },
  );
  const data = await readJsonSafe(response);
  if (!response.ok) {
    throw new Error(readErrorMessage(data, response));
  }
  return normalizeMusicDownloadLinkResponse(data);
}

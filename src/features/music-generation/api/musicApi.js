import { getAuthTokenHeader } from "../../chat/api/chatApi.js";
import {
  DEFAULT_LYRICS_HISTORY_LIMIT,
  DEFAULT_MUSIC_HISTORY_LIMIT,
  normalizeLyricsGenerationResponse,
  normalizeLyricsHistoryDeleteResponse,
  normalizeLyricsHistoryLimit,
  normalizeLyricsHistoryListResponse,
  normalizeLyricsHistoryRenameResponse,
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

function appendFormField(formData, key, value) {
  if (value == null) return;
  if (value instanceof File) {
    formData.append(key, value);
    return;
  }
  if (typeof value === "boolean") {
    formData.append(key, value ? "true" : "false");
    return;
  }
  formData.append(key, String(value));
}

export async function generateMusic(payload = {}, { signal } = {}) {
  const formData = new FormData();
  appendFormField(formData, "model", payload?.model || "");
  appendFormField(formData, "prompt", payload?.prompt || "");
  appendFormField(formData, "lyrics", payload?.lyrics || "");
  appendFormField(formData, "isInstrumental", !!payload?.isInstrumental);
  appendFormField(formData, "lyricsOptimizer", !!payload?.lyricsOptimizer);
  appendFormField(formData, "aigcWatermark", !!payload?.aigcWatermark);
  if (payload?.referenceAudio instanceof File) {
    appendFormField(formData, "referenceAudio", payload.referenceAudio);
  }

  const response = await fetch("/api/music/generate", {
    method: "POST",
    headers: {
      ...getAuthTokenHeader(),
    },
    body: formData,
    signal,
  });
  const data = await readJsonSafe(response);
  if (!response.ok) {
    throw new Error(readErrorMessage(data, response));
  }
  return normalizeMusicGenerationResponse(data);
}

export async function generateLyrics(payload = {}, { signal } = {}) {
  const response = await fetch("/api/music/lyrics/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthTokenHeader(),
    },
    body: JSON.stringify(payload),
    signal,
  });
  const data = await readJsonSafe(response);
  if (!response.ok) {
    throw new Error(readErrorMessage(data, response));
  }
  return normalizeLyricsGenerationResponse(data);
}

export async function fetchMusicHistory({
  limit = DEFAULT_MUSIC_HISTORY_LIMIT,
} = {}) {
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

export async function fetchLyricsHistory({
  limit = DEFAULT_LYRICS_HISTORY_LIMIT,
} = {}) {
  const safeLimit = normalizeLyricsHistoryLimit(limit, DEFAULT_LYRICS_HISTORY_LIMIT);
  const response = await fetch(`/api/music/lyrics/history?limit=${safeLimit}`, {
    method: "GET",
    headers: {
      ...getAuthTokenHeader(),
    },
  });
  const data = await readJsonSafe(response);
  if (!response.ok) {
    throw new Error(readErrorMessage(data, response));
  }
  return normalizeLyricsHistoryListResponse(data);
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

export async function deleteLyricsHistoryItem(lyricsId) {
  const safeId = String(lyricsId || "").trim();
  if (!safeId) {
    throw new Error("无效歌词 ID。");
  }
  const response = await fetch(
    `/api/music/lyrics/history/${encodeURIComponent(safeId)}`,
    {
      method: "DELETE",
      headers: {
        ...getAuthTokenHeader(),
      },
    },
  );
  const data = await readJsonSafe(response);
  if (!response.ok) {
    throw new Error(readErrorMessage(data, response));
  }
  return normalizeLyricsHistoryDeleteResponse(data);
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

export async function clearLyricsHistory() {
  const response = await fetch("/api/music/lyrics/history", {
    method: "DELETE",
    headers: {
      ...getAuthTokenHeader(),
    },
  });
  const data = await readJsonSafe(response);
  if (!response.ok) {
    throw new Error(readErrorMessage(data, response));
  }
  return normalizeLyricsHistoryDeleteResponse(data);
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

export async function renameLyricsHistoryItem(lyricsId, title) {
  const safeId = String(lyricsId || "").trim();
  if (!safeId) {
    throw new Error("无效歌词 ID。");
  }
  const response = await fetch(
    `/api/music/lyrics/history/${encodeURIComponent(safeId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...getAuthTokenHeader(),
      },
      body: JSON.stringify({
        title: String(title || ""),
      }),
    },
  );
  const data = await readJsonSafe(response);
  if (!response.ok) {
    throw new Error(readErrorMessage(data, response));
  }
  return normalizeLyricsHistoryRenameResponse(data);
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

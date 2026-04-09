import { getAuthTokenHeader } from "../../../pages/chat/stateApi.js";

async function readJson(resp) {
  try {
    return await resp.json();
  } catch {
    return {};
  }
}

async function request(path, options = {}) {
  const resp = await fetch(path, {
    method: "GET",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...getAuthTokenHeader(),
      ...(options.headers || {}),
    },
  });
  const data = await readJson(resp);
  if (!resp.ok) {
    throw new Error(data?.error || data?.message || `请求失败（${resp.status}）`);
  }
  return data;
}

async function requestBlob(path, options = {}) {
  const resp = await fetch(path, {
    method: "GET",
    ...options,
    headers: {
      ...getAuthTokenHeader(),
      ...(options.headers || {}),
    },
  });

  if (!resp.ok) {
    const data = await readJson(resp);
    throw new Error(data?.error || data?.message || `请求失败（${resp.status}）`);
  }

  const blob = await resp.blob();
  const disposition = resp.headers.get("content-disposition") || "";
  const fileNameMatch =
    disposition.match(/filename\*=UTF-8''([^;]+)/i) || disposition.match(/filename="?([^"]+)"?/i);
  return {
    blob,
    filename: fileNameMatch?.[1] ? decodeURIComponent(fileNameMatch[1]) : "",
  };
}

export function listNotes({ q = "", tag = "", status = "" } = {}) {
  const params = new URLSearchParams();
  if (String(q || "").trim()) params.set("q", String(q || "").trim());
  if (String(tag || "").trim()) params.set("tag", String(tag || "").trim());
  if (String(status || "").trim()) params.set("status", String(status || "").trim());
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return request(`/api/notes${suffix}`);
}

export function createNote(payload = {}) {
  return request("/api/notes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getNote(noteId) {
  return request(`/api/notes/${encodeURIComponent(String(noteId || "").trim())}`);
}

export function updateNote(noteId, payload = {}) {
  return request(`/api/notes/${encodeURIComponent(String(noteId || "").trim())}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteNote(noteId) {
  return request(`/api/notes/${encodeURIComponent(String(noteId || "").trim())}`, {
    method: "DELETE",
  });
}

export function toggleNoteStar(noteId, payload = {}) {
  return request(`/api/notes/${encodeURIComponent(String(noteId || "").trim())}/star`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function captureNoteFromChat(payload = {}) {
  return request("/api/notes/capture", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function exportNoteWord(noteId) {
  return requestBlob(`/api/notes/${encodeURIComponent(String(noteId || "").trim())}/export-word`, {
    method: "POST",
  });
}

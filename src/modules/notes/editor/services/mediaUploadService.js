import { uploadNoteImage } from "../../api/notesApi.js";

const NOTE_IMAGE_ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

const NOTE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export const NOTE_IMAGE_ACCEPT = Array.from(NOTE_IMAGE_ALLOWED_TYPES).join(",");

export function validateNoteImageFile(file) {
  if (!(file instanceof File)) {
    throw new Error("未读取到可上传的图片文件。");
  }

  if (!NOTE_IMAGE_ALLOWED_TYPES.has(String(file.type || "").toLowerCase())) {
    throw new Error("仅支持 PNG、JPG、WEBP、GIF 图片。");
  }

  if (Number(file.size || 0) <= 0) {
    throw new Error("图片内容为空，请重新选择。");
  }

  if (Number(file.size || 0) > NOTE_IMAGE_MAX_BYTES) {
    throw new Error("图片不能超过 10MB。");
  }

  return file;
}

export async function uploadNoteImageFile({ noteId = "", file }) {
  validateNoteImageFile(file);
  const data = await uploadNoteImage(noteId, file);
  return {
    url: String(data?.url || "").trim(),
    fileName: String(data?.fileName || file.name || "图片").trim() || "图片",
    mimeType: String(data?.mimeType || file.type || "").trim(),
    size: Number(data?.size || file.size || 0),
  };
}

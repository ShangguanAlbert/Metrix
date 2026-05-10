export const DEBUG_REGENERATE_REUPLOAD_MESSAGE =
  "这条调试消息包含本地附件。为了避免调试页长期占用浏览器内存，原始文件不会保存在会话历史里；如需重新回答，请重新上传文件后再发送。";

function toTrimmedString(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function toPositiveSize(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return numeric;
}

export function createStoredDebugSourceFiles(files = []) {
  const safeFiles = Array.isArray(files) ? files.filter(Boolean) : [];
  return safeFiles.map((item) => {
    const kind = toTrimmedString(item?.kind, "local").toLowerCase();
    const base = {
      kind,
      name: toTrimmedString(item?.name, "File"),
      size: toPositiveSize(item?.size),
      type: toTrimmedString(item?.mimeType || item?.type),
    };

    if (kind === "prepared_ref") {
      return {
        ...base,
        mimeType: toTrimmedString(item?.mimeType || item?.type),
        preparedToken: toTrimmedString(item?.preparedToken),
      };
    }

    if (kind === "volc_ref") {
      return {
        ...base,
        mimeType: toTrimmedString(item?.mimeType || item?.type),
        inputType: toTrimmedString(item?.inputType).toLowerCase(),
        fileId: toTrimmedString(item?.fileId),
        url: toTrimmedString(item?.url),
        ossKey: toTrimmedString(item?.ossKey),
      };
    }

    return base;
  });
}

export function hasUnreplayableDebugSourceFiles(files = []) {
  const safeFiles = Array.isArray(files) ? files.filter(Boolean) : [];
  return safeFiles.some((item) => {
    const kind = toTrimmedString(item?.kind, "local").toLowerCase();
    return kind !== "prepared_ref" && kind !== "volc_ref";
  });
}

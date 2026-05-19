export async function createTeachingPdfSource(downloadResult = {}) {
  if (downloadResult?.blob instanceof Blob) {
    const objectUrl = URL.createObjectURL(downloadResult.blob);
    return {
      url: objectUrl,
      fileName: String(downloadResult.fileName || downloadResult.filename || "").trim(),
      mimeType: String(downloadResult.mimeType || downloadResult.blob.type || "").trim(),
      revoke() {
        URL.revokeObjectURL(objectUrl);
      },
    };
  }

  const downloadUrl = String(downloadResult?.downloadUrl || "").trim();
  if (!downloadUrl) return null;
  const response = await fetch(downloadUrl, { method: "GET" });
  if (!response.ok) {
    throw new Error(`授课 PDF 拉取失败（${response.status}）`);
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  return {
    url: objectUrl,
    fileName: String(downloadResult.fileName || downloadResult.filename || "").trim(),
    mimeType: String(downloadResult.mimeType || blob.type || "").trim(),
    revoke() {
      URL.revokeObjectURL(objectUrl);
    },
  };
}

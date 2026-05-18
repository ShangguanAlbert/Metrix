export function normalizeTeachingCenterConfig(teachingConfig) {
  const source =
    teachingConfig && typeof teachingConfig === "object" ? teachingConfig : {};
  const rawPdfFiles = Array.isArray(source.pdfFiles) ? source.pdfFiles : [];
  const seenIds = new Set();
  const pdfFiles = rawPdfFiles
    .map((item, index) => {
      const fileId = String(item?.fileId || item?.id || "").trim();
      if (!fileId || seenIds.has(fileId)) return null;
      seenIds.add(fileId);
      return {
        fileId,
        sortOrder:
          Number.isFinite(Number(item?.sortOrder)) ? Number(item.sortOrder) : index,
        enabled: item?.enabled !== false,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item, index) => ({
      ...item,
      sortOrder: index,
    }));
  return {
    pdfFiles,
    defaultPdfFileId: String(source.defaultPdfFileId || "").trim(),
    allowQuestions: source.allowQuestions !== false,
    teacherNotes: String(source.teacherNotes || ""),
    welcomeText: String(source.welcomeText || ""),
    updatedAt: String(source.updatedAt || ""),
  };
}

export function appendTeachingCenterPdfFiles(teachingConfig, fileIds = []) {
  const current = normalizeTeachingCenterConfig(teachingConfig);
  const existingIds = new Set(current.pdfFiles.map((item) => item.fileId));
  const nextPdfFiles = [...current.pdfFiles];
  const safeFileIds = Array.isArray(fileIds) ? fileIds : [];
  safeFileIds.forEach((fileId) => {
    const safeFileId = String(fileId || "").trim();
    if (!safeFileId || existingIds.has(safeFileId)) return;
    existingIds.add(safeFileId);
    nextPdfFiles.push({
      fileId: safeFileId,
      sortOrder: nextPdfFiles.length,
      enabled: true,
    });
  });
  return {
    ...current,
    pdfFiles: nextPdfFiles.map((item, index) => ({
      ...item,
      sortOrder: index,
    })),
    defaultPdfFileId:
      current.defaultPdfFileId || String(nextPdfFiles[0]?.fileId || ""),
  };
}

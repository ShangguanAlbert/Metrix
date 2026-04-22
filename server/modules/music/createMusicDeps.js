export function createMusicDeps(rootDeps) {
  return {
    moduleName: "music",
    requireChatAuth: rootDeps.requireChatAuth,
    sanitizeId: rootDeps.sanitizeId,
    sanitizeText: rootDeps.sanitizeText,
    sanitizeRuntimeBoolean: rootDeps.sanitizeRuntimeBoolean,
    sanitizeRuntimeInteger: rootDeps.sanitizeRuntimeInteger,
    sanitizeIsoDate: rootDeps.sanitizeIsoDate,
    sanitizeGroupChatFileName: rootDeps.sanitizeGroupChatFileName,
    sanitizeGroupChatHttpUrl: rootDeps.sanitizeGroupChatHttpUrl,
    sanitizeGroupChatOssObjectKey: rootDeps.sanitizeGroupChatOssObjectKey,
    buildGroupChatOssObjectUrl: rootDeps.buildGroupChatOssObjectUrl,
    buildGroupChatFileSignedDownloadUrl:
      rootDeps.buildGroupChatFileSignedDownloadUrl,
    uploadBufferToGroupChatOss: rootDeps.uploadBufferToGroupChatOss,
    deleteGroupChatOssObject: rootDeps.deleteGroupChatOssObject,
    deleteGeneratedMusicHistoryOssObjects:
      rootDeps.deleteGeneratedMusicHistoryOssObjects,
    GeneratedMusicHistory: rootDeps.GeneratedMusicHistory,
    GeneratedLyricsHistory: rootDeps.GeneratedLyricsHistory,
    toGeneratedMusicHistoryItem: rootDeps.toGeneratedMusicHistoryItem,
    toGeneratedLyricsHistoryItem: rootDeps.toGeneratedLyricsHistoryItem,
    normalizeGeneratedMusicFormat: rootDeps.normalizeGeneratedMusicFormat,
    normalizeGeneratedMusicMimeType: rootDeps.normalizeGeneratedMusicMimeType,
    getProviderConfig: rootDeps.getProviderConfig,
    formatProviderUpstreamError: rootDeps.formatProviderUpstreamError,
    safeReadText: rootDeps.safeReadText,
  };
}

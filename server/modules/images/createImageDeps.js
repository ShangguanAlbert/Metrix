export function createImageDeps(rootDeps) {
  return {
    moduleName: "images",
    requireChatAuth: rootDeps.requireChatAuth,
    imageGenerationUpload: rootDeps.imageGenerationUpload,
    MAX_IMAGE_GENERATION_INPUT_FILES: rootDeps.MAX_IMAGE_GENERATION_INPUT_FILES,
    streamSeedreamImageGeneration: rootDeps.streamSeedreamImageGeneration,
    sanitizeId: rootDeps.sanitizeId,
    GeneratedImageHistory: rootDeps.GeneratedImageHistory,
    toGeneratedImageHistoryItem: rootDeps.toGeneratedImageHistoryItem,
    resolveImageHistoryAuthUserId: rootDeps.resolveImageHistoryAuthUserId,
    sanitizeIsoDate: rootDeps.sanitizeIsoDate,
    normalizeGeneratedImageStorageType: rootDeps.normalizeGeneratedImageStorageType,
    sanitizeGroupChatOssObjectKey: rootDeps.sanitizeGroupChatOssObjectKey,
    sanitizeGroupChatHttpUrl: rootDeps.sanitizeGroupChatHttpUrl,
    buildGroupChatOssObjectUrl: rootDeps.buildGroupChatOssObjectUrl,
    extractGeneratedImageDataBuffer: rootDeps.extractGeneratedImageDataBuffer,
    normalizeGeneratedImageMimeType: rootDeps.normalizeGeneratedImageMimeType,
    normalizeGeneratedImageStoreUrl: rootDeps.normalizeGeneratedImageStoreUrl,
    parseGeneratedImageDataUrl: rootDeps.parseGeneratedImageDataUrl,
    deleteGeneratedImageHistoryOssObjects: rootDeps.deleteGeneratedImageHistoryOssObjects,
  };
}

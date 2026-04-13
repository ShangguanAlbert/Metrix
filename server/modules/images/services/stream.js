export function registerImageStreamRoutes(app, deps) {
  app.post(
    "/api/images/seedream/stream",
    deps.requireChatAuth,
    deps.imageGenerationUpload.array("images", deps.MAX_IMAGE_GENERATION_INPUT_FILES),
    async (req, res) => {
      await deps.streamSeedreamImageGeneration({
        res,
        body: req.body || {},
        files: req.files || [],
        chatUserId: String(req.authUser?._id || ""),
        chatStorageUserId: String(req.authStorageUserId || ""),
        teacherScopeKey: req.authTeacherScopeKey,
      });
    },
  );
}

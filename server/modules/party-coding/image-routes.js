import { canDriveParty } from "../../../shared/party-roles.js";
import { getPartyWebWorkspaceModel } from "./model.js";

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

export function detectImageFormat(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_IMAGE_BYTES) return null;
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { mime: "image/png", extension: "png" };
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return { mime: "image/jpeg", extension: "jpg" };
  if (/^GIF8[79]a$/.test(buffer.subarray(0, 6).toString())) return { mime: "image/gif", extension: "gif" };
  if (buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP") return { mime: "image/webp", extension: "webp" };
  return null;
}

export function registerPartyImageRoutes(app, deps, { requireCodingMember, collaboration }) {
  const { mongoose, requireChatAuth, groupChatImageUpload, uploadChatAttachmentsToOss,
    deleteGroupChatOssObject, buildGroupChatFileSignedDownloadUrl, verifyToken, readBearerToken } = deps;
  const Workspace = getPartyWebWorkspaceModel(mongoose);
  const schema = new mongoose.Schema({ roomId: { type: String, required: true, index: true },
    uploadedBy: String, fileName: String, mimeType: String, extension: String, size: Number, ossKey: String,
  }, { timestamps: true, collection: "party_coding_images" });
  const Image = mongoose.models.PartyCodingImage || mongoose.model("PartyCodingImage", schema);

  app.post("/api/group-chat/rooms/:roomId/coding/images", requireChatAuth,
    (req, res, next) => groupChatImageUpload.single("image")(req, res, (error) => {
      if (error) res.status(400).json({ error: "请选择不超过 6 MB 的 PNG、JPG、GIF 或 WebP 图片。" });
      else next();
    }), async (req, res) => {
      let ossKey = "";
      try {
        const member = await requireCodingMember(req, res);
        if (!member) return;
        const format = detectImageFormat(req.file?.buffer);
        if (!format) { res.status(400).json({ error: "请选择 PNG、JPG、GIF 或 WebP 图片。" }); return; }
        const workspace = await Workspace.findOne({ roomId: member.roomId }).lean();
        if (!canDriveParty(workspace, member.userId)) { res.status(403).json({ error: "仅当前 Driver 可以插入图片。" }); return; }
        const [uploaded] = await uploadChatAttachmentsToOss({ files: [{ ...req.file, mimetype: format.mime }],
          userId: member.userId, sessionId: member.roomId, source: "party-coding-image" });
        ossKey = uploaded?.ossKey || "";
        if (!ossKey) throw new Error("图片存储不可用，未修改代码。");
        await collaboration.withRoomLock(member.roomId, async () => {
          const current = await Workspace.findOne({ roomId: member.roomId }).lean();
          if (!canDriveParty(current, member.userId) || Number(current.documentEpoch || 0) !== Number(req.body.documentEpoch)) {
            const error = new Error("角色或作品已变化，请由当前 Driver 重新选择图片。"); error.status = 409; throw error;
          }
          const image = await Image.create({ roomId: member.roomId, uploadedBy: member.userId,
            fileName: String(req.file.originalname || "图片").slice(0, 180), mimeType: format.mime,
            extension: format.extension, size: req.file.buffer.length, ossKey });
          res.json({ ok: true, path: `assets/${image._id}.${format.extension}` });
        });
      } catch (error) {
        if (ossKey) await deleteGroupChatOssObject(ossKey).catch((cleanupError) => console.error("[party-image] cleanup failed", cleanupError.message));
        res.status(error.status || 500).json({ error: error?.message || "上传图片失败。" });
      }
    });

  app.get("/api/group-chat/rooms/:roomId/coding/images/:imageId", requireChatAuth, async (req, res) => {
    try {
      const payload = verifyToken(readBearerToken(req));
      const observer = payload?.collaborationObserver === true && payload.observerRoomId === req.params.roomId
        && ["admin", "teacher"].includes(req.authUser?.role);
      if (!observer && !await requireCodingMember(req, res)) return;
      if (!/^[a-f0-9]{24}$/.test(req.params.imageId)) { res.status(400).json({ error: "无效图片。" }); return; }
      const image = await Image.findOne({ _id: req.params.imageId, roomId: req.params.roomId }).lean();
      if (!image) { res.status(404).json({ error: "图片不存在或不属于当前小组。" }); return; }
      const url = await buildGroupChatFileSignedDownloadUrl({ ossKey: image.ossKey, fileName: image.fileName, disposition: "inline", expiresInSeconds: 60 });
      if (!url) throw new Error("暂时无法读取图片，请稍后重试。");
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error("图片存储读取失败，请稍后重试。");
      const buffer = Buffer.from(await response.arrayBuffer());
      if (!detectImageFormat(buffer)) throw new Error("存储的图片格式无效。");
      res.setHeader("Cache-Control", "private, no-store");
      res.json({ ok: true, dataUrl: `data:${image.mimeType};base64,${buffer.toString("base64")}` });
    } catch (error) { res.status(500).json({ error: error?.message || "读取图片失败。" }); }
  });
}

import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import { Note, isValidNoteObjectId, normalizeNoteDoc } from "../services/notes/note-model.js";
import { NoteImage } from "../services/notes/note-image-model.js";
import { exportNoteMarkdownToWord } from "../services/notes/notes-word-export.js";

const NOTE_STATUS_VALUES = new Set(["draft", "active", "archived"]);
const NOTE_IMAGE_UPLOAD = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
});
const NOTE_IMAGE_EXT_BY_MIME = new Map([
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
]);
const NOTE_IMAGE_MIME_BY_EXT = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
]);
const NOTE_LEGACY_UPLOAD_URL_PATTERN = /(?:https?:\/\/[^\s"'<>()[\]]+)?\/uploads\/notes\/[^\s"'<>()[\]]+/gi;

function sanitizeText(value, maxLength = 4000) {
  const text = String(value || "").split("\u0000").join("").trim();
  if (!text) return "";
  return text.slice(0, maxLength).trim();
}

function sanitizeLooseText(value, maxLength = 20000) {
  return String(value || "").split("\u0000").join("").slice(0, maxLength);
}

function sanitizeId(value, maxLength = 120) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .slice(0, maxLength);
}

function sanitizeRole(value) {
  const role = sanitizeText(value, 24).toLowerCase();
  if (["user", "assistant", "system"].includes(role)) return role;
  return "";
}

function sanitizeStatus(value, fallback = "draft") {
  const status = sanitizeText(value, 24).toLowerCase();
  return NOTE_STATUS_VALUES.has(status) ? status : fallback;
}

function sanitizeBoolean(value, fallback = null) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
}

function sanitizeTags(value) {
  const list = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,\n，、]/)
      : [];
  return Array.from(
    new Set(
      list
        .map((item) => sanitizeText(item, 32).replace(/^#/, ""))
        .filter(Boolean)
        .slice(0, 20),
    ),
  );
}

function resolveNoteImageExtension(file = null) {
  const mimeType = String(file?.mimetype || "").trim().toLowerCase();
  if (NOTE_IMAGE_EXT_BY_MIME.has(mimeType)) {
    return NOTE_IMAGE_EXT_BY_MIME.get(mimeType);
  }

  const originalName = String(file?.originalname || "").trim().toLowerCase();
  const ext = path.extname(originalName || "");
  return NOTE_IMAGE_EXT_BY_MIME.get(mimeType) || ext || ".png";
}

function resolveNoteImageMimeTypeFromPath(filePath = "") {
  const ext = path.extname(String(filePath || "").trim()).toLowerCase();
  return NOTE_IMAGE_MIME_BY_EXT.get(ext) || "image/png";
}

function extractLegacyUploadUrls(contentMarkdown = "") {
  return Array.from(
    new Set(String(contentMarkdown || "").match(NOTE_LEGACY_UPLOAD_URL_PATTERN) || []),
  );
}

function resolveLegacyUploadFilePath(rawUrl = "") {
  const text = String(rawUrl || "").trim();
  if (!text) return "";

  let pathname = text;
  if (/^https?:\/\//i.test(text)) {
    try {
      pathname = new URL(text).pathname || "";
    } catch {
      pathname = text;
    }
  }

  const safePathname = String(pathname || "").split("?")[0].split("#")[0];
  if (!safePathname.startsWith("/uploads/notes/")) return "";

  const uploadsRoot = path.resolve(process.cwd(), "uploads", "notes");
  const targetPath = path.resolve(process.cwd(), `.${safePathname}`);
  if (targetPath !== uploadsRoot && !targetPath.startsWith(`${uploadsRoot}${path.sep}`)) {
    return "";
  }
  return targetPath;
}

async function migrateLegacyNoteImageUrls({ userId = "", noteId = "", contentMarkdown = "" } = {}) {
  const legacyUrls = extractLegacyUploadUrls(contentMarkdown);
  if (legacyUrls.length === 0) {
    return {
      changed: false,
      contentMarkdown: String(contentMarkdown || ""),
      migratedCount: 0,
    };
  }

  const replacements = new Map();

  for (const legacyUrl of legacyUrls) {
    const filePath = resolveLegacyUploadFilePath(legacyUrl);
    if (!filePath) continue;

    try {
      const fileBuffer = await readFile(filePath);
      if (!fileBuffer.length) continue;

      const noteImage = await NoteImage.create({
        userId,
        noteId,
        fileName: path.basename(filePath),
        mimeType: resolveNoteImageMimeTypeFromPath(filePath),
        size: fileBuffer.length,
        dataBase64: fileBuffer.toString("base64"),
      });

      replacements.set(
        legacyUrl,
        `/api/notes/images/${encodeURIComponent(String(noteImage._id || "").trim())}`,
      );
    } catch {
      // ignore missing/invalid legacy files
    }
  }

  if (replacements.size === 0) {
    return {
      changed: false,
      contentMarkdown: String(contentMarkdown || ""),
      migratedCount: 0,
    };
  }

  let nextMarkdown = String(contentMarkdown || "");
  replacements.forEach((nextUrl, legacyUrl) => {
    nextMarkdown = nextMarkdown.split(legacyUrl).join(nextUrl);
  });

  return {
    changed: nextMarkdown !== String(contentMarkdown || ""),
    contentMarkdown: nextMarkdown,
    migratedCount: replacements.size,
  };
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function resolveStatusSearchTerms(value) {
  const text = sanitizeText(value, 120).toLowerCase();
  if (!text) return [];
  const matches = new Set();
  if (/归档|arch/i.test(text)) matches.add("archived");
  if (/草稿|draft/i.test(text)) matches.add("draft");
  if (/正常|active|未归档|进行中/i.test(text)) matches.add("active");
  return Array.from(matches);
}

function toBlockquote(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join("\n");
}

function buildExcerptTitle(excerpt = "", sessionTitle = "") {
  const firstLine = String(excerpt || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  const firstSentence = String(firstLine || "")
    .split(/[。！？.!?\n]/)
    .map((part) => part.trim())
    .find(Boolean);
  const candidate = sanitizeText(firstSentence || firstLine, 40);
  if (candidate) return candidate;
  if (sessionTitle) return `来自${sessionTitle}的笔记`;
  return "新的对话笔记";
}

function buildCapturedMarkdown({
  sourceExcerpt = "",
  sessionTitle = "",
  sourceRole = "",
  promptText = "",
  answerText = "",
} = {}) {
  const lines = [];
  const normalizedPromptText = String(promptText || "").trim();
  const normalizedAnswerText = String(answerText || "").trim();
  const hasQaPair = !!normalizedPromptText && !!normalizedAnswerText;
  lines.push(
    `# ${buildExcerptTitle(
      hasQaPair ? normalizedPromptText : sourceExcerpt,
      sessionTitle,
    )}`,
  );
  lines.push("");

  if (sessionTitle) {
    lines.push(`_来源会话：${sessionTitle}_`);
    lines.push("");
  }

  if (hasQaPair) {
    lines.push("## 用户问题");
    lines.push("");
    lines.push(toBlockquote(normalizedPromptText));
    lines.push("");
    lines.push("## AI 回答");
    lines.push("");
    lines.push(toBlockquote(normalizedAnswerText));
    lines.push("");
  } else if (sourceExcerpt) {
    lines.push("## 对话摘录");
    lines.push("");
    lines.push(toBlockquote(sourceExcerpt));
    lines.push("");
  }

  if (sourceRole) {
    lines.push(`- 摘录角色：${sourceRole === "assistant" ? "AI" : sourceRole === "user" ? "用户" : sourceRole}`);
    lines.push("");
  }

  lines.push("## 我的笔记");
  lines.push("");
  lines.push("- ");
  lines.push("");
  return lines.join("\n");
}

function buildManualMarkdown() {
  return ["# 新笔记", "", "## 记录", "", "- ", ""].join("\n");
}

export function registerNotesRoutes(app, deps) {
  const { requireChatAuth } = deps;

  app.post(
    "/api/notes/images/upload",
    requireChatAuth,
    NOTE_IMAGE_UPLOAD.single("image"),
    async (req, res) => {
      const userId = sanitizeId(req.authUser?._id);
      if (!userId) {
        res.status(400).json({ error: "无效用户身份。" });
        return;
      }

      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "请先选择图片文件。" });
        return;
      }

      const mimeType = String(file.mimetype || "").trim().toLowerCase();
      if (!NOTE_IMAGE_EXT_BY_MIME.has(mimeType)) {
        res.status(400).json({ error: "仅支持 PNG、JPG、WEBP、GIF 图片。" });
        return;
      }

      if (!Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
        res.status(400).json({ error: "图片内容为空，请重新上传。" });
        return;
      }

      try {
        const extension = resolveNoteImageExtension(file);
        const noteId = sanitizeId(req.body?.noteId);
        const noteImage = await NoteImage.create({
          userId,
          noteId: isValidNoteObjectId(noteId) ? noteId : "",
          fileName:
            String(file.originalname || "").trim()
            || `图片${extension}`,
          mimeType,
          size: Number(file.size || file.buffer.length || 0),
          dataBase64: file.buffer.toString("base64"),
        });

        res.json({
          ok: true,
          url: `/api/notes/images/${encodeURIComponent(String(noteImage._id || "").trim())}`,
          fileName: String(file.originalname || "图片").trim() || "图片",
          mimeType,
          size: Number(file.size || file.buffer.length || 0),
        });
      } catch (error) {
        res.status(500).json({
          error: error?.message || "图片上传失败，请稍后重试。",
        });
      }
    },
  );

  app.get("/api/notes/images/:imageId", async (req, res) => {
    const imageId = sanitizeId(req.params?.imageId);
    if (!isValidNoteObjectId(imageId)) {
      res.status(404).end();
      return;
    }

    try {
      const doc = await NoteImage.findById(imageId).lean();
      if (!doc?.dataBase64 || !doc?.mimeType) {
        res.status(404).end();
        return;
      }

      const buffer = Buffer.from(String(doc.dataBase64 || ""), "base64");
      if (!buffer.length) {
        res.status(404).end();
        return;
      }

      res.setHeader("Content-Type", String(doc.mimeType || "application/octet-stream"));
      res.setHeader("Content-Length", String(buffer.length));
      res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
      res.end(buffer);
    } catch {
      res.status(404).end();
    }
  });

  app.get("/api/notes", requireChatAuth, async (req, res) => {
    const userId = sanitizeId(req.authUser?._id);
    if (!userId) {
      res.status(400).json({ error: "无效用户身份。" });
      return;
    }

    const q = sanitizeText(req.query?.q, 120);
    const tag = sanitizeText(req.query?.tag, 32);
    const status = sanitizeStatus(req.query?.status, "");
    const query = { userId };
    if (status) query.status = status;
    if (tag) query.tags = tag;
    if (q) {
      const regex = new RegExp(escapeRegex(q), "i");
      const statusTerms = resolveStatusSearchTerms(q);
      query.$or = [{ title: regex }, { contentMarkdown: regex }, { tags: regex }];
      if (statusTerms.length > 0) {
        query.$or.push({ status: { $in: statusTerms } });
      }
    }

    try {
      const docs = await Note.find(query).sort({ starred: -1, updatedAt: -1 }).limit(300).lean();
      res.json({
        ok: true,
        notes: docs.map((doc) => normalizeNoteDoc(doc)).filter(Boolean),
      });
    } catch (error) {
      res.status(500).json({
        error: error?.message || "读取笔记列表失败，请稍后重试。",
      });
    }
  });

  app.post("/api/notes", requireChatAuth, async (req, res) => {
    const userId = sanitizeId(req.authUser?._id);
    if (!userId) {
      res.status(400).json({ error: "无效用户身份。" });
      return;
    }

    const title = sanitizeText(req.body?.title, 120) || "新笔记";
    const contentMarkdown =
      sanitizeLooseText(req.body?.contentMarkdown, 30000) || buildManualMarkdown();
    const tags = sanitizeTags(req.body?.tags);
    const status = sanitizeStatus(req.body?.status, "draft");

    try {
      const doc = await Note.create({
        userId,
        title,
        contentMarkdown,
        tags,
        starred: false,
        status,
        createdFrom: "manual",
        visibility: "private",
        shareToken: "",
      });
      res.json({ ok: true, note: normalizeNoteDoc(doc) });
    } catch (error) {
      res.status(500).json({
        error: error?.message || "创建笔记失败，请稍后重试。",
      });
    }
  });

  app.post("/api/notes/migrate-images", requireChatAuth, async (req, res) => {
    const userId = sanitizeId(req.authUser?._id);
    if (!userId) {
      res.status(400).json({ error: "无效用户身份。" });
      return;
    }

    try {
      const docs = await Note.find({
        userId,
        contentMarkdown: /\/uploads\/notes\//i,
      })
        .select({ _id: 1, contentMarkdown: 1 })
        .lean();

      let migratedNotes = 0;
      let migratedImages = 0;

      for (const doc of docs) {
        const noteId = String(doc?._id || "").trim();
        if (!noteId) continue;

        const migration = await migrateLegacyNoteImageUrls({
          userId,
          noteId,
          contentMarkdown: String(doc?.contentMarkdown || ""),
        });
        if (!migration.changed) continue;

        await Note.updateOne(
          { _id: noteId, userId },
          { $set: { contentMarkdown: migration.contentMarkdown } },
        );
        migratedNotes += 1;
        migratedImages += migration.migratedCount;
      }

      res.json({
        ok: true,
        migratedNotes,
        migratedImages,
      });
    } catch (error) {
      res.status(500).json({
        error: error?.message || "迁移旧图片失败，请稍后重试。",
      });
    }
  });

  app.get("/api/notes/:id", requireChatAuth, async (req, res) => {
    const userId = sanitizeId(req.authUser?._id);
    const noteId = sanitizeId(req.params?.id);
    if (!userId || !isValidNoteObjectId(noteId)) {
      res.status(404).json({ error: "笔记不存在。" });
      return;
    }

    try {
      let doc = await Note.findOne({ _id: noteId, userId }).lean();
      if (!doc) {
        res.status(404).json({ error: "笔记不存在。" });
        return;
      }

      const migration = await migrateLegacyNoteImageUrls({
        userId,
        noteId,
        contentMarkdown: String(doc?.contentMarkdown || ""),
      });
      if (migration.changed) {
        doc = await Note.findOneAndUpdate(
          { _id: noteId, userId },
          { $set: { contentMarkdown: migration.contentMarkdown } },
          { new: true },
        ).lean();
      }

      res.json({ ok: true, note: normalizeNoteDoc(doc) });
    } catch (error) {
      res.status(500).json({
        error: error?.message || "读取笔记失败，请稍后重试。",
      });
    }
  });

  app.put("/api/notes/:id", requireChatAuth, async (req, res) => {
    const userId = sanitizeId(req.authUser?._id);
    const noteId = sanitizeId(req.params?.id);
    if (!userId || !isValidNoteObjectId(noteId)) {
      res.status(404).json({ error: "笔记不存在。" });
      return;
    }

    const title = sanitizeText(req.body?.title, 120) || "未命名笔记";
    const contentMarkdown =
      sanitizeLooseText(req.body?.contentMarkdown, 40000) || buildManualMarkdown();
    const tags = sanitizeTags(req.body?.tags);
    const status = sanitizeStatus(req.body?.status, "draft");

    try {
      const doc = await Note.findOneAndUpdate(
        { _id: noteId, userId },
        { $set: { title, contentMarkdown, tags, status } },
        { new: true },
      ).lean();
      if (!doc) {
        res.status(404).json({ error: "笔记不存在。" });
        return;
      }
      res.json({ ok: true, note: normalizeNoteDoc(doc) });
    } catch (error) {
      res.status(500).json({
        error: error?.message || "保存笔记失败，请稍后重试。",
      });
    }
  });

  app.delete("/api/notes/:id", requireChatAuth, async (req, res) => {
    const userId = sanitizeId(req.authUser?._id);
    const noteId = sanitizeId(req.params?.id);
    if (!userId || !isValidNoteObjectId(noteId)) {
      res.status(404).json({ error: "笔记不存在。" });
      return;
    }

    try {
      const doc = await Note.findOneAndDelete({ _id: noteId, userId }).lean();
      if (!doc) {
        res.status(404).json({ error: "笔记不存在。" });
        return;
      }
      await NoteImage.deleteMany({ userId, noteId });
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({
        error: error?.message || "删除笔记失败，请稍后重试。",
      });
    }
  });

  app.post("/api/notes/capture", requireChatAuth, async (req, res) => {
    const userId = sanitizeId(req.authUser?._id);
    if (!userId) {
      res.status(400).json({ error: "无效用户身份。" });
      return;
    }

    const sessionId = sanitizeId(req.body?.sessionId);
    const messageId = sanitizeId(req.body?.messageId);
    const promptMessageId = sanitizeId(req.body?.promptMessageId);
    const selectedText = sanitizeLooseText(req.body?.selectedText, 8000).trim();
    const messageText = sanitizeLooseText(req.body?.messageText, 20000).trim();
    const messageRole = sanitizeRole(req.body?.messageRole);
    const promptText = sanitizeLooseText(req.body?.promptText, 20000).trim();
    const answerText = selectedText || messageText;
    const sourceExcerpt =
      messageRole === "assistant" && promptText && answerText
        ? [promptText, answerText].filter(Boolean).join("\n\n")
        : answerText;
    const sessionTitle = sanitizeText(req.body?.sessionTitle, 120);

    if (!sessionId || !messageId || !sourceExcerpt) {
      res.status(400).json({ error: "缺少可保存的对话内容。" });
      return;
    }

    try {
      const doc = await Note.create({
        userId,
        title: buildExcerptTitle(sourceExcerpt, sessionTitle),
        contentMarkdown: buildCapturedMarkdown({
          sourceExcerpt,
          sessionTitle,
          sourceRole: messageRole,
          promptText,
          answerText,
        }),
        summary: "",
        tags: [],
        starred: false,
        status: "draft",
        sourceSessionId: sessionId,
        sourceMessageId: promptMessageId || messageId,
        sourceExcerpt,
        sourceRole: messageRole,
        createdFrom: "chat_capture",
        visibility: "private",
        shareToken: "",
      });
      res.json({ ok: true, note: normalizeNoteDoc(doc) });
    } catch (error) {
      res.status(500).json({
        error: error?.message || "保存聊天摘录失败，请稍后重试。",
      });
    }
  });

  app.patch("/api/notes/:id/star", requireChatAuth, async (req, res) => {
    const userId = sanitizeId(req.authUser?._id);
    const noteId = sanitizeId(req.params?.id);
    if (!userId || !isValidNoteObjectId(noteId)) {
      res.status(404).json({ error: "笔记不存在。" });
      return;
    }

    try {
      const existing = await Note.findOne({ _id: noteId, userId });
      if (!existing) {
        res.status(404).json({ error: "笔记不存在。" });
        return;
      }

      const incomingStarred = sanitizeBoolean(req.body?.starred, null);
      existing.starred = incomingStarred === null ? !existing.starred : incomingStarred;
      await existing.save();

      res.json({ ok: true, note: normalizeNoteDoc(existing) });
    } catch (error) {
      res.status(500).json({
        error: error?.message || "更新星标失败，请稍后重试。",
      });
    }
  });

  app.post("/api/notes/:id/export-word", requireChatAuth, async (req, res) => {
    const userId = sanitizeId(req.authUser?._id);
    const noteId = sanitizeId(req.params?.id);
    if (!userId || !isValidNoteObjectId(noteId)) {
      res.status(404).json({ error: "笔记不存在。" });
      return;
    }

    try {
      const doc = await Note.findOne({ _id: noteId, userId }).lean();
      if (!doc) {
        res.status(404).json({ error: "笔记不存在。" });
        return;
      }

      const note = normalizeNoteDoc(doc);
      const result = await exportNoteMarkdownToWord({
        title: note?.title || "笔记",
        markdown: note?.contentMarkdown || "",
      });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}`,
      );
      res.send(result.buffer);
    } catch (error) {
      const statusCode =
        Number.isInteger(error?.statusCode) && error.statusCode >= 400 ? error.statusCode : 500;
      res.status(statusCode).json({
        error: error?.message || "导出 Word 失败，请稍后重试。",
      });
    }
  });

}

import { Note, isValidNoteObjectId, normalizeNoteDoc } from "../services/notes/note-model.js";
import { generateNoteAiDraft } from "../services/notes/notes-ai-service.js";
import { exportNoteMarkdownToWord } from "../services/notes/notes-word-export.js";

const NOTE_STATUS_VALUES = new Set(["draft", "active", "archived"]);

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
} = {}) {
  const lines = [];
  lines.push(`# ${buildExcerptTitle(sourceExcerpt, sessionTitle)}`);
  lines.push("");

  if (sessionTitle) {
    lines.push(`_来源会话：${sessionTitle}_`);
    lines.push("");
  }

  if (sourceExcerpt) {
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

  app.get("/api/notes/:id", requireChatAuth, async (req, res) => {
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
    const selectedText = sanitizeLooseText(req.body?.selectedText, 8000).trim();
    const messageText = sanitizeLooseText(req.body?.messageText, 20000).trim();
    const sourceExcerpt = selectedText || messageText;
    const messageRole = sanitizeRole(req.body?.messageRole);
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
        }),
        summary: "",
        tags: [],
        starred: false,
        status: "draft",
        sourceSessionId: sessionId,
        sourceMessageId: messageId,
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
      existing.starred = incomingStarred === null ? !Boolean(existing.starred) : incomingStarred;
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

  app.post("/api/notes/:id/ai-draft", requireChatAuth, async (req, res) => {
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

      const previousCreatedFrom = String(existing.createdFrom || "manual").trim() || "manual";
      const draft = await generateNoteAiDraft(deps, {
        contentMarkdown: existing.contentMarkdown,
        sourceExcerpt: existing.sourceExcerpt,
      });

      existing.contentMarkdown = draft.contentMarkdown;
      existing.summary = draft.summary;
      existing.tags = draft.tags;
      if (previousCreatedFrom === "manual") {
        existing.createdFrom = "ai_draft";
      }
      await existing.save();

      res.json({ ok: true, note: normalizeNoteDoc(existing) });
    } catch (error) {
      res.status(500).json({
        error: error?.message || "AI 整理失败，请稍后重试。",
      });
    }
  });
}

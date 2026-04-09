import mongoose from "mongoose";

const NOTE_STATUS_VALUES = ["draft", "active", "archived"];
const NOTE_CREATED_FROM_VALUES = ["manual", "chat_capture", "ai_draft"];
const NOTE_VISIBILITY_VALUES = ["private"];

const noteSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, default: "" },
    contentMarkdown: { type: String, default: "" },
    summary: { type: String, default: "" },
    tags: { type: [String], default: () => [] },
    starred: { type: Boolean, default: false },
    status: {
      type: String,
      enum: NOTE_STATUS_VALUES,
      default: "draft",
    },
    sourceSessionId: { type: String, default: "" },
    sourceMessageId: { type: String, default: "" },
    sourceExcerpt: { type: String, default: "" },
    sourceRole: { type: String, default: "" },
    createdFrom: {
      type: String,
      enum: NOTE_CREATED_FROM_VALUES,
      default: "manual",
    },
    visibility: {
      type: String,
      enum: NOTE_VISIBILITY_VALUES,
      default: "private",
    },
    shareToken: { type: String, default: "" },
  },
  {
    timestamps: true,
    collection: "notes",
  },
);

noteSchema.index({ userId: 1, updatedAt: -1 }, { name: "ix_notes_user_updated" });
noteSchema.index({ userId: 1, starred: -1, updatedAt: -1 }, { name: "ix_notes_user_starred" });
noteSchema.index({ userId: 1, status: 1, updatedAt: -1 }, { name: "ix_notes_user_status" });
noteSchema.index({ userId: 1, sourceSessionId: 1 }, { name: "ix_notes_user_source_session" });

export const Note = mongoose.models.Note || mongoose.model("Note", noteSchema);

export function normalizeNoteDoc(doc) {
  if (!doc) return null;
  return {
    id: String(doc?._id || doc?.id || "").trim(),
    userId: String(doc?.userId || "").trim(),
    title: String(doc?.title || "").trim(),
    contentMarkdown: String(doc?.contentMarkdown || ""),
    summary: String(doc?.summary || "").trim(),
    tags: Array.isArray(doc?.tags)
      ? doc.tags.map((item) => String(item || "").trim()).filter(Boolean)
      : [],
    starred: Boolean(doc?.starred),
    status: String(doc?.status || "draft").trim() || "draft",
    sourceSessionId: String(doc?.sourceSessionId || "").trim(),
    sourceMessageId: String(doc?.sourceMessageId || "").trim(),
    sourceExcerpt: String(doc?.sourceExcerpt || "").trim(),
    sourceRole: String(doc?.sourceRole || "").trim(),
    createdFrom: String(doc?.createdFrom || "manual").trim() || "manual",
    visibility: String(doc?.visibility || "private").trim() || "private",
    shareToken: String(doc?.shareToken || "").trim(),
    createdAt: doc?.createdAt || null,
    updatedAt: doc?.updatedAt || null,
  };
}

export function isValidNoteObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || "").trim());
}

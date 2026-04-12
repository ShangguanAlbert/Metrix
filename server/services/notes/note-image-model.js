import mongoose from "mongoose";

const noteImageSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    noteId: { type: String, default: "", index: true },
    fileName: { type: String, default: "" },
    mimeType: { type: String, required: true },
    size: { type: Number, default: 0 },
    dataBase64: { type: String, required: true },
  },
  {
    timestamps: true,
    collection: "note_images",
  },
);

noteImageSchema.index({ userId: 1, noteId: 1, createdAt: -1 }, { name: "ix_note_images_user_note" });

export const NoteImage =
  mongoose.models.NoteImage || mongoose.model("NoteImage", noteImageSchema);


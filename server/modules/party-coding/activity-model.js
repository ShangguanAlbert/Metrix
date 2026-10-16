export function getPartyCodeArchiveModel(mongoose) {
  const schema = new mongoose.Schema({
    eventId: { type: String, required: true, unique: true },
    roomId: { type: String, required: true, index: true },
    userId: String, activeWorkspace: String, documentEpoch: Number, revision: Number,
    kind: { type: String, enum: ["checkpoint", "update"], required: true },
    update: String, html: String, css: String,
    occurredAt: { type: Date, required: true },
    sequence: Number, processId: String,
  }, { collection: "party_code_archive", timestamps: true });
  schema.index({ roomId: 1, occurredAt: 1, _id: 1 });
  return mongoose.models.PartyCodeArchive || mongoose.model("PartyCodeArchive", schema);
}

export function getPartyRoomArchiveModel(mongoose) {
  const schema = new mongoose.Schema({
    roomId: { type: String, required: true, unique: true },
    teacherScopeKey: { type: String, index: true },
    memberUserIds: [String], room: mongoose.Schema.Types.Mixed,
    archivedAt: Date, archivedByUserId: String,
  }, { collection: "party_room_archives" });
  return mongoose.models.PartyRoomArchive || mongoose.model("PartyRoomArchive", schema);
}

export function getPartySourceArchiveModel(mongoose) {
  const schema = new mongoose.Schema({
    sourceKey: { type: String, required: true, unique: true },
    roomId: { type: String, required: true, index: true },
    sourceCollection: String, sourceId: String, document: mongoose.Schema.Types.Mixed,
    archivedAt: { type: Date, default: Date.now },
  }, { collection: "party_source_archive" });
  return mongoose.models.PartySourceArchive || mongoose.model("PartySourceArchive", schema);
}

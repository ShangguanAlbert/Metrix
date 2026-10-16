import { mkdir, open, rename, readdir, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getPartyLearningEventModel, getPartyWebWorkspaceModel, getPartyMemoryUseModel } from "./model.js";
import { getPartyCodeArchiveModel, getPartySourceArchiveModel } from "./activity-model.js";
import { linkLearningEventToRecentMemoryUses } from "./memory-usage.js";
import { readNavigatorUserIds } from "../../../shared/party-roles.js";

// One explicitly injected recorder per process. The durable outbox is outside public uploads.
// Student requests never await MongoDB audit writes. Client batches are acknowledged after fsync.
export function createPartyActivityRecorder(deps, {
  directory = path.resolve(deps.env?.PARTY_ACTIVITY_OUTBOX_DIR || ".runtime/party-activity"),
  intervalMs = 1000, logger = console,
} = {}) {
  const Event = getPartyLearningEventModel(deps.mongoose);
  const Code = getPartyCodeArchiveModel(deps.mongoose);
  const Source = getPartySourceArchiveModel(deps.mongoose);
  const Workspace = getPartyWebWorkspaceModel(deps.mongoose);
  const MemoryUse = getPartyMemoryUseModel(deps.mongoose);
  const processId = randomUUID();
  let sequence = 0;
  let pending = [];
  let writing = Promise.resolve();
  let draining = null;
  let timer;
  let lastError = "";
  let lastSuccessAt = null;

  function prepare(input, kind = "event") {
    return { ...input, kind, eventId: input.eventId || randomUUID(),
      occurredAt: input.occurredAt || new Date().toISOString(), receivedAt: new Date().toISOString(),
      source: input.source || "server", processId, sequence: input.sequence ?? ++sequence };
  }
  function record(input) { pending.push(prepare(input)); }
  function code(input) { pending.push(prepare(input, "code")); }
  function source(input) { pending.push(prepare(input, "source")); }

  async function persistBatch(batch) {
    if (!batch.length) return;
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const file = path.join(directory, `${Date.now()}-${randomUUID()}.json`);
    const handle = await open(`${file}.tmp`, "wx", 0o600);
    try { await handle.writeFile(JSON.stringify(batch)); await handle.sync(); }
    finally { await handle.close(); }
    await rename(`${file}.tmp`, file);
  }
  function flush() {
    writing = writing.catch(() => {}).then(async () => {
      const batch = pending;
      pending = [];
      try { await persistBatch(batch); }
      catch (error) { pending.unshift(...batch); lastError = error.message; throw error; }
    });
    return writing;
  }
  async function accept(batch) {
    await persistBatch(batch.map((item) => prepare(item)));
  }
  async function store(item) {
    if (item.kind === "source") {
      await Source.updateOne({ sourceKey: `${item.sourceCollection}:${item.sourceId}` }, { $setOnInsert: {
        roomId: item.roomId, sourceCollection: item.sourceCollection, sourceId: item.sourceId, document: item.document,
      } }, { upsert: true });
      return;
    }
    if (item.kind === "code") {
      const { kind: _kind, codeKind, ...data } = item;
      void _kind;
      await Code.updateOne({ eventId: item.eventId }, { $setOnInsert: { ...data, kind: codeKind } }, { upsert: true });
      return;
    }
    const room = await deps.GroupChatRoom.findOne({ _id: item.roomId, teacherScopeKey: "shi-gaojun" }).setOptions({ includeArchived: true }).lean();
    // Authorized browser batches and captured events can arrive after classroom archival.
    if (!room && !item.authorized && !item.workspace) return;
    const workspace = item.workspace || await Workspace.findOne({ roomId: item.roomId }).lean();
    const role = item.role || (workspace?.driverUserId === item.userId ? "driver"
      : readNavigatorUserIds(workspace).includes(item.userId) ? "navigator" : "observer");
    const event = {
      eventId: item.eventId, roomId: item.roomId, userId: item.userId || "", userName: item.userName || "成员",
      eventType: item.eventType, role, source: item.source, sessionId: item.sessionId || "",
      sequence: item.sequence, processId: item.processId,
      taskId: item.taskId || `${item.roomId}:${workspace?.taskRevision || 1}`,
      taskStage: item.taskStage || workspace?.taskStage || "understand",
      occurredAt: new Date(item.occurredAt), receivedAt: new Date(item.receivedAt),
      metadata: { ...item.metadata,
        activeWorkspace: item.metadata?.activeWorkspace || workspace?.activeWorkspace || "project",
        lessonId: item.metadata?.lessonId || workspace?.loadedTemplate?.lessonId || "",
      },
    };
    await Event.updateOne({ eventId: item.eventId }, { $setOnInsert: event }, { upsert: true });
    // Retry association too: it is idempotent and must not silently disappear on a transient failure.
    if (["chat_message", "code_edit", "preview", "paia_feedback"].includes(item.eventType)) {
      const saved = await Event.findOne({ eventId: item.eventId }).lean();
      await linkLearningEventToRecentMemoryUses({ MemoryUse, event: saved });
    }
  }
  function drain() {
    if (draining) return draining;
    draining = (async () => {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const files = (await readdir(directory)).filter((name) => name.endsWith(".json")).sort();
      for (const name of files) {
        const file = path.join(directory, name);
        let batch;
        try { batch = JSON.parse(await readFile(file, "utf8")); }
        catch (error) { if (error.code === "ENOENT") continue; throw error; }
        for (let offset = 0; offset < batch.length; offset += 8) await Promise.all(batch.slice(offset, offset + 8).map(store));
        await unlink(file).catch((error) => { if (error.code !== "ENOENT") throw error; });
      }
      lastError = ""; lastSuccessAt = new Date();
    })().catch((error) => { lastError = error.message; logger.error("[party-activity] retry pending", error.message); })
      .finally(() => { draining = null; });
    return draining;
  }
  async function status() {
    let queuedFiles = 0;
    try { queuedFiles = (await readdir(directory)).filter((name) => name.endsWith(".json")).length; }
    catch (error) { if (error.code !== "ENOENT") lastError = error.message; }
    return { pendingInMemory: pending.length, queuedFiles, lastError, lastSuccessAt };
  }
  async function start() {
    await Event.init(); await Code.init(); await Source.init();
    timer = setInterval(() => { void flush().then(drain).catch((error) => logger.error("[party-activity] outbox write failed", error.message)); }, intervalMs);
    timer.unref?.();
    await drain();
  }
  async function close() { clearInterval(timer); await flush(); await drain(); }
  return { record, code, source, accept, flush, drain, start, close, status };
}

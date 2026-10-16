import { getUserToken } from "../../app/authStorage.js";

export function openActivityStore(indexedDB, userId) {
  let database;
  const ready = new Promise((resolve, reject) => {
    if (!indexedDB) { reject(new Error("Browser storage unavailable")); return; }
    const request = indexedDB.open(`metrix-activity-v1-${userId}`, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("events", { keyPath: "eventId" });
    request.onsuccess = () => { database = request.result; resolve(); };
    request.onerror = () => reject(request.error);
  });
  async function transaction(mode, run) {
    await ready;
    return new Promise((resolve, reject) => {
      const tx = database.transaction("events", mode);
      const request = run(tx.objectStore("events"));
      tx.oncomplete = () => resolve(request?.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
  return {
    put: (event) => transaction("readwrite", (store) => store.put(event)),
    list: () => transaction("readonly", (store) => store.getAll(undefined, 100)),
    remove: (ids) => transaction("readwrite", (store) => { ids.forEach((id) => store.delete(id)); }),
  };
}

// Injectable for retry tests. IndexedDB is asynchronous; no writes in the editor render path.
export function createActivityClient({ roomId, userId, store, send, now = () => new Date(), uuid = () => crypto.randomUUID() }) {
  const sessionId = uuid();
  let sequence = 0, running = null;
  let writes = Promise.resolve();
  const unsaved = new Map();
  let lastAiMessageId = "";
  function record(eventType, metadata = {}) {
    if (eventType === "message_visible" && metadata.senderKind === "ai") lastAiMessageId = metadata.messageId;
    const event = { eventId: uuid(), roomId, userId, sessionId, sequence: ++sequence,
      occurredAt: now().toISOString(), eventType,
      metadata: { ...metadata, ...(lastAiMessageId ? { relatedAiMessageId: lastAiMessageId } : {}) } };
    unsaved.set(event.eventId, event);
    writes = writes.catch(() => {}).then(async () => {
      await store.put(event); unsaved.delete(event.eventId);
    }).catch(() => { /* Retain in memory and retry; never affect classroom controls. */ });
  }
  function flush() {
    if (running) return running;
    running = (async () => {
      await writes;
      for (const event of unsaved.values()) {
        try { await store.put(event); unsaved.delete(event.eventId); }
        catch { event.metadata.captureStorage = "memory_only"; }
      }
      const stored = await store.list().catch(() => []);
      const queued = [...new Map([...stored, ...unsaved.values()].map((event) => [event.eventId, event])).values()].slice(0, 100);
      const rooms = new Map();
      queued.forEach((event) => { if (!rooms.has(event.roomId)) rooms.set(event.roomId, []); rooms.get(event.roomId).push(event); });
      for (const [target, events] of rooms) {
        const result = await send(target, events);
        const accepted = new Set(result.accepted || []);
        const ids = events.filter((event) => accepted.has(event.eventId)).map((event) => event.eventId);
        ids.forEach((eventId) => unsaved.delete(eventId));
        await store.remove(ids);
      }
    })().catch(() => { /* Unacknowledged records stay in IndexedDB for the next attempt. */ })
      .finally(() => { running = null; });
    return running;
  }
  return { record, flush, sessionId };
}

export async function sendActivity(roomId, events) {
  const response = await fetch(`/api/group-chat/rooms/${encodeURIComponent(roomId)}/activity`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${getUserToken()}` },
    body: JSON.stringify({ events }), signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Activity HTTP ${response.status}`);
  return response.json();
}

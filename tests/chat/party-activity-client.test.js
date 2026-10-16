import test from "node:test";
import assert from "node:assert/strict";
import { createActivityClient } from "../../src/features/party/activityClient.js";

test("离线操作不等待请求；只删除服务端确认的记录，重建客户端后可补传", async () => {
  const rows = new Map(); let serial = 0; let offline = true;
  const store = { put: async (event) => rows.set(event.eventId, event), list: async () => [...rows.values()], remove: async (ids) => ids.forEach((id) => rows.delete(id)) };
  const send = async (_room, events) => {
    if (offline) throw new Error("offline");
    return { accepted: [events[0].eventId] };
  };
  const options = { roomId: "room", userId: "student", store, send, uuid: () => `id-${++serial}` };
  const client = createActivityClient(options);
  assert.equal(client.record("session_start"), undefined);
  client.record("editor_action", { inputType: "undo" });
  await client.flush(); assert.equal(rows.size, 2);
  offline = false;
  const restarted = createActivityClient(options);
  await restarted.flush(); assert.equal(rows.size, 1);
  assert.equal([...rows.values()][0].metadata.inputType, "undo");
  await restarted.flush(); assert.equal(rows.size, 0);
});

test("AI 可见与后续行为只记录关联ID，保留原始操作与会话顺序", async () => {
  const records = []; let serial = 0;
  const client = createActivityClient({ roomId: "room", userId: "a", uuid: () => `id-${++serial}`,
    store: { put: async (event) => records.push(event), list: async () => [], remove: async () => {} }, send: async () => ({ accepted: [] }) });
  client.record("message_visible", { messageId: "ai-1", senderKind: "ai" });
  client.record("editor_action", { inputType: "input.paste" });
  await client.flush();
  assert.equal(records[1].metadata.relatedAiMessageId, "ai-1");
  assert.equal(records[1].sequence, 2);
  assert.equal(records[1].metadata.adopted, undefined);
});


test("浏览器存储失败时保留内存记录，成功发送后不会重复补传", async () => {
  let serial = 0;
  const sent = [];
  const unavailable = async () => { throw new Error("storage unavailable"); };
  const client = createActivityClient({ roomId: "room", userId: "a", uuid: () => `id-${++serial}`,
    store: { put: unavailable, list: unavailable, remove: unavailable },
    send: async (_room, events) => { sent.push(...events); return { accepted: events.map((event) => event.eventId) }; },
  });
  client.record("session_start");
  await client.flush(); await client.flush();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].metadata.captureStorage, "memory_only");
});

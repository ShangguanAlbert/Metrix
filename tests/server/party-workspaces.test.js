import test from "node:test";
import assert from "node:assert/strict";
import { serialize, deserialize } from "node:v8";
import mongoose from "mongoose";
import * as Y from "yjs";
import { createPartyCodingRealtime } from "../../server/modules/party-coding/realtime.js";
import { normalizeWorkspace } from "../../server/modules/party-coding/workspace-state.js";

const clone = (value) => deserialize(serialize(value));
const encode = (value) => Buffer.from(value).toString("base64");

function fixture(t) {
  let stored = { roomId: "room", html: "<p>长期作品</p>", css: "p { color: red; }", revision: 1,
    taskStage: "build", driverUserId: "a", navigatorUserId: "b", navigatorUserIds: ["b", "c"],
    versions: [], documentEpoch: 0 };
  let failWrite = false;
  const messages = [];
  const query = (read) => ({ lean: async () => clone(read()) });
  const Workspace = {
    findOne: () => query(() => stored),
    findOneAndUpdate: (_filter, update) => query(() => {
      if (failWrite) throw new Error("模拟数据库写入失败");
      for (const [key, value] of Object.entries(update.$set || {})) {
        if (key.startsWith("storedWorkspaces.")) {
          stored.storedWorkspaces ||= {};
          stored.storedWorkspaces[key.split(".")[1]] = clone(value);
        } else stored[key] = clone(value);
      }
      for (const [key, value] of Object.entries(update.$inc || {})) stored[key] = (stored[key] || 0) + value;
      if (update.$push?.versions) stored.versions = [...stored.versions, ...clone(update.$push.versions.$each)].slice(update.$push.versions.$slice);
      return stored;
    }),
    updateOne: async (filter, update) => Workspace.findOneAndUpdate(filter, update).lean(),
  };
  const db = new mongoose.Mongoose();
  db.models.PartyWebWorkspace = Workspace;
  db.models.PartyLearningEvent = { create: async (event) => event };
  const deps = { mongoose: db, sanitizeId: (id) => String(id || ""),
    GroupChatRoom: { findOne: (filter) => query(() => filter.paiaMonitoringEnabled ? null : { memberUserIds: ["a", "b", "c"] }) },
    broadcastGroupChatWsPayload: (_room, payload) => messages.push(payload),
    sendGroupChatWsPayload: (_socket, payload) => messages.push(payload),
  };
  const service = createPartyCodingRealtime(deps);
  let epoch = 0;
  const meta = { authed: true, userId: "a", userName: "测试甲", joinedRooms: new Set(["room"]) };
  async function join() {
    await service.handleWsMessage({ socket: {}, meta, payload: { type: "coding_collab_join", roomId: "room" } });
    const sync = messages.findLast((item) => item.type === "coding_collab_sync");
    epoch = sync.documentEpoch;
    const fresh = new Y.Doc();
    Y.applyUpdate(fresh, Buffer.from(sync.update, "base64"));
    return fresh;
  }
  function options(client, target) {
    return { roomId: "room", target, expectedEpoch: epoch,
      expectedStateVector: encode(Y.encodeStateVector(client)), expectedHtml: client.getText("html").toString(), expectedCss: client.getText("css").toString(),
      author: { userId: "a", name: "测试甲" } };
  }
  async function edit(client, html, css) {
    const vector = Y.encodeStateVector(client);
    client.transact(() => { const text = client.getText("html"); text.delete(0, text.length); text.insert(0, html);
      if (css !== undefined) { const style = client.getText("css"); style.delete(0, style.length); style.insert(0, css); }
    });
    await service.handleWsMessage({ socket: {}, meta, payload: {
      type: "coding_collab_update", roomId: "room", documentEpoch: epoch, update: encode(Y.encodeStateAsUpdate(client, vector)),
    } });
  }
  t.after(async () => { failWrite = false; await service.close(); });
  return { service, deps, join, edit, options, messages, read: () => clone(stored), fail: (value) => { failWrite = value; } };
}

test("旧作品保留为长期任务，切换前刷新未落盘编辑，两区代码和历史独立且角色不变", async (t) => {
  const f = fixture(t);
  assert.equal(normalizeWorkspace(f.read()).activeWorkspace, "project");
  let client = await f.join();
  await f.edit(client, "<p>最后一次长期修改</p>", "p { color: green; }");
  await f.service.saveOrSwitchWorkspace(f.options(client, "lesson"));
  client.destroy(); client = await f.join();
  assert.notEqual(client.getText("html").toString(), "<p>最后一次长期修改</p>");
  assert.equal(f.read().taskStage, "understand");
  await f.edit(client, "<p>本课练习修改</p>", "p { color: blue; }");
  await f.service.saveOrSwitchWorkspace(f.options(client, "project"));
  client.destroy(); client = await f.join();
  assert.equal(client.getText("html").toString(), "<p>最后一次长期修改</p>");
  assert.equal(f.read().taskStage, "build");
  assert.equal(client.getText("css").toString(), "p { color: green; }");
  assert.ok(f.read().versions.every((v) => !v.html.includes("本课练习修改")));
  assert.deepEqual(f.read().navigatorUserIds, ["b", "c"]);
  await f.service.saveOrSwitchWorkspace(f.options(client, "lesson"));
  client.destroy(); client = await f.join();
  assert.equal(client.getText("html").toString(), "<p>本课练习修改</p>");
  assert.equal(client.getText("css").toString(), "p { color: blue; }");
  assert.ok(f.read().versions.every((v) => !v.html.includes("长期修改")));
  client.destroy();
});

test("Navigator 不能切换；过期代数和未同步删除不能触发切换", async (t) => {
  const f = fixture(t); const client = await f.join();
  await assert.rejects(f.service.saveOrSwitchWorkspace({ ...f.options(client, "lesson"), author: { userId: "b" } }), { status: 403 });
  await assert.rejects(f.service.saveOrSwitchWorkspace({ ...f.options(client, "lesson"), expectedEpoch: 99 }), { status: 409 });
  // A pure deletion does not change a Yjs state vector. Text verification must catch it.
  const before = encode(Y.encodeStateVector(client));
  client.getText("html").delete(0, 3);
  assert.equal(encode(Y.encodeStateVector(client)), before);
  await assert.rejects(f.service.saveOrSwitchWorkspace(f.options(client, "lesson")), { status: 409 });
  assert.equal(f.read().activeWorkspace, undefined);
  client.destroy();
});

test("模板只能载入练习区，重复请求幂等且旧文档更新不能污染另一区域", async (t) => {
  const f = fixture(t); let client = await f.join();
  const template = { lessonId: "lesson-1", version: "v1" };
  const request = () => ({ ...f.options(client), html: "<h1>模板</h1>", css: "h1 { color: blue; }", template, requestId: "request-123456789" });
  await assert.rejects(f.service.replaceRoomDocuments(request()), { status: 409 });
  const oldUpdate = encode(Y.encodeStateAsUpdate(client));
  await f.service.saveOrSwitchWorkspace(f.options(client, "lesson"));
  client.destroy(); client = await f.join();
  const load = request();
  const first = await f.service.replaceRoomDocuments(load);
  const repeated = await f.service.replaceRoomDocuments(load);
  assert.equal(first.revision, repeated.revision);
  client.destroy(); client = await f.join();
  await f.service.handleWsMessage({ socket: {}, meta: { authed: true, userId: "a", joinedRooms: new Set(["room"]) },
    payload: { type: "coding_collab_update", roomId: "room", documentEpoch: 0, update: oldUpdate } });
  assert.equal(f.read().html, "<h1>模板</h1>");
  assert.equal(f.messages.at(-1).type, "coding_collab_reset");
  await f.service.saveOrSwitchWorkspace(f.options(client, "project"));
  assert.equal(f.read().html, "<p>长期作品</p>");
  client.destroy();
});

test("保存失败时拒绝切换，重试后可保存并重建协作服务读取同一作品", async (t) => {
  const f = fixture(t); const client = await f.join();
  await f.edit(client, "<p>等待保存</p>");
  f.fail(true);
  const oldError = console.error;
  console.error = () => {};
  try { await assert.rejects(f.service.saveOrSwitchWorkspace(f.options(client, "lesson")), { status: 500 }); }
  finally { console.error = oldError; f.fail(false); }
  assert.equal(f.read().activeWorkspace, undefined);
  assert.equal(f.messages.at(-1).type, "coding_collab_error");
  const saved = await f.service.saveOrSwitchWorkspace(f.options(client));
  assert.ok(saved.savedAt);
  assert.equal(saved.html, "<p>等待保存</p>");
  await f.service.close();
  const restarted = createPartyCodingRealtime(f.deps);
  t.after(() => restarted.close());
  await restarted.handleWsMessage({ socket: {}, meta: { authed: true, userId: "a", joinedRooms: new Set(["room"]) }, payload: { type: "coding_collab_join", roomId: "room" } });
  const sync = f.messages.findLast((item) => item.type === "coding_collab_sync");
  const reloaded = new Y.Doc(); Y.applyUpdate(reloaded, Buffer.from(sync.update, "base64"));
  assert.equal(reloaded.getText("html").toString(), "<p>等待保存</p>");
  reloaded.destroy(); client.destroy();
});

test("填空模板在服务端拦截锁定区修改，保存切换和历史恢复后仍受保护", async (t) => {
  const f = fixture(t); let client = await f.join();
  await f.service.saveOrSwitchWorkspace(f.options(client, "lesson"));
  client.destroy(); client = await f.join();
  const template = { lessonId: "fill-lesson", version: "fill-v1", editMode: "fill", html: "<h1>____</h1>", css: "", editableRanges: { html: [{ id: "a", from: 4, to: 8 }], css: [] } };
  await f.service.replaceRoomDocuments({ ...f.options(client), ...template, template, requestId: "fill-request" });
  client.destroy(); client = await f.join();
  const before = Y.encodeStateVector(client);
  client.transact(() => { client.getText("html").delete(4, 4); client.getText("html").insert(4, "同学的答案"); });
  await f.service.handleWsMessage({ socket: {}, meta: { authed: true, userId: "a", joinedRooms: new Set(["room"]) }, payload: {
    type: "coding_collab_update", roomId: "room", documentEpoch: f.options(client).expectedEpoch,
    update: encode(Y.encodeStateAsUpdate(client, before)),
  } });
  await f.service.saveOrSwitchWorkspace(f.options(client));
  const savedAnswer = f.read().versions.at(-1);
  assert.equal(savedAnswer.html, "<h1>同学的答案</h1>");
  assert.equal(savedAnswer.exercise.version, "fill-v1");
  await f.edit(client, "破坏整个模板");
  assert.equal(f.messages.at(-1).type, "coding_collab_reset");
  client.destroy(); client = await f.join();
  assert.equal(client.getText("html").toString(), "<h1>同学的答案</h1>");
  await assert.rejects(f.service.replaceRoomDocuments({ ...f.options(client), html: "坏内容", css: "", requireDriver: true }), { status: 403 });
  await f.service.replaceRoomDocuments({ ...f.options(client), html: savedAnswer.html, css: savedAnswer.css, restoreRevision: savedAnswer.revision });
  client.destroy(); client = await f.join();
  await f.service.saveOrSwitchWorkspace(f.options(client, "project"));
  client.destroy(); client = await f.join();
  assert.equal(client.getText("html").toString(), "<p>长期作品</p>");
  await f.service.saveOrSwitchWorkspace(f.options(client, "lesson"));
  client.destroy(); client = await f.join();
  await f.edit(client, "再次破坏");
  assert.equal(f.messages.at(-1).type, "coding_collab_reset");
  client.destroy();
});

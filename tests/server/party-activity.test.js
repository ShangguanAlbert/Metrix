import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import mongoose from "mongoose";
import { createPartyActivityRecorder } from "../../server/modules/party-coding/activity-recorder.js";
import { normalizeClientActivity, buildActivityFilter, canReadActivityRoom } from "../../server/modules/party-coding/activity-routes.js";
import { createPartyLearningService } from "../../server/modules/party-coding/learning-service.js";

function fixture() {
  const db = new mongoose.Mongoose();
  const events = new Map(), codes = new Map(), sources = new Map();
  let failed = false;
  const query = (value) => ({ lean: async () => value, setOptions() { return this; } });
  const model = (rows) => ({ init: async () => {}, updateOne: async (filter, update) => {
    if (failed) throw new Error("simulated database outage");
    const key = filter.eventId || filter.sourceKey;
    if (!rows.has(key)) rows.set(key, { _id: key, ...update.$setOnInsert });
  }, findOne: (filter) => query(rows.get(filter.eventId)) });
  db.models.PartyLearningEvent = model(events);
  db.models.PartyCodeArchive = model(codes);
  db.models.PartySourceArchive = model(sources);
  db.models.PartyWebWorkspace = { findOne: () => query({ taskRevision: 2, driverUserId: "a", activeWorkspace: "lesson" }) };
  db.models.PartyMemoryUse = { updateMany: async () => {} };
  const deps = { mongoose: db, GroupChatRoom: { findOne: () => query({ paiaMonitoringEnabled: false }) } };
  return { deps, events, codes, sources, fail: (value) => { failed = value; } };
}

test("AI 感知关闭时仍采集，且调用者不等待数据库", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "party-activity-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const f = fixture();
  const recorder = createPartyActivityRecorder(f.deps, { directory, logger: { error() {} } });
  f.deps.partyActivity = recorder;
  const learning = createPartyLearningService(f.deps);
  f.fail(true);
  await learning.recordEvent({ roomId: "room", userId: "a", eventType: "code_edit", metadata: { revision: 8 } });
  await recorder.flush(); await recorder.drain();
  assert.equal(f.events.size, 0);
  assert.equal((await recorder.status()).queuedFiles, 1);
  f.fail(false); await recorder.drain();
  assert.equal(f.events.size, 1);
  assert.equal([...f.events.values()][0].role, "driver");
  assert.equal([...f.events.values()][0].metadata.activeWorkspace, "lesson");
});

test("已确认的浏览器批次可跨进程重试且不重复，代码档案超过20条仍完整", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "party-activity-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const f = fixture();
  const options = { directory, logger: { error() {} } };
  const first = createPartyActivityRecorder(f.deps, options);
  const event = { eventId: "same-event", roomId: "room", eventType: "session_start", source: "client_observation" };
  await first.accept([event]); await first.accept([event]);
  for (let i = 0; i < 35; i += 1) first.code({ eventId: `code-${i}`, roomId: "room", codeKind: "update", update: `${i}` });
  await first.flush();
  const restarted = createPartyActivityRecorder(f.deps, options);
  await restarted.drain();
  assert.equal(f.events.size, 1); assert.equal(f.codes.size, 35);
  assert.deepEqual(await readdir(directory), []);
});

test("客户端不能伪造他人身份或权威代码事件，危险字段不会入库", () => {
  const raw = { eventId: "1234567890123456", sessionId: "abcdefghijklmnop", sequence: 1, occurredAt: new Date().toISOString(),
    eventType: "editor_action", userId: "victim", role: "driver", metadata: { document: "html", code: "secret", $where: "bad" } };
  const safe = normalizeClientActivity(raw, { roomId: "room", userId: "real", userName: "测试" });
  assert.equal(safe.userId, "real"); assert.equal(safe.role, undefined);
  assert.deepEqual(safe.metadata, { document: "html" });
  assert.equal(normalizeClientActivity({ ...raw, eventType: "code_transaction" }, {}), null);
});

test("分页同时包含时间和ID，筛选条件不能被游标覆盖", () => {
  const cursor = Buffer.from(JSON.stringify({ at: "2026-10-16T03:00:00Z", id: "012345678901234567890123" })).toString("base64url");
  const filter = buildActivityFilter("room", { cursor, userId: "a", from: "2026-10-15", eventType: "preview" });
  assert.equal(filter.userId, "a"); assert.equal(filter.eventType, "preview");
  assert.ok(filter.occurredAt.$gte); assert.equal(filter.$or.length, 2);
  assert.throws(() => buildActivityFilter("room", { cursor: "bad" }));
});

test("教师只可查看授权班级的完整小组，平台管理员可跨班查看", async () => {
  const deps = { PLATFORM_ADMIN_ACCOUNT_TAG: "platform", AuthUser: { find: () => ({ lean: async () => [{ _id: "a", profile: { className: "A" } }, { _id: "b", profile: { className: "B" } }] }) } };
  const room = { memberUserIds: ["a", "b"] };
  assert.equal(await canReadActivityRoom(deps, { role: "teacher", authorizedClassNames: ["A"] }, room), false);
  assert.equal(await canReadActivityRoom(deps, { role: "teacher", authorizedClassNames: ["A", "B"] }, room), true);
  assert.equal(await canReadActivityRoom(deps, { role: "admin", accountTag: "platform" }, room), true);
  assert.equal(await canReadActivityRoom({}, { role: "admin" }, { memberUserIds: [] }), false);
});


test("账号删除后仍按历史班级授权，缺失身份不授予访问", async () => {
  const deps = { AuthUser: { find: () => ({ lean: async () => [] }) } };
  const room = { memberUserIds: ["a"], historicalMembers: [{ userId: "a", className: "A" }] };
  assert.equal(await canReadActivityRoom(deps, { role: "teacher", authorizedClassNames: ["A"] }, room), true);
  assert.equal(await canReadActivityRoom(deps, { role: "teacher", authorizedClassNames: ["B"] }, room), false);
  assert.equal(await canReadActivityRoom(deps, { role: "teacher", authorizedClassNames: ["A"] }, { memberUserIds: ["a"] }), false);
});

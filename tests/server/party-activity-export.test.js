import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { buildPartyActivityExportFiles, PARTY_EXPORT_COLLECTIONS } from "../../server/modules/party-coding/activity-export.js";
import { registerPartyActivityRoutes } from "../../server/modules/party-coding/activity-routes.js";

const roomId = "012345678901234567890123";
const otherRoomId = "012345678901234567890124";
const query = (value) => ({ lean: async () => value, setOptions() { return this; } });

function fixture() {
  const database = new mongoose.Mongoose();
  const rows = {
    group_chat_rooms: [{ _id: roomId, teacherScopeKey: "shi-gaojun", memberUserIds: ["a"] },
      { _id: otherRoomId, teacherScopeKey: "shi-gaojun", memberUserIds: ["b"], archivedAt: new Date() }],
    party_learning_events: Array.from({ length: 251 }, (_, i) => ({ _id: `event-${i}`, roomId, eventType: "session_heartbeat" })),
    party_code_archive: Array.from({ length: 35 }, (_, i) => ({ _id: `code-${i}`, roomId, update: "AQID" })),
    group_chat_messages: [{ _id: "own", roomId, content: "学习过程" }, { _id: "other", roomId: otherRoomId, content: "其他班级" }],
    party_source_archive: [{ _id: "deleted-file", roomId, document: { fileName: "已删除材料.txt" } }],
  };
  for (const name of PARTY_EXPORT_COLLECTIONS) rows[name] ||= [];
  let flushed = false;
  database.connection.db = { collection: (name) => ({ find: (filter) => ({ sort: () => ({
    async *[Symbol.asyncIterator]() {
      assert.ok(flushed, "export waits for the recorder flush");
      const key = name === "group_chat_rooms" ? "_id" : "roomId";
      const ids = filter[key].$in.map(String);
      for (const row of rows[name]) if (ids.includes(String(row[key]))) yield row;
    },
  }) }) }) };
  database.models.PartyRoomArchive = { find: () => query([]) };
  const deps = {
    mongoose: database,
    partyActivity: { flush: async () => { flushed = true; }, drain: async () => {}, status: async () => ({ queuedFiles: 2 }) },
    AuthUser: { find: (filter) => query(filter._id.$in.map((id) => ({ _id: id, profile: { className: id === "a" ? "A" : "B" } }))) },
    GroupChatRoom: {
      find: () => query(rows.group_chat_rooms),
      findOne: (filter) => query(rows.group_chat_rooms.find((room) => room._id === filter._id)),
    },
    authenticateAdminRequest: async () => ({ role: "teacher", authorizedClassNames: ["A"] }),
    buildZipBuffer: (files) => files,
  };
  return { deps, rows };
}

test("JSON包包含全部过程类型、251条事件和35份代码，去重范围且排除其他小组", async () => {
  const { deps } = fixture();
  const files = await buildPartyActivityExportFiles(deps, [roomId, roomId]);
  const data = Object.fromEntries(files.map((file) => [file.name, JSON.parse(file.content)]));
  assert.equal(files.length, PARTY_EXPORT_COLLECTIONS.length + 1);
  assert.equal(data["party_learning_events.json"].length, 251);
  assert.equal(data["party_code_archive.json"].length, 35);
  assert.deepEqual(data["group_chat_messages.json"].map((item) => item._id), ["own"]);
  assert.equal(data["party_source_archive.json"][0].document.fileName, "已删除材料.txt");
  assert.deepEqual(data["party_memory_uses.json"], []);
  const manifest = data["manifest.json"];
  assert.deepEqual(manifest.roomIds, [roomId]);
  assert.equal(manifest.recording.queuedFiles, 2);
  for (const collection of PARTY_EXPORT_COLLECTIONS) assert.equal(manifest.counts[collection], data[`${collection}.json`].length);
});

test("原全量ZIP使用相同JSON档案目录，空授权范围不会退化成全库导出", async () => {
  const { deps } = fixture();
  const files = await buildPartyActivityExportFiles(deps, [], { prefix: "learning-process/" });
  assert.ok(files.every((file) => file.name.startsWith("learning-process/") && file.name.endsWith(".json")));
  assert.equal(JSON.parse(files[0].content).totalRecords, 0);
});

test("教师打包全部小组仅包含授权班级，导出不使用界面分页或时间筛选", async () => {
  const { deps } = fixture();
  const handlers = new Map();
  registerPartyActivityRoutes({ get: (path, handler) => handlers.set(path, handler), post() {} }, deps);
  const headers = {};
  const res = { setHeader: (name, value) => { headers[name] = value; }, send: (files) => { res.files = files; } };
  await handlers.get("/api/auth/admin/collaboration-activity/export")({ query: { limit: 1, from: "2099-01-01" } }, res);
  assert.equal(headers["Content-Type"], "application/zip");
  assert.match(headers["Content-Disposition"], /\.zip/);
  assert.equal(JSON.parse(res.files.find((file) => file.name === "party_learning_events.json").content).length, 251);
  assert.deepEqual(JSON.parse(res.files[0].content).roomIds, [roomId]);
});

test("单组打包仍检查教师权限，不能通过房间ID导出其他班级", async () => {
  const { deps } = fixture();
  const handlers = new Map();
  registerPartyActivityRoutes({ get: (path, handler) => handlers.set(path, handler), post() {} }, deps);
  let status;
  const res = { status: (value) => { status = value; return res; }, json() {} };
  await handlers.get("/api/auth/admin/collaboration-classrooms/:roomId/activity/export")({ params: { roomId: otherRoomId } }, res);
  assert.equal(status, 403);
});

import assert from "node:assert/strict";
import test from "node:test";
import { syncPublishedClassroomRooms } from "../../server/modules/party-coding/classroom-publication.js";

for (const olderLesson of [false, true]) {
  test(`关闭最新课时后房间任务${olderLesson ? "回到仍开放课时" : "清空"}，并通知学生刷新`, async () => {
    const writes = [];
    const events = [];
    const closed = { id: "new", publication: { publishedAt: "2026-10-08", snapshot: { id: "new", className: "801班", enabled: false, announcement: "关闭的任务" } } };
    const old = { id: "old", className: "801班", announcement: "仍开放的任务", createdAt: "2026-10-01" };
    await syncPublishedClassroomRooms({
      lessons: olderLesson ? [closed, old] : [closed],
      classNames: ["801班", "801班"],
      deps: {
        AuthUser: { find: (query) => {
          assert.deepEqual(query, { lockedTeacherScopeKey: "shi-gaojun", "profile.className": "801班" });
          return { lean: async () => [{ _id: "student" }] };
        } },
        GroupChatRoom: {
          updateMany: async (query, update) => {
            assert.deepEqual(query.memberUserIds, { $in: ["student"], $not: { $elemMatch: { $nin: ["student"] } } });
            writes.push(update);
          },
          find: () => ({ lean: async () => [{ _id: "room" }] }),
        },
        broadcastGroupChatRoomUpdated: (id) => assert.equal(id, "room"),
        broadcastGroupChatWsPayload: (_id, payload) => events.push(payload),
      },
    });
    assert.deepEqual(writes, [{ $set: { announcement: olderLesson ? "仍开放的任务" : "" } }]);
    assert.equal(events.length, 1);
    assert.equal(events[0].type, "coding_collab_template_published");
    assert.equal(events[0].lessonId, olderLesson ? "old" : "");
  });
}

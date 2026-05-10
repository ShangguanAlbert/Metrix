import test from "node:test";
import assert from "node:assert/strict";

import {
  GroupChatRoom,
  updateGroupChatRoomReadState,
} from "../../server/services/core-runtime.js";

test("updateGroupChatRoomReadState keeps room activity time unchanged", async (t) => {
  const roomDoc = {
    _id: "507f1f77bcf86cd799439011",
    roomCode: "1234",
    name: "讨论组",
    ownerUserId: "owner-1",
    memberUserIds: ["owner-1", "user-1"],
    memberCount: 2,
    readStates: [],
    createdAt: new Date("2026-05-10T08:00:00.000Z"),
    updatedAt: new Date("2026-05-10T08:05:00.000Z"),
  };

  const originalFindById = GroupChatRoom.findById;
  const originalFindByIdAndUpdate = GroupChatRoom.findByIdAndUpdate;

  t.after(() => {
    GroupChatRoom.findById = originalFindById;
    GroupChatRoom.findByIdAndUpdate = originalFindByIdAndUpdate;
  });

  let receivedOptions = null;

  GroupChatRoom.findById = () => ({
    lean: async () => roomDoc,
  });

  GroupChatRoom.findByIdAndUpdate = (_roomId, _update, options) => {
    receivedOptions = options;
    return {
      lean: async () => ({
        ...roomDoc,
        readStates: [
          {
            userId: "user-1",
            lastReadMessageId: "507f1f77bcf86cd799439099",
            lastReadAt: new Date("2026-05-10T08:06:00.000Z"),
            updatedAt: new Date("2026-05-10T08:06:00.000Z"),
          },
        ],
      }),
    };
  };

  await updateGroupChatRoomReadState({
    roomId: "507f1f77bcf86cd799439011",
    userId: "user-1",
    lastReadMessageId: "507f1f77bcf86cd799439099",
    lastReadAt: "2026-05-10T08:06:00.000Z",
  });

  assert.equal(receivedOptions?.new, true);
  assert.equal(
    receivedOptions?.timestamps,
    false,
    "已读同步不应该刷新群聊房间的 updatedAt",
  );
});

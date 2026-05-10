import test from "node:test";
import assert from "node:assert/strict";

import {
  arePartyIdListsEqual,
  getPartyRoomSubscriptionDiff,
  normalizePartyRoomOnlineUserIds,
} from "../../src/pages/party/partyRealtimeState.js";

test("normalizePartyRoomOnlineUserIds keeps only room members and removes duplicates", () => {
  assert.deepEqual(
    normalizePartyRoomOnlineUserIds([" user-1 ", "user-2", "user-1", "user-3"], ["user-1", "user-3"]),
    ["user-1", "user-3"],
  );
});

test("arePartyIdListsEqual returns true only for the same normalized id order", () => {
  assert.equal(arePartyIdListsEqual([" user-1 ", "user-2"], ["user-1", "user-2"]), true);
  assert.equal(arePartyIdListsEqual(["user-1", "user-2"], ["user-2", "user-1"]), false);
  assert.equal(arePartyIdListsEqual(["user-1"], ["user-1", "user-2"]), false);
});

test("getPartyRoomSubscriptionDiff only joins newly added rooms and leaves removed rooms", () => {
  const diff = getPartyRoomSubscriptionDiff(
    new Set(["room-1", "room-2"]),
    [
      { id: "room-2" },
      { id: " room-3 " },
      { id: "" },
    ],
  );

  assert.deepEqual(diff.joinRoomIds, ["room-3"]);
  assert.deepEqual(diff.leaveRoomIds, ["room-1"]);
  assert.deepEqual(Array.from(diff.nextRoomIds), ["room-2", "room-3"]);
});

function sanitizePartyId(value) {
  return String(value || "").trim();
}

export function arePartyIdListsEqual(left, right) {
  const leftList = Array.isArray(left) ? left : [];
  const rightList = Array.isArray(right) ? right : [];
  if (leftList.length !== rightList.length) return false;
  for (let index = 0; index < leftList.length; index += 1) {
    if (sanitizePartyId(leftList[index]) !== sanitizePartyId(rightList[index])) {
      return false;
    }
  }
  return true;
}

export function normalizePartyRoomOnlineUserIds(rawOnlineUserIds, memberUserIds = []) {
  const memberSet = new Set(
    (Array.isArray(memberUserIds) ? memberUserIds : [])
      .map((item) => sanitizePartyId(item))
      .filter(Boolean),
  );
  return Array.from(
    new Set(
      (Array.isArray(rawOnlineUserIds) ? rawOnlineUserIds : [])
        .map((item) => sanitizePartyId(item))
        .filter((userId) => userId && memberSet.has(userId)),
    ),
  );
}

export function getPartyRoomSubscriptionDiff(currentJoinedIds, rooms) {
  const previousIds = currentJoinedIds instanceof Set ? currentJoinedIds : new Set();
  const nextRoomIds = new Set(
    (Array.isArray(rooms) ? rooms : [])
      .map((room) => sanitizePartyId(room?.id))
      .filter(Boolean),
  );

  const joinRoomIds = [];
  nextRoomIds.forEach((roomId) => {
    if (!previousIds.has(roomId)) {
      joinRoomIds.push(roomId);
    }
  });

  const leaveRoomIds = [];
  previousIds.forEach((roomId) => {
    if (!nextRoomIds.has(roomId)) {
      leaveRoomIds.push(roomId);
    }
  });

  return {
    nextRoomIds,
    joinRoomIds,
    leaveRoomIds,
  };
}

export function joinAllPartyRooms(socket, rooms) {
  const nextRoomIds = new Set(
    (Array.isArray(rooms) ? rooms : [])
      .map((room) => sanitizePartyId(room?.id))
      .filter(Boolean),
  );
  if (!socket || typeof socket.joinRoom !== "function") {
    return nextRoomIds;
  }
  nextRoomIds.forEach((roomId) => {
    socket.joinRoom(roomId);
  });
  return nextRoomIds;
}

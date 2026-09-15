export const PARTY_MIN_STUDENTS = 2;
export const PARTY_MAX_STUDENTS = 3;

export function normalizePartyMemberIds(value) {
  return [...new Set((Array.isArray(value) ? value : [])
    .map((id) => String(id || "").trim()).filter(Boolean))];
}

export function readNavigatorUserIds(workspace) {
  return normalizePartyMemberIds(workspace?.navigatorUserIds?.length
    ? workspace.navigatorUserIds
    : [workspace?.navigatorUserId]);
}

export function resolvePartyRoles(memberIds, current = {}) {
  const memberUserIds = normalizePartyMemberIds(memberIds);
  const driverUserId = memberUserIds.includes(current.driverUserId)
    ? current.driverUserId : memberUserIds[0] || "";
  const driverIndex = memberUserIds.indexOf(driverUserId);
  const navigatorUserIds = [...memberUserIds.slice(driverIndex + 1), ...memberUserIds.slice(0, driverIndex)];
  return {
    memberUserIds,
    driverUserId,
    navigatorUserIds,
    // Retained for existing rooms and older API consumers.
    navigatorUserId: navigatorUserIds[0] || "",
    pairReady: memberUserIds.length >= PARTY_MIN_STUDENTS
      && memberUserIds.length <= PARTY_MAX_STUDENTS,
  };
}

export function rotatePartyRoles(memberIds, current) {
  const roles = resolvePartyRoles(memberIds, current);
  if (!roles.pairReady) throw new Error("请安排 2～3 名学生后再交棒。");
  const index = roles.memberUserIds.indexOf(roles.driverUserId);
  return resolvePartyRoles(roles.memberUserIds, {
    driverUserId: roles.memberUserIds[(index + 1) % roles.memberUserIds.length],
  });
}

export function canDriveParty(workspace, userId) {
  return Boolean(userId && workspace?.driverUserId === String(userId)
    && readNavigatorUserIds(workspace).length >= 1
    && readNavigatorUserIds(workspace).length <= 2);
}

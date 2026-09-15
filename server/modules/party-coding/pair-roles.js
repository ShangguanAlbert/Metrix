import { resolvePartyRoles } from "../../../shared/party-roles.js";

export function resolvePartyPairRoles(rawMemberIds, current = {}) {
  const roles = resolvePartyRoles(rawMemberIds, current);
  return {
    ...roles,
    changed: roles.driverUserId !== String(current?.driverUserId || "")
      || roles.navigatorUserId !== String(current?.navigatorUserId || "")
      || JSON.stringify(roles.navigatorUserIds) !== JSON.stringify(current?.navigatorUserIds || []),
  };
}

export async function ensurePartyPairRoles({ Workspace, roomId, memberUserIds }) {
  const current = await Workspace.findOneAndUpdate(
    { roomId },
    { $setOnInsert: { roomId } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
  const roles = resolvePartyPairRoles(memberUserIds, current);
  if (!roles.changed) return current;
  const updated = await Workspace.findOneAndUpdate(
    { roomId, driverUserId: current.driverUserId, roleRotationCount: current.roleRotationCount || 0 },
    {
      $set: {
        driverUserId: roles.driverUserId,
        navigatorUserId: roles.navigatorUserId,
        navigatorUserIds: roles.navigatorUserIds,
        rolesUpdatedAt: roles.pairReady ? new Date() : null,
      },
    },
    { new: true },
  ).lean();
  return updated || Workspace.findOne({ roomId }).lean();
}

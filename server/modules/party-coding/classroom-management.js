import { PARTY_MAX_STUDENTS, PARTY_MIN_STUDENTS } from "../../../shared/party-roles.js";

export const PAIR_CLASSROOM_STUDENT_LIMIT = PARTY_MAX_STUDENTS;

export function buildPairClassroomMonitoringFields(
  enabled,
  { now = new Date(), adminId = "" } = {},
) {
  const updatedAt = now instanceof Date ? now : new Date(now);
  return {
    paiaMonitoringEnabled: enabled === true,
    paiaMonitoringStartedAt: enabled === true ? updatedAt : null,
    paiaMonitoringUpdatedAt: updatedAt,
    paiaMonitoringUpdatedByAdminId: String(adminId || "").trim(),
  };
}

export function normalizePairClassroomStudentUserIds(
  rawUserIds,
  { sanitizeId = (value) => String(value || "").trim() } = {},
) {
  return Array.from(
    new Set(
      (Array.isArray(rawUserIds) ? rawUserIds : [])
        .map((item) => sanitizeId(item, ""))
        .filter(Boolean),
    ),
  );
}

export function validatePairClassroomStudentUserIds(
  rawUserIds,
  {
    sanitizeId,
    isValidUserId = (value) => Boolean(String(value || "").trim()),
  } = {},
) {
  const userIds = normalizePairClassroomStudentUserIds(rawUserIds, {
    ...(typeof sanitizeId === "function" ? { sanitizeId } : {}),
  });
  const valid =
    userIds.length >= PARTY_MIN_STUDENTS && userIds.length <= PAIR_CLASSROOM_STUDENT_LIMIT &&
    userIds.every((userId) => isValidUserId(userId));
  return {
    valid,
    userIds,
    error: valid ? "" : "请选择 2～3 名不同的有效学生。",
  };
}

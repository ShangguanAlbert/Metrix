import { withAuthSlot } from "../../app/authStorage.js";
import { withAppBasePath, withBasePath } from "../../app/basePath.js";

export function buildTeachingSessionHref(lessonId, slot, basePath = "") {
  const safeLessonId = String(lessonId || "").trim();
  if (!safeLessonId) return "";
  const routePath = withAuthSlot(
    `/admin/classroom/teaching/${encodeURIComponent(safeLessonId)}`,
    slot,
  );
  const explicitBasePath = String(basePath || "").trim();
  if (explicitBasePath) {
    return withBasePath(routePath, explicitBasePath);
  }
  return withAppBasePath(routePath);
}

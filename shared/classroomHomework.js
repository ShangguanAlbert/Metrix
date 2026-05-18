export const CLASSROOM_HOMEWORK_REQUIREMENT_MAX_LENGTH = 500;
export const CLASSROOM_HOMEWORK_REQUIREMENT_EMPTY_TEXT =
  "教师暂未填写作业要求说明。";
export const CLASSROOM_HOMEWORK_DIRECTORY_UPLOAD_ERROR =
  "不支持上传文件夹，请先压缩为 zip、rar 或 7z 后再上传。";

export function normalizeClassroomHomeworkRequirementText(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, CLASSROOM_HOMEWORK_REQUIREMENT_MAX_LENGTH);
}

export function resolveClassroomHomeworkRequirementText(value) {
  const normalized = normalizeClassroomHomeworkRequirementText(value);
  return normalized || CLASSROOM_HOMEWORK_REQUIREMENT_EMPTY_TEXT;
}

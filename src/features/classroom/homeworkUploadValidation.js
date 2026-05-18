import { CLASSROOM_HOMEWORK_DIRECTORY_UPLOAD_ERROR } from "../../../shared/classroomHomework.js";

function isUsableHomeworkFile(file) {
  return (
    file &&
    typeof file === "object" &&
    typeof file.name === "string" &&
    Number(file.size) > 0
  );
}

function selectionContainsDirectoryItem(items = []) {
  return Array.from(items || []).some((item) => {
    if (!item || typeof item.webkitGetAsEntry !== "function") return false;
    try {
      return item.webkitGetAsEntry()?.isDirectory === true;
    } catch {
      return false;
    }
  });
}

function selectionContainsRelativePathFile(files = []) {
  return Array.from(files || []).some((file) =>
    String(file?.webkitRelativePath || "").trim(),
  );
}

export { CLASSROOM_HOMEWORK_DIRECTORY_UPLOAD_ERROR };

export function analyzeHomeworkFileSelection({ files = [], items = [] } = {}) {
  if (
    selectionContainsDirectoryItem(items) ||
    selectionContainsRelativePathFile(files)
  ) {
    return {
      files: [],
      error: CLASSROOM_HOMEWORK_DIRECTORY_UPLOAD_ERROR,
    };
  }

  return {
    files: Array.from(files || []).filter(isUsableHomeworkFile),
    error: "",
  };
}

import {
  SHANGGUAN_FUZE_TEACHER_SCOPE_KEY,
  sanitizeTeacherScopeKey,
} from "./teacherScopes.js";

export const FIXED_STUDENT_ACCOUNT_TAG = "fixed-student";
export const FIXED_STUDENT_REQUIRED_TEACHER_SCOPE_KEY = sanitizeTeacherScopeKey(
  SHANGGUAN_FUZE_TEACHER_SCOPE_KEY,
);
const FIXED_STUDENT_DEFAULT_CLASS_NAME = "教技231";
const FIXED_STUDENT_DEFAULT_GRADE = "8年级";

function sanitizeBoundedText(value, maxLength = 64, fallback = "") {
  const trimmed = String(value || "").trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, Math.max(1, maxLength));
}

function normalizeFixedStudentUsername(value) {
  const username = sanitizeBoundedText(value, 64, "");
  if (!username) return "";
  if (username.length < 2) return "";
  if (/\s/.test(username)) return "";
  return username;
}

function normalizeFixedStudentId(value) {
  const studentId = sanitizeBoundedText(value, 20, "");
  if (!studentId) return "";
  if (!/^\d{1,20}$/.test(studentId)) return "";
  return studentId;
}

function readRawFixedStudentAccountsFromRuntimeEnv() {
  try {
    const viteRaw = sanitizeBoundedText(import.meta?.env?.VITE_FIXED_STUDENT_ACCOUNTS, 200000, "");
    if (viteRaw) return viteRaw;
  } catch {
    return "";
  }
  const processEnv = globalThis?.process?.env;
  if (processEnv) {
    return sanitizeBoundedText(processEnv.FIXED_STUDENT_ACCOUNTS, 200000, "");
  }
  return "";
}

export function parseFixedStudentAccounts(raw, options = {}) {
  const {
    defaultTeacherScopeKey = FIXED_STUDENT_REQUIRED_TEACHER_SCOPE_KEY,
    defaultClassName = FIXED_STUDENT_DEFAULT_CLASS_NAME,
    defaultGrade = FIXED_STUDENT_DEFAULT_GRADE,
    warningLabel = "FIXED_STUDENT_ACCOUNTS",
    onWarning = null,
  } = options;

  const source = sanitizeBoundedText(raw, 200000, "");
  if (!source) return [];

  let parsed = null;
  try {
    parsed = JSON.parse(source);
  } catch {
    if (typeof onWarning === "function") {
      onWarning(
        `[auth] ${warningLabel} 解析失败：请使用 JSON 数组（例如 [{"username":"张三","studentId":"20260001","className":"教技231"}]）。`,
      );
    }
    return [];
  }

  let sourceAccounts = [];
  if (Array.isArray(parsed)) {
    sourceAccounts = parsed;
  } else if (parsed && typeof parsed === "object") {
    const groupedAccounts = [];
    Object.entries(parsed).forEach(([groupClassName, groupValue]) => {
      const classNameFromKey = sanitizeBoundedText(groupClassName, 40, "");
      const list = Array.isArray(groupValue)
        ? groupValue
        : Array.isArray(groupValue?.students)
          ? groupValue.students
          : [];
      list.forEach((entry) => {
        groupedAccounts.push({
          ...entry,
          className: sanitizeBoundedText(entry?.className, 40, classNameFromKey),
        });
      });
    });
    sourceAccounts = groupedAccounts;
  } else {
    if (typeof onWarning === "function") {
      onWarning(`[auth] ${warningLabel} 无效：必须是 JSON 数组或按班级分组的 JSON 对象。`);
    }
    return [];
  }

  const teacherScopeKey = sanitizeTeacherScopeKey(
    defaultTeacherScopeKey || FIXED_STUDENT_REQUIRED_TEACHER_SCOPE_KEY,
  );
  const classNameFallback = sanitizeBoundedText(defaultClassName, 40, FIXED_STUDENT_DEFAULT_CLASS_NAME);
  const gradeFallback = sanitizeBoundedText(defaultGrade, 20, FIXED_STUDENT_DEFAULT_GRADE);
  const deduped = new Map();

  sourceAccounts.forEach((item) => {
    const username = normalizeFixedStudentUsername(item?.username);
    const studentId = normalizeFixedStudentId(item?.studentId);
    const password = sanitizeBoundedText(item?.password || studentId, 128, "");
    if (!username || !studentId || !password) return;

    const className = sanitizeBoundedText(item?.className, 40, classNameFallback);
    const grade = sanitizeBoundedText(item?.grade, 20, gradeFallback);
    const requiredTeacherScopeKey = sanitizeTeacherScopeKey(
      item?.requiredTeacherScopeKey || teacherScopeKey,
    );
    if (!requiredTeacherScopeKey) return;

    const usernameKey = username.toLowerCase();
    if (!usernameKey || deduped.has(usernameKey)) return;

    deduped.set(
      usernameKey,
      Object.freeze({
        username,
        password,
        className,
        grade,
        studentId,
        requiredTeacherScopeKey,
      }),
    );
  });

  return Array.from(deduped.values());
}

export const FIXED_STUDENT_ACCOUNTS = Object.freeze(
  parseFixedStudentAccounts(readRawFixedStudentAccountsFromRuntimeEnv()),
);

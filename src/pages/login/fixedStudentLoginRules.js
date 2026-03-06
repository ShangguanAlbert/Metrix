import { sanitizeTeacherScopeKey } from "../../../shared/teacherScopes.js";

export const FIXED_STUDENT_LOGIN_REQUIRED_TEACHER_SCOPE_KEY = sanitizeTeacherScopeKey(
  "yang-junfeng",
);

export const FIXED_STUDENT_LOGIN_RULES = Object.freeze([
  { username: "凌磊", studentId: "2023211003002" },
  { username: "戚展研", studentId: "2023211003003" },
  { username: "易杭", studentId: "2023211003004" },
  { username: "金赫洋", studentId: "2023211003005" },
  { username: "周媛婷", studentId: "2023211003006" },
  { username: "朱思仪", studentId: "2023211003007" },
  { username: "杜依米", studentId: "2023211003008" },
  { username: "周俊宇", studentId: "2023211003009" },
  { username: "黄鼎翰", studentId: "2023211003010" },
  { username: "郑煜婷", studentId: "2023211003011" },
  { username: "胡英杰", studentId: "2023211003012" },
  { username: "史秦恺", studentId: "2023211003013" },
  { username: "钱毅澄", studentId: "2023211003014" },
  { username: "季晨曦", studentId: "2023211003015" },
  { username: "林楚楚", studentId: "2023211003016" },
  { username: "季宗炫", studentId: "2023211003017" },
  { username: "王乐怡", studentId: "2023211003018" },
  { username: "林一宇", studentId: "2023211003019" },
  { username: "周子玥", studentId: "2023211003020" },
  { username: "袁过婷", studentId: "2023211003021" },
  { username: "赵诚", studentId: "2023211003022" },
  { username: "张依楠", studentId: "2023211003023" },
  { username: "葛灵玥", studentId: "2023211003024" },
  { username: "叶轩", studentId: "2023211003025" },
  { username: "郭煌磊", studentId: "2023211003026" },
  { username: "蔡锦宏", studentId: "2023211003027" },
  { username: "颜赵奇", studentId: "2023211003028" },
  { username: "周晓勇", studentId: "2023211003029" },
  { username: "李敏豪", studentId: "2023211003030" },
  { username: "陈柄旭", studentId: "2023211003031" },
  { username: "徐浩", studentId: "2023211003032" },
  { username: "熊乐恩", studentId: "2023211003033" },
  { username: "洪嘉毅", studentId: "2023211003034" },
  { username: "徐健翔", studentId: "2023211003035" },
  { username: "李泓霄", studentId: "2023211003036" },
  { username: "颜煖熔", studentId: "2023211003037" },
  { username: "杨旺旭", studentId: "2023211003040" },
].map((item) =>
  Object.freeze({
    ...item,
    usernameKey: String(item.username || "")
      .trim()
      .toLowerCase(),
    requiredTeacherScopeKey: FIXED_STUDENT_LOGIN_REQUIRED_TEACHER_SCOPE_KEY,
  }),
));

export function findFixedStudentLoginRuleByUsername(username) {
  const usernameKey = String(username || "")
    .trim()
    .toLowerCase();
  if (!usernameKey) return null;
  return FIXED_STUDENT_LOGIN_RULES.find((item) => item.usernameKey === usernameKey) || null;
}

export function resolveFixedStudentTeacherScopeKeyByUsername(username) {
  return findFixedStudentLoginRuleByUsername(username)?.requiredTeacherScopeKey || "";
}

import { sanitizeTeacherScopeKey } from "./teacherScopes.js";

export const FIXED_STUDENT_ACCOUNT_TAG = "fixed-student";
export const FIXED_STUDENT_REQUIRED_TEACHER_SCOPE_KEY = sanitizeTeacherScopeKey("yang-junfeng");

export const FIXED_STUDENT_ACCOUNTS = Object.freeze([
  { username: "凌磊", password: "2023211003002", className: "教技231", studentId: "2023211003002" },
  { username: "戚展研", password: "2023211003003", className: "教技231", studentId: "2023211003003" },
  { username: "易杭", password: "2023211003004", className: "教技231", studentId: "2023211003004" },
  { username: "金赫洋", password: "2023211003005", className: "教技231", studentId: "2023211003005" },
  { username: "周媛婷", password: "2023211003006", className: "教技231", studentId: "2023211003006" },
  { username: "朱思仪", password: "2023211003007", className: "教技231", studentId: "2023211003007" },
  { username: "杜依米", password: "2023211003008", className: "教技231", studentId: "2023211003008" },
  { username: "周俊宇", password: "2023211003009", className: "教技231", studentId: "2023211003009" },
  { username: "黄鼎翰", password: "2023211003010", className: "教技231", studentId: "2023211003010" },
  { username: "郑煜婷", password: "2023211003011", className: "教技231", studentId: "2023211003011" },
  { username: "胡英杰", password: "2023211003012", className: "教技231", studentId: "2023211003012" },
  { username: "史秦恺", password: "2023211003013", className: "教技231", studentId: "2023211003013" },
  { username: "钱毅澄", password: "2023211003014", className: "教技231", studentId: "2023211003014" },
  { username: "季晨曦", password: "2023211003015", className: "教技231", studentId: "2023211003015" },
  { username: "林楚楚", password: "2023211003016", className: "教技231", studentId: "2023211003016" },
  { username: "季宗炫", password: "2023211003017", className: "教技231", studentId: "2023211003017" },
  { username: "王乐怡", password: "2023211003018", className: "教技231", studentId: "2023211003018" },
  { username: "林一宇", password: "2023211003019", className: "教技231", studentId: "2023211003019" },
  { username: "周子玥", password: "2023211003020", className: "教技231", studentId: "2023211003020" },
  { username: "袁过婷", password: "2023211003021", className: "教技231", studentId: "2023211003021" },
  { username: "赵诚", password: "2023211003022", className: "教技231", studentId: "2023211003022" },
  { username: "张依楠", password: "2023211003023", className: "教技231", studentId: "2023211003023" },
  { username: "葛灵玥", password: "2023211003024", className: "教技231", studentId: "2023211003024" },
  { username: "叶轩", password: "2023211003025", className: "教技231", studentId: "2023211003025" },
  { username: "郭煌磊", password: "2023211003026", className: "教技231", studentId: "2023211003026" },
  { username: "蔡锦宏", password: "2023211003027", className: "教技231", studentId: "2023211003027" },
  { username: "颜赵奇", password: "2023211003028", className: "教技231", studentId: "2023211003028" },
  { username: "周晓勇", password: "2023211003029", className: "教技231", studentId: "2023211003029" },
  { username: "李敏豪", password: "2023211003030", className: "教技231", studentId: "2023211003030" },
  { username: "陈柄旭", password: "2023211003031", className: "教技231", studentId: "2023211003031" },
  { username: "徐浩", password: "2023211003032", className: "教技231", studentId: "2023211003032" },
  { username: "熊乐恩", password: "2023211003033", className: "教技231", studentId: "2023211003033" },
  { username: "洪嘉毅", password: "2023211003034", className: "教技231", studentId: "2023211003034" },
  { username: "徐健翔", password: "2023211003035", className: "教技231", studentId: "2023211003035" },
  { username: "李泓霄", password: "2023211003036", className: "教技231", studentId: "2023211003036" },
  { username: "颜煖熔", password: "2023211003037", className: "教技231", studentId: "2023211003037" },
  { username: "杨旺旭", password: "2023211003040", className: "教技231", studentId: "2023211003040" },
].map((item) =>
  Object.freeze({
    ...item,
    requiredTeacherScopeKey: FIXED_STUDENT_REQUIRED_TEACHER_SCOPE_KEY,
  }),
));

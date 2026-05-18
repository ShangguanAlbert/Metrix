import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const teacherHomePagePath = path.resolve("src/pages/TeacherHomePage.jsx");
const teacherHomePageSource = fs.readFileSync(teacherHomePagePath, "utf8");

test("teacher homework requirement editor does not render the helper subtext line", () => {
  assert.doesNotMatch(
    teacherHomePageSource,
    /学生会在课堂任务、提交作业弹窗和历史作业中看到这段说明/,
  );
});

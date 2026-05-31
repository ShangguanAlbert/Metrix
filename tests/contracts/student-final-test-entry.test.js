import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const modeSelectionPagePath = path.resolve("src/pages/ModeSelectionPage.jsx");
const finalTestCssPath = path.resolve("src/styles/final-test.css");
const teacherHomePagePath = path.resolve("src/pages/TeacherHomePage.jsx");
const studentFinalTestPanelPath = path.resolve(
  "src/features/classroom/components/StudentFinalTestPanel.jsx",
);

const modeSelectionPageSource = fs.readFileSync(modeSelectionPagePath, "utf8");
const finalTestCssSource = fs.readFileSync(finalTestCssPath, "utf8");
const teacherHomePageSource = fs.readFileSync(teacherHomePagePath, "utf8");
const studentFinalTestPanelSource = fs.readFileSync(
  studentFinalTestPanelPath,
  "utf8",
);

test("student mode selection exposes the final test entry and panel", () => {
  assert.match(modeSelectionPageSource, /label:\s*"期末测试"/);
  assert.match(modeSelectionPageSource, /key:\s*"final-test"/);
  assert.match(modeSelectionPageSource, /StudentFinalTestPanel/);
});

test("final test stylesheet keeps the UI square", () => {
  assert.match(finalTestCssSource, /border-radius:\s*0\s*!important;/);
});

test("teacher home exposes a final test sidebar entry and editor panel", () => {
  assert.match(teacherHomePageSource, /key:\s*"final-test"/);
  assert.match(teacherHomePageSource, /label:\s*"期末测试"/);
  assert.match(teacherHomePageSource, /saveAdminFinalTestConfig/);
  assert.match(teacherHomePageSource, /添加任务/);
});

test("student final test panel reads teacher-authored final test content", () => {
  assert.match(studentFinalTestPanelSource, /taskSettings\?\.finalTestConfig/);
});

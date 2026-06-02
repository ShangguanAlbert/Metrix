import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { normalizeFinalTestContentConfig } from "../../shared/finalTestContent.js";

const teacherHomePagePath = path.resolve("src/pages/TeacherHomePage.jsx");
const teacherHomeStylesPath = path.resolve("src/styles/teacher-home.css");

const teacherHomePageSource = fs.readFileSync(teacherHomePagePath, "utf8");
const teacherHomeStylesSource = fs.readFileSync(teacherHomeStylesPath, "utf8");

test("teacher final test panel keeps the preview column pinned to viewport height", () => {
  assert.match(teacherHomePageSource, /teacher-final-test-stack/);
  assert.match(teacherHomeStylesSource, /\.teacher-final-test-stack\s*\{/);
  assert.match(teacherHomeStylesSource, /\.teacher-final-test-columns\s*\{/);
  assert.match(teacherHomeStylesSource, /@media\s*\(min-width:\s*1081px\)[\s\S]*?\.teacher-final-test-stack\s*\{[\s\S]*?height:\s*100%;[\s\S]*?\}/);
  assert.match(teacherHomeStylesSource, /@media\s*\(min-width:\s*1081px\)[\s\S]*?\.teacher-final-test-preview-card\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;[\s\S]*?\}/);
  assert.match(teacherHomeStylesSource, /@media\s*\(min-width:\s*1081px\)[\s\S]*?\.teacher-final-test-preview\s*\{[\s\S]*?overflow-y:\s*auto;[\s\S]*?\}/);
});

test("teacher final test editor uses a single-line input for intro text", () => {
  assert.match(
    teacherHomePageSource,
    /<span>顶部说明<\/span>[\s\S]*?<input[\s\S]*?type="text"[\s\S]*?value=\{finalTestConfig\.introText\}/,
  );
});

test("final test block text normalization preserves trailing spaces and newlines", () => {
  const normalized = normalizeFinalTestContentConfig({
    introText: "说明文字",
    tasks: [
      {
        id: "task-1",
        title: "任务 1",
        description: "第一行 \n第二行\n",
        mode: "platform",
      },
    ],
  });

  assert.equal(normalized.tasks[0].description, "第一行 \n第二行\n");
});

test("teacher final test layout keeps the editing surface compact", () => {
  assert.match(
    teacherHomeStylesSource,
    /\.teacher-final-test-columns\s*\{[^}]*gap:\s*10px;/,
  );
  assert.match(
    teacherHomeStylesSource,
    /\.teacher-final-test-card,\s*\n\.teacher-final-test-preview-card\s*\{[^}]*gap:\s*8px;/,
  );
  assert.match(
    teacherHomeStylesSource,
    /\.teacher-full-row\s*\{[^}]*margin-top:\s*8px;/,
  );
  assert.match(
    teacherHomeStylesSource,
    /\.teacher-final-test-task-list\s*\{[^}]*gap:\s*8px;/,
  );
  assert.match(
    teacherHomeStylesSource,
    /\.teacher-final-test-task-item\s*\{[^}]*padding:\s*12px;/,
  );
  assert.match(
    teacherHomeStylesSource,
    /\.teacher-final-test-preview\s*\{[^}]*padding:\s*12px;/,
  );
  assert.doesNotMatch(teacherHomeStylesSource, /\.teacher-final-test-columns\s*\{[^}]*gap:\s*14px;/);
  assert.doesNotMatch(teacherHomeStylesSource, /\.teacher-final-test-task-list\s*\{[^}]*gap:\s*12px;/);
  assert.doesNotMatch(teacherHomeStylesSource, /\.teacher-final-test-preview\s*\{[^}]*padding:\s*14px;/);
});

test("export center exposes final test export controls with class filtering", () => {
  assert.match(teacherHomePageSource, /<span>期末测试班级<\/span>/);
  assert.match(teacherHomePageSource, /exportCenterFinalTestClassName/);
  assert.match(teacherHomePageSource, /导出期末测试痕迹（ZIP 含 Excel）/);
});

test("teacher final test panel exposes a submissions toggle and homework-style roster grid", () => {
  assert.match(teacherHomePageSource, /编辑内容/);
  assert.match(teacherHomePageSource, /提交情况/);
  assert.match(teacherHomePageSource, /全班名单（已交/);
  assert.match(teacherHomePageSource, /交卷状态/);
  assert.match(teacherHomePageSource, /当前步骤/);
  assert.match(teacherHomePageSource, /finalTestSubmissionDisplayMode/);
  assert.match(teacherHomePageSource, /finalTestSubmissionClasses/);
  assert.match(teacherHomePageSource, /fetchAdminFinalTestSubmissions/);
  assert.match(teacherHomePageSource, /teacher-homework-card-grid/);
  assert.match(teacherHomePageSource, /teacher-homework-student-card/);
  assert.doesNotMatch(teacherHomePageSource, /按班级查看全班名单与交卷进度/);
  assert.doesNotMatch(teacherHomePageSource, />显示内容</);
  assert.doesNotMatch(teacherHomePageSource, />查看班级</);
  assert.doesNotMatch(teacherHomePageSource, /teacher-final-test-status-summary/);
  assert.doesNotMatch(teacherHomePageSource, /应测学生/);
  assert.doesNotMatch(teacherHomePageSource, /谁已提交/);
  assert.doesNotMatch(teacherHomePageSource, /谁未提交/);
});

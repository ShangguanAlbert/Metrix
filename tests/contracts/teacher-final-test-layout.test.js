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

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const studentHomeStylesPath = path.resolve("src/styles/student-home.css");
const studentHomeStyles = fs.readFileSync(studentHomeStylesPath, "utf8");

test("student lesson active card keeps only an ambient shadow without a downward drop shadow", () => {
  assert.match(
    studentHomeStyles,
    /\.student-home-page \.teacher-lesson-row\.active\s*\{[\s\S]*?box-shadow:\s*[\s\S]*?0 0 18px rgba\(95, 74, 56, 0\.05\);[\s\S]*?\}/,
  );
  assert.doesNotMatch(studentHomeStyles, /0 10px 24px rgba\(95, 74, 56, 0\.06\)/);
});

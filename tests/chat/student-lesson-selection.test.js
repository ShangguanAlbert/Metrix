import assert from "node:assert/strict";
import test from "node:test";
import { reconcileStudentLessons } from "../../src/features/classroom/studentLessonSelection.js";

const old = { id: "old", courseStartAt: "2026-10-20", publishedAt: "2026-10-07" };
const current = { id: "current", courseStartAt: "2026-10-01", publishedAt: "2026-10-08" };

test("学生默认显示最近发布课时，开课时间较晚的旧任务不会抢占", () => {
  const state = reconcileStudentLessons({}, [old, current]);
  assert.equal(state.selectedId, "current");
  assert.deepEqual(state.lessons.map((lesson) => lesson.id), ["current", "old"]);
});

test("普通轮询保留手选历史课时；新发布或重新发布后切换到最新任务", () => {
  const previous = { ...reconcileStudentLessons({}, [old, current]), selectedId: "old" };
  assert.equal(reconcileStudentLessons(previous, [current, old]).selectedId, "old");
  const republished = { ...current, publishedAt: "2026-10-09" };
  assert.equal(reconcileStudentLessons(previous, [old, republished]).selectedId, "current");
  const third = { id: "third", publishedAt: "2026-10-10" };
  assert.equal(reconcileStudentLessons(previous, [current, old, third]).selectedId, "third");
});

test("关闭或删除当前课时后切换到仍开放课时，没有任务时清空选择", () => {
  const previous = reconcileStudentLessons({}, [old, current]);
  assert.equal(reconcileStudentLessons(previous, [old]).selectedId, "old");
  assert.deepEqual(reconcileStudentLessons(previous, []), { lessons: [], selectedId: "", publicationKey: "" });
});

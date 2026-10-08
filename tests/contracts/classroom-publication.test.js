import assert from "node:assert/strict";
import test from "node:test";
import { latestPublishedClassroomLesson, publishedClassroomTaskText, readStudentLesson, lessonHasUnpublishedChanges, lessonSnapshot, preserveLessonPublication, publishedLessonFileIds, readPublishedLesson } from "../../shared/classroomPublication.js";

const original = { id: "lesson", courseName: "第1节课", enabled: true, tasks: [{ id: "task", content: "原任务", files: [{ id: "file-old" }] }], files: [], updatedAt: "2026-09-21T01:00:00.000Z" };

test("saving a new lesson creates a private draft until explicitly published", () => {
  const draft = { ...original, publication: preserveLessonPublication(null) };
  assert.equal(readPublishedLesson(draft), null);
  const published = { ...draft, publication: { publishedAt: "now", snapshot: lessonSnapshot(draft) } };
  assert.equal(readPublishedLesson(published).courseName, "第1节课");
  assert.equal(Object.hasOwn(published.publication.snapshot, "publication"), false);
});

test("legacy lesson first save freezes prior title, text and files; draft mutations cannot alter the snapshot", () => {
  const prior = structuredClone(original);
  const draft = { ...prior, courseName: "新课名", publication: preserveLessonPublication(prior) };
  draft.tasks[0].content = "新任务";
  draft.tasks[0].files = [];
  const visible = readPublishedLesson(draft);
  assert.equal(visible.courseName, "第1节课");
  assert.equal(visible.tasks[0].content, "原任务");
  assert.deepEqual([...publishedLessonFileIds(draft)], ["file-old"]);
  assert.equal(preserveLessonPublication(draft), draft.publication);
});

test("republish switches title, tasks and attachments together and can publish a closed state", () => {
  const draft = { ...original, courseName: "新课名", enabled: false, tasks: [], publication: preserveLessonPublication(original) };
  draft.publication = { publishedAt: "now", snapshot: lessonSnapshot(draft) };
  assert.equal(readPublishedLesson(draft).courseName, "新课名");
  assert.equal(readPublishedLesson(draft).enabled, false);
  assert.deepEqual([...publishedLessonFileIds(draft)], []);
});


test("publication status detects renamed drafts and ignores save timestamps and object key ordering", () => {
  const lesson = { ...original, publication: { snapshot: lessonSnapshot(original) } };
  assert.equal(lessonHasUnpublishedChanges(lesson), false);
  assert.equal(lessonHasUnpublishedChanges({ ...lesson, updatedAt: "new timestamp" }), false);
  assert.equal(lessonHasUnpublishedChanges({ ...lesson, courseName: "新名称" }), true);
  assert.equal(lessonHasUnpublishedChanges({ ...original, publication: { snapshot: null } }), true);
});

test("新小组与学生任务栏只读取本班最近发布内容，排除别班、未发布和关闭课时", () => {
  const snapshot = { ...original, className: "801班", announcement: "本班公告" };
  const lesson = { ...snapshot, announcement: "尚未发布的草稿", publication: { publishedAt: "2026-10-08", snapshot } };
  const selected = latestPublishedClassroomLesson([
    { ...snapshot, id: "other", className: "802班", createdAt: "2026-10-10" },
    { ...snapshot, id: "draft", publication: { snapshot: null } },
    { ...snapshot, id: "closed", enabled: false, createdAt: "2026-10-11" },
    lesson,
  ], "801班");
  assert.equal(selected.id, original.id);
  assert.equal(selected.publishedAt, "2026-10-08");
  assert.equal(publishedClassroomTaskText(selected), "本班公告\n原任务");
  assert.equal(readStudentLesson({ publication: { snapshot: null } }), null);
  assert.equal(latestPublishedClassroomLesson([lesson], "803班"), null);
  assert.equal(publishedClassroomTaskText(null), "");
});

test("同一秒内的 Mongo Date 发布时间保留毫秒精度", () => {
  const lessons = [100, 900].map((milliseconds, index) => ({
    id: String(index),
    publication: {
      publishedAt: new Date(Date.UTC(2026, 9, 8, 1, 0, 0, milliseconds)),
      snapshot: { id: String(index), className: "801班", enabled: true },
    },
  }));
  assert.equal(latestPublishedClassroomLesson(lessons, "801班").id, "1");
});

import assert from "node:assert/strict";
import test from "node:test";
import { lessonHasUnpublishedChanges, lessonSnapshot, preserveLessonPublication, publishedLessonFileIds, readPublishedLesson } from "../../shared/classroomPublication.js";

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

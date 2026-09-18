import test from "node:test";
import assert from "node:assert/strict";
import * as Y from "yjs";
import { ChangeSet } from "@codemirror/state";
import { initializeExercise, resolveExerciseRanges, validateExerciseUpdate, exerciseSnapshot, EXERCISE_MAP } from "../../shared/party-exercise.js";
import { normalizeProgrammingTemplate } from "../../shared/party-template.js";
import { changesStayInRanges } from "../../src/features/classroom/coding/exerciseEditor.js";

const template = { editMode: "fill", html: '<h1>____</h1><p>____</p>', css: 'h1 { color: ____; }', editableRanges: { html: [{ id: "a", from: 4, to: 8 }, { id: "b", from: 16, to: 20 }], css: [{ id: "c", from: 12, to: 16 }] } };
function create() {
  const doc = new Y.Doc();
  doc.getText("html").insert(0, template.html); doc.getText("css").insert(0, template.css);
  initializeExercise(doc, template, "v1");
  return doc;
}
function proposal(doc, change) {
  const next = new Y.Doc(); Y.applyUpdate(next, Y.encodeStateAsUpdate(doc));
  const updates = []; next.on("update", (update) => updates.push(update));
  next.transact(() => change(next));
  const update = Y.mergeUpdates(updates); next.destroy(); return update;
}

test("填写区允许替换、清空后继续填写、多空和 CSS，锁定部分不可改", () => {
  const doc = create();
  const update = proposal(doc, (next) => { next.getText("html").delete(4, 4); next.getText("html").insert(4, "学生标题🌱"); });
  assert.equal(validateExerciseUpdate(doc, update), true); Y.applyUpdate(doc, update);
  assert.equal(resolveExerciseRanges(doc, "html")[1].from, 18);
  const empty = proposal(doc, (next) => { const r = resolveExerciseRanges(next, "html")[0]; next.getText("html").delete(r.from, r.to - r.from); });
  assert.equal(validateExerciseUpdate(doc, empty), true); Y.applyUpdate(doc, empty);
  assert.deepEqual(resolveExerciseRanges(doc, "html")[0], { id: "a", from: 4, to: 4 });
  const refill = proposal(doc, (next) => next.getText("html").insert(4, "新标题"));
  assert.equal(validateExerciseUpdate(doc, refill), true); Y.applyUpdate(doc, refill);
  const bad = proposal(doc, (next) => next.getText("html").delete(0, 1));
  assert.equal(validateExerciseUpdate(doc, bad), false);
  const css = proposal(doc, (next) => { next.getText("css").delete(12, 4); next.getText("css").insert(12, "red"); });
  assert.equal(validateExerciseUpdate(doc, css), true);
  const crossed = proposal(doc, (next) => next.getText("html").delete(4, 10));
  assert.equal(validateExerciseUpdate(doc, crossed), false);
  doc.destroy();
});

test("整个文件未设空时不可编辑；不能篡改锁定规则；序列化后保护仍有效", () => {
  const doc = create();
  const attempt = proposal(doc, (next) => next.getMap(EXERCISE_MAP).delete("definition"));
  assert.equal(validateExerciseUpdate(doc, attempt), false);
  const stored = new Y.Doc(); Y.applyUpdate(stored, Y.encodeStateAsUpdate(doc));
  assert.deepEqual(exerciseSnapshot(stored), exerciseSnapshot(doc));
  const untouched = new Y.Doc(); untouched.getText("html").insert(0, "固定内容");
  initializeExercise(untouched, { editMode: "fill", editableRanges: {} }, "v2");
  assert.equal(validateExerciseUpdate(untouched, proposal(untouched, (next) => next.getText("html").insert(0, "x"))), false);
  doc.destroy(); stored.destroy(); untouched.destroy();
});

test("前端拒绝跨区删除/全选替换，允许在填写区两端插入及多处独立填写", () => {
  const ranges = template.editableRanges.html;
  assert.equal(changesStayInRanges(ChangeSet.of({ from: 4, to: 8, insert: "标题" }, template.html.length), ranges), true);
  assert.equal(changesStayInRanges(ChangeSet.of({ from: 8, insert: "!" }, template.html.length), ranges), true);
  assert.equal(changesStayInRanges(ChangeSet.of({ from: 0, to: template.html.length, insert: "x" }, template.html.length), ranges), false);
  assert.equal(changesStayInRanges(ChangeSet.of([{ from: 4, to: 8, insert: "A" }, { from: 16, to: 20, insert: "B" }], template.html.length), ranges), true);
});

test("旧模板仍为自由编程，非法或相交的填写区被归一化", () => {
  assert.equal(normalizeProgrammingTemplate({ html: "hello" }).editMode, "free");
  const normalized = normalizeProgrammingTemplate({ html: "123456789", editMode: "fill", editableRanges: { html: [{ id: "a", from: 1, to: 4 }, { from: 3, to: 5 }, { from: -1, to: 2 }, { from: 7, to: 40 }] } });
  assert.deepEqual(normalized.editableRanges.html, [{ id: "a", from: 1, to: 4 }]);
});

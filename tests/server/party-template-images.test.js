import test from "node:test";
import assert from "node:assert/strict";
import { buildPublishedTemplate } from "../../server/modules/party-coding/template-service.js";
import { detectImageFormat } from "../../server/modules/party-coding/image-routes.js";
import { findImageSourceAtSelection, parsePartyImagePath } from "../../shared/party-images.js";

test("模板版本由代码内容确定，重复发布不制造新版本", () => {
  const lesson = { id: "lesson", courseId: "course", programmingTemplate: { html: "<p>文本</p>", css: "p { color: red; }" } };
  const first = buildPublishedTemplate(lesson, "teacher", new Date(0));
  const repeated = buildPublishedTemplate(lesson, "teacher", new Date(1000));
  assert.equal(first.version, repeated.version);
  const edited = buildPublishedTemplate({ ...lesson, programmingTemplate: { ...lesson.programmingTemplate, html: "<p>新的文本</p>" } }, "teacher");
  assert.notEqual(first.version, edited.version);
});

test("图片插入定位保留引号、其他属性和标签，不选中 data-src 或注释", () => {
  for (const value of ['<img alt="a > b" src="old.png" width="20">', "<img data-src='ignored.png' src='old.png'>", "<img src=old.png>"]) {
    const target = findImageSourceAtSelection(value, value.indexOf("old.png") + 2);
    assert.equal(target.value, "old.png");
    assert.equal(value.slice(target.from, target.to), "old.png");
    const patched = value.slice(0, target.from) + "assets/012345678901234567890123.png" + value.slice(target.to);
    assert.equal(patched, value.replace("old.png", "assets/012345678901234567890123.png"));
  }
  const empty = '<img src="">';
  assert.deepEqual(findImageSourceAtSelection(empty, 10), { from: 10, to: 10, value: "" });
  assert.equal(findImageSourceAtSelection('<!-- <img src="x"> -->', 14), null);
  assert.equal(findImageSourceAtSelection('<img data-src="x">', 10), null);
});

test("素材路径仅接受当前素材格式，图片格式按文件内容识别", () => {
  assert.equal(parsePartyImagePath("assets/012345678901234567890123.png").id, "012345678901234567890123");
  for (const value of ["file:///test.png", "assets/../secret.png", "https://example.com/x.png", "assets/012345678901234567890123.svg"]) assert.equal(parsePartyImagePath(value), null);
  assert.deepEqual(detectImageFormat(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), { mime: "image/png", extension: "png" });
  assert.equal(detectImageFormat(Buffer.from('<svg onload="alert(1)"></svg>')), null);
  assert.equal(detectImageFormat(Buffer.alloc(7 * 1024 * 1024)), null);
});

test("published lesson rename updates template label without changing template code or version", async () => {
  const { readRoomTemplate } = await import("../../server/modules/party-coding/template-service.js");
  const template = { lessonId: "lesson", lessonName: "第1节课", version: "same-code", html: "<p>模板</p>", css: "", publishedAt: "2026-09-21" };
  const deps = {
    Template: { findOne: () => ({ sort() { return this; }, lean: async () => template }) },
    AuthUser: { find: () => ({ lean: async () => [{ profile: { className: "801班" }, lockedTeacherScopeKey: "shi-gaojun" }] }) },
    AdminConfig: { findOne: () => ({ lean: async () => ({ teacherCoursePlans: [{ id: "lesson", courseName: "未发布草稿", publication: { snapshot: { courseName: "推荐卡制作" } } }] }) }) },
    memberUserIds: ["student"],
  };
  const result = await readRoomTemplate(deps);
  assert.equal(result.lessonName, "推荐卡制作");
  assert.equal(result.version, "same-code");
  assert.equal(result.html, "<p>模板</p>");
});

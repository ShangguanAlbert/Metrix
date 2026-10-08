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

test("published lesson rename updates template label without changing code or version", async () => {
  const { readRoomTemplate } = await import("../../server/modules/party-coding/template-service.js");
  const lesson = { id: "lesson", courseName: "第1节课", className: "测试班", programmingTemplate: { html: "<p>模板</p>" } };
  const template = buildPublishedTemplate(lesson, "teacher", new Date("2026-09-21T01:00:00Z"));
  const result = await readRoomTemplate(roomTemplateFixture({ template, lessons: [
    { ...lesson, courseName: "未发布草稿", publication: { publishedAt: "2026-09-22T01:00:00Z", snapshot: { ...lesson, courseName: "推荐卡制作" } } },
  ] }));
  assert.equal(result.lessonName, "推荐卡制作");
  assert.equal(result.version, template.version);
  assert.equal(result.html, "<p>模板</p>");
});

function roomTemplateFixture({ template = null, lessons = [], className = "测试班" } = {}) {
  return {
    Template: { find: () => ({ lean: async () => template ? [template] : [] }) },
    AuthUser: { find: () => ({ lean: async () => [
      { profile: { className }, lockedTeacherScopeKey: "shi-gaojun" },
    ] }) },
    AdminConfig: { findOne: () => ({ lean: async () => ({ teacherCoursePlans: lessons }) }) },
    memberUserIds: ["student"],
  };
}

for (const editMode of ["free", "fill"]) {
  test(`发布课时后学生读取本节课的 ${editMode} 代码和填写区，而非上节课模板`, async () => {
    const { readRoomTemplate } = await import("../../server/modules/party-coding/template-service.js");
    const programmingTemplate = { html: "<p>____</p>", css: "p { color: red; }", editMode,
      editableRanges: { html: [{ id: "title", from: 3, to: 7 }], css: [] } };
    const published = { id: "today", courseId: "course", className: "测试班", courseName: "今日练习", programmingTemplate };
    const result = await readRoomTemplate(roomTemplateFixture({
      template: { lessonId: "previous", lessonName: "上节课", html: "旧代码", version: "old", publishedAt: "2026-10-07T01:00:00.000Z" },
      lessons: [{ id: "previous" }, { ...published, programmingTemplate: { html: "未发布的新草稿" },
        publication: { publishedAt: "2026-10-08T01:00:00.000Z", snapshot: published } }],
    }));
    assert.equal(result.lessonId, "today");
    assert.equal(result.lessonName, "今日练习");
    assert.equal(result.html, programmingTemplate.html);
    assert.equal(result.css, programmingTemplate.css);
    assert.equal(result.editMode, editMode);
    assert.deepEqual(result.editableRanges, programmingTemplate.editableRanges);
    assert.equal(result.version, buildPublishedTemplate(published, "teacher").version);
  });
}

test("首次发布课时中的编程练习，无需另行发布模板也可供学生载入", async () => {
  const { readRoomTemplate } = await import("../../server/modules/party-coding/template-service.js");
  const snapshot = { id: "first", className: "测试班", courseName: "首课", programmingTemplate: { html: "<p>首课内容</p>" } };
  const result = await readRoomTemplate(roomTemplateFixture({ lessons: [
    { ...snapshot, publication: { publishedAt: "2026-10-08T01:00:00.000Z", snapshot } },
  ] }));
  assert.equal(result?.lessonId, "first");
  assert.equal(result?.html, "<p>首课内容</p>");
});

test("未发布草稿、其他班级、关闭或没有代码的课时不能替换已发布编程练习", async () => {
  const { readRoomTemplate } = await import("../../server/modules/party-coding/template-service.js");
  const template = { lessonId: "old", html: "已发布代码", version: "old-v1", publishedAt: "2026-10-07T01:00:00.000Z" };
  const result = await readRoomTemplate(roomTemplateFixture({ template, lessons: [
    { id: "old" },
    { id: "draft", className: "测试班", programmingTemplate: { html: "草稿代码" }, publication: { snapshot: null } },
    { id: "legacy", className: "测试班", programmingTemplate: { html: "旧课时未单独发布的代码" } },
    { id: "other", publication: { publishedAt: "2026-10-08T01:00:00.000Z", snapshot: { id: "other", className: "其他班", programmingTemplate: { html: "其他班代码" } } } },
    { id: "text-only", publication: { publishedAt: "2026-10-08T02:00:00.000Z", snapshot: { id: "text-only", className: "测试班", programmingTemplate: { html: "", css: "" } } } },
    { id: "closed", publication: { publishedAt: "2026-10-08T03:00:00.000Z", snapshot: { id: "closed", className: "测试班", enabled: false, programmingTemplate: { html: "关闭课时代码" } } } },
  ] }));
  assert.equal(result.lessonId, "old");
  assert.equal(result.html, "已发布代码");
});

test("单独重新发布的练习优先于较早的课时发布版本", async () => {
  const { readRoomTemplate } = await import("../../server/modules/party-coding/template-service.js");
  const snapshot = { id: "lesson", className: "测试班", courseName: "今日课时", programmingTemplate: { html: "之前发布的代码" } };
  const result = await readRoomTemplate(roomTemplateFixture({
    template: { lessonId: "lesson", lessonName: "独立发布练习", html: "单独重新发布的代码", version: "new-v2", publishedAt: "2026-10-08T02:00:00.000Z" },
    lessons: [{ ...snapshot, publication: { publishedAt: "2026-10-08T01:00:00.000Z", snapshot } }],
  }));
  assert.equal(result.html, "单独重新发布的代码");
  assert.equal(result.version, "new-v2");
  assert.equal(result.lessonName, "独立发布练习");
});

for (const action of ["close", "delete", "move-class", "remove-code"]) {
  test(`课时${action}后不再提供该课时的旧独立模板`, async () => {
    const { readRoomTemplate } = await import("../../server/modules/party-coding/template-service.js");
    const snapshot = { id: "lesson", className: "测试班", enabled: true, programmingTemplate: { html: "新代码" } };
    if (action === "close") snapshot.enabled = false;
    if (action === "move-class") snapshot.className = "其他班";
    if (action === "remove-code") snapshot.programmingTemplate = { html: "", css: "" };
    const result = await readRoomTemplate(roomTemplateFixture({
      template: { lessonId: "lesson", html: "旧独立代码", publishedAt: "2026-10-08T01:00:00Z" },
      lessons: action === "delete" ? [] : [{ id: "lesson", publication: { publishedAt: "2026-10-08T02:00:00Z", snapshot } }],
    }));
    assert.equal(result, null);
  });
}

test("关闭最新练习后仍可读取其他开放课时的独立模板", async () => {
  const { readRoomTemplate } = await import("../../server/modules/party-coding/template-service.js");
  const deps = roomTemplateFixture({ lessons: [
    { id: "older" },
    { id: "newer", publication: { publishedAt: "2026-10-08T03:00:00Z", snapshot: { enabled: false, className: "测试班" } } },
  ] });
  deps.Template.find = () => ({ lean: async () => [
    { lessonId: "newer", html: "已关闭", publishedAt: "2026-10-08T02:00:00Z" },
    { lessonId: "older", html: "仍开放", publishedAt: "2026-10-08T01:00:00Z" },
  ] });
  assert.equal((await readRoomTemplate(deps)).html, "仍开放");
});

test("只保存关闭草稿不会撤回已发布练习", async () => {
  const { readRoomTemplate } = await import("../../server/modules/party-coding/template-service.js");
  const result = await readRoomTemplate(roomTemplateFixture({
    template: { lessonId: "lesson", html: "学生仍可读取", publishedAt: "2026-10-08T02:00:00Z" },
    lessons: [{ id: "lesson", enabled: false, publication: { publishedAt: "2026-10-08T01:00:00Z", snapshot: { enabled: true, className: "测试班" } } }],
  }));
  assert.equal(result.html, "学生仍可读取");
});

test("MongoDB Date 保留毫秒，同一秒内较晚发布的独立练习优先", async () => {
  const { readRoomTemplate } = await import("../../server/modules/party-coding/template-service.js");
  const result = await readRoomTemplate(roomTemplateFixture({
    template: { lessonId: "lesson", lessonName: "刚发布练习", html: "新代码", publishedAt: new Date("2026-10-08T01:00:00.900Z") },
    lessons: [{ id: "lesson", publication: { publishedAt: "2026-10-08T01:00:00.100Z", snapshot: {
      id: "lesson", className: "测试班", courseName: "较早课时", programmingTemplate: { html: "旧代码" },
    } } }],
  }));
  assert.equal(result.html, "新代码");
  assert.equal(result.lessonName, "刚发布练习");
});

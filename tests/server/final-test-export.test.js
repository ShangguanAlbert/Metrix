import assert from "node:assert/strict";
import test from "node:test";
import XLSX from "xlsx";

import { buildFinalTestExportBundle } from "../../server/services/final-test-export.js";

test("buildFinalTestExportBundle emits chinese zip entries, workbook sheets, and student detail traces", () => {
  const bundle = buildFinalTestExportBundle(
    {
      teacherScopeKey: "shangguan-fuze",
      classNameFilter: "810班",
      exportedAt: "2026-06-01T08:00:00.000Z",
      users: [
        {
          _id: "stu-1",
          username: "stu1",
          profile: {
            name: "王乐怡",
            studentId: "20232110030018",
            className: "810班",
          },
        },
      ],
      sessions: [
        {
          key: "admin-config",
          teacherScopeKey: "shangguan-fuze",
          studentUserId: "stu-1",
          className: "810班",
          variant: "three-stage-guided",
          status: "submitted",
          startedAt: "2026-06-01T08:00:00.000Z",
          deadlineAt: "2026-06-01T08:15:00.000Z",
          lockedAt: "2026-06-01T08:18:00.000Z",
          submittedAt: "2026-06-01T08:19:00.000Z",
          timeExpired: false,
          durationMinutes: 15,
          payload: {
            stage1: {
              draftText: "先把书包减重，再增加夜间反光条。",
              lockedAt: "2026-06-01T08:05:00.000Z",
              submittedAt: "2026-06-01T08:05:00.000Z",
              pasteBlockedCount: 2,
            },
            stage2: {
              messages: [
                {
                  id: "msg-user-1",
                  role: "user",
                  content: "请帮我改进我的想法",
                  createdAt: "2026-06-01T08:06:00.000Z",
                },
                {
                  id: "msg-ai-1",
                  role: "assistant",
                  content: "可以增加减压肩带和雨天防水层。",
                  createdAt: "2026-06-01T08:06:20.000Z",
                  feedback: "up",
                },
              ],
              promptCardClicks: [
                {
                  prompt: "这个想法有什么不足",
                  createdAt: "2026-06-01T08:06:10.000Z",
                },
              ],
              promptCardCopies: [],
              transfers: [
                {
                  insertEventId: "insert-1",
                  sourceMessageId: "msg-ai-1",
                  sourceRole: "assistant",
                  selectedText: "可以增加减压肩带和雨天防水层。",
                  targetField: "stage2.draftText",
                  insertedAt: "2026-06-01T08:07:00.000Z",
                  insertMethod: "internal_stage2_transfer",
                },
              ],
              riskEvents: [
                {
                  eventId: "risk-stage2-1",
                  type: "paste_allowed",
                  stage: "stage2",
                  createdAt: "2026-06-01T08:08:00.000Z",
                  chars: 12,
                },
              ],
              draftText: "我想把减压肩带、防水层和反光条结合起来。",
              submittedAt: "2026-06-01T08:12:00.000Z",
            },
            stage3: {
              finalText: "最终方案：减轻书包重量，加入减压肩带、防水层和夜间反光条。",
              pasteEvents: [
                {
                  eventId: "risk-stage3-paste-1",
                  type: "paste_allowed",
                  stage: "stage3",
                  createdAt: "2026-06-01T08:15:00.000Z",
                  fieldKey: "stage3.finalText",
                  chars: 16,
                },
              ],
              riskEvents: [
                {
                  eventId: "risk-stage3-1",
                  type: "large_insert",
                  stage: "stage3",
                  createdAt: "2026-06-01T08:15:10.000Z",
                  fieldKey: "stage3.finalText",
                  charDelta: 66,
                },
              ],
              submittedAt: "2026-06-01T08:19:00.000Z",
            },
            turnbackEvents: [
              {
                eventId: "turnback-1",
                fromStage: "stage3",
                toStage: "stage2",
                passphraseAccepted: true,
                reason: "误点进入下一阶段",
                createdAt: "2026-06-01T08:14:00.000Z",
              },
            ],
            riskLog: [
              {
                eventId: "risk-1",
                type: "paste_blocked",
                stage: "stage1",
                createdAt: "2026-06-01T08:01:00.000Z",
                chars: 8,
              },
              {
                eventId: "risk-2",
                type: "paste_allowed",
                stage: "stage2",
                createdAt: "2026-06-01T08:08:00.000Z",
                chars: 12,
              },
              {
                eventId: "risk-3",
                type: "large_insert",
                stage: "stage3",
                createdAt: "2026-06-01T08:15:10.000Z",
                fieldKey: "stage3.finalText",
                charDelta: 66,
              },
            ],
          },
        },
      ],
      finalTestConfig: {
        introText: "先完成平台内任务，再完成线下创新任务。",
        tasks: [
          {
            id: "task-1",
            title: "任务 1：改进普通书包",
            description: "请围绕普通书包提出改进方案。",
            mode: "platform",
          },
          {
            id: "task-2",
            title: "任务 2：线下创新",
            description: "线下完成，不在本页面提交。",
            mode: "offline",
          },
        ],
      },
    },
    {
      XLSX,
      getTeacherScopeLabel: () => "上官福泽",
      formatDisplayTime: (value) => String(value || ""),
      formatFileStamp: () => "20260601-080000",
      sanitizeId: (value, fallback = "") => String(value || fallback).trim(),
      sanitizeText: (value, fallback = "", maxLength = 120) =>
        String(value ?? fallback).trim().slice(0, maxLength),
      sanitizeUserProfile: (value) =>
        value && typeof value === "object" ? value : {},
      sanitizeZipEntryName: (value, fallback = "file.txt") =>
        String(value || fallback).replace(/[\\:*?"<>|]/g, "_"),
    },
  );

  assert.match(bundle.fileName, /期末测试导出/);

  const fileNames = bundle.files.map((item) => item.name);
  assert.ok(fileNames.includes("导出说明.txt"));
  assert.ok(fileNames.includes("统计/期末测试总表.xlsx"));
  assert.ok(fileNames.includes("统计/期末测试总表.csv"));
  assert.ok(
    fileNames.some((name) => name.includes("学生明细/810班/") && name.endsWith("-明细.txt")),
  );
  assert.ok(
    fileNames.some((name) => name.includes("学生明细/810班/") && name.endsWith("-明细.json")),
  );

  const workbookEntry = bundle.files.find(
    (item) => item.name === "统计/期末测试总表.xlsx",
  );
  assert.ok(workbookEntry);
  const workbook = XLSX.read(workbookEntry.content, { type: "buffer" });
  assert.deepEqual(workbook.SheetNames, ["总表", "字段说明", "任务内容"]);

  const csvEntry = bundle.files.find((item) => item.name === "统计/期末测试总表.csv");
  assert.ok(csvEntry);
  const csvText = csvEntry.content.toString("utf8");
  assert.match(csvText, /姓名,学号,账号/);
  assert.match(csvText, /王乐怡/);
  assert.match(csvText, /三阶段引导型/);

  const textEntry = bundle.files.find((item) => item.name.endsWith("-明细.txt"));
  assert.ok(textEntry);
  assert.match(String(textEntry.content || ""), /五、第二阶段/);
  assert.match(String(textEntry.content || ""), /AI 对话记录/);
  assert.match(String(textEntry.content || ""), /误点进入下一阶段/);

  const jsonEntry = bundle.files.find((item) => item.name.endsWith("-明细.json"));
  assert.ok(jsonEntry);
  const detail = JSON.parse(String(jsonEntry.content || "{}"));
  assert.equal(detail.基本信息.姓名, "王乐怡");
  assert.equal(detail.第二阶段.AI对话记录[1].角色, "AI");
  assert.equal(detail.风险汇总.风险分, 7);
  assert.match(JSON.stringify(detail), /第一阶段/);
  assert.doesNotMatch(JSON.stringify(detail), /"stage1"/);
});

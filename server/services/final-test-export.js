import { normalizeFinalTestContentConfig } from "../../shared/finalTestContent.js";
import {
  buildFinalTestRiskSnapshot,
  createFinalTestSessionBase,
  normalizeFinalTestSession,
  resolveFinalTestVariant,
} from "../../shared/finalTestState.js";

const FINAL_TEST_TARGET_CLASS_NAMES = Object.freeze(["810班", "811班"]);
const CONTROL_CHARACTERS_PATTERN = "[\\x00-\\x1F\\x7F]";

function sanitizeStudentExportSegment(value, fallback = "unknown") {
  const safe = String(value || "")
    .replace(new RegExp(CONTROL_CHARACTERS_PATTERN, "g"), "")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 72);
  return safe || fallback;
}

function toCsvCell(value) {
  const text = String(value ?? "");
  if (!/["\n,]/.test(text)) return text;
  return `"${text.replace(/"/g, "\"\"")}"`;
}

function countTextLength(value) {
  return String(value || "").trim().length;
}

function formatMaybeTime(formatDisplayTime, value) {
  if (!value) return "";
  return String(formatDisplayTime(value) || "").trim();
}

function appendIndentedBlock(lines, value, spaces = 2) {
  const indent = " ".repeat(spaces);
  const text = String(value || "");
  if (!text.trim()) {
    lines.push(`${indent}-`);
    return;
  }
  text
    .replace(/\r/g, "")
    .split("\n")
    .forEach((line) => {
      lines.push(`${indent}${line}`);
    });
}

function resolveClassFilterValue(value) {
  const safe = String(value || "").trim();
  if (FINAL_TEST_TARGET_CLASS_NAMES.includes(safe)) return safe;
  return "all";
}

function resolveClassFilterLabel(value) {
  return value === "all" ? "全部班级" : value;
}

function resolveVariantLabel(value) {
  if (value === "three-stage-guided") return "三阶段引导型";
  if (value === "two-stage-free") return "两阶段自由型";
  return "未开放";
}

function resolveStatusLabel(value) {
  const safe = String(value || "").trim();
  if (safe === "not_started") return "未开始";
  if (safe === "stage1_draft") return "第一阶段进行中";
  if (safe === "stage1_locked") return "第一阶段已锁定";
  if (safe === "stage2_active") return "第二阶段进行中";
  if (safe === "stage3_active") return "第三阶段进行中";
  if (safe === "time_expired_locked") return "超时锁定";
  if (safe === "submitted") return "已提交";
  if (safe === "disabled") return "未开放";
  return safe || "未知状态";
}

function resolveStageLabel(value) {
  const safe = String(value || "").trim();
  if (safe === "stage1") return "第一阶段";
  if (safe === "stage2") return "第二阶段";
  if (safe === "stage3") return "第三阶段";
  if (safe === "time_expired") return "超时锁定阶段";
  if (safe === "submitted") return "已提交";
  return safe || "未知阶段";
}

function resolveRoleLabel(value) {
  return String(value || "").trim() === "assistant" ? "AI" : "学生";
}

function resolveFeedbackLabel(value) {
  if (value === "up") return "点赞";
  if (value === "down") return "点踩";
  return "无";
}

function resolveTargetFieldLabel(value) {
  const safe = String(value || "").trim();
  if (safe === "stage1.draftText") return "第一阶段作答框";
  if (safe === "stage2.draftText") return "第二阶段协作草稿";
  if (safe === "stage3.finalText") return "第三阶段最终定稿";
  return safe || "未标记字段";
}

function resolveRiskTypeLabel(value) {
  const safe = String(value || "").trim();
  if (safe === "paste_blocked") return "第一阶段粘贴被拦截";
  if (safe === "paste_allowed") return "记录到粘贴行为";
  if (safe === "large_insert") return "短时间大段输入";
  if (safe === "idle_then_large_insert") return "空闲或切屏后大段输入";
  if (safe === "tab_hidden") return "切换标签页或页面隐藏";
  if (safe === "window_blur") return "窗口失焦";
  return safe || "未知风险事件";
}

function resolveProcessActionLabel(value) {
  const safe = String(value || "").trim();
  if (safe === "text_edit") return "编辑文本";
  if (safe === "manual_save") return "保存草稿";
  if (safe === "paste_blocked") return "粘贴被拦截";
  if (safe === "paste_allowed") return "粘贴被记录";
  if (safe === "internal_transfer") return "AI内容写入作答区";
  if (safe === "stage_submit") return "阶段提交";
  if (safe === "final_submit") return "最终提交";
  if (safe === "post_submit_step") return "提交后流程确认";
  if (safe === "prompt_card_click") return "点击快捷提问";
  if (safe === "ai_message_sent") return "向AI发送消息";
  if (safe === "ai_feedback") return "评价AI回复";
  if (safe === "ai_regenerate") return "重新生成AI回复";
  return safe || "未标记动作";
}

function resolvePostSubmitEventLabel(value) {
  const safe = String(value || "").trim();
  if (safe === "task1_survey_completed") return "确认完成任务 1 问卷";
  if (safe === "task2_confirmed") return "确认完成线下任务 2";
  return safe || "未知提交后事件";
}

function createEmptySession(studentUserId, className, variant) {
  return normalizeFinalTestSession({
    ...createFinalTestSessionBase({
      studentUserId,
      className,
      variant,
      nowIso: new Date().toISOString(),
    }),
    status: "not_started",
    startedAt: "",
    deadlineAt: "",
    lockedAt: "",
    submittedAt: "",
    timeExpired: false,
  });
}

function mapPromptEvents(events = [], formatDisplayTime) {
  return (Array.isArray(events) ? events : []).map((item, index) => ({
    序号: index + 1,
    提示词: String(item?.prompt || "").trim(),
    时间: formatMaybeTime(formatDisplayTime, item?.createdAt),
  }));
}

function mapPostSubmitEvents(events = [], formatDisplayTime) {
  return (Array.isArray(events) ? events : []).map((item, index) => ({
    序号: index + 1,
    事件: resolvePostSubmitEventLabel(item?.type),
    时间: formatMaybeTime(formatDisplayTime, item?.createdAt),
    备注: String(item?.note || "").trim(),
  }));
}

function mapMessages(messages = [], formatDisplayTime) {
  return (Array.isArray(messages) ? messages : []).map((item, index) => ({
    序号: index + 1,
    消息ID: String(item?.id || "").trim(),
    角色: resolveRoleLabel(item?.role),
    时间: formatMaybeTime(formatDisplayTime, item?.createdAt),
    反馈: resolveFeedbackLabel(item?.feedback),
    内容: String(item?.content || ""),
  }));
}

function mapTransfers(transfers = [], formatDisplayTime) {
  return (Array.isArray(transfers) ? transfers : []).map((item, index) => ({
    序号: index + 1,
    转移ID: String(item?.insertEventId || "").trim(),
    来源消息ID: String(item?.sourceMessageId || "").trim(),
    来源角色: resolveRoleLabel(item?.sourceRole),
    写入位置: resolveTargetFieldLabel(item?.targetField),
    写入时间: formatMaybeTime(formatDisplayTime, item?.insertedAt),
    选中文本: String(item?.selectedText || ""),
    写入方式: String(item?.insertMethod || "").trim(),
  }));
}

function mapRiskEvents(events = [], formatDisplayTime) {
  return (Array.isArray(events) ? events : []).map((item, index) => ({
    序号: index + 1,
    事件ID: String(item?.eventId || "").trim(),
    事件类型: resolveRiskTypeLabel(item?.type),
    阶段: resolveStageLabel(item?.stage),
    时间: formatMaybeTime(formatDisplayTime, item?.createdAt),
    字段: resolveTargetFieldLabel(item?.fieldKey),
    字符数: Number(item?.chars || 0),
    新增字符数: Number(item?.charDelta || 0),
    输入类型: String(item?.inputType || "").trim(),
    输入前空闲毫秒: Number(item?.idleBeforeMs || 0),
    页面隐藏后毫秒: Number(item?.hiddenAgoMs || 0),
    窗口失焦后毫秒: Number(item?.blurAgoMs || 0),
    可见性状态: String(item?.visibilityState || "").trim(),
  }));
}

function mapProcessLogEvents(events = [], formatDisplayTime) {
  return (Array.isArray(events) ? events : []).map((item, index) => {
    const beforeLength = Number.isFinite(Number(item?.beforeLength))
      ? Number(item.beforeLength)
      : String(item?.beforeText || "").length;
    const afterLength = Number.isFinite(Number(item?.afterLength))
      ? Number(item.afterLength)
      : String(item?.afterText || "").length;
    return {
      序号: index + 1,
      事件ID: String(item?.eventId || "").trim(),
      时间: formatMaybeTime(formatDisplayTime, item?.createdAt),
      阶段: resolveStageLabel(item?.stage),
      字段: String(item?.fieldLabel || "").trim() || resolveTargetFieldLabel(item?.fieldKey),
      动作: String(item?.actionLabel || "").trim() || resolveProcessActionLabel(item?.type),
      输入类型: String(item?.inputType || "").trim(),
      光标位置: Number.isFinite(Number(item?.cursorPosition)) ? Number(item.cursorPosition) : -1,
      选区开始: Number.isFinite(Number(item?.selectionStart)) ? Number(item.selectionStart) : -1,
      选区结束: Number.isFinite(Number(item?.selectionEnd)) ? Number(item.selectionEnd) : -1,
      修改前字数: beforeLength,
      修改后字数: afterLength,
      字数变化: Number.isFinite(Number(item?.charDelta))
        ? Number(item.charDelta)
        : afterLength - beforeLength,
      修改前文本: String(item?.beforeText || ""),
      修改后文本: String(item?.afterText || ""),
      粘贴文本预览: String(item?.pastedTextPreview || item?.pastedText || ""),
      粘贴全文: String(item?.pastedText || ""),
      粘贴字数: Number.isFinite(Number(item?.pastedTextLength))
        ? Number(item.pastedTextLength)
        : String(item?.pastedText || "").length,
      写入文本预览: String(item?.insertedTextPreview || item?.insertedText || ""),
      写入全文: String(item?.insertedText || ""),
      写入字数: Number.isFinite(Number(item?.insertedTextLength))
        ? Number(item.insertedTextLength)
        : String(item?.insertedText || "").length,
      来源角色: resolveRoleLabel(item?.sourceRole),
      来源消息ID: String(item?.sourceMessageId || "").trim(),
      备注: String(item?.note || "").trim(),
    };
  });
}

function mapTurnbackEvents(events = [], formatDisplayTime) {
  const list = Array.isArray(events) ? events : [];
  return list
    .filter((item) => String(item?.kind || "").trim() !== "restart")
    .map((item, index) => ({
      序号: index + 1,
      事件ID: String(item?.eventId || "").trim(),
      类型: "回退",
      从阶段: resolveStageLabel(item?.fromStage),
      到阶段: resolveStageLabel(item?.toStage),
      原因: String(item?.reason || ""),
      时间: formatMaybeTime(formatDisplayTime, item?.createdAt),
      口令校验通过: item?.passphraseAccepted === true ? "是" : "否",
    }));
}

function mapRestartEvents(events = [], formatDisplayTime) {
  const list = Array.isArray(events) ? events : [];
  return list
    .filter((item) => String(item?.kind || "").trim() === "restart")
    .map((item, index) => ({
      序号: index + 1,
      事件ID: String(item?.eventId || "").trim(),
      类型: "重新开始",
      之前状态: resolveStatusLabel(item?.previousStatus),
      之前开始时间: formatMaybeTime(formatDisplayTime, item?.previousStartedAt),
      原因: String(item?.reason || ""),
      时间: formatMaybeTime(formatDisplayTime, item?.createdAt),
      口令校验通过: item?.passphraseAccepted === true ? "是" : "否",
      之前会话摘要: {
        之前状态: resolveStatusLabel(item?.previousSession?.status),
        之前提交时间: formatMaybeTime(formatDisplayTime, item?.previousSession?.submittedAt),
        之前第一阶段字数: countTextLength(item?.previousSession?.stage1?.draftText),
        之前第二阶段草稿字数: countTextLength(item?.previousSession?.stage2?.draftText),
        之前最终定稿字数: countTextLength(item?.previousSession?.stage3?.finalText),
        之前风险事件数: Array.isArray(item?.previousSession?.riskLog)
          ? item.previousSession.riskLog.length
          : 0,
      },
    }));
}

function buildSummaryFieldGuideRows() {
  return [
    ["字段", "说明"],
    ["序号", "导出总表中的行号。"],
    ["班级", "学生所属班级。"],
    ["姓名", "学生姓名，优先读取个人资料中的姓名。"],
    ["学号", "学生学号。"],
    ["账号", "学生登录账号。"],
    ["测试模式", "810 班为三阶段引导型，811 班为两阶段自由型。"],
    ["当前状态", "导出时该学生的期末测试状态。"],
    ["是否已提交", "是否已经完成最终提交。"],
    ["是否超时", "是否进入超时锁定。"],
    ["开始时间", "学生点击开始测试的时间。"],
    ["截止时间", "系统计算出的测试截止时间。"],
    ["锁定时间", "系统锁定作答的时间。"],
    ["提交时间", "学生最终提交的时间。"],
    ["任务1问卷确认时间", "学生在平台内确认已完成任务 1 问卷的时间。"],
    ["任务2页面进入时间", "学生进入线下任务 2 说明页的时间。"],
    ["任务2完成确认时间", "学生确认已在线下完成任务 2 的时间。"],
    ["任务2问卷进入时间", "学生进入任务 2 问卷页的时间。"],
    ["第一阶段字数", "第一阶段作答文本字数。"],
    ["第二阶段草稿字数", "第二阶段协作草稿字数。"],
    ["最终定稿字数", "第三阶段最终定稿字数。"],
    ["学生提问次数", "第二阶段中学生发给 AI 的消息数量。"],
    ["AI回复次数", "第二阶段中 AI 的回复数量。"],
    ["快捷提问点击次数", "学生点击快捷提问卡片的次数。"],
    ["AI内容转移次数", "把右侧 AI 内容追加到左侧答题区的次数。"],
    ["回退次数", "从后续阶段回退到前一阶段的次数。"],
    ["重新开始次数", "清空作答并重新开始的次数。"],
    ["第一阶段粘贴拦截次数", "第一阶段被系统拦截的粘贴次数。"],
    ["第二阶段粘贴次数", "第二阶段记录到的粘贴次数。"],
    ["第三阶段粘贴次数", "第三阶段记录到的粘贴次数。"],
    ["风险事件总数", "全部风险日志中的事件数量。"],
    ["风险分", "系统根据风险日志计算出的风险分。"],
    ["风险标签", "系统根据风险日志生成的风险标签。"],
  ];
}

function buildTaskSheetRows(finalTestContent) {
  const rows = [["字段", "内容"]];
  rows.push(["顶部说明", String(finalTestContent?.introText || "")]);
  const tasks = Array.isArray(finalTestContent?.tasks) ? finalTestContent.tasks : [];
  tasks.forEach((task, index) => {
    rows.push([`任务 ${index + 1} 标题`, String(task?.title || "")]);
    rows.push([`任务 ${index + 1} 完成方式`, task?.mode === "offline" ? "线下完成" : "平台内完成"]);
    rows.push([`任务 ${index + 1} 说明`, String(task?.description || "")]);
  });
  return rows;
}

function buildStudentDetailText(record) {
  const lines = [];
  lines.push("EduChat 期末测试学生明细");
  lines.push(`导出时间：${record.导出范围.导出时间 || "-"}`);
  lines.push(`授课教师范围：${record.导出范围.授课教师范围 || "-"}`);
  lines.push(`班级筛选：${record.导出范围.班级筛选 || "-"}`);
  lines.push("");
  lines.push("一、基本信息");
  Object.entries(record.基本信息).forEach(([label, value]) => {
    lines.push(`${label}：${String(value ?? "") || "-"}`);
  });
  lines.push("");
  lines.push("二、任务内容");
  lines.push(`顶部说明：${record.任务内容.顶部说明 || "-"}`);
  (Array.isArray(record.任务内容.任务列表) ? record.任务内容.任务列表 : []).forEach((item, index) => {
    lines.push(`${index + 1}. ${item.标题}（${item.完成方式}）`);
    appendIndentedBlock(lines, item.说明, 2);
  });
  lines.push("");
  lines.push("三、过程汇总");
  Object.entries(record.过程汇总).forEach(([label, value]) => {
    if (Array.isArray(value)) {
      lines.push(`${label}：${value.length > 0 ? value.join("、") : "无"}`);
      return;
    }
    lines.push(`${label}：${String(value ?? "") || "-"}`);
  });
  lines.push("");
  lines.push("四、第一阶段");
  lines.push(`作答文本：`);
  appendIndentedBlock(lines, record.第一阶段.作答文本, 2);
  lines.push(`锁定时间：${record.第一阶段.锁定时间 || "-"}`);
  lines.push(`提交时间：${record.第一阶段.提交时间 || "-"}`);
  lines.push(`粘贴拦截次数：${record.第一阶段.粘贴拦截次数}`);
  lines.push("");
  lines.push("五、第二阶段");
  lines.push(`协作草稿：`);
  appendIndentedBlock(lines, record.第二阶段.协作草稿, 2);
  lines.push(`提交时间：${record.第二阶段.提交时间 || "-"}`);
  lines.push("快捷提问点击：");
  if (record.第二阶段.快捷提问点击.length === 0) {
    lines.push("  无");
  } else {
    record.第二阶段.快捷提问点击.forEach((item) => {
      lines.push(`  ${item.序号}. ${item.提示词}（${item.时间 || "-"}）`);
    });
  }
  lines.push("快捷提问复制：");
  if (record.第二阶段.快捷提问复制.length === 0) {
    lines.push("  无");
  } else {
    record.第二阶段.快捷提问复制.forEach((item) => {
      lines.push(`  ${item.序号}. ${item.提示词}（${item.时间 || "-"}）`);
    });
  }
  lines.push("AI 对话记录：");
  if (record.第二阶段.AI对话记录.length === 0) {
    lines.push("  无");
  } else {
    record.第二阶段.AI对话记录.forEach((item) => {
      lines.push(`  ${item.序号}. [${item.角色}] ${item.时间 || "-"} 反馈：${item.反馈}`);
      appendIndentedBlock(lines, item.内容, 4);
    });
  }
  lines.push("AI 内容转移记录：");
  if (record.第二阶段.AI内容转移记录.length === 0) {
    lines.push("  无");
  } else {
    record.第二阶段.AI内容转移记录.forEach((item) => {
      lines.push(
        `  ${item.序号}. ${item.写入时间 || "-"}，从 ${item.来源角色} 消息 ${item.来源消息ID || "-"} 写入 ${item.写入位置}`,
      );
      appendIndentedBlock(lines, item.选中文本, 4);
    });
  }
  lines.push("第二阶段风险事件：");
  if (record.第二阶段.风险事件.length === 0) {
    lines.push("  无");
  } else {
    record.第二阶段.风险事件.forEach((item) => {
      lines.push(
        `  ${item.序号}. ${item.事件类型}｜${item.阶段}｜${item.时间 || "-"}｜字段：${item.字段 || "-"}`,
      );
    });
  }
  lines.push("");
  lines.push("六、第三阶段");
  lines.push("最终定稿：");
  appendIndentedBlock(lines, record.第三阶段.最终定稿, 2);
  lines.push(`提交时间：${record.第三阶段.提交时间 || "-"}`);
  lines.push("第三阶段粘贴记录：");
  if (record.第三阶段.粘贴记录.length === 0) {
    lines.push("  无");
  } else {
    record.第三阶段.粘贴记录.forEach((item) => {
      lines.push(
        `  ${item.序号}. ${item.事件类型}｜${item.阶段}｜${item.时间 || "-"}｜字段：${item.字段 || "-"}`,
      );
    });
  }
  lines.push("第三阶段风险事件：");
  if (record.第三阶段.风险事件.length === 0) {
    lines.push("  无");
  } else {
    record.第三阶段.风险事件.forEach((item) => {
      lines.push(
        `  ${item.序号}. ${item.事件类型}｜${item.阶段}｜${item.时间 || "-"}｜字段：${item.字段 || "-"}`,
      );
    });
  }
  lines.push("");
  lines.push("七、提交后流程");
  lines.push(`任务1问卷确认时间：${record.提交后流程.任务1问卷确认时间 || "-"}`);
  lines.push(`任务2页面进入时间：${record.提交后流程.任务2页面进入时间 || "-"}`);
  lines.push(`任务2完成确认时间：${record.提交后流程.任务2完成确认时间 || "-"}`);
  lines.push(`任务2问卷进入时间：${record.提交后流程.任务2问卷进入时间 || "-"}`);
  lines.push("流程事件：");
  if (record.提交后流程.流程事件.length === 0) {
    lines.push("  无");
  } else {
    record.提交后流程.流程事件.forEach((item) => {
      lines.push(
        `  ${item.序号}. ${item.事件}｜${item.时间 || "-"}｜备注：${item.备注 || "-"}`,
      );
    });
  }
  lines.push("");
  lines.push("八、回退与重新开始");
  lines.push("回退记录：");
  if (record.回退与重新开始.回退记录.length === 0) {
    lines.push("  无");
  } else {
    record.回退与重新开始.回退记录.forEach((item) => {
      lines.push(
        `  ${item.序号}. ${item.时间 || "-"}｜${item.从阶段} -> ${item.到阶段}｜原因：${item.原因 || "-"}`,
      );
    });
  }
  lines.push("重新开始记录：");
  if (record.回退与重新开始.重新开始记录.length === 0) {
    lines.push("  无");
  } else {
    record.回退与重新开始.重新开始记录.forEach((item) => {
      lines.push(
        `  ${item.序号}. ${item.时间 || "-"}｜之前状态：${item.之前状态}｜原因：${item.原因 || "-"}`,
      );
    });
  }
  lines.push("");
  lines.push("九、风险汇总");
  Object.entries(record.风险汇总).forEach(([label, value]) => {
    if (Array.isArray(value)) {
      lines.push(`${label}：${value.length > 0 ? value.join("、") : "无"}`);
      return;
    }
    lines.push(`${label}：${String(value ?? "") || "-"}`);
  });
  lines.push("全部风险日志：");
  if (record.全部风险日志.length === 0) {
    lines.push("  无");
  } else {
    record.全部风险日志.forEach((item) => {
      lines.push(
        `  ${item.序号}. ${item.事件类型}｜${item.阶段}｜${item.时间 || "-"}｜字段：${item.字段 || "-"}`,
      );
    });
  }
  lines.push("");
  lines.push("十、全过程时间线");
  if (record.全过程时间线.length === 0) {
    lines.push("  无");
  } else {
    record.全过程时间线.forEach((item) => {
      lines.push(
        `  ${item.序号}. ${item.时间 || "-"}｜${item.阶段}｜${item.字段}｜${item.动作}`,
      );
      lines.push(
        `    输入类型：${item.输入类型 || "-"}｜光标：${item.光标位置}｜选区：${item.选区开始}-${item.选区结束}｜字数：${item.修改前字数} -> ${item.修改后字数}（${item.字数变化 >= 0 ? "+" : ""}${item.字数变化}）`,
      );
      if (item.粘贴文本预览) {
        lines.push(`    粘贴文本预览：${item.粘贴文本预览}`);
      }
      if (item.写入文本预览) {
        lines.push(`    写入文本预览：${item.写入文本预览}`);
      }
      if (item.来源消息ID) {
        lines.push(`    来源：${item.来源角色 || "-"} 消息 ${item.来源消息ID}`);
      }
      if (item.备注) {
        lines.push(`    备注：${item.备注}`);
      }
      if (item.修改前文本 || item.修改后文本) {
        lines.push("    修改前文本：");
        appendIndentedBlock(lines, item.修改前文本, 6);
        lines.push("    修改后文本：");
        appendIndentedBlock(lines, item.修改后文本, 6);
      }
    });
  }
  return lines.join("\n");
}

export function buildFinalTestExportBundle(payload = {}, deps = {}) {
  const {
    teacherScopeKey = "",
    classNameFilter = "all",
    users = [],
    sessions = [],
    finalTestConfig = null,
    exportedAt = new Date(),
  } = payload || {};
  const {
    XLSX,
    getTeacherScopeLabel = (value) => String(value || ""),
    formatDisplayTime = (value) => String(value || ""),
    formatFileStamp = () => "unknown-time",
    sanitizeId = (value) => String(value || "").trim(),
    sanitizeText = (value, fallback = "", maxLength = 120) =>
      String(value ?? fallback).trim().slice(0, maxLength),
    sanitizeUserProfile = (value) =>
      value && typeof value === "object" ? value : {},
    sanitizeZipEntryName = (value, fallback = "file.txt") =>
      String(value || fallback),
  } = deps;

  if (!XLSX) {
    throw new Error("缺少 XLSX 依赖，无法生成期末测试导出文件。");
  }

  const safeTeacherScopeKey = String(teacherScopeKey || "").trim();
  const safeClassNameFilter = resolveClassFilterValue(classNameFilter);
  const safeTeacherScopeLabel = getTeacherScopeLabel(safeTeacherScopeKey) || safeTeacherScopeKey || "-";
  const normalizedFinalTestContent = normalizeFinalTestContentConfig(finalTestConfig);
  const sessionByUserId = new Map(
    (Array.isArray(sessions) ? sessions : []).map((item) => {
      const session = normalizeFinalTestSession(item);
      return [sanitizeId(session.studentUserId, ""), session];
    }),
  );

  const scopedUsers = (Array.isArray(users) ? users : [])
    .map((user) => {
      const userId = sanitizeId(user?._id, "");
      const username = sanitizeText(user?.username, "", 80);
      const profile = sanitizeUserProfile(user?.profile);
      const className = sanitizeText(profile?.className, "", 40).replace(/\s+/g, "");
      const variant = resolveFinalTestVariant(className);
      return {
        userId,
        username,
        name: sanitizeText(profile?.name || username, "", 64),
        studentId: sanitizeText(profile?.studentId, "", 20),
        className,
        variant,
      };
    })
    .filter((item) => item.userId && item.variant !== "disabled")
    .filter((item) => safeClassNameFilter === "all" || item.className === safeClassNameFilter)
    .sort((a, b) => {
      const classCompare = String(a.className || "").localeCompare(String(b.className || ""), "zh-CN");
      if (classCompare !== 0) return classCompare;
      const idCompare = String(a.studentId || "").localeCompare(String(b.studentId || ""), "zh-CN");
      if (idCompare !== 0) return idCompare;
      return String(a.name || a.username || "").localeCompare(String(b.name || b.username || ""), "zh-CN");
    });

  const summaryRows = [];
  const studentFiles = [];
  let totalSubmittedCount = 0;
  let totalExpiredCount = 0;

  scopedUsers.forEach((user, index) => {
    const session = sessionByUserId.get(user.userId) || createEmptySession(user.userId, user.className, user.variant);
    const riskSummary = buildFinalTestRiskSnapshot(session?.riskLog || []);
    const stage1Text = String(session?.stage1?.draftText || "").trim();
    const stage2Text = String(session?.stage2?.draftText || "").trim();
    const stage3Text = String(session?.stage3?.finalText || "").trim();
    const postSubmit =
      session?.postSubmit && typeof session.postSubmit === "object"
        ? session.postSubmit
        : {};
    const stage2Messages = Array.isArray(session?.stage2?.messages) ? session.stage2.messages : [];
    const userMessageCount = stage2Messages.filter((item) => item?.role === "user").length;
    const assistantMessageCount = stage2Messages.filter((item) => item?.role === "assistant").length;
    const promptCardClicks = Array.isArray(session?.stage2?.promptCardClicks)
      ? session.stage2.promptCardClicks
      : [];
    const promptCardCopies = Array.isArray(session?.stage2?.promptCardCopies)
      ? session.stage2.promptCardCopies
      : [];
    const transfers = Array.isArray(session?.stage2?.transfers) ? session.stage2.transfers : [];
    const turnbackEvents = Array.isArray(session?.turnbackEvents) ? session.turnbackEvents : [];
    const restartEvents = turnbackEvents.filter((item) => String(item?.kind || "").trim() === "restart");
    const turnbackOnlyEvents = turnbackEvents.filter((item) => String(item?.kind || "").trim() !== "restart");
    const riskLog = Array.isArray(session?.riskLog) ? session.riskLog : [];
    const processLog = Array.isArray(session?.processLog) ? session.processLog : [];
    const stage2PasteCount = riskLog.filter(
      (item) => String(item?.stage || "").trim() === "stage2" && String(item?.type || "").trim() === "paste_allowed",
    ).length;
    const stage3PasteCount = riskLog.filter(
      (item) => String(item?.stage || "").trim() === "stage3" && String(item?.type || "").trim() === "paste_allowed",
    ).length;

    if (session?.status === "submitted") totalSubmittedCount += 1;
    if (session?.timeExpired === true) totalExpiredCount += 1;

    const summaryRow = {
      序号: index + 1,
      班级: user.className || "",
      姓名: user.name || "",
      学号: user.studentId || "",
      账号: user.username || "",
      测试模式: resolveVariantLabel(session?.variant || user.variant),
      当前状态: resolveStatusLabel(session?.status),
      是否已提交: session?.status === "submitted" ? "是" : "否",
      是否超时: session?.timeExpired === true ? "是" : "否",
      开始时间: formatMaybeTime(formatDisplayTime, session?.startedAt),
      截止时间: formatMaybeTime(formatDisplayTime, session?.deadlineAt),
      锁定时间: formatMaybeTime(formatDisplayTime, session?.lockedAt),
      提交时间: formatMaybeTime(formatDisplayTime, session?.submittedAt),
      任务1问卷确认时间: formatMaybeTime(formatDisplayTime, postSubmit.task1SurveyCompletedAt),
      任务2页面进入时间: formatMaybeTime(formatDisplayTime, postSubmit.task2PageEnteredAt),
      任务2完成确认时间: formatMaybeTime(formatDisplayTime, postSubmit.task2ConfirmedAt),
      任务2问卷进入时间: formatMaybeTime(formatDisplayTime, postSubmit.task2SurveyEnteredAt),
      第一阶段字数: countTextLength(stage1Text),
      第二阶段草稿字数: countTextLength(stage2Text),
      最终定稿字数: countTextLength(stage3Text),
      学生提问次数: userMessageCount,
      AI回复次数: assistantMessageCount,
      快捷提问点击次数: promptCardClicks.length,
      AI内容转移次数: transfers.length,
      回退次数: turnbackOnlyEvents.length,
      重新开始次数: restartEvents.length,
      第一阶段粘贴拦截次数: Number(session?.stage1?.pasteBlockedCount || 0),
      第二阶段粘贴次数: stage2PasteCount,
      第三阶段粘贴次数: stage3PasteCount,
      风险事件总数: riskLog.length,
      风险分: Number(riskSummary?.riskScore || 0),
      风险标签: Array.isArray(riskSummary?.riskFlags) ? riskSummary.riskFlags.join("、") : "",
    };
    summaryRows.push(summaryRow);

    const detailRecord = {
      导出范围: {
        导出时间: formatMaybeTime(formatDisplayTime, exportedAt),
        授课教师范围: safeTeacherScopeLabel,
        班级筛选: resolveClassFilterLabel(safeClassNameFilter),
      },
      基本信息: {
        用户ID: user.userId,
        账号: user.username || "",
        姓名: user.name || "",
        学号: user.studentId || "",
        班级: user.className || "",
        测试模式: resolveVariantLabel(session?.variant || user.variant),
        当前状态: resolveStatusLabel(session?.status),
        是否已提交: session?.status === "submitted" ? "是" : "否",
        是否超时: session?.timeExpired === true ? "是" : "否",
        开始时间: formatMaybeTime(formatDisplayTime, session?.startedAt),
        截止时间: formatMaybeTime(formatDisplayTime, session?.deadlineAt),
        锁定时间: formatMaybeTime(formatDisplayTime, session?.lockedAt),
        提交时间: formatMaybeTime(formatDisplayTime, session?.submittedAt),
        任务1问卷确认时间: formatMaybeTime(formatDisplayTime, postSubmit.task1SurveyCompletedAt),
        任务2页面进入时间: formatMaybeTime(formatDisplayTime, postSubmit.task2PageEnteredAt),
        任务2完成确认时间: formatMaybeTime(formatDisplayTime, postSubmit.task2ConfirmedAt),
        任务2问卷进入时间: formatMaybeTime(formatDisplayTime, postSubmit.task2SurveyEnteredAt),
        时长分钟: Number(session?.durationMinutes || 20),
      },
      任务内容: {
        顶部说明: String(normalizedFinalTestContent?.introText || ""),
        任务列表: (Array.isArray(normalizedFinalTestContent?.tasks)
          ? normalizedFinalTestContent.tasks
          : []
        ).map((item) => ({
          标题: String(item?.title || ""),
          完成方式: item?.mode === "offline" ? "线下完成" : "平台内完成",
          说明: String(item?.description || ""),
        })),
      },
      过程汇总: {
        第一阶段字数: countTextLength(stage1Text),
        第二阶段草稿字数: countTextLength(stage2Text),
        最终定稿字数: countTextLength(stage3Text),
        学生提问次数: userMessageCount,
        AI回复次数: assistantMessageCount,
        快捷提问点击次数: promptCardClicks.length,
        快捷提问复制次数: promptCardCopies.length,
        AI内容转移次数: transfers.length,
        回退次数: turnbackOnlyEvents.length,
        重新开始次数: restartEvents.length,
        第一阶段粘贴拦截次数: Number(session?.stage1?.pasteBlockedCount || 0),
        第二阶段粘贴次数: stage2PasteCount,
        第三阶段粘贴次数: stage3PasteCount,
        风险事件总数: riskLog.length,
        风险分: Number(riskSummary?.riskScore || 0),
        风险标签: Array.isArray(riskSummary?.riskFlags) ? riskSummary.riskFlags : [],
      },
      第一阶段: {
        作答文本: stage1Text,
        锁定时间: formatMaybeTime(formatDisplayTime, session?.stage1?.lockedAt),
        提交时间: formatMaybeTime(formatDisplayTime, session?.stage1?.submittedAt),
        粘贴拦截次数: Number(session?.stage1?.pasteBlockedCount || 0),
      },
      第二阶段: {
        协作草稿: stage2Text,
        提交时间: formatMaybeTime(formatDisplayTime, session?.stage2?.submittedAt),
        快捷提问点击: mapPromptEvents(promptCardClicks, formatDisplayTime),
        快捷提问复制: mapPromptEvents(promptCardCopies, formatDisplayTime),
        AI对话记录: mapMessages(stage2Messages, formatDisplayTime),
        AI内容转移记录: mapTransfers(transfers, formatDisplayTime),
        风险事件: mapRiskEvents(session?.stage2?.riskEvents || [], formatDisplayTime),
      },
      第三阶段: {
        最终定稿: stage3Text,
        提交时间: formatMaybeTime(formatDisplayTime, session?.stage3?.submittedAt),
        粘贴记录: mapRiskEvents(session?.stage3?.pasteEvents || [], formatDisplayTime),
        风险事件: mapRiskEvents(session?.stage3?.riskEvents || [], formatDisplayTime),
      },
      提交后流程: {
        任务1问卷确认时间: formatMaybeTime(formatDisplayTime, postSubmit.task1SurveyCompletedAt),
        任务2页面进入时间: formatMaybeTime(formatDisplayTime, postSubmit.task2PageEnteredAt),
        任务2完成确认时间: formatMaybeTime(formatDisplayTime, postSubmit.task2ConfirmedAt),
        任务2问卷进入时间: formatMaybeTime(formatDisplayTime, postSubmit.task2SurveyEnteredAt),
        流程事件: mapPostSubmitEvents(postSubmit.events || [], formatDisplayTime),
      },
      回退与重新开始: {
        回退记录: mapTurnbackEvents(turnbackEvents, formatDisplayTime),
        重新开始记录: mapRestartEvents(turnbackEvents, formatDisplayTime),
      },
      风险汇总: {
        风险分: Number(riskSummary?.riskScore || 0),
        风险标签: Array.isArray(riskSummary?.riskFlags) ? riskSummary.riskFlags : [],
        第一阶段粘贴拦截次数: Number(riskSummary?.pasteBlockedCount || 0),
        第二阶段与第三阶段粘贴次数: Number(riskSummary?.pasteAllowedCount || 0),
        大段输入次数: Number(riskSummary?.largeInsertCount || 0),
        空闲后大段输入次数: Number(riskSummary?.idleThenLargeInsertCount || 0),
        切换标签页次数: Number(riskSummary?.tabHiddenCount || 0),
        窗口失焦次数: Number(riskSummary?.windowBlurCount || 0),
      },
      全部风险日志: mapRiskEvents(riskLog, formatDisplayTime),
      全过程时间线: mapProcessLogEvents(processLog, formatDisplayTime),
    };

    const studentBaseName = sanitizeStudentExportSegment(
      `${String(index + 1).padStart(3, "0")}-${user.name || user.username || "未命名学生"}${
        user.studentId ? `-${user.studentId}` : ""
      }`,
      `student-${index + 1}`,
    );
    const classFolder = sanitizeStudentExportSegment(user.className || "未分班", "未分班");
    const textContent = buildStudentDetailText(detailRecord);
    const jsonContent = JSON.stringify(detailRecord, null, 2);
    studentFiles.push({
      textName: sanitizeZipEntryName(
        `学生明细/${classFolder}/${studentBaseName}-明细.txt`,
        `学生明细/${classFolder}/detail-${index + 1}.txt`,
      ),
      textContent,
      jsonName: sanitizeZipEntryName(
        `学生明细/${classFolder}/${studentBaseName}-明细.json`,
        `学生明细/${classFolder}/detail-${index + 1}.json`,
      ),
      jsonContent,
    });
  });

  const readmeLines = [
    "EduChat 期末测试全量痕迹导出",
    `导出时间：${formatMaybeTime(formatDisplayTime, exportedAt) || "-"}`,
    `授课教师范围：${safeTeacherScopeLabel}`,
    `班级筛选：${resolveClassFilterLabel(safeClassNameFilter)}`,
    `纳入导出的学生人数：${scopedUsers.length}`,
    `已提交人数：${totalSubmittedCount}`,
    `超时人数：${totalExpiredCount}`,
    "",
    "压缩包内容：",
    "1. 统计/期末测试总表.xlsx：Excel 总表，含“总表”“字段说明”“任务内容”三个工作表。",
    "2. 统计/期末测试总表.csv：与 Excel 总表同结构的 CSV 文件。",
    "3. 学生明细/*/*.txt：每个学生的中文可读明细。",
    "4. 学生明细/*/*.json：每个学生的中文结构化明细，保留全部平台内痕迹。",
    "",
    "说明：",
    "1. 本导出仅包含当前系统数据库中已经保存的平台内期末测试痕迹。",
    "2. 腾讯问卷答案与线下创新任务结果不在本系统数据库中，因此不在本次导出内。",
    "3. 未开始测试但属于导出范围的学生，也会出现在总表中，状态显示为“未开始”。",
    "",
    "当前任务内容：",
    `顶部说明：${String(normalizedFinalTestContent?.introText || "") || "-"}`,
  ];
  (Array.isArray(normalizedFinalTestContent?.tasks) ? normalizedFinalTestContent.tasks : []).forEach((item, index) => {
    readmeLines.push(
      `${index + 1}. ${String(item?.title || "")}（${item?.mode === "offline" ? "线下完成" : "平台内完成"}）`,
    );
    readmeLines.push(`   ${String(item?.description || "")}`);
  });

  const workbook = XLSX.utils.book_new();
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows, {
    skipHeader: false,
  });
  const fieldGuideSheet = XLSX.utils.aoa_to_sheet(buildSummaryFieldGuideRows());
  const taskSheet = XLSX.utils.aoa_to_sheet(buildTaskSheetRows(normalizedFinalTestContent));
  XLSX.utils.book_append_sheet(workbook, summarySheet, "总表");
  XLSX.utils.book_append_sheet(workbook, fieldGuideSheet, "字段说明");
  XLSX.utils.book_append_sheet(workbook, taskSheet, "任务内容");
  const workbookBuffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  });

  const csvLines = [];
  const headers = summaryRows.length > 0 ? Object.keys(summaryRows[0]) : [];
  if (headers.length > 0) {
    csvLines.push(headers.map((header) => toCsvCell(header)).join(","));
    summaryRows.forEach((row) => {
      csvLines.push(headers.map((header) => toCsvCell(row?.[header] ?? "")).join(","));
    });
  } else {
    csvLines.push("序号,班级,姓名,学号,账号,测试模式,当前状态");
  }

  const fileScopePart = safeClassNameFilter === "all"
    ? "全部班级"
    : safeClassNameFilter;
  const zipFileName = sanitizeStudentExportSegment(
    `期末测试导出-${safeTeacherScopeLabel}-${fileScopePart}-${formatFileStamp(exportedAt)}.zip`,
    `期末测试导出-${formatFileStamp(exportedAt)}.zip`,
  );

  const files = [
    {
      name: "导出说明.txt",
      content: readmeLines.join("\n"),
    },
    {
      name: "统计/期末测试总表.xlsx",
      content: workbookBuffer,
    },
    {
      name: "统计/期末测试总表.csv",
      content: Buffer.from(`\uFEFF${csvLines.join("\n")}`, "utf8"),
    },
    ...studentFiles.flatMap((item) => [
      { name: item.textName, content: item.textContent },
      { name: item.jsonName, content: item.jsonContent },
    ]),
  ];

  if (studentFiles.length === 0) {
    files.push({
      name: "学生明细/暂无数据.txt",
      content: "当前筛选范围内没有可导出的期末测试学生数据。",
    });
  }

  return {
    files,
    fileName: zipFileName,
    summaryRows,
  };
}

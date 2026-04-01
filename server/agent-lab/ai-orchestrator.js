import { Buffer } from "node:buffer";
import {
  buildDefaultAgentLabSettings,
  normalizeAgentLabSettingsDoc,
  normalizeAgentLabMessageDoc,
} from "./store.js";

function createResponseRecorder() {
  let statusCode = 200;
  let body = "";
  let jsonPayload = null;
  return {
    setHeader() {},
    flushHeaders() {},
    status(code) {
      statusCode = Number(code) || 500;
      return this;
    },
    json(payload) {
      jsonPayload = payload;
      return this;
    },
    write(chunk) {
      body += typeof chunk === "string" ? chunk : Buffer.from(chunk || "").toString("utf8");
      return true;
    },
    end(chunk = "") {
      if (chunk) {
        body += typeof chunk === "string" ? chunk : Buffer.from(chunk || "").toString("utf8");
      }
      return this;
    },
    read() {
      return { statusCode, body, jsonPayload };
    },
  };
}

function parseSseEvents(text) {
  return String(text || "")
    .split(/\r?\n\r?\n/)
    .map((chunk) => String(chunk || "").trim())
    .filter(Boolean)
    .map((chunk) => {
      let event = "";
      let dataText = "";
      chunk.split(/\r?\n/).forEach((line) => {
        if (line.startsWith("event:")) {
          event = line.slice("event:".length).trim();
        } else if (line.startsWith("data:")) {
          dataText += line.slice("data:".length).trim();
        }
      });
      if (!event || !dataText) return null;
      try {
        return {
          event,
          payload: JSON.parse(dataText),
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function buildPresetInstruction(modePreset) {
  if (modePreset === "learning_companion") {
    return "你的角色是学习陪伴型助理：温和、鼓励、善于拆解步骤，帮助学生明确下一步。";
  }
  if (modePreset === "community_manager") {
    return "你的角色是通用社群型助理：整理话题、维护秩序、提炼共识、提醒未决问题。";
  }
  return "你的角色是课堂主持型助理：控场、总结、追问、引导不同成员推进讨论。";
}

function normalizeComparableText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\s，。！？、,.!?;:：；"'“”‘’（）()【】[\]{}<>《》]/g, "")
    .slice(0, 160);
}

function resolveCooldownMs(level) {
  if (level === "high") return 30 * 1000;
  if (level === "low") return 2 * 60 * 1000;
  return 60 * 1000;
}

function computeTriggerReasons({ settings, messages, userMessage, room }) {
  const reasons = [];
  const normalizedSettings = normalizeAgentLabSettingsDoc(settings || buildDefaultAgentLabSettings());
  const list = Array.isArray(messages) ? messages.filter(Boolean) : [];
  const safeUserMessage = userMessage && typeof userMessage === "object" ? userMessage : null;
  const previousMessages = safeUserMessage
    ? list.filter((item) => String(item?.id || "") !== String(safeUserMessage.id || ""))
    : list;
  const previousVisible = previousMessages.filter(
    (item) => ["text", "assistant", "system"].includes(String(item?.type || "").toLowerCase()),
  );
  const previousLatest = previousVisible[previousVisible.length - 1];
  const userCreatedAtMs = Date.parse(String(safeUserMessage?.createdAt || "")) || Date.now();
  const previousCreatedAtMs = Date.parse(String(previousLatest?.createdAt || "")) || 0;
  if (
    previousCreatedAtMs > 0 &&
    userCreatedAtMs - previousCreatedAtMs >= normalizedSettings.silenceTriggerMs
  ) {
    reasons.push("cold_resume");
  }

  const comparable = normalizeComparableText(safeUserMessage?.content);
  if (comparable.length >= 6) {
    const recentUsers = previousVisible
      .filter((item) => String(item?.type || "").toLowerCase() === "text")
      .slice(-normalizedSettings.repeatWindowMessages);
    if (recentUsers.some((item) => normalizeComparableText(item?.content) === comparable)) {
      reasons.push("repeat_question");
    }
  }

  let userCountSinceLastAssistant = 0;
  for (let index = previousVisible.length - 1; index >= 0; index -= 1) {
    const current = previousVisible[index];
    const type = String(current?.type || "").toLowerCase();
    if (type === "assistant" || type === "system") break;
    if (type === "text") userCountSinceLastAssistant += 1;
  }
  userCountSinceLastAssistant += comparable ? 1 : 0;
  if (userCountSinceLastAssistant >= normalizedSettings.stageSummaryMessageCount) {
    reasons.push("stage_summary");
  }

  const lastAgentAtMs = Date.parse(String(room?.lastAgentAt || "")) || 0;
  if (lastAgentAtMs > 0 && userCreatedAtMs - lastAgentAtMs < resolveCooldownMs(normalizedSettings.proactivityLevel)) {
    return reasons.filter((item) => item !== "stage_summary");
  }

  return Array.from(new Set(reasons));
}

function mapMessagesForModel(messages) {
  const list = Array.isArray(messages) ? messages : [];
  return list
    .slice(-18)
    .map((item) => {
      const type = String(item?.type || "").toLowerCase();
      const content = String(item?.content || "").trim();
      if (!content) return null;
      if (type === "assistant" || type === "system") {
        return { role: "assistant", content };
      }
      return { role: "user", content: `${String(item?.senderName || "成员").trim() || "成员"}：${content}` };
    })
    .filter(Boolean);
}

async function collectModelText({
  deps,
  agentId,
  systemPromptOverride,
  messages,
  chatUserId,
  chatStorageUserId,
  teacherScopeKey,
  sessionId,
  metaExtras,
}) {
  const recorder = createResponseRecorder();
  await deps.streamAgentResponse({
    res: recorder,
    agentId,
    messages,
    files: [],
    runtimeConfig: null,
    systemPromptOverride,
    chatUserId,
    chatStorageUserId,
    teacherScopeKey,
    sessionId,
    smartContextEnabled: false,
    contextMode: "append",
    attachUploadedFiles: false,
    metaExtras,
  });
  const result = recorder.read();
  if (result.jsonPayload?.error) {
    throw new Error(result.jsonPayload.error);
  }
  if (result.statusCode >= 400 && result.jsonPayload?.message) {
    throw new Error(result.jsonPayload.message);
  }
  const events = parseSseEvents(result.body);
  let meta = null;
  let content = "";
  let lastError = "";
  events.forEach((item) => {
    if (item.event === "meta") meta = item.payload;
    if (item.event === "token" && item.payload?.text) {
      content += String(item.payload.text || "");
    }
    if (item.event === "error" && item.payload?.message) {
      lastError = String(item.payload.message || "");
    }
  });
  if (lastError) {
    throw new Error(lastError);
  }
  return {
    content: String(content || "").trim(),
    meta,
  };
}

async function generateShadowSuggestion({
  deps,
  settings,
  room,
  messages,
  chatUserId,
  chatStorageUserId,
  teacherScopeKey,
}) {
  const systemPrompt = [
    "你是 Agent Lab 的影子主持人。",
    buildPresetInstruction(settings.modePreset),
    "你不会直接进入群聊发言，而是只给当前用户一条私有建议，帮助他推动讨论。",
    "输出要求：不超过120字；直接给建议；不要自称 AI；不要写标题；不要输出序号超过3条。",
    settings.systemPersonaPrompt ? `补充人设：${settings.systemPersonaPrompt}` : "",
    `当前房间：${room?.name || "Agent Lab"}`,
  ]
    .filter(Boolean)
    .join("\n");
  return collectModelText({
    deps,
    agentId: settings.baseAgentId,
    systemPromptOverride: systemPrompt,
    messages: mapMessagesForModel(messages),
    chatUserId,
    chatStorageUserId,
    teacherScopeKey,
    sessionId: `agent-lab-shadow-${String(room?.id || "default")}`,
    metaExtras: {
      requestSource: "agent-lab-shadow",
      modePreset: settings.modePreset,
    },
  });
}

async function generateAssistantMessage({
  deps,
  settings,
  room,
  messages,
  triggerReasons,
  chatUserId,
  chatStorageUserId,
  teacherScopeKey,
}) {
  const systemPrompt = [
    "你是 Agent Lab 测试群中的主动参与型助理。",
    buildPresetInstruction(settings.modePreset),
    "现在你要以群成员身份发言，帮助讨论继续推进。",
    "发言要求：不超过180字；自然、具体、推进式；不要暴露内部触发规则；不要说“根据设置”或“作为 AI”。",
    triggerReasons.length > 0 ? `本次触发原因：${triggerReasons.join("、")}` : "",
    settings.systemPersonaPrompt ? `补充人设：${settings.systemPersonaPrompt}` : "",
    `当前房间：${room?.name || "Agent Lab"}`,
  ]
    .filter(Boolean)
    .join("\n");
  return collectModelText({
    deps,
    agentId: settings.baseAgentId,
    systemPromptOverride: systemPrompt,
    messages: mapMessagesForModel(messages),
    chatUserId,
    chatStorageUserId,
    teacherScopeKey,
    sessionId: `agent-lab-assistant-${String(room?.id || "default")}`,
    metaExtras: {
      requestSource: "agent-lab-assistant",
      modePreset: settings.modePreset,
      triggerReasons,
    },
  });
}

export async function runAgentLabAiTurn({
  deps,
  settings: rawSettings,
  room,
  messages,
  userMessage,
  chatUserId,
  chatStorageUserId,
  teacherScopeKey,
}) {
  const settings = normalizeAgentLabSettingsDoc(rawSettings);
  const triggerReasons = computeTriggerReasons({
    settings,
    messages,
    userMessage,
    room,
  });
  const result = {
    triggerReasons,
    shadowSuggestion: null,
    assistantMessageDraft: null,
    aiError: "",
  };

  try {
    if (settings.shadowModeratorEnabled && !settings.proactiveSpeechEnabled) {
      const shadow = await generateShadowSuggestion({
        deps,
        settings,
        room,
        messages,
        chatUserId,
        chatStorageUserId,
        teacherScopeKey,
      });
      if (shadow.content) {
        result.shadowSuggestion = {
          content: shadow.content,
          generatedAt: new Date().toISOString(),
          modePreset: settings.modePreset,
          triggerReasons,
          runtime: {
            provider: String(shadow.meta?.provider || ""),
            model: String(shadow.meta?.model || ""),
            reasoningApplied: String(shadow.meta?.reasoningApplied || ""),
          },
        };
      }
    }

    if (settings.proactiveSpeechEnabled && triggerReasons.length > 0) {
      const proactive = await generateAssistantMessage({
        deps,
        settings,
        room,
        messages,
        triggerReasons,
        chatUserId,
        chatStorageUserId,
        teacherScopeKey,
      });
      if (proactive.content) {
        result.assistantMessageDraft = normalizeAgentLabMessageDoc({
          _id: `agent-lab-assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          roomId: room?.id,
          type: "assistant",
          senderUserId: "agent-lab-assistant",
          senderName: "Agent Lab",
          content: proactive.content,
          createdAt: new Date(),
          aiMeta: {
            modePreset: settings.modePreset,
            proactivityLevel: settings.proactivityLevel,
            triggerReasons,
            provider: proactive.meta?.provider,
            model: proactive.meta?.model,
            reasoningApplied: proactive.meta?.reasoningApplied,
            shadow: false,
          },
        });
      }
    }
  } catch (error) {
    result.aiError = error?.message || "Agent Lab AI 生成失败。";
  }

  return result;
}

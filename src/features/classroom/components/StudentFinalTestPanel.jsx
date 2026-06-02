import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Copy,
  RotateCcw,
} from "lucide-react";
import MessageList from "../../../components/MessageList.jsx";
import MessageInput from "../../../components/MessageInput.jsx";
import "../../../styles/chat.css";
import {
  buildInternalTransferEvent,
  lockExpiredSession,
  normalizeFinalTestSession,
  resolveFinalTestStageFromStatus,
} from "../../../../shared/finalTestState.js";
import { normalizeFinalTestContentConfig } from "../../../../shared/finalTestContent.js";
import {
  fetchClassroomFinalTestSession,
  restartClassroomFinalTestSession,
  startClassroomFinalTestSession,
  submitClassroomFinalTestSession,
  turnbackClassroomFinalTestSession,
  updateClassroomFinalTestSession,
} from "../../../pages/classroom/classroomApi.js";
import { ChatApiService } from "../../chat/services/ChatApiService.js";
import "../../../styles/final-test.css";

const LARGE_INSERT_THRESHOLD = 60;
const IDLE_INSERT_THRESHOLD_MS = 12000;
const HIDDEN_INSERT_WINDOW_MS = 45000;

const STAGE2_PROMPTS = [
  "请帮我改进我的想法",
  "这个想法有什么不足",
  "能不能把两个想法组合起来",
  "哪个想法更有新颖性和实用性",
  "如果放到校园里，可以怎么改",
];

const TASK1_SURVEY_URL = "https://wj.qq.com/s2/26868195/6777/";
const TASK2_SURVEY_URL = "https://wj.qq.com/s2/26868239/d762/";
const FINAL_TEST_START_CONFIRM_MESSAGE =
  "期末测试会记录所有时间和操作，请各位同学诚信测试。确认参加后将立即开始考试并进入计时模式。";


function buildStage2DraftText(stage2 = {}) {
  return String(stage2?.draftText || "").trim();
}

function buildStage3FinalText(stage3 = {}) {
  return String(stage3?.finalText || "").trim();
}

function normalizePostSubmitFlow(postSubmit = {}) {
  const safe = postSubmit && typeof postSubmit === "object" ? postSubmit : {};
  return {
    task1SurveyCompletedAt: String(safe.task1SurveyCompletedAt || ""),
    task2PageEnteredAt: String(safe.task2PageEnteredAt || ""),
    task2ConfirmedAt: String(safe.task2ConfirmedAt || ""),
    task2SurveyEnteredAt: String(safe.task2SurveyEnteredAt || ""),
    events: Array.isArray(safe.events)
      ? safe.events.map((item) => ({
          eventId: String(item?.eventId || ""),
          type: String(item?.type || ""),
          createdAt: String(item?.createdAt || ""),
          note: String(item?.note || ""),
        }))
      : [],
  };
}

function createPostSubmitEvent(type, createdAt, note = "") {
  return {
    eventId: `post-submit-${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    createdAt,
    note,
  };
}

function resolvePostSubmitStep(session) {
  const flow = normalizePostSubmitFlow(session?.postSubmit);
  if (!flow.task1SurveyCompletedAt) return "task1-survey";
  if (!flow.task2ConfirmedAt) return "task2-offline";
  return "task2-survey";
}

function formatFinalTestCountdown(remainingMs = 0) {
  const safeMs = Math.max(0, Number(remainingMs || 0));
  const totalSeconds = Math.ceil(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function createRiskEvent(type, stage, extra = {}) {
  return {
    eventId: `risk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    stage,
    createdAt: new Date().toISOString(),
    ...extra,
  };
}

function normalizeSessionForView(session, fallbackVariant) {
  const normalized = normalizeFinalTestSession(session);
  const raw = session && typeof session === "object" ? session : {};
  // 客户端编辑循环里，顶层 stageX 才是最新写入值；shared normalizer 会优先读 payload.stageX，
  // 而 payload 可能滞后于刚写入的顶层数据。因此这里优先取顶层，顶层缺失时（例如来自服务端的
  // 纯 payload 文档）再回退到 shared normalizer 的提取结果。
  const srcStage1 =
    raw.stage1 && typeof raw.stage1 === "object" ? raw.stage1 : normalized.stage1 || {};
  const srcStage2 =
    raw.stage2 && typeof raw.stage2 === "object" ? raw.stage2 : normalized.stage2 || {};
  const srcStage3 =
    raw.stage3 && typeof raw.stage3 === "object" ? raw.stage3 : normalized.stage3 || {};

  const stage1 = {
    draftText: Array.isArray(srcStage1?.ideas) && srcStage1.ideas.length > 0
      ? srcStage1.ideas
          .map((item) => String(item?.text || "").trim())
          .filter(Boolean)
          .join("\n\n")
      : String(srcStage1?.draftText || ""),
    lockedAt: String(srcStage1?.lockedAt || ""),
    submittedAt: String(srcStage1?.submittedAt || ""),
    pasteBlockedCount: Number(srcStage1?.pasteBlockedCount || 0),
  };
  const stage2 = {
    messages: Array.isArray(srcStage2?.messages)
      ? srcStage2.messages.map((item) => ({
          id: String(item?.id || ""),
          role: item?.role === "assistant" ? "assistant" : "user",
          content: String(item?.content || ""),
          createdAt: String(item?.createdAt || ""),
          feedback: item?.feedback === "up" || item?.feedback === "down" ? item.feedback : null,
        }))
      : [],
    promptCardClicks: Array.isArray(srcStage2?.promptCardClicks)
      ? srcStage2.promptCardClicks
      : [],
    promptCardCopies: Array.isArray(srcStage2?.promptCardCopies)
      ? srcStage2.promptCardCopies
      : [],
    transfers: Array.isArray(srcStage2?.transfers) ? srcStage2.transfers : [],
    riskEvents: Array.isArray(srcStage2?.riskEvents) ? srcStage2.riskEvents : [],
    draftText: String(srcStage2?.draftText || ""),
    submittedAt: String(srcStage2?.submittedAt || ""),
  };
  const stage3 = {
    draft:
      srcStage3?.draft && typeof srcStage3.draft === "object" ? srcStage3.draft : {},
    pasteEvents: Array.isArray(srcStage3?.pasteEvents) ? srcStage3.pasteEvents : [],
    riskEvents: Array.isArray(srcStage3?.riskEvents) ? srcStage3.riskEvents : [],
    finalText: String(srcStage3?.finalText || ""),
    submittedAt: String(srcStage3?.submittedAt || ""),
  };
  const turnbackEvents = Array.isArray(raw.turnbackEvents)
    ? raw.turnbackEvents
    : Array.isArray(normalized.turnbackEvents)
      ? normalized.turnbackEvents
      : [];
  const riskLog = Array.isArray(raw.riskLog)
    ? raw.riskLog
    : Array.isArray(normalized.riskLog)
      ? normalized.riskLog
      : [];
  const postSubmit =
    raw.postSubmit && typeof raw.postSubmit === "object"
      ? normalizePostSubmitFlow(raw.postSubmit)
      : normalizePostSubmitFlow(normalized.postSubmit);

  return {
    ...normalized,
    variant: normalized.variant || fallbackVariant || "disabled",
    stage1,
    stage2,
    stage3,
    postSubmit,
    turnbackEvents,
    riskLog,
    // 让 payload 与顶层 stage 数据保持一致，避免下一轮 commitSession 经 shared normalizer
    // 时被滞后的 payload 覆盖。
    payload: { stage1, stage2, stage3, postSubmit, turnbackEvents, riskLog },
  };
}

function buildStage2SystemPrompt(variant, taskTitle, stage1DraftText = "", draftText = "") {
  const taskText = String(taskTitle || "任务 1：改进普通书包").trim();
  const draftSection = String(draftText || "").trim();
  if (variant === "two-stage-free") {
    return [
      "你现在处于对照班的自由 AI 协作阶段。允许自由讨论与生成，但回复要简洁、具体、可执行。",
      `任务：${taskText}`,
      draftSection ? `学生当前笔记：\n${draftSection}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  }
  const ideasText = String(stage1DraftText || "").trim();
  return [
    "你现在处于实验班的 AI 协作改进阶段。请围绕学生原始想法做比较、改进、组合与反思，不要直接替学生生成完整最终答案。",
    `任务：${taskText}`,
    `学生原始想法：\n${ideasText || "本阶段没有原始想法记录。"}`,
    draftSection ? `当前草稿：\n${draftSection}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function hasCompletedStage1Draft(draftText = "") {
  return String(draftText || "").trim().length > 0;
}

function replaceMessageById(messages, messageId, updater) {
  return (Array.isArray(messages) ? messages : []).map((message) => {
    if (String(message?.id || "") !== String(messageId || "")) return message;
    return updater(message);
  });
}

function readShadowSession(storageKey) {
  if (typeof window === "undefined" || !storageKey) return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeShadowSession(storageKey, session) {
  if (typeof window === "undefined" || !storageKey || !session) return;
  try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        savedAt: new Date().toISOString(),
        session,
      }),
    );
  } catch {
    // Ignore client-side cache write failures.
  }
}

function clearShadowSession(storageKey) {
  if (typeof window === "undefined" || !storageKey) return;
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // Ignore client-side cache cleanup failures.
  }
}

function recoverShadowSession(remoteSession, storageKey) {
  const shadow = readShadowSession(storageKey);
  const normalizedRemote = normalizeFinalTestSession(remoteSession);
  if (!shadow?.session || typeof shadow.session !== "object") {
    return {
      restored: false,
      session: normalizedRemote,
    };
  }
  const normalizedShadow = normalizeFinalTestSession(shadow.session);
  if (normalizedRemote.status === "submitted") {
    clearShadowSession(storageKey);
    return {
      restored: false,
      session: normalizedRemote,
    };
  }
  if (
    normalizedRemote.startedAt &&
    normalizedShadow.startedAt &&
    normalizedRemote.startedAt === normalizedShadow.startedAt
  ) {
    return {
      restored: true,
      session: normalizedShadow,
    };
  }
  return {
    restored: false,
    session: normalizedRemote,
  };
}

function buildSessionFingerprint(session) {
  const safeSession = session && typeof session === "object" ? session : {};
  return JSON.stringify({
    status: String(safeSession.status || ""),
    lockedAt: String(safeSession.lockedAt || ""),
    submittedAt: String(safeSession.submittedAt || ""),
    timeExpired: safeSession.timeExpired === true,
    stage1: safeSession.stage1 || {},
    stage2: safeSession.stage2 || {},
    stage3: safeSession.stage3 || {},
    postSubmit: normalizePostSubmitFlow(safeSession.postSubmit),
    turnbackEvents: Array.isArray(safeSession.turnbackEvents) ? safeSession.turnbackEvents : [],
    riskLog: Array.isArray(safeSession.riskLog) ? safeSession.riskLog : [],
  });
}

function buildRiskLoggedSession(session, type, extra = {}) {
  const current = session && typeof session === "object" ? session : null;
  if (!current) return current;
  const resolvedStage = String(extra.stage || resolveFinalTestStageFromStatus(current.status) || "").trim();
  const nextEvent = createRiskEvent(type, resolvedStage, extra);
  const nextSession = {
    ...current,
    riskLog: [...(Array.isArray(current.riskLog) ? current.riskLog : []), nextEvent],
  };

  if (type === "paste_blocked") {
    nextSession.stage1 = {
      ...(nextSession.stage1 || {}),
      pasteBlockedCount: Number(nextSession.stage1?.pasteBlockedCount || 0) + 1,
    };
  }

  if (resolvedStage === "stage2") {
    nextSession.stage2 = {
      ...(nextSession.stage2 || {}),
      riskEvents: [
        ...(Array.isArray(nextSession.stage2?.riskEvents) ? nextSession.stage2.riskEvents : []),
        nextEvent,
      ],
    };
  }

  if (resolvedStage === "stage3") {
    nextSession.stage3 = {
      ...(nextSession.stage3 || {}),
      riskEvents: [
        ...(Array.isArray(nextSession.stage3?.riskEvents) ? nextSession.stage3.riskEvents : []),
        nextEvent,
      ],
      pasteEvents:
        type === "paste_allowed"
          ? [
              ...(Array.isArray(nextSession.stage3?.pasteEvents)
                ? nextSession.stage3.pasteEvents
                : []),
              nextEvent,
            ]
          : Array.isArray(nextSession.stage3?.pasteEvents)
            ? nextSession.stage3.pasteEvents
            : [],
    };
  }

  return nextSession;
}

function StageBadge({ active, index, name, muted = false }) {
  return (
    <div className={`final-test-stage-badge${active ? " active" : ""}${muted ? " muted" : ""}`}>
      <div className="final-test-stage-node" aria-hidden="true">
        <span>{index}</span>
      </div>
      <div className="final-test-stage-copy">
        <strong>{name}</strong>
      </div>
    </div>
  );
}

function FinalTestDialog({ dialog, onClose, onSubmit }) {
  if (!dialog) return null;
  return (
    <div className="final-test-dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="final-test-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={dialog.title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="final-test-dialog-head">
          <strong>{dialog.title}</strong>
        </header>
        <p className="final-test-dialog-copy">{dialog.message}</p>
        {dialog.kind === "turnback" || dialog.kind === "restart" ? (
          <div className="final-test-dialog-form">
            <label className="final-test-field">
              <span>{dialog.passphraseLabel || "口令"}</span>
              <input
                type="password"
                value={dialog.passphrase}
                onChange={(event) => onSubmit({ type: "passphrase", value: event.target.value })}
                placeholder={dialog.passphrasePlaceholder || ""}
              />
            </label>
            <label className="final-test-field">
              <span>{dialog.reasonLabel || "原因"}</span>
              <textarea
                rows={4}
                value={dialog.reason}
                onChange={(event) => onSubmit({ type: "reason", value: event.target.value })}
                placeholder={dialog.reasonPlaceholder || "请填写原因"}
              />
            </label>
          </div>
        ) : null}
        {dialog.errorMessage ? (
          <div className="final-test-dialog-error" role="alert">
            <AlertTriangle size={14} />
            <span>{dialog.errorMessage}</span>
          </div>
        ) : null}
        <footer className="final-test-dialog-actions">
          <button type="button" className="final-test-ghost-btn" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="final-test-primary-btn"
            onClick={() => onSubmit({ type: "confirm" })}
          >
            {dialog.confirmLabel || "确认"}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default function StudentFinalTestPanel({ storedUser, taskSettings, debugMode = false }) {
  const className = String(storedUser?.profile?.className || storedUser?.className || "").trim();
  const studentUserId = String(
    storedUser?._id || storedUser?.id || storedUser?.userId || storedUser?.username || className,
  ).trim();
  const taskExperiment = taskSettings?.experimentTask || null;
  const finalTestContent = useMemo(
    () => normalizeFinalTestContentConfig(taskSettings?.finalTestConfig),
    [taskSettings?.finalTestConfig],
  );
  const [experimentTask, setExperimentTask] = useState(() => ({
    enabled: taskExperiment?.enabled === true,
    variant: String(taskExperiment?.variant || "disabled"),
    durationMinutes: Number.isFinite(Number(taskExperiment?.durationMinutes))
      ? Math.max(0, Number(taskExperiment.durationMinutes))
      : 20,
    entryLabel: String(taskExperiment?.entryLabel || "期末测试"),
    demoMode: taskExperiment?.demoMode === true,
    timingEnabled: taskExperiment?.timingEnabled === true,
  }));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [session, setSession] = useState(null);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamingAssistantId, setStreamingAssistantId] = useState("");
  const [stage1Input, setStage1Input] = useState("");
  const [stage1Dirty, setStage1Dirty] = useState(false);
  const [stage2Input, setStage2Input] = useState("");
  const [stage2Dirty, setStage2Dirty] = useState(false);
  const [stage3Input, setStage3Input] = useState("");
  const [stage3Dirty, setStage3Dirty] = useState(false);
  const [aiQuoteText, setAiQuoteText] = useState("");
  const [promptsExpanded, setPromptsExpanded] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [notice, setNotice] = useState("");
  const [remainingMs, setRemainingMs] = useState(0);
  const saveTimerRef = useRef(null);
  const streamAbortRef = useRef(null);
  const mountedRef = useRef(false);
  const sessionRef = useRef(null);
  const stage1SyncKeyRef = useRef("");
  const stage2SyncKeyRef = useRef("");
  const stage3SyncKeyRef = useRef("");
  const persistRequestIdRef = useRef(0);
  const localSessionVersionRef = useRef(0);
  const lastInputAtRef = useRef(Date.now());
  const hiddenAtRef = useRef(0);
  const blurAtRef = useRef(0);

  const shadowStorageKey = useMemo(
    () => `final-test-shadow:${studentUserId || "student"}:${className || "class"}`,
    [className, studentUserId],
  );

  const variant = session?.variant || experimentTask.variant || "disabled";
  const isDemoMode = experimentTask.demoMode === true;
  const timingEnabled = experimentTask.timingEnabled === true && !isDemoMode;
  const stage = resolveFinalTestStageFromStatus(session?.status);
  const isSubmitted = session?.status === "submitted";
  const isExpired = session?.status === "time_expired_locked" || session?.timeExpired === true;
  const isStarted =
    !!session &&
    session.status !== "not_started" &&
    session.status !== "disabled" &&
    session.status !== "";
  const stage1DraftText = String(session?.stage1?.draftText || "");
  const stage2AnswerText = buildStage2DraftText(session?.stage2 || {});
  const stage3FinalText = buildStage3FinalText(session?.stage3 || {});
  const stage3Locked = session?.status === "time_expired_locked" || isSubmitted;
  const liveRemainingMs =
    timingEnabled && isStarted
      ? Math.max(
          0,
          remainingMs || Date.parse(String(session?.deadlineAt || "")) - Date.now(),
        )
      : 0;
  const timerStatusText = isDemoMode
    ? "演示模式，不计时"
    : timingEnabled && isStarted && !isSubmitted
      ? `剩余时间 ${formatFinalTestCountdown(liveRemainingMs)}`
      : "";
  const stage1SyncKey =
    stage === "stage1"
      ? [
          String(session?.startedAt || ""),
          String(session?.status || ""),
          String(session?.stage1?.lockedAt || ""),
          String(session?.stage1?.submittedAt || ""),
          Array.isArray(session?.turnbackEvents) ? session.turnbackEvents.length : 0,
        ].join("|")
      : "";

  useEffect(() => {
    if (stage !== "stage1") return;
    if (stage1SyncKeyRef.current === stage1SyncKey) return;
    stage1SyncKeyRef.current = stage1SyncKey;
    setStage1Input(stage1DraftText);
    setStage1Dirty(false);
  }, [stage, stage1DraftText, stage1SyncKey]);

  // Stage 2 协作草稿同样改为手动保存：仅在进入/回退到 stage2 时用会话值重置本地输入，
  // 正常编辑不被覆盖（同步键不含 draftText）。
  const stage2SyncKey =
    stage === "stage2"
      ? [
          String(session?.startedAt || ""),
          String(session?.status || ""),
          String(session?.stage2?.submittedAt || ""),
          Array.isArray(session?.turnbackEvents) ? session.turnbackEvents.length : 0,
        ].join("|")
      : "";

  useEffect(() => {
    if (stage !== "stage2") return;
    if (stage2SyncKeyRef.current === stage2SyncKey) return;
    stage2SyncKeyRef.current = stage2SyncKey;
    setStage2Input(stage2AnswerText);
    setStage2Dirty(false);
  }, [stage, stage2AnswerText, stage2SyncKey]);

  const stage3SyncKey =
    stage === "stage3"
      ? [
          String(session?.startedAt || ""),
          String(session?.status || ""),
          Array.isArray(session?.turnbackEvents) ? session.turnbackEvents.length : 0,
        ].join("|")
      : "";

  useEffect(() => {
    if (stage !== "stage3") return;
    if (stage3SyncKeyRef.current === stage3SyncKey) return;
    stage3SyncKeyRef.current = stage3SyncKey;
    setStage3Input(stage3FinalText);
    setStage3Dirty(false);
  }, [stage, stage3FinalText, stage3SyncKey]);

  const syncExperimentTask = useCallback((nextTask) => {
    if (!nextTask || typeof nextTask !== "object") return;
    setExperimentTask((current) => ({
      ...current,
      enabled: nextTask.enabled === true,
      variant: String(nextTask.variant || current.variant || "disabled"),
      durationMinutes: Number.isFinite(Number(nextTask.durationMinutes))
        ? Math.max(0, Number(nextTask.durationMinutes))
        : Number(current.durationMinutes || 20),
      entryLabel: String(nextTask.entryLabel || current.entryLabel || "期末测试"),
      demoMode: nextTask.demoMode === true,
      timingEnabled: nextTask.timingEnabled === true,
    }));
  }, []);

  const persistSession = useCallback(
    async (nextSession, options = {}) => {
      const snapshotVersion = Number(options.snapshotVersion || localSessionVersionRef.current || 0);
      const requestFingerprint = buildSessionFingerprint(nextSession);
      if (!nextSession || nextSession.status === "not_started" || nextSession.status === "disabled") {
        return nextSession;
      }
      const requestId = ++persistRequestIdRef.current;
      if (mountedRef.current) setSaving(true);
      try {
        const resp = await updateClassroomFinalTestSession(nextSession);
        syncExperimentTask(resp?.experimentTask);
        const normalized = normalizeSessionForView(
          resp?.session,
          resp?.experimentTask?.variant || nextSession.variant,
        );
        writeShadowSession(shadowStorageKey, normalized);
        const latestFingerprint = buildSessionFingerprint(sessionRef.current);
        const hasNewerLocalChanges =
          snapshotVersion !== localSessionVersionRef.current ||
          latestFingerprint !== requestFingerprint;
        if (!hasNewerLocalChanges && requestId === persistRequestIdRef.current && mountedRef.current) {
          sessionRef.current = normalized;
          setSession(normalized);
          return normalized;
        }
        return sessionRef.current || normalized;
      } catch (error) {
        if (mountedRef.current) {
          setLoadError(error?.message || "保存期末测试状态失败。");
        }
        return nextSession;
      } finally {
        if (requestId === persistRequestIdRef.current && mountedRef.current) {
          setSaving(false);
        }
      }
    },
    [shadowStorageKey, syncExperimentTask],
  );

  const queuePersist = useCallback(
    (nextSession, snapshotVersion) => {
      if (!nextSession || nextSession.status === "not_started" || nextSession.status === "disabled") {
        return;
      }
      writeShadowSession(shadowStorageKey, nextSession);
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        void persistSession(nextSession, { snapshotVersion });
      }, 600);
    },
    [persistSession, shadowStorageKey],
  );

  const commitSession = useCallback(
    (nextSession, options = {}) => {
      const { immediate = false, persist = true, source = "local" } = options;
      const normalized = normalizeSessionForView(nextSession, variant);
      const snapshotVersion =
        source === "local" ? (localSessionVersionRef.current += 1) : localSessionVersionRef.current;
      sessionRef.current = normalized;
      if (mountedRef.current) setSession(normalized);
      writeShadowSession(shadowStorageKey, normalized);
      if (persist && normalized.status !== "submitted") {
        if (immediate) {
          if (saveTimerRef.current) {
            window.clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
          }
          void persistSession(normalized, { snapshotVersion });
        } else {
          queuePersist(normalized, snapshotVersion);
        }
      }
      return normalized;
    },
    [persistSession, queuePersist, shadowStorageKey, variant],
  );

  const logRiskEvent = useCallback(
    (type, extra = {}, options = {}) => {
      const current = sessionRef.current;
      if (!current || current.status === "not_started" || current.status === "disabled") return current;
      const next = buildRiskLoggedSession(current, type, extra);
      return commitSession(next, {
        immediate: options.immediate === true,
        persist: options.persist !== false,
      });
    },
    [commitSession],
  );

  const applyMutationRisk = useCallback(
    (nextSession, { stage: inputStage, fieldKey, previousValue, nextValue, inputType }) => {
      const now = Date.now();
      const previousText = String(previousValue || "");
      const nextText = String(nextValue || "");
      const charDelta = Math.max(0, nextText.length - previousText.length);
      const idleBeforeMs = now - Number(lastInputAtRef.current || now);
      const hiddenAgoMs = hiddenAtRef.current ? now - hiddenAtRef.current : Number.POSITIVE_INFINITY;
      const blurAgoMs = blurAtRef.current ? now - blurAtRef.current : Number.POSITIVE_INFINITY;
      lastInputAtRef.current = now;

      if (charDelta < LARGE_INSERT_THRESHOLD) {
        return nextSession;
      }

      let flagged = buildRiskLoggedSession(nextSession, "large_insert", {
        stage: inputStage,
        fieldKey,
        charDelta,
        inputType: String(inputType || ""),
        idleBeforeMs,
        hiddenAgoMs: Number.isFinite(hiddenAgoMs) ? hiddenAgoMs : -1,
        blurAgoMs: Number.isFinite(blurAgoMs) ? blurAgoMs : -1,
      });

      if (
        idleBeforeMs >= IDLE_INSERT_THRESHOLD_MS ||
        hiddenAgoMs <= HIDDEN_INSERT_WINDOW_MS ||
        blurAgoMs <= HIDDEN_INSERT_WINDOW_MS
      ) {
        flagged = buildRiskLoggedSession(flagged, "idle_then_large_insert", {
          stage: inputStage,
          fieldKey,
          charDelta,
          inputType: String(inputType || ""),
          idleBeforeMs,
          hiddenAgoMs: Number.isFinite(hiddenAgoMs) ? hiddenAgoMs : -1,
          blurAgoMs: Number.isFinite(blurAgoMs) ? blurAgoMs : -1,
        });
      }

      return flagged;
    },
    [],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      if (streamAbortRef.current) streamAbortRef.current.abort();
    };
  }, []);

  useEffect(() => {
    syncExperimentTask(taskExperiment);
  }, [syncExperimentTask, taskExperiment]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError("");
      try {
        const resp = await fetchClassroomFinalTestSession();
        if (cancelled) return;
        syncExperimentTask(resp?.experimentTask);
        const normalized = normalizeSessionForView(
          resp?.session,
          resp?.experimentTask?.variant || experimentTask.variant,
        );
        const recovered = recoverShadowSession(normalized, shadowStorageKey);
        const nextSession = normalizeSessionForView(
          recovered.session,
          resp?.experimentTask?.variant || experimentTask.variant,
        );
        localSessionVersionRef.current = 0;
        sessionRef.current = nextSession;
        setSession(nextSession);
        // Shadow session restore is silent — no need to notify the student on entry.
      } catch (error) {
        if (!cancelled) {
          setLoadError(error?.message || "读取期末测试状态失败。");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [experimentTask.variant, shadowStorageKey, syncExperimentTask]);

  useEffect(() => {
    if (!notice) return undefined;
    const timerId = window.setTimeout(() => setNotice(""), 3500);
    return () => window.clearTimeout(timerId);
  }, [notice]);

  useEffect(() => {
    if (!isStarted || !timingEnabled || isSubmitted) {
      setRemainingMs(0);
      return undefined;
    }
    const deadlineMs = Date.parse(String(session?.deadlineAt || ""));
    if (!Number.isFinite(deadlineMs)) {
      setRemainingMs(0);
      return undefined;
    }

    const syncCountdown = () => {
      const nextRemainingMs = Math.max(0, deadlineMs - Date.now());
      setRemainingMs(nextRemainingMs);
      if (
        nextRemainingMs <= 0 &&
        sessionRef.current &&
        sessionRef.current.status !== "submitted" &&
        sessionRef.current.status !== "time_expired_locked"
      ) {
        const locked = normalizeSessionForView(
          lockExpiredSession(sessionRef.current, new Date().toISOString()),
          variant,
        );
        localSessionVersionRef.current += 1;
        sessionRef.current = locked;
        setSession(locked);
        writeShadowSession(shadowStorageKey, locked);
        void persistSession(locked, { snapshotVersion: localSessionVersionRef.current });
        setNotice("考试时间已到，当前内容已锁定，请尽快提交。");
      }
    };

    syncCountdown();
    const timerId = window.setInterval(syncCountdown, 1000);
    return () => window.clearInterval(timerId);
  }, [isStarted, isSubmitted, persistSession, shadowStorageKey, timingEnabled, variant, session?.deadlineAt]);

  useEffect(() => {
    if (!loadError) return undefined;
    const timerId = window.setTimeout(() => setLoadError(""), 5000);
    return () => window.clearTimeout(timerId);
  }, [loadError]);

  useEffect(() => {
    if (!isStarted || isSubmitted) return undefined;
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isStarted, isSubmitted]);

  useEffect(() => {
    if (!isStarted || isSubmitted) return undefined;
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "hidden") return;
      hiddenAtRef.current = Date.now();
      logRiskEvent(
        "tab_hidden",
        {
          stage: resolveFinalTestStageFromStatus(sessionRef.current?.status),
          visibilityState: document.visibilityState,
        },
        { immediate: true },
      );
      if (sessionRef.current) {
        void persistSession(sessionRef.current);
      }
    };
    const handleBlur = () => {
      if (document.visibilityState === "hidden") return;
      blurAtRef.current = Date.now();
      logRiskEvent(
        "window_blur",
        {
          stage: resolveFinalTestStageFromStatus(sessionRef.current?.status),
        },
        { immediate: false },
      );
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, [isStarted, isSubmitted, logRiskEvent, persistSession]);

  const openConfirmDialog = useCallback((title, message, onConfirm, confirmLabel = "确认") => {
    setDialog({
      kind: "confirm",
      title,
      message,
      onConfirm,
      confirmLabel,
    });
  }, []);

  const openTurnbackDialog = useCallback((fromStage, toStage) => {
    setDialog({
      kind: "turnback",
      title: "回退确认",
      message: `请输入回退口令和回退原因。系统会标记这次从 ${fromStage} 到 ${toStage} 的回退，并直接重新开放目标阶段。`,
      confirmLabel: "确认回退",
      fromStage,
      toStage,
      passphrase: "",
      reason: "",
      errorMessage: "",
      passphraseLabel: "回退口令",
      passphrasePlaceholder: "请输入口令",
      reasonLabel: "回退原因",
      reasonPlaceholder: "请说明为什么需要回退",
    });
  }, []);

  const openRestartDialog = useCallback(() => {
    setDialog({
      kind: "restart",
      title: "申请重新开始",
      message: "请输入重新开始口令和原因。系统会清空当前作答内容并从头开始，同时记录这次重新开始。",
      confirmLabel: "确认重新开始",
      passphrase: "",
      reason: "",
      errorMessage: "",
      passphraseLabel: "重新开始口令",
      passphrasePlaceholder: "请输入口令",
      reasonLabel: "重新开始原因",
      reasonPlaceholder: "请说明为什么需要重新开始",
    });
  }, []);

  const handleDialogSubmit = useCallback(
    async (action) => {
      if (!dialog) return;
      if (dialog.kind === "turnback" || dialog.kind === "restart") {
        if (action.type === "passphrase") {
          setDialog((current) =>
            current ? { ...current, passphrase: action.value, errorMessage: "" } : current,
          );
          return;
        }
        if (action.type === "reason") {
          setDialog((current) =>
            current ? { ...current, reason: action.value, errorMessage: "" } : current,
          );
          return;
        }
        if (action.type !== "confirm") return;
        try {
          const resp =
            dialog.kind === "turnback"
              ? await turnbackClassroomFinalTestSession({
                  fromStage: dialog.fromStage,
                  toStage: dialog.toStage,
                  passphrase: dialog.passphrase,
                  reason: dialog.reason,
                })
              : await restartClassroomFinalTestSession({
                  passphrase: dialog.passphrase,
                  reason: dialog.reason,
                });
          syncExperimentTask(resp?.experimentTask);
          const normalized = normalizeSessionForView(
            resp?.session,
            resp?.experimentTask?.variant || variant,
          );
          localSessionVersionRef.current = 0;
          sessionRef.current = normalized;
          setSession(normalized);
          writeShadowSession(shadowStorageKey, normalized);
          streamAbortRef.current?.abort();
          setStreaming(false);
          setStreamingAssistantId("");
          setAiQuoteText("");
          setNotice(
            dialog.kind === "turnback"
              ? "回退已记录，目标阶段已直接重新开放。"
              : "重新开始已记录，测试已从头开始。",
          );
          setDialog(null);
        } catch (error) {
          setDialog((current) =>
            current
              ? {
                  ...current,
                  errorMessage:
                    error?.message || (dialog.kind === "turnback" ? "回退失败。" : "重新开始失败。"),
                }
              : current,
          );
        }
        return;
      }

      if (action.type === "confirm") {
        const onConfirm = dialog.onConfirm;
        setDialog(null);
        if (typeof onConfirm === "function") {
          await onConfirm();
        }
      }
    },
    [dialog, shadowStorageKey, syncExperimentTask, variant],
  );

  async function handleStart() {
    setStarting(true);
    setLoadError("");
    try {
      const resp = await startClassroomFinalTestSession();
      syncExperimentTask(resp?.experimentTask);
      const normalized = normalizeSessionForView(
        resp?.session,
        resp?.experimentTask?.variant || experimentTask.variant,
      );
      localSessionVersionRef.current = 0;
      sessionRef.current = normalized;
      setSession(normalized);
      writeShadowSession(shadowStorageKey, normalized);
      setNotice(debugMode ? "测试已开始，当前为调试模式。" : "测试已开始。");
    } catch (error) {
      setLoadError(error?.message || "开始测试失败。");
    } finally {
      setStarting(false);
    }
  }

  function requestStart() {
    if (isDemoMode) {
      void handleStart();
      return;
    }
    openConfirmDialog(
      "确认参加期末测试",
      FINAL_TEST_START_CONFIRM_MESSAGE,
      handleStart,
      "确认参加",
    );
  }

  // Stage 1 为手动保存模式：编辑只更新本地输入并标记“未保存”，不自动写入会话/服务端。
  function handleStage1Edit(value) {
    setStage1Input(value);
    setStage1Dirty(true);
  }

  // 手动保存：把当前编辑框内容写入会话并立即持久化，记录一次输入风险快照。
  function saveStage1Draft(nativeInputType = "manual_save") {
    const current = sessionRef.current;
    if (!current || resolveFinalTestStageFromStatus(current.status) !== "stage1" || isSubmitted) {
      return current;
    }
    const value = String(stage1Input || "");
    const previousValue = String(current.stage1?.draftText || "");
    const baseNextSession = {
      ...current,
      stage1: {
        ...(current.stage1 || {}),
        draftText: value,
      },
    };
    const nextSession = applyMutationRisk(baseNextSession, {
      stage: "stage1",
      fieldKey: "stage1.draftText",
      previousValue,
      nextValue: value,
      inputType: nativeInputType,
    });
    const normalized = commitSession(nextSession, { immediate: true });
    setStage1Dirty(false);
    return normalized;
  }

  // Stage 2 协作草稿为手动保存：编辑只更新本地输入并标记“未保存”，不自动写入会话/服务端。
  function handleStage2Edit(value) {
    setStage2Input(value);
    setStage2Dirty(true);
  }

  // 手动保存：把当前编辑框内容写入会话并立即持久化，记录一次输入风险快照。
  function saveStage2Draft(nativeInputType = "manual_save") {
    const current = sessionRef.current;
    if (!current || current.status !== "stage2_active") return current;
    const value = String(stage2Input || "");
    const previousValue = String(current.stage2?.draftText || "");
    const baseNextSession = {
      ...current,
      stage2: {
        ...(current.stage2 || {}),
        draftText: value,
      },
    };
    const nextSession = applyMutationRisk(baseNextSession, {
      stage: "stage2",
      fieldKey: "stage2.draftText",
      previousValue,
      nextValue: value,
      inputType: nativeInputType,
    });
    const normalized = commitSession(nextSession, { immediate: true });
    setStage2Dirty(false);
    return normalized;
  }

  function handleStage3Edit(value) {
    setStage3Input(value);
    setStage3Dirty(true);
  }

  function saveStage3Draft(nativeInputType = "manual_save") {
    const current = sessionRef.current;
    if (!current || current.status !== "stage3_active") return current;
    const value = String(stage3Input || "");
    const previousValue = String(current.stage3?.finalText || "");
    const baseNextSession = {
      ...current,
      stage3: {
        ...(current.stage3 || {}),
        finalText: value,
      },
    };
    const nextSession = applyMutationRisk(baseNextSession, {
      stage: "stage3",
      fieldKey: "stage3.finalText",
      previousValue,
      nextValue: value,
      inputType: nativeInputType,
    });
    const normalized = commitSession(nextSession, { immediate: true });
    setStage3Dirty(false);
    return normalized;
  }

  async function confirmStage1Submit() {
    const current = sessionRef.current;
    if (!current) return;
    // 进入 Stage 2 前强制保存当前编辑框内容（手动保存模式）。
    const draftText = String(stage1Input || "");
    if (!hasCompletedStage1Draft(draftText)) {
      setLoadError("请先写下你的想法后再提交。");
      return;
    }
    const nowIso = new Date().toISOString();
    const nextSession = normalizeSessionForView(
      {
        ...current,
        status: "stage2_active",
        stage1: {
          ...(current.stage1 || {}),
          draftText,
          lockedAt: nowIso,
          submittedAt: nowIso,
        },
        stage2: {
          ...(current.stage2 || {}),
          draftText,
          submittedAt: "",
        },
      },
      variant,
    );
    localSessionVersionRef.current += 1;
    // 关键：persist 前先把本地状态切到目标会话，否则 persistSession 内部的
    // fingerprint 比对会因 sessionRef.current 仍是旧 status 而误判为“有更新的本地改动”，
    // 进而丢弃服务端返回的 stage2_active，导致页面停在 Stage 1。
    sessionRef.current = nextSession;
    setSession(nextSession);
    writeShadowSession(shadowStorageKey, nextSession);
    setStage1Dirty(false);
    const persisted = await persistSession(nextSession, {
      snapshotVersion: localSessionVersionRef.current,
    });
    sessionRef.current = persisted;
    setSession(persisted);
    setNotice("独立思考阶段已锁定，进入 AI 协作阶段。");
  }

  async function confirmEnterStage3() {
    const current = sessionRef.current;
    if (!current) return;
    // 进入定稿前强制保存当前协作草稿（手动保存模式）。
    const draftText = String(stage2Input || "");
    const nowIso = new Date().toISOString();
    const nextSession = normalizeSessionForView(
      {
        ...current,
        status: "stage3_active",
        stage2: {
          ...(current.stage2 || {}),
          draftText,
          submittedAt: nowIso,
        },
        stage3: {
          ...(current.stage3 || {}),
          finalText: String(current.stage3?.finalText || draftText || current.stage1?.draftText || ""),
        },
      },
      variant,
    );
    localSessionVersionRef.current += 1;
    // 同 confirmStage1Submit：persist 前先同步本地状态，避免 fingerprint 误判丢弃服务端结果。
    sessionRef.current = nextSession;
    setSession(nextSession);
    writeShadowSession(shadowStorageKey, nextSession);
    setStage2Dirty(false);
    const persisted = await persistSession(nextSession, {
      snapshotVersion: localSessionVersionRef.current,
    });
    sessionRef.current = persisted;
    setSession(persisted);
    setNotice("已进入独立定稿阶段。");
  }

  async function confirmFinalSubmit() {
    saveStage3Draft();
    setSubmitting(true);
    setLoadError("");
    try {
      const resp = await submitClassroomFinalTestSession();
      syncExperimentTask(resp?.experimentTask);
      const normalized = normalizeSessionForView(
        resp?.session,
        resp?.experimentTask?.variant || variant,
      );
      localSessionVersionRef.current = 0;
      sessionRef.current = normalized;
      setSession(normalized);
      clearShadowSession(shadowStorageKey);
      setNotice("测试已提交。");
    } catch (error) {
      setLoadError(error?.message || "提交失败。");
    } finally {
      setSubmitting(false);
    }
  }

  async function recordPostSubmitStep(actionType) {
    const current = sessionRef.current;
    if (!current || current.status !== "submitted") return;
    const nowIso = new Date().toISOString();
    const currentFlow = normalizePostSubmitFlow(current.postSubmit);
    const nextEvents = [
      ...(Array.isArray(currentFlow.events) ? currentFlow.events : []),
      createPostSubmitEvent(
        actionType,
        nowIso,
        actionType === "task1_survey_completed"
          ? "学生确认已完成任务 1 问卷，进入线下任务 2 页面。"
          : "学生确认已完成线下任务 2，进入任务 2 问卷。",
      ),
    ];
    const nextPostSubmit =
      actionType === "task1_survey_completed"
        ? {
            ...currentFlow,
            task1SurveyCompletedAt: currentFlow.task1SurveyCompletedAt || nowIso,
            task2PageEnteredAt: currentFlow.task2PageEnteredAt || nowIso,
            events: nextEvents,
          }
        : {
            ...currentFlow,
            task2ConfirmedAt: currentFlow.task2ConfirmedAt || nowIso,
            task2SurveyEnteredAt: currentFlow.task2SurveyEnteredAt || nowIso,
            events: nextEvents,
          };
    const nextSession = normalizeSessionForView(
      {
        ...current,
        postSubmit: nextPostSubmit,
      },
      variant,
    );
    setSubmitting(true);
    setLoadError("");
    try {
      localSessionVersionRef.current += 1;
      sessionRef.current = nextSession;
      setSession(nextSession);
      const resp = await updateClassroomFinalTestSession(nextSession);
      syncExperimentTask(resp?.experimentTask);
      const normalized = normalizeSessionForView(
        resp?.session,
        resp?.experimentTask?.variant || variant,
      );
      sessionRef.current = normalized;
      setSession(normalized);
      setNotice(
        actionType === "task1_survey_completed"
          ? "已进入任务 2 页面。"
          : "已进入任务 2 问卷。",
      );
    } catch (error) {
      setLoadError(error?.message || "保存任务进度失败。");
      sessionRef.current = current;
      setSession(current);
    } finally {
      setSubmitting(false);
    }
  }

  function requestStage1Submit() {
    openConfirmDialog(
      "提交独立思考阶段",
      "提交后，原始想法会立即锁定。后续只能通过受控回退重新开放，且回退会被平台标记。确认继续吗？",
      confirmStage1Submit,
      "锁定并进入 AI 协作阶段",
    );
  }

  function requestEnterStage3() {
    openConfirmDialog(
      "进入独立定稿阶段",
      "确认结束当前 AI 协作并进入独立定稿阶段吗？进入后不再显示 AI 输入区，只能独立整理最终方案。",
      confirmEnterStage3,
      "进入独立定稿阶段",
    );
  }

  function requestFinalSubmit() {
    openConfirmDialog(
      "提交测试",
      "确认提交当前最终方案吗？提交后将进入只读状态，不能继续编辑。",
      confirmFinalSubmit,
      "确认提交",
    );
  }

  function requestEnterTask2() {
    openConfirmDialog(
      "进入任务 2",
      "请确认你已经完成任务 1 的任务感受问卷。确认后将进入线下任务 2 页面，平台会记录这个时间。",
      () => recordPostSubmitStep("task1_survey_completed"),
      "我已完成任务 1 问卷，进入任务 2",
    );
  }

  function requestEnterTask2Survey() {
    openConfirmDialog(
      "进入任务 2 问卷",
      "请确认你已经在线下完成任务 2。确认后将进入任务 2 问卷，平台会记录这个时间。",
      () => recordPostSubmitStep("task2_confirmed"),
      "确认已完成线下任务 2，进入任务 2 问卷",
    );
  }

  async function sendStage2Message(text) {
    const current = sessionRef.current;
    const safeText = String(text || "").trim();
    if (!current || current.status !== "stage2_active" || !safeText || streaming) return;

    const userMessage = {
      id: `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      role: "user",
      content: safeText,
      feedback: null,
      createdAt: new Date().toISOString(),
    };
    const assistantId = `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const assistantDraft = {
      id: assistantId,
      role: "assistant",
      content: "",
      feedback: null,
      createdAt: new Date().toISOString(),
    };
    const baseMessages = [
      ...(Array.isArray(current.stage2?.messages) ? current.stage2.messages : []),
      userMessage,
      assistantDraft,
    ];
    const seededSession = {
      ...current,
      stage2: {
        ...(current.stage2 || {}),
        messages: baseMessages,
      },
    };

    setStreaming(true);
    setStreamingAssistantId(assistantId);
    commitSession(seededSession);

    const history = [
      {
        role: "system",
        content: buildStage2SystemPrompt(
          variant,
          finalTestContent.taskTitle,
          String(current.stage1?.draftText || ""),
          current.stage2?.draftText || "",
        ),
      },
      ...(Array.isArray(current.stage2?.messages) ? current.stage2.messages : []).map((message) => ({
        role: message.role,
        content: message.content,
      })),
      {
        role: "user",
        content: safeText,
      },
    ];

    const requestController = new AbortController();
    streamAbortRef.current = requestController;

    try {
      await ChatApiService.streamChatCompletion({
        agentId: "A",
        formData: ChatApiService.createChatStreamFormData({
          agentId: "A",
          runtimeConfig: { temperature: 0.6, topP: 0.9 },
          sessionId: `final-test-${studentUserId || className || "student"}`,
          messages: history,
        }),
        signal: requestController.signal,
        handlers: {
          onToken: (chunk) => {
            if (!chunk) return;
            const latest = sessionRef.current;
            if (!latest) return;
            const nextMessages = replaceMessageById(latest.stage2?.messages || [], assistantId, (message) => ({
              ...message,
              content: `${String(message?.content || "")}${chunk}`,
            }));
            commitSession({
              ...latest,
              stage2: {
                ...(latest.stage2 || {}),
                messages: nextMessages,
              },
            });
          },
          onError: (message) => {
            throw new Error(message || "AI 请求失败");
          },
        },
      });
    } catch (error) {
      const isAbort = error?.name === "AbortError";
      const latest = sessionRef.current;
      if (latest) {
        const messages = Array.isArray(latest.stage2?.messages) ? latest.stage2.messages : [];
        const nextMessages = isAbort
          ? // 用户主动停止：保留已生成内容，仅清掉仍为空的 assistant 草稿
            messages.filter(
              (m) => !(m.id === assistantId && String(m?.content || "").trim() === ""),
            )
          : // 请求失败：移除本次的 user + assistant，不写入历史，错误改用右下角气泡提示
            messages.filter((m) => m.id !== userMessage.id && m.id !== assistantId);
        commitSession({
          ...latest,
          stage2: {
            ...(latest.stage2 || {}),
            messages: nextMessages,
          },
        });
      }
      if (!isAbort) {
        setLoadError(error?.message || "AI 回复失败。");
      }
    } finally {
      setStreaming(false);
      setStreamingAssistantId("");
      streamAbortRef.current = null;
    }
  }

  async function regenerateStage2Message(assistantMessageId, promptMessageId) {
    const current = sessionRef.current;
    const safeAssId = String(assistantMessageId || "").trim();
    const safePromptId = String(promptMessageId || "").trim();
    if (!current || current.status !== "stage2_active" || !safeAssId || !safePromptId || streaming) return;

    const messages = Array.isArray(current.stage2?.messages) ? current.stage2.messages : [];
    const promptIdx = messages.findIndex((m) => m.id === safePromptId && m.role === "user");
    if (promptIdx < 0) return;
    const promptText = String(messages[promptIdx]?.content || "").trim();
    if (!promptText) return;

    const previousAssistant = messages.find((m) => m.id === safeAssId);
    const previousAssistantContent = String(previousAssistant?.content || "");
    const previousAssistantFeedback = previousAssistant?.feedback || null;

    const resetMessages = messages.map((m) => {
      if (m.id !== safeAssId) return m;
      return { ...m, content: "", feedback: null };
    });

    setStreaming(true);
    setStreamingAssistantId(safeAssId);
    commitSession({
      ...current,
      stage2: { ...current.stage2, messages: resetMessages },
    });

    const history = [
      {
        role: "system",
        content: buildStage2SystemPrompt(
          variant,
          finalTestContent.taskTitle,
          String(current.stage1?.draftText || ""),
          current.stage2?.draftText || "",
        ),
      },
      ...messages.slice(0, promptIdx + 1).map((m) => ({ role: m.role, content: m.content })),
    ];

    const requestController = new AbortController();
    streamAbortRef.current = requestController;

    try {
      await ChatApiService.streamChatCompletion({
        agentId: "A",
        formData: ChatApiService.createChatStreamFormData({
          agentId: "A",
          runtimeConfig: { temperature: 0.6, topP: 0.9 },
          sessionId: `final-test-${studentUserId || className || "student"}`,
          messages: history,
        }),
        signal: requestController.signal,
        handlers: {
          onToken: (chunk) => {
            if (!chunk) return;
            const latest = sessionRef.current;
            if (!latest) return;
            const nextMessages = replaceMessageById(latest.stage2?.messages || [], safeAssId, (m) => ({
              ...m,
              content: `${String(m?.content || "")}${chunk}`,
            }));
            commitSession({ ...latest, stage2: { ...latest.stage2, messages: nextMessages } });
          },
          onError: (msg) => { throw new Error(msg || "AI 请求失败"); },
        },
      });
    } catch (error) {
      const latest = sessionRef.current;
      if (latest && error?.name !== "AbortError") {
        // 重新生成失败：恢复原回复，不把错误写进历史，错误改用右下角气泡提示
        const restored = replaceMessageById(latest.stage2?.messages || [], safeAssId, (m) => ({
          ...m,
          content: previousAssistantContent,
          feedback: previousAssistantFeedback,
        }));
        commitSession({ ...latest, stage2: { ...latest.stage2, messages: restored } });
        setLoadError(error?.message || "AI 重新回答失败。");
      }
    } finally {
      setStreaming(false);
      setStreamingAssistantId("");
      streamAbortRef.current = null;
    }
  }

  function handleStage2MessageFeedback(messageId, feedback) {
    const current = sessionRef.current;
    const safeMessageId = String(messageId || "").trim();
    const safeFeedback = feedback === "up" || feedback === "down" ? feedback : "";
    if (!current || !safeMessageId || !safeFeedback) return;
    const messages = Array.isArray(current.stage2?.messages) ? current.stage2.messages : [];
    let changed = false;
    const nextMessages = messages.map((m) => {
      if (String(m?.id || "") !== safeMessageId || m.role !== "assistant") return m;
      const nextFeedback = m.feedback === safeFeedback ? null : safeFeedback;
      changed = true;
      return { ...m, feedback: nextFeedback };
    });
    if (!changed) return;
    commitSession({ ...current, stage2: { ...(current.stage2 || {}), messages: nextMessages } });
  }

  function handleInsertMessageToAnswer(messageId) {
    const current = sessionRef.current;
    if (!current || !messageId) return;
    const messages = Array.isArray(current.stage2?.messages) ? current.stage2.messages : [];
    const message = messages.find((m) => m.id === messageId && m.role === "assistant");
    const content = String(message?.content || "").trim();
    if (!content) return;
    const targetField = stage === "stage2" ? "stage2.draftText" : "stage3.finalText";
    const transferEvent = buildInternalTransferEvent({
      sourceMessageId: messageId,
      sourceRole: "assistant",
      selectedText: content,
      targetField,
      insertedAt: new Date().toISOString(),
    });

    if (stage === "stage2") {
      // 追加到本地编辑框并标记“未保存”（手动保存模式）；转移记录仍立即持久化以保留研究数据。
      const currentText = String(stage2Input || "");
      const updatedText = currentText.trim() ? `${currentText.trim()}\n${content}` : content;
      setStage2Input(updatedText);
      setStage2Dirty(true);
      commitSession({
        ...current,
        stage2: {
          ...(current.stage2 || {}),
          transfers: [
            ...(Array.isArray(current.stage2?.transfers) ? current.stage2.transfers : []),
            transferEvent,
          ],
        },
      });
      setNotice("已追加到左侧答题区，记得点保存。");
      return;
    }

    // Stage 3 定稿仍为即时写入。
    const currentText = String(current.stage3?.finalText || "");
    const updatedText = currentText.trim() ? `${currentText.trim()}\n${content}` : content;
    const nextSession = {
      ...current,
      stage2: {
        ...(current.stage2 || {}),
        transfers: [
          ...(Array.isArray(current.stage2?.transfers) ? current.stage2.transfers : []),
          transferEvent,
        ],
      },
      stage3: {
        ...(current.stage3 || {}),
        finalText: updatedText,
      },
    };
    commitSession(nextSession);
    setNotice("已追加到左侧答题区，平台会保留内部转移记录。");
  }

  function handleStage1Paste(event) {
    const text = String(event.clipboardData?.getData("text/plain") || "");
    event.preventDefault();
    logRiskEvent(
      "paste_blocked",
      {
        stage: "stage1",
        chars: text.length,
      },
      { immediate: false },
    );
    setNotice("独立思考阶段已禁止粘贴外部内容，请独立输入你的原始想法。");
  }

  function handleStage2Paste(event) {
    const text = String(event.clipboardData?.getData("text/plain") || "");
    logRiskEvent(
      "paste_allowed",
      {
        stage: "stage2",
        chars: text.length,
      },
      { immediate: false },
    );
  }

  function handleStage3Paste(event, fieldKey) {
    const text = String(event.clipboardData?.getData("text/plain") || "");
    logRiskEvent(
      "paste_allowed",
      {
        stage: "stage3",
        fieldKey,
        chars: text.length,
      },
      { immediate: false },
    );
    setNotice("系统已标记本次独立定稿阶段粘贴行为。若内容来自右侧 AI，对应内容会被单独记录。");
  }

  const finalTestTasks = Array.isArray(finalTestContent.tasks)
    ? finalTestContent.tasks
    : [];
  const displayedTasks =
    finalTestTasks.length > 0
      ? finalTestTasks
      : [
          {
            id: "task-1",
            title: finalTestContent.taskTitle,
            description: finalTestContent.taskDescription,
            mode: "platform",
          },
        ];
  const task2OfflineTask =
    displayedTasks.find((task) => task.mode === "offline") ||
    displayedTasks[1] ||
    {
      title: "任务 2：创新任务",
      description: finalTestContent.task2OfflineText,
      mode: "offline",
    };
  const postSubmitStep = isSubmitted ? resolvePostSubmitStep(session) : "";
  const finalTestTitle = "期末测试";
  const currentStageTitle =
    stage === "stage1"
      ? "请先独立写下你的改进方案"
      : stage === "stage2"
        ? variant === "two-stage-free"
          ? "左侧随时记录笔记，右侧自由使用 AI"
          : "左侧完成作答，右侧与 AI 协作"
        : isExpired
          ? "当前内容已锁定"
          : "在这里完成最终定稿";
  const answerFieldLabel = "";
  const answerPlaceholder =
    stage === "stage1"
      ? "在这里写下你的改进方案。"
      : stage === "stage2"
        ? variant === "two-stage-free"
          ? "自由使用 AI 完成任务 1 并记录草稿。"
          : "在这里整理你的改进方案。可以参考 AI 建议，但请用自己的话完成草稿。"
        : "在这里整理最终方案。";
  const displayedStage2Messages = useMemo(() => {
    const base = session?.stage2?.messages || [];
    // 过滤掉历史里内容为空的 assistant 空壳消息（请求失败/中断会留下空消息，
    // 只会渲染出一排孤立的操作按钮）。正在流式接收的那条初始也为空，需保留。
    const visible = base.filter(
      (m) =>
        m.id === streamingAssistantId ||
        m.role === "user" ||
        String(m?.content || "").trim() !== "",
    );
    if (!streamingAssistantId) return visible;
    return visible.map((m) => (m.id === streamingAssistantId ? { ...m, streaming: true } : m));
  }, [session?.stage2?.messages, streamingAssistantId]);

  if (loading) {
    return (
      <div className="final-test-shell">
        <section className="final-test-card final-test-landing">
          <p className="final-test-status">正在读取期末测试状态…</p>
        </section>
      </div>
    );
  }

  if (!experimentTask.enabled && variant === "disabled") {
    return (
      <div className="final-test-shell">
        <section className="final-test-card final-test-landing">
          <header className="final-test-landing-head">
            <span className="final-test-kicker">期末测试</span>
            <h2>当前班级未开放</h2>
          </header>
          <p className="final-test-body-copy">你的账号班级当前不在 810 / 811 的测试范围内。</p>
        </section>
      </div>
    );
  }

  return (
    <div className="final-test-shell">
      {session?.status === "not_started" ? (
        <>
          <header className="final-test-hero">
            <div className="final-test-hero-main">
              <h2>{finalTestTitle}</h2>
              <p className="final-test-hero-copy">{finalTestContent.introText}</p>
            </div>
            <div className="final-test-hero-side">
              <div className={`final-test-runtime-pill${isDemoMode ? " demo" : " timed"}`}>
                {timerStatusText || (isDemoMode ? "演示模式，不计时" : "正式模式，开始后计时")}
              </div>
            </div>
          </header>

          <section className="final-test-task-board final-test-task-board-compact">
            <div className="final-test-task-list">
              {displayedTasks.map((task, index) => (
                <article
                  key={task.id || `task-${index + 1}`}
                  className="final-test-task-item"
                >
                  <div className="final-test-task-item-head">
                    <strong>{String(task.title || `任务 ${index + 1}`)}</strong>
                    <span>{task.mode === "offline" ? "线下完成" : "平台内完成"}</span>
                  </div>
                  <p className="final-test-task-item-copy">
                    {String(task.description || "未填写任务说明。")}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="final-test-card final-test-landing">
            <header className="final-test-landing-head">
              <h3>{isDemoMode ? "点击开始演示后进入作答流程" : "点击确认开始考试后进入作答流程"}</h3>
            </header>
            <button
              type="button"
              className="final-test-primary-btn final-test-start-btn"
              onClick={() => void requestStart()}
              disabled={starting}
            >
              {starting
                ? isDemoMode
                  ? "正在进入演示…"
                  : "正在开始…"
                : isDemoMode
                  ? "开始演示"
                  : "确认开始考试"}
            </button>
          </section>
        </>
      ) : null}

      {session?.status !== "not_started" && !isSubmitted ? (
        <section className="final-test-exam-layout">
          <section className="final-test-exam-pane final-test-answer-pane">
            <header className="final-test-pane-head">
              <div className="final-test-pane-head-main">
                <h2>{finalTestTitle}</h2>
                <p>{finalTestContent.introText}</p>
              </div>
              <div className="final-test-pane-head-actions">
                {timerStatusText ? (
                  <span className={`final-test-runtime-pill${isDemoMode ? " demo" : " timed"}`}>
                    {timerStatusText}
                  </span>
                ) : null}
                <button
                  type="button"
                  className="final-test-ghost-btn"
                  onClick={openRestartDialog}
                  disabled={saving || streaming || submitting || starting}
                >
                  申请重新开始
                </button>
              </div>
            </header>

            <div className="final-test-pane-scroll final-test-answer-scroll">
              <section className="final-test-task-board final-test-task-board-compact final-test-embedded-board">
                <div className="final-test-task-list">
                  {displayedTasks.map((task, index) => (
                    <article
                      key={task.id || `task-${index + 1}`}
                      className="final-test-task-item"
                    >
                      <div className="final-test-task-item-head">
                        <strong>{String(task.title || `任务 ${index + 1}`)}</strong>
                        <span>{task.mode === "offline" ? "线下完成" : "平台内完成"}</span>
                      </div>
                      <p className="final-test-task-item-copy">
                        {String(task.description || "未填写任务说明。")}
                      </p>
                    </article>
                  ))}
                </div>
              </section>

              <div className="final-test-stage-strip final-test-stage-strip-embedded">
                {variant === "two-stage-free" ? (
                  <>
                    <StageBadge
                      active={stage === "stage2"}
                      index="1"
                      name="AI 自由使用阶段"
                    />
                    <StageBadge
                      active={stage === "stage3" || stage === "time_expired"}
                      index="2"
                      name="独立定稿阶段"
                    />
                    <StageBadge
                      active={false}
                      index="3"
                      name="任务感受"
                    />
                  </>
                ) : (
                  <>
                    <StageBadge
                      active={stage === "stage1"}
                      index="1"
                      name="独立思考阶段"
                    />
                    <StageBadge
                      active={stage === "stage2"}
                      index="2"
                      name="AI 协作阶段"
                    />
                    <StageBadge
                      active={stage === "stage3" || stage === "time_expired"}
                      index="3"
                      name="独立定稿阶段"
                    />
                    <StageBadge
                      active={false}
                      index="4"
                      name="任务感受"
                    />
                  </>
                )}
              </div>

              <section className="final-test-answer-workbench">
                <header className="final-test-stage-head">
                  <div>
                    <h3>
                      {currentStageTitle}
                      {(stage === "stage1" && stage1Dirty) ||
                      (stage === "stage2" && stage2Dirty) ||
                      (stage === "stage3" && stage3Dirty) ? (
                        <em className="final-test-unsaved-flag">未保存</em>
                      ) : null}
                    </h3>
                  </div>
                  <div className="final-test-stage-actions">
                    {stage === "stage1" ? (
                      <>
                        <button
                          type="button"
                          className="final-test-ghost-btn"
                          onClick={() => {
                            saveStage1Draft();
                          }}
                          disabled={!stage1Dirty}
                        >
                          {stage1Dirty ? "保存草稿" : "已保存"}
                        </button>
                        <button
                          type="button"
                          className="final-test-secondary-btn"
                          onClick={requestStage1Submit}
                        >
                          锁定并进入 AI 协作阶段
                        </button>
                      </>
                    ) : null}
                    {stage === "stage2" ? (
                      <>
                        {variant === "three-stage-guided" ? (
                          <button
                            type="button"
                            className="final-test-ghost-btn"
                            onClick={() => openTurnbackDialog("stage2", "stage1")}
                            disabled={streaming}
                          >
                            <RotateCcw size={15} />
                            <span>回退到上一阶段</span>
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="final-test-ghost-btn"
                          onClick={() => {
                            saveStage2Draft();
                          }}
                          disabled={!stage2Dirty}
                        >
                          {stage2Dirty ? "保存草稿" : "已保存"}
                        </button>
                        <button
                          type="button"
                          className="final-test-secondary-btn"
                          onClick={requestEnterStage3}
                          disabled={streaming}
                        >
                          进入独立定稿阶段
                        </button>
                      </>
                    ) : null}
                    {stage === "stage3" && !isExpired && !isSubmitted ? (
                      <>
                        <button
                          type="button"
                          className="final-test-ghost-btn"
                          onClick={() => openTurnbackDialog("stage3", "stage2")}
                          disabled={submitting}
                        >
                          <RotateCcw size={15} />
                          <span>回退到上一阶段</span>
                        </button>
                        <button
                          type="button"
                          className="final-test-ghost-btn"
                          onClick={() => saveStage3Draft()}
                          disabled={!stage3Dirty}
                        >
                          {stage3Dirty ? "保存草稿" : "已保存"}
                        </button>
                        <button
                          type="button"
                          className="final-test-secondary-btn"
                          onClick={requestFinalSubmit}
                          disabled={submitting}
                        >
                          {submitting ? "提交中…" : "提交测试"}
                        </button>
                      </>
                    ) : null}
                    {stage === "time_expired" && !isSubmitted ? (
                      <button
                        type="button"
                        className="final-test-secondary-btn"
                        onClick={requestFinalSubmit}
                        disabled={submitting}
                      >
                        {submitting ? "提交中…" : "提交测试"}
                      </button>
                    ) : null}
                  </div>
                </header>

                <label className="final-test-field final-test-answer-field">
                  {answerFieldLabel ? <span>{answerFieldLabel}</span> : null}
                  <textarea
                    rows={stage === "stage1" ? 16 : stage === "stage2" ? 18 : 20}
                    value={
                      stage === "stage1"
                        ? stage1Input
                        : stage === "stage2"
                          ? stage2Input
                          : stage3Input
                    }
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      if (stage === "stage1") {
                        handleStage1Edit(nextValue);
                        return;
                      }
                      if (stage === "stage2") {
                        handleStage2Edit(nextValue);
                        return;
                      }
                      if (stage === "stage3") {
                        handleStage3Edit(nextValue);
                      }
                    }}
                    onPaste={(event) => {
                      if (stage === "stage1") {
                        handleStage1Paste(event);
                        return;
                      }
                      if (stage === "stage2") {
                        handleStage2Paste(event);
                        return;
                      }
                      if (stage === "stage3") {
                        handleStage3Paste(event, "stage3.finalText");
                      }
                    }}
                    onDrop={(event) => {
                      if (stage === "stage1") {
                        event.preventDefault();
                      }
                    }}
                    placeholder={answerPlaceholder}
                    disabled={stage !== "stage1" && stage !== "stage2" ? stage3Locked : false}
                  />
                </label>
              </section>
            </div>
          </section>

          <aside className="final-test-exam-pane final-test-chat-pane">
            <header className="final-test-pane-head final-test-chat-head">
              <div className="final-test-pane-head-main">
                <h3>AI 对话区</h3>
                <p>{stage === "stage2" ? "在这里与 AI 协作改进你的方案。" : "当前阶段保留 AI 历史，仅供查看。"}</p>
              </div>
            </header>

            <div className="final-test-chat-message-wrap">
              {stage === "stage2" && displayedStage2Messages.length === 0 ? (
                <div className="final-test-chat-empty-hint">
                  可以向 AI 提问，例如比较想法、指出不足、提出改进方向。
                </div>
              ) : null}
              <MessageList
                activeSessionId={`final-test-${studentUserId || className || "student"}`}
                messages={displayedStage2Messages}
                isStreaming={streaming}
                streamingStatusText="AI 正在回答…"
                onAssistantFeedback={stage === "stage2" ? handleStage2MessageFeedback : null}
                onAssistantRegenerate={stage === "stage2" ? regenerateStage2Message : null}
                onAssistantForward={stage === "stage2" || stage === "stage3" ? handleInsertMessageToAnswer : null}
                onAskSelection={stage === "stage2" ? (text) => setAiQuoteText(text) : null}
                showAssistantActions={stage === "stage2"}
                disableAssistantCopy={false}
                assistantForwardLabel="追加到左侧协作草稿"
              />
            </div>

            {stage === "stage2" && variant === "three-stage-guided" ? (
              <div className="final-test-prompt-section">
                <button
                  type="button"
                  className="final-test-prompt-toggle"
                  onClick={() => setPromptsExpanded((value) => !value)}
                  aria-expanded={promptsExpanded}
                >
                  <span>快捷提问</span>
                  {!promptsExpanded ? (
                    <small>不知道怎么问？</small>
                  ) : null}
                  {promptsExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>
                {promptsExpanded ? (
                  <div className="final-test-prompt-list">
                    {STAGE2_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        className="final-test-prompt-btn"
                        disabled={streaming}
                        onClick={() => {
                          const current = sessionRef.current;
                          if (!current) return;
                          commitSession({
                            ...current,
                            stage2: {
                              ...(current.stage2 || {}),
                              promptCardClicks: [
                                ...(Array.isArray(current.stage2?.promptCardClicks)
                                  ? current.stage2.promptCardClicks
                                  : []),
                                { prompt, createdAt: new Date().toISOString() },
                              ],
                            },
                          });
                          void sendStage2Message(prompt);
                        }}
                      >
                        <Copy size={14} />
                        <span>{prompt}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="final-test-chat-input-wrap">
              <MessageInput
                onSend={sendStage2Message}
                onStop={() => { streamAbortRef.current?.abort(); }}
                disabled={stage !== "stage2"}
                isStreaming={streaming}
                quoteText={aiQuoteText}
                onClearQuote={() => setAiQuoteText("")}
                onConsumeQuote={() => setAiQuoteText("")}
              />
            </div>
          </aside>
        </section>
      ) : null}

      {isSubmitted ? (
        <section className="final-test-survey-pane final-test-exam-pane">
          <header className="final-test-pane-head">
            <div className="final-test-pane-head-main">
              <h2>{finalTestTitle}</h2>
            </div>
            <div className="final-test-pane-head-actions">
              <button
                type="button"
                className="final-test-ghost-btn"
                onClick={openRestartDialog}
                disabled={saving || streaming || submitting || starting}
              >
                申请重新开始
              </button>
            </div>
          </header>
          <div className="final-test-survey-body">
            <div className="final-test-stage-strip final-test-stage-strip-embedded">
              {variant === "two-stage-free" ? (
                <>
                  <StageBadge active={false} muted index="1" name="AI 自由使用阶段" />
                  <StageBadge active={false} muted index="2" name="独立定稿阶段" />
                  <StageBadge
                    active={postSubmitStep === "task1-survey"}
                    muted={postSubmitStep !== "task1-survey"}
                    index="3"
                    name="任务 1 感受"
                  />
                  <StageBadge
                    active={postSubmitStep === "task2-offline"}
                    muted={postSubmitStep !== "task2-offline"}
                    index="4"
                    name="任务 2"
                  />
                  <StageBadge
                    active={postSubmitStep === "task2-survey"}
                    muted={postSubmitStep !== "task2-survey"}
                    index="5"
                    name="任务 2 感受"
                  />
                </>
              ) : (
                <>
                  <StageBadge active={false} muted index="1" name="独立思考阶段" />
                  <StageBadge active={false} muted index="2" name="AI 协作阶段" />
                  <StageBadge active={false} muted index="3" name="独立定稿阶段" />
                  <StageBadge
                    active={postSubmitStep === "task1-survey"}
                    muted={postSubmitStep !== "task1-survey"}
                    index="4"
                    name="任务 1 感受"
                  />
                  <StageBadge
                    active={postSubmitStep === "task2-offline"}
                    muted={postSubmitStep !== "task2-offline"}
                    index="5"
                    name="任务 2"
                  />
                  <StageBadge
                    active={postSubmitStep === "task2-survey"}
                    muted={postSubmitStep !== "task2-survey"}
                    index="6"
                    name="任务 2 感受"
                  />
                </>
              )}
            </div>
            {postSubmitStep === "task1-survey" ? (
              <>
                <div className="final-test-survey-intro">
                  <p>任务 1 平台作答已完成。请先填写任务 1 的任务感受问卷，填写完成后点击下方按钮进入任务 2。</p>
                  <button
                    type="button"
                    className="final-test-secondary-btn"
                    onClick={requestEnterTask2}
                    disabled={submitting}
                  >
                    {submitting ? "正在记录…" : "我已完成任务 1 问卷，进入任务 2"}
                  </button>
                </div>
                <iframe
                  src={TASK1_SURVEY_URL}
                  title="任务 1 感受问卷"
                  className="final-test-survey-iframe"
                  sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-top-navigation"
                />
              </>
            ) : null}
            {postSubmitStep === "task2-offline" ? (
              <section className="final-test-task2-offline-panel">
                <div className="final-test-task2-offline-copy">
                  <span>线下完成</span>
                  <h3>{String(task2OfflineTask.title || "任务 2：创新任务")}</h3>
                  <p>
                    {String(
                      task2OfflineTask.description ||
                        finalTestContent.task2OfflineText ||
                        "任务 2 在线下独立完成。",
                    )}
                  </p>
                </div>
                <div className="final-test-task2-empty-space" aria-hidden="true" />
                <button
                  type="button"
                  className="final-test-secondary-btn final-test-task2-confirm-btn"
                  onClick={requestEnterTask2Survey}
                  disabled={submitting}
                >
                  {submitting ? "正在记录…" : "确认已完成线下任务 2，进入任务 2 问卷"}
                </button>
              </section>
            ) : null}
            {postSubmitStep === "task2-survey" ? (
              <>
                <div className="final-test-survey-intro">
                  <p>任务 2 已确认完成。请在下方填写任务 2 的任务感受问卷。</p>
                </div>
                <iframe
                  src={TASK2_SURVEY_URL}
                  title="任务 2 感受问卷"
                  className="final-test-survey-iframe"
                  sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-top-navigation"
                />
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      {dialog ? (
        <FinalTestDialog
          dialog={dialog}
          onClose={() => setDialog(null)}
          onSubmit={handleDialogSubmit}
        />
      ) : null}

      {loadError || notice ? (
        <div className="final-test-floating-stack">
          {loadError ? (
            <div key={loadError} className="final-test-floating-tip final-test-floating-tip-error" role="alert">
              <AlertTriangle size={14} />
              <span>{loadError}</span>
            </div>
          ) : null}
          {notice ? <div key={notice} className="final-test-floating-tip final-test-floating-tip-notice">{notice}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

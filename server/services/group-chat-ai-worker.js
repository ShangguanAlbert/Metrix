import { GroupChatAiTask } from "../models/group-chat-ai-task.js";
import {
  GroupChatMessage,
  GroupChatStoredFile,
  buildGroupChatFileSignedDownloadUrl,
  callGroupChatOssWithTimeoutFallback,
  groupChatOssClient,
  normalizeGroupChatMessageDoc,
  sanitizeGroupChatFileMimeType,
  sanitizeGroupChatFileName,
  sanitizeGroupChatHttpUrl,
  sleepMs,
  streamAgentResponse,
} from "./core-runtime.js";
import { GROUP_CHAT_AI_LIMITS, GROUP_CHAT_AI_RUNTIME } from "./group-chat-ai.js";
import {
  decrementGroupChatAiPendingCounters,
  popGroupChatAiTaskId,
  publishGroupChatAiMessageUpdated,
  releaseGroupChatAiRunningCapacity,
  requeueGroupChatAiTaskId,
  tryAcquireGroupChatAiRunningCapacity,
} from "../runtime/group-chat-ai-redis.js";

function createSseCaptureResponse(onEvent) {
  let statusCode = 200;
  let buffer = "";
  return {
    headersSent: false,
    setHeader() {},
    flushHeaders() {
      this.headersSent = true;
    },
    status(code) {
      statusCode = Number(code || 500);
      return this;
    },
    json(payload) {
      onEvent("error", {
        message:
          payload?.error ||
          payload?.message ||
          `HTTP ${statusCode || 500}`,
      });
      this.end();
      return this;
    },
    write(chunk) {
      buffer += String(chunk || "");
      consumeBuffer(false);
      return true;
    },
    end(chunk = "") {
      if (chunk) {
        buffer += String(chunk);
      }
      consumeBuffer(true);
    },
  };

  function consumeBuffer(flushAll) {
    while (true) {
      const boundary = buffer.indexOf("\n\n");
      if (boundary < 0) break;
      const rawBlock = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      emitBlock(rawBlock);
    }
    if (flushAll && buffer.trim()) {
      emitBlock(buffer);
      buffer = "";
    }
  }

  function emitBlock(rawBlock) {
    const lines = String(rawBlock || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) return;
    let event = "message";
    let dataText = "";
    lines.forEach((line) => {
      if (line.startsWith("event:")) {
        event = line.slice("event:".length).trim() || "message";
        return;
      }
      if (line.startsWith("data:")) {
        dataText += line.slice("data:".length).trim();
      }
    });
    if (!dataText) return;
    try {
      onEvent(event, JSON.parse(dataText));
    } catch {
      onEvent(event, { text: dataText });
    }
  }
}

function buildGroupChatAiPromptText(snapshot, attachmentLabels = []) {
  const lines = [
    "你正在一个学生群聊里担任固定 AI 助手，请直接回答提问者的问题。",
    `群聊名称：${String(snapshot?.roomName || "群聊")}`,
    `提问者：${String(snapshot?.requestedByUserName || "用户")}`,
    snapshot?.transcriptText
      ? `触发前最近讨论：\n${String(snapshot.transcriptText)}`
      : "触发前最近讨论：无",
  ];
  if (attachmentLabels.length > 0) {
    lines.push(`可参考附件：\n${attachmentLabels.map((label) => `- ${label}`).join("\n")}`);
  }
  lines.push(`用户问题：${String(snapshot?.userQuestion || "").trim() || "请结合上下文作答。"}`);
  lines.push("请优先依据最近讨论和附件内容回答；若信息不足，请明确说明缺少哪些信息。");
  return lines.join("\n\n");
}

function buildTaskAiMeta(task, status, overrides = {}) {
  return {
    taskId: String(task?._id || ""),
    agentId: GROUP_CHAT_AI_RUNTIME.agentId,
    provider: String(overrides.provider || GROUP_CHAT_AI_RUNTIME.provider),
    model: String(overrides.model || GROUP_CHAT_AI_RUNTIME.model),
    requestedByUserId: String(task?.requestedByUserId || ""),
    triggerMessageId: String(task?.triggerMessageId || ""),
    status,
    streaming: Boolean(overrides.streaming),
    error: String(overrides.error || ""),
  };
}

async function readBufferFromStoredFile(storedFileDoc) {
  if (!storedFileDoc) return Buffer.alloc(0);
  const dataBuffer = Buffer.isBuffer(storedFileDoc?.data)
    ? storedFileDoc.data
    : storedFileDoc?.data instanceof Uint8Array
      ? Buffer.from(storedFileDoc.data)
      : Buffer.alloc(0);
  if (dataBuffer.length > 0) return dataBuffer;

  const ossKey = String(storedFileDoc?.ossKey || "").trim();
  if (ossKey && groupChatOssClient) {
    try {
      const result = await callGroupChatOssWithTimeoutFallback(
        `group-chat-ai:get(${ossKey})`,
        async (client) => client.get(ossKey),
        async (client) => client.get(ossKey),
      );
      const value = result?.content ?? result?.data ?? result?.res?.data ?? null;
      if (Buffer.isBuffer(value)) return value;
      if (value instanceof Uint8Array) return Buffer.from(value);
      if (value instanceof ArrayBuffer) return Buffer.from(value);
      if (value && typeof value.arrayBuffer === "function") {
        return Buffer.from(await value.arrayBuffer());
      }
    } catch {
      // Fall through to the signed URL fetch path.
    }
  }

  const downloadUrl =
    sanitizeGroupChatHttpUrl(storedFileDoc?.fileUrl) ||
    (await buildGroupChatFileSignedDownloadUrl({
      ossKey,
      fileName: storedFileDoc?.fileName,
    }));
  if (!downloadUrl) return Buffer.alloc(0);
  const response = await fetch(downloadUrl);
  if (!response.ok) return Buffer.alloc(0);
  return Buffer.from(await response.arrayBuffer());
}

async function resolveGroupChatAiAttachments(snapshot = {}) {
  const files = [];
  const imageParts = [];
  const attachmentLabels = [];
  const attachmentMessages = Array.isArray(snapshot?.attachmentMessages)
    ? snapshot.attachmentMessages
    : [];

  for (const message of attachmentMessages) {
    if (!message || typeof message !== "object") continue;
    if (String(message.type || "").trim().toLowerCase() === "image") {
      const imageUrl = String(message?.image?.dataUrl || "").trim();
      const fileName = String(message?.image?.fileName || "图片").trim() || "图片";
      if (!imageUrl) continue;
      imageParts.push({
        type: "input_image",
        image_url: { url: imageUrl },
      });
      attachmentLabels.push(`图片：${fileName}`);
      continue;
    }
    if (String(message.type || "").trim().toLowerCase() !== "file") continue;
    const fileId = String(message?.file?.fileId || "").trim();
    if (!fileId) continue;
    const storedFileDoc = await GroupChatStoredFile.findOne({
      _id: fileId,
      roomId: snapshot.roomId,
    }).lean();
    if (!storedFileDoc) continue;
    const buffer = await readBufferFromStoredFile(storedFileDoc);
    if (!buffer.length) continue;
    const fileName = sanitizeGroupChatFileName(storedFileDoc?.fileName);
    files.push({
      fieldname: "files",
      originalname: fileName,
      mimetype: sanitizeGroupChatFileMimeType(storedFileDoc?.mimeType),
      size: buffer.length,
      buffer,
    });
    attachmentLabels.push(`文件：${fileName}`);
  }

  return {
    files,
    imageParts,
    attachmentLabels,
  };
}

async function patchAiPlaceholderMessage({
  redis,
  redisPrefix,
  task,
  patch = {},
  logger = console,
}) {
  const placeholderMessageId = String(task?.placeholderMessageId || "").trim();
  if (!placeholderMessageId) return null;
  const update = {
    ...(patch.content != null ? { content: String(patch.content || "") } : {}),
    ...(patch.aiMeta ? { aiMeta: patch.aiMeta } : {}),
    updatedAt: patch.updatedAt instanceof Date ? patch.updatedAt : new Date(),
  };
  const nextDoc = await GroupChatMessage.findByIdAndUpdate(
    placeholderMessageId,
    { $set: update },
    { new: true },
  ).lean();
  const normalized = normalizeGroupChatMessageDoc(nextDoc);
  if (normalized) {
    logger.info?.(
      `[group-chat-ai-worker] publishing message_updated taskId=${String(
        task?._id || "",
      )} roomId=${String(task?.roomId || "").trim()} messageId=${String(
        normalized.id || "",
      ).trim()} status=${String(patch?.aiMeta?.status || normalized?.aiMeta?.status || "").trim()}`,
    );
    await publishGroupChatAiMessageUpdated(redis, {
      prefix: redisPrefix,
      roomId: String(task?.roomId || ""),
      message: normalized,
    });
  }
  return normalized;
}

export function createGroupChatAiWorker({
  redis,
  redisPrefix,
  logger = console,
} = {}) {
  if (!redis) {
    throw new Error("group chat AI worker requires a Redis connection");
  }

  let stopping = false;
  let recoveryTimer = null;

  async function runForever() {
    startRecoveryLoop();
    while (!stopping) {
      const taskId = await popGroupChatAiTaskId(redis, {
        prefix: redisPrefix,
        timeoutSeconds: 5,
      });
      if (!taskId) continue;
      try {
        await processTask(taskId);
      } catch (error) {
        logger.error?.("[group-chat-ai-worker] task failed:", error);
      }
    }
  }

  async function stop() {
    stopping = true;
    if (recoveryTimer) {
      clearInterval(recoveryTimer);
      recoveryTimer = null;
    }
  }

  async function processTask(taskId) {
    const claimedTask = await GroupChatAiTask.findOneAndUpdate(
      { _id: taskId, status: "pending" },
      {
        $set: {
          dequeuedAt: new Date(),
        },
      },
      { new: true },
    ).lean();
    if (!claimedTask) return;

    const startDecision = await tryAcquireGroupChatAiRunningCapacity(redis, {
      prefix: redisPrefix,
      roomId: claimedTask.roomId,
      userId: claimedTask.requestedByUserId,
    });
    if (!startDecision.accepted) {
      await requeuePendingTask(claimedTask);
      return;
    }

    let runningTask = null;
    try {
      runningTask = await GroupChatAiTask.findOneAndUpdate(
        { _id: taskId, status: "pending" },
        {
          $set: {
            status: "running",
            startedAt: new Date(),
            finishedAt: null,
            leaseUntil: new Date(Date.now() + GROUP_CHAT_AI_LIMITS.taskTimeoutMs),
            dequeuedAt: null,
            lastError: "",
          },
          $inc: {
            attemptCount: 1,
          },
        },
        { new: true },
      ).lean();
      if (!runningTask) {
        await releaseGroupChatAiRunningCapacity(redis, {
          prefix: redisPrefix,
          roomId: claimedTask.roomId,
          userId: claimedTask.requestedByUserId,
        });
        return;
      }

      await decrementGroupChatAiPendingCounters(redis, {
        prefix: redisPrefix,
        roomId: runningTask.roomId,
        userId: runningTask.requestedByUserId,
      });

      const attachmentResolution = await resolveGroupChatAiAttachments(
        runningTask.contextSnapshot,
      );
      const promptText = buildGroupChatAiPromptText(
        runningTask.contextSnapshot,
        attachmentResolution.attachmentLabels,
      );
      const messageContent = [
        {
          type: "input_text",
          text: promptText,
        },
        ...attachmentResolution.imageParts,
      ];
      let assistantContent = "";
      let providerMeta = {
        provider: GROUP_CHAT_AI_RUNTIME.provider,
        model: GROUP_CHAT_AI_RUNTIME.model,
      };
      let latestPersistedAt = 0;
      let taskError = "";

      await patchAiPlaceholderMessage({
        redis,
        redisPrefix,
        task: runningTask,
        logger,
        patch: {
          content: "AI 正在回答…",
          aiMeta: buildTaskAiMeta(runningTask, "running", {
            streaming: true,
          }),
        },
      });

      const response = createSseCaptureResponse(async (event, payload) => {
        if (event === "meta") {
          providerMeta = {
            provider: String(
              payload?.provider || providerMeta.provider || GROUP_CHAT_AI_RUNTIME.provider,
            ),
            model: String(
              payload?.model || providerMeta.model || GROUP_CHAT_AI_RUNTIME.model,
            ),
          };
          return;
        }
        if (event === "token") {
          assistantContent += String(payload?.text || "");
          const now = Date.now();
          if (now - latestPersistedAt < 180) return;
          latestPersistedAt = now;
          await patchAiPlaceholderMessage({
            redis,
            redisPrefix,
            task: runningTask,
            logger,
            patch: {
              content: assistantContent || "AI 正在回答…",
              aiMeta: buildTaskAiMeta(runningTask, "running", {
                provider: providerMeta.provider,
                model: providerMeta.model,
                streaming: true,
              }),
            },
          });
          return;
        }
        if (event === "error") {
          taskError = String(payload?.message || "AI 请求失败，请稍后再试。");
        }
      });

      await Promise.race([
        streamAgentResponse({
          res: response,
          agentId: GROUP_CHAT_AI_RUNTIME.agentId,
          messages: [
            {
              role: "user",
              content: messageContent,
            },
          ],
          files: attachmentResolution.files,
          providerOverride: GROUP_CHAT_AI_RUNTIME.provider,
          modelOverride: GROUP_CHAT_AI_RUNTIME.model,
          chatUserId: String(runningTask.requestedByUserId || ""),
          sessionId: `group-chat-ai:${String(runningTask._id || "")}`,
          attachUploadedFiles: attachmentResolution.files.length > 0,
          metaExtras: {
            requestSource: "group-chat-ai-worker",
            roomId: String(runningTask.roomId || ""),
          },
        }),
        sleepMs(GROUP_CHAT_AI_LIMITS.taskTimeoutMs).then(() => {
          throw new Error("AI 回答超时，请稍后再试。");
        }),
      ]);

      if (taskError) {
        throw new Error(taskError);
      }

      await GroupChatAiTask.findByIdAndUpdate(runningTask._id, {
        $set: {
          status: "done",
          finishedAt: new Date(),
          leaseUntil: null,
          dequeuedAt: null,
        },
      });
      await patchAiPlaceholderMessage({
        redis,
        redisPrefix,
        task: runningTask,
        logger,
        patch: {
          content: assistantContent || "AI 已完成回答。",
          aiMeta: buildTaskAiMeta(runningTask, "done", {
            provider: providerMeta.provider,
            model: providerMeta.model,
            streaming: false,
          }),
        },
      });
    } catch (error) {
      const message = error?.message || "AI 请求失败，请稍后再试。";
      const failedTask = runningTask || claimedTask;
      await GroupChatAiTask.findByIdAndUpdate(taskId, {
        $set: {
          status: "failed",
          finishedAt: new Date(),
          leaseUntil: null,
          dequeuedAt: null,
          lastError: message,
        },
      });
      await patchAiPlaceholderMessage({
        redis,
        redisPrefix,
        task: failedTask,
        logger,
        patch: {
          content: message,
          aiMeta: buildTaskAiMeta(failedTask, "failed", {
            streaming: false,
            error: message,
          }),
        },
      });
    } finally {
      await releaseGroupChatAiRunningCapacity(redis, {
        prefix: redisPrefix,
        roomId: claimedTask.roomId,
        userId: claimedTask.requestedByUserId,
      });
    }
  }

  async function requeuePendingTask(task) {
    await sleepMs(800);
    await requeueGroupChatAiTaskId(redis, {
      prefix: redisPrefix,
      taskId: String(task?._id || ""),
    });
    await GroupChatAiTask.findByIdAndUpdate(task?._id, {
      $set: {
        lastQueuedAt: new Date(),
        dequeuedAt: null,
      },
    });
  }

  function startRecoveryLoop() {
    if (recoveryTimer) return;
    recoveryTimer = setInterval(() => {
      void recoverOrphanedPendingTasks().catch((error) => {
        logger.warn?.("[group-chat-ai-worker] pending recovery failed:", error);
      });
      void failExpiredRunningTasks().catch((error) => {
        logger.warn?.("[group-chat-ai-worker] running recovery failed:", error);
      });
    }, 15_000);
  }

  async function recoverOrphanedPendingTasks() {
    const staleTasks = await GroupChatAiTask.find(
      {
        status: "pending",
        dequeuedAt: { $lte: new Date(Date.now() - 15_000) },
      },
      { _id: 1 },
    )
      .sort({ createdAt: 1 })
      .limit(24)
      .lean();
    for (const task of staleTasks) {
      const taskId = String(task?._id || "").trim();
      if (!taskId) continue;
      await requeueGroupChatAiTaskId(redis, { prefix: redisPrefix, taskId });
      await GroupChatAiTask.findByIdAndUpdate(taskId, {
        $set: {
          lastQueuedAt: new Date(),
          dequeuedAt: null,
        },
      });
    }
  }

  async function failExpiredRunningTasks() {
    const expiredTasks = await GroupChatAiTask.find(
      {
        status: "running",
        leaseUntil: { $lte: new Date() },
      },
      {
        _id: 1,
        roomId: 1,
        requestedByUserId: 1,
        triggerMessageId: 1,
        placeholderMessageId: 1,
      },
    )
      .sort({ leaseUntil: 1 })
      .limit(24)
      .lean();
    for (const task of expiredTasks) {
      const taskId = String(task?._id || "").trim();
      if (!taskId) continue;
      const errorMessage = "AI 回答超时，请稍后再试。";
      await GroupChatAiTask.findByIdAndUpdate(taskId, {
        $set: {
          status: "failed",
          finishedAt: new Date(),
          leaseUntil: null,
          lastError: errorMessage,
        },
      });
      await patchAiPlaceholderMessage({
        redis,
        redisPrefix,
        task,
        logger,
        patch: {
          content: errorMessage,
          aiMeta: buildTaskAiMeta(task, "failed", {
            streaming: false,
            error: errorMessage,
          }),
        },
      });
      await releaseGroupChatAiRunningCapacity(redis, {
        prefix: redisPrefix,
        roomId: task.roomId,
        userId: task.requestedByUserId,
      });
    }
  }

  return {
    runForever,
    stop,
    processTask,
    recoverOrphanedPendingTasks,
    failExpiredRunningTasks,
  };
}

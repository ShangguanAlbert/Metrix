function appendIndentedBlock(lines, text, spaces = 6) {
  const indent = " ".repeat(spaces);
  const source = String(text || "");
  if (!source.trim()) {
    lines.push(`${indent}-`);
    return;
  }
  source
    .replace(/\r/g, "")
    .split("\n")
    .forEach((line) => {
      lines.push(`${indent}${line}`);
    });
}

function formatExportDateLabel(exportDate) {
  const safe = String(exportDate || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(safe)) return safe || "-";
  const [year, month, day] = safe.split("-");
  return `${Number(year)}年${Number(month)}月${Number(day)}日`;
}

function stripControlChars(value) {
  return Array.from(String(value || ""))
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("");
}

function sanitizeZipPathSegment(value, fallback = "item") {
  const normalized = stripControlChars(String(value || fallback))
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || fallback;
}

function getFileExtension(fileName) {
  const normalized = String(fileName || "").trim();
  const match = normalized.match(/\.([a-z0-9]{1,16})$/i);
  return match?.[1] ? match[1].toLowerCase() : "";
}

function ensureAttachmentFileName(fileName, mimeType, deps) {
  const safeMimeType = deps.sanitizeGroupChatFileMimeType(mimeType);
  const safeBaseName = sanitizeZipPathSegment(fileName, "attachment");
  if (getFileExtension(safeBaseName)) return safeBaseName;
  const ext = deps.resolveFileExtensionByMimeType(safeMimeType, "bin");
  return `${safeBaseName}.${ext}`;
}

function buildRoomAttachmentDirectory(room, roomIndex) {
  const roomName = sanitizeZipPathSegment(room?.name, "未命名群聊");
  const roomCode = sanitizeZipPathSegment(room?.roomCode, "no-code");
  return `attachments/${String(roomIndex + 1).padStart(3, "0")}-${roomName}-${roomCode}`;
}

function buildMessageAttachmentPath({
  room,
  roomIndex,
  messageIndex,
  attachmentType,
  originalFileName,
  mimeType,
  deps,
}) {
  const roomDirectory = buildRoomAttachmentDirectory(room, roomIndex);
  const safeOriginalName = ensureAttachmentFileName(
    originalFileName,
    mimeType,
    deps,
  );
  return `${roomDirectory}/${String(messageIndex + 1).padStart(3, "0")}-${attachmentType}-${safeOriginalName}`;
}

function buildMessageAttachmentRefText(ref) {
  if (!ref) return "";
  if (ref.missing) {
    return `${ref.path}（缺失：原文件已删除、过期或读取失败）`;
  }
  return ref.path;
}

function resolveMessageId(message, deps) {
  return deps.sanitizeId(message?._id || message?.id, "");
}

function buildAttachmentRefsMap(attachmentRefs = [], deps) {
  const map = new Map();
  attachmentRefs.forEach((item) => {
    const messageId = deps.sanitizeId(item?.messageId, "");
    if (!messageId) return;
    map.set(messageId, item);
  });
  return map;
}

export function buildAdminGroupChatsExportTxt(
  data,
  deps,
  { attachmentRefs = [] } = {},
) {
  const safeTeacherScopeKey = deps.sanitizeTeacherScopeKey(
    data?.safeTeacherScopeKey,
  );
  const exportDate = deps.sanitizeExportDate(data?.exportDate);
  const rooms = Array.isArray(data?.rooms) ? data.rooms : [];
  const messagesByRoomId =
    data?.messagesByRoomId instanceof Map ? data.messagesByRoomId : new Map();
  const userById = data?.userById instanceof Map ? data.userById : new Map();
  const scopedUserCount = Number(data?.scopedUsers?.length || 0);
  const attachmentRefByMessageId = buildAttachmentRefsMap(attachmentRefs, deps);
  const lines = [
    "EduChat 管理员导出：群聊聊天记录",
    `导出时间: ${deps.formatDisplayTime(new Date())}`,
    `授课教师: ${deps.getTeacherScopeLabel(safeTeacherScopeKey)}`,
    ...(exportDate ? [`聊天日期: ${formatExportDateLabel(exportDate)}`] : []),
    `范围内学生数: ${scopedUserCount}`,
    `群聊数量: ${rooms.length}`,
    "",
  ];

  if (rooms.length === 0) {
    lines.push(exportDate ? "当前日期下暂无群聊记录。" : "当前范围暂无群聊记录。");
    return lines.join("\n");
  }

  rooms.forEach((room, roomIndex) => {
    const roomId = deps.sanitizeId(room?._id, "");
    const roomName =
      deps.sanitizeText(room?.name, "未命名群聊", 80) || "未命名群聊";
    const roomCode = deps.sanitizeText(room?.roomCode, "", 32);
    const ownerId = deps.sanitizeId(room?.ownerUserId, "");
    const owner = ownerId ? userById.get(ownerId) : null;
    const ownerLabel = owner
      ? `${owner.displayName}${owner.username ? `(@${owner.username})` : ""}`
      : deps.sanitizeText(room?.ownerUserId, "-", 64) || "-";
    const memberIds = deps.sanitizeGroupChatMemberUserIds(room?.memberUserIds);
    const messages = Array.isArray(messagesByRoomId.get(roomId))
      ? messagesByRoomId.get(roomId)
      : [];

    lines.push(`群聊 ${roomIndex + 1}`);
    lines.push(`名称: ${roomName}`);
    lines.push(`群聊ID: ${roomId || "-"}`);
    lines.push(`群号: ${roomCode || "-"}`);
    lines.push(`群主: ${ownerLabel}`);
    lines.push(`成员数: ${memberIds.length}`);
    lines.push(`消息数: ${messages.length}`);
    lines.push(`创建时间: ${deps.formatDisplayTime(room?.createdAt)}`);
    lines.push(`更新时间: ${deps.formatDisplayTime(room?.updatedAt)}`);
    if (memberIds.length > 0) {
      lines.push("成员列表:");
      memberIds.forEach((memberId, memberIndex) => {
        const member = userById.get(memberId);
        if (!member) {
          lines.push(`  ${memberIndex + 1}. ${memberId}`);
          return;
        }
        const roleLabel = member.role === "admin" ? "管理员" : "学生";
        lines.push(
          `  ${memberIndex + 1}. ${member.displayName}${member.username ? `(@${member.username})` : ""} · ${roleLabel}${member.className ? ` · ${member.className}` : ""}${member.studentId ? ` · ${member.studentId}` : ""}`,
        );
      });
    } else {
      lines.push("成员列表: （空）");
    }

    if (messages.length === 0) {
      lines.push("聊天消息: （空）");
      lines.push("");
      return;
    }

    lines.push("聊天消息:");
    messages.forEach((message, messageIndex) => {
      const type = deps.sanitizeText(message?.type, "text", 12) || "text";
      const senderId = deps.sanitizeId(message?.senderUserId, "");
      const sender = senderId ? userById.get(senderId) : null;
      const senderName =
        deps.sanitizeText(message?.senderName, "", 64) ||
        sender?.displayName ||
        (type === "system" ? "系统消息" : "未知成员");
      const messageId = resolveMessageId(message, deps);
      const attachmentRef = attachmentRefByMessageId.get(messageId);
      lines.push(
        `  ${messageIndex + 1}. [${deps.formatDisplayTime(message?.createdAt)}] ${senderName} (${type})`,
      );
      if (type === "image") {
        lines.push(
          `      图片: ${deps.sanitizeText(message?.image?.fileName, "未命名图片", 120)} · ${deps.sanitizeText(message?.image?.mimeType, "-", 80)} · ${Number(message?.image?.size || 0)}B`,
        );
        if (attachmentRef) {
          lines.push(`      导出附件: ${buildMessageAttachmentRefText(attachmentRef)}`);
        }
      } else if (type === "file") {
        lines.push(
          `      文件: ${deps.sanitizeText(message?.file?.fileName, "未命名文件", 120)} · ${deps.sanitizeText(message?.file?.mimeType, "-", 80)} · ${Number(message?.file?.size || 0)}B`,
        );
        if (attachmentRef) {
          lines.push(`      导出附件: ${buildMessageAttachmentRefText(attachmentRef)}`);
        }
      }
      const messageContent = String(message?.content || "");
      if (messageContent.trim()) {
        lines.push("      内容:");
        appendIndentedBlock(lines, messageContent, 8);
      }
      const reactions = Array.isArray(message?.reactions)
        ? message.reactions
        : [];
      if (reactions.length > 0) {
        const reactionText = reactions
          .slice(0, 20)
          .map((reaction) => {
            const emoji = deps.sanitizeText(reaction?.emoji, "?", 16) || "?";
            const reactionUserId = deps.sanitizeId(reaction?.userId, "");
            const reactionUser = reactionUserId
              ? userById.get(reactionUserId)
              : null;
            const reactionUserName =
              reactionUser?.displayName ||
              deps.sanitizeText(reaction?.userId, "未知成员", 32);
            return `${emoji}×${reactionUserName}`;
          })
          .join("，");
        if (reactionText) {
          lines.push(`      反应: ${reactionText}`);
        }
      }
    });
    lines.push("");
  });

  return lines.join("\n");
}

async function readBinaryContentAsBuffer(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  if (typeof Blob !== "undefined" && value instanceof Blob) {
    return Buffer.from(await value.arrayBuffer());
  }
  if (value && typeof value.arrayBuffer === "function") {
    return Buffer.from(await value.arrayBuffer());
  }
  if (Array.isArray(value?.data)) return Buffer.from(value.data);
  return Buffer.alloc(0);
}

async function downloadOssObjectBuffer({ ossKey, deps }) {
  const safeOssKey = deps.sanitizeGroupChatOssObjectKey(ossKey);
  if (!safeOssKey || !deps.groupChatOssClient) return Buffer.alloc(0);
  try {
    const result = await deps.callGroupChatOssWithTimeoutFallback(
      `get(${safeOssKey})`,
      async (client) => await client.get(safeOssKey),
      async (client) => await client.get(safeOssKey),
    );
    return await readBinaryContentAsBuffer(
      result?.content ?? result?.data ?? result?.res?.data ?? null,
    );
  } catch {
    return Buffer.alloc(0);
  }
}

async function downloadDirectUrlBuffer({ url, deps }) {
  const safeUrl = deps.sanitizeGroupChatHttpUrl(url);
  const fetchFn = deps.fetch || globalThis.fetch;
  if (!safeUrl || typeof fetchFn !== "function") return Buffer.alloc(0);
  try {
    const response = await fetchFn(safeUrl);
    if (!response?.ok) return Buffer.alloc(0);
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return Buffer.alloc(0);
  }
}

async function resolveImageAttachmentBuffer(message, deps) {
  const dataUrl = String(message?.image?.dataUrl || "").trim();
  if (dataUrl) {
    const parsed = deps.parseGeneratedImageDataUrl(dataUrl);
    if (parsed?.data?.length) return Buffer.from(parsed.data);
  }

  const ossKey = deps.sanitizeGroupChatOssObjectKey(message?.image?.oss?.ossKey);
  const ossBuffer = await downloadOssObjectBuffer({ ossKey, deps });
  if (ossBuffer.length > 0) return ossBuffer;

  const directUrl =
    deps.sanitizeGroupChatHttpUrl(message?.image?.oss?.fileUrl) ||
    deps.buildGroupChatOssObjectUrl(ossKey);
  return await downloadDirectUrlBuffer({ url: directUrl, deps });
}

async function resolveFileAttachmentBuffer(roomId, message, deps) {
  const fileId = deps.sanitizeId(message?.file?.fileId, "");
  if (!roomId || !fileId) return Buffer.alloc(0);
  const storedFileDoc = await deps.findGroupChatStoredFileByRoomAndId({
    roomId,
    fileId,
  });
  if (!storedFileDoc) return Buffer.alloc(0);

  const inlineBuffer = deps.extractGeneratedImageDataBuffer(storedFileDoc?.data);
  if (inlineBuffer.length > 0) return inlineBuffer;

  const ossKey = deps.sanitizeGroupChatOssObjectKey(storedFileDoc?.ossKey);
  const ossBuffer = await downloadOssObjectBuffer({ ossKey, deps });
  if (ossBuffer.length > 0) return ossBuffer;

  const directUrl =
    deps.sanitizeGroupChatHttpUrl(storedFileDoc?.fileUrl) ||
    deps.buildGroupChatOssObjectUrl(ossKey);
  return await downloadDirectUrlBuffer({ url: directUrl, deps });
}

export async function buildAdminGroupChatsZipBundle(data, deps) {
  const rooms = Array.isArray(data?.rooms) ? data.rooms : [];
  const messagesByRoomId =
    data?.messagesByRoomId instanceof Map ? data.messagesByRoomId : new Map();
  const files = [];
  const attachmentRefs = [];

  for (let roomIndex = 0; roomIndex < rooms.length; roomIndex += 1) {
    const room = rooms[roomIndex];
    const roomId = deps.sanitizeId(room?._id, "");
    const messages = Array.isArray(messagesByRoomId.get(roomId))
      ? messagesByRoomId.get(roomId)
      : [];
    for (let messageIndex = 0; messageIndex < messages.length; messageIndex += 1) {
      const message = messages[messageIndex];
      const type = deps.sanitizeText(message?.type, "text", 12) || "text";
      const messageId = resolveMessageId(message, deps);
      if (!messageId || (type !== "image" && type !== "file")) continue;

      const originalFileName =
        type === "image"
          ? deps.sanitizeGroupChatImageFileName(message?.image?.fileName)
          : deps.sanitizeGroupChatFileName(message?.file?.fileName);
      const mimeType =
        type === "image"
          ? deps.sanitizeGroupChatFileMimeType(message?.image?.mimeType)
          : deps.sanitizeGroupChatFileMimeType(message?.file?.mimeType);
      const attachmentPath = buildMessageAttachmentPath({
        room,
        roomIndex,
        messageIndex,
        attachmentType: type,
        originalFileName,
        mimeType,
        deps,
      });

      const buffer =
        type === "image"
          ? await resolveImageAttachmentBuffer(message, deps)
          : await resolveFileAttachmentBuffer(roomId, message, deps);

      const ref = {
        messageId,
        path: attachmentPath,
        missing: buffer.length === 0,
      };
      attachmentRefs.push(ref);
      if (buffer.length > 0) {
        files.push({
          name: attachmentPath,
          content: buffer,
        });
      }
    }
  }

  const txtContent = buildAdminGroupChatsExportTxt(data, deps, {
    attachmentRefs,
  });
  const readme = [
    "EduChat 管理员导出：群聊聊天记录 ZIP",
    `导出时间: ${deps.formatDisplayTime(new Date())}`,
    `群聊数量: ${rooms.length}`,
    `附件数量: ${files.length}`,
    "",
    "说明:",
    "1. group-chats.txt 记录群聊元信息、消息正文与导出附件路径。",
    "2. attachments/ 目录存放与文本中“导出附件”字段完全对应的原始附件。",
    "3. 若文本中显示“缺失”，表示原文件在导出时已删除、过期或读取失败。",
    "",
  ].join("\n");

  return {
    files: [
      { name: "README.txt", content: readme },
      { name: "group-chats.txt", content: txtContent },
      ...files,
    ],
    attachmentCount: files.length,
    missingAttachmentCount: attachmentRefs.filter((item) => item.missing).length,
  };
}

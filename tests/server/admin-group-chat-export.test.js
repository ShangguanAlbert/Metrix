import assert from "node:assert/strict";
import test from "node:test";

import { buildAdminGroupChatsZipBundle } from "../../server/services/admin-group-chat-export.js";

test("buildAdminGroupChatsZipBundle keeps txt attachment names aligned with exported files", async () => {
  const pngDataUrl =
    "data:image/png;base64," + Buffer.from("fake-png-binary").toString("base64");
  const data = {
    safeTeacherScopeKey: "teacher-a",
    scopedUsers: [{ _id: "stu-1" }],
    rooms: [
      {
        _id: "room-1",
        name: "第一组",
        roomCode: "1001",
        ownerUserId: "stu-1",
        memberUserIds: ["stu-1"],
        createdAt: "2026-04-13T07:40:00.000Z",
        updatedAt: "2026-04-13T07:42:55.000Z",
      },
    ],
    messagesByRoomId: new Map([
      [
        "room-1",
        [
          {
            _id: "msg-image-1",
            roomId: "room-1",
            type: "image",
            senderUserId: "stu-1",
            senderName: "王乐怡",
            createdAt: "2026-04-13T07:40:51.000Z",
            content: "",
            image: {
              fileName: "image.png",
              mimeType: "image/png",
              size: 73393,
              dataUrl: pngDataUrl,
              oss: {},
            },
          },
          {
            _id: "msg-file-1",
            roomId: "room-1",
            type: "file",
            senderUserId: "stu-1",
            senderName: "王乐怡",
            createdAt: "2026-04-13T07:41:05.000Z",
            content: "",
            file: {
              fileId: "file-1",
              fileName: "作业.docx",
              mimeType:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              size: 120,
              oss: {},
            },
          },
        ],
      ],
    ]),
    userById: new Map([
      [
        "stu-1",
        {
          userId: "stu-1",
          username: "stu1",
          role: "user",
          displayName: "王乐怡",
          studentId: "20232110030018",
          className: "教技231",
        },
      ],
    ]),
    exportDate: "",
  };
  const deps = {
    getTeacherScopeLabel: () => "教师A",
    formatDisplayTime: (value) => String(value || ""),
    sanitizeTeacherScopeKey: (value) => String(value || "").trim(),
    sanitizeExportDate: (value) => String(value || "").trim(),
    sanitizeId: (value, fallback = "") => String(value || fallback).trim(),
    sanitizeText: (value, fallback = "", maxLength = 120) =>
      String(value ?? fallback).trim().slice(0, maxLength),
    sanitizeGroupChatMemberUserIds: (value) =>
      Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [],
    sanitizeGroupChatImageFileName: (value) => String(value || "").trim(),
    sanitizeGroupChatFileName: (value) => String(value || "").trim(),
    sanitizeGroupChatFileMimeType: (value) => String(value || "").trim(),
    sanitizeGroupChatHttpUrl: (value) => String(value || "").trim(),
    sanitizeGroupChatOssObjectKey: (value) => String(value || "").trim(),
    sanitizeZipEntryName: (value, fallback = "file.bin") =>
      String(value || fallback).replace(/[\\:*?"<>|]/g, "_"),
    resolveFileExtensionByMimeType(mimeType, fallback = "bin") {
      if (String(mimeType || "").includes("wordprocessingml")) return "docx";
      if (String(mimeType || "").includes("png")) return "png";
      return fallback;
    },
    parseGeneratedImageDataUrl(value) {
      const match = String(value || "").match(/^data:(.+);base64,(.+)$/);
      if (!match) return null;
      return {
        mimeType: match[1],
        data: Buffer.from(match[2], "base64"),
      };
    },
    extractGeneratedImageDataBuffer(value) {
      return Buffer.isBuffer(value) ? value : Buffer.alloc(0);
    },
    buildGroupChatOssObjectUrl: (value) => `https://oss.example.com/${value}`,
    callGroupChatOssWithTimeoutFallback: async (_label, primary) => await primary({
      get: async () => ({ content: Buffer.from("oss-file") }),
    }),
    groupChatOssClient: { enabled: true },
    findGroupChatStoredFileByRoomAndId: async ({ roomId, fileId }) => {
      assert.equal(roomId, "room-1");
      assert.equal(fileId, "file-1");
      return {
        _id: "file-1",
        roomId: "room-1",
        fileName: "作业.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        data: Buffer.from("docx-binary"),
        storageType: "memory",
        ossKey: "",
        fileUrl: "",
      };
    },
    buildZipBuffer: (files) => files,
  };

  const bundle = await buildAdminGroupChatsZipBundle(data, deps);
  const txtFile = bundle.files.find((item) => item.name === "group-chats.txt");
  const imageAttachment = bundle.files.find((item) =>
    item.name.endsWith("/001-image-image.png"),
  );
  const fileAttachment = bundle.files.find((item) =>
    item.name.endsWith("/002-file-作业.docx"),
  );

  assert.ok(txtFile);
  assert.ok(imageAttachment);
  assert.ok(fileAttachment);
  assert.match(
    txtFile.content,
    /导出附件: attachments\/001-第一组-1001\/001-image-image\.png/,
  );
  assert.match(
    txtFile.content,
    /导出附件: attachments\/001-第一组-1001\/002-file-作业\.docx/,
  );
  assert.equal(imageAttachment.content.toString("utf8"), "fake-png-binary");
  assert.equal(fileAttachment.content.toString("utf8"), "docx-binary");
});

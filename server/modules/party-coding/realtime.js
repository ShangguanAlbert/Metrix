import { normalizeWorkspace } from "./workspace-state.js";
import { canDriveParty } from "../../../shared/party-roles.js";
import * as Y from "yjs";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import { createPartyLearningService } from "./learning-service.js";
import { getPartyWebWorkspaceModel } from "./model.js";
import { ensurePartyPairRoles } from "./pair-roles.js";
import { isCollaborationObserverForRoom } from "./access-control.js";

const MAX_DOCUMENT_LENGTH = 200_000;
const MAX_UPDATE_BYTES = 512 * 1024;
const VERSION_LIMIT = 20;
const PERSIST_DELAY_MS = 800;
const DOCUMENT_NAMES = Object.freeze({ html: "html", css: "css" });
const SERVER_INITIALIZATION_ORIGIN = { type: "party-web-server-initialization" };

function sanitizeDocument(value) {
  return String(value || "").replace(/\r\n/g, "\n").slice(0, MAX_DOCUMENT_LENGTH);
}

function estimateChangedCharacters(beforeValue, afterValue) {
  const before = sanitizeDocument(beforeValue);
  const after = sanitizeDocument(afterValue);
  let prefix = 0;
  const prefixLimit = Math.min(before.length, after.length);
  while (prefix < prefixLimit && before[prefix] === after[prefix]) prefix += 1;
  let suffix = 0;
  const suffixLimit = Math.min(before.length - prefix, after.length - prefix);
  while (suffix < suffixLimit && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) {
    suffix += 1;
  }
  return (before.length - prefix - suffix) + (after.length - prefix - suffix);
}


function encodeUpdate(update) {
  return Buffer.from(update).toString("base64");
}

function decodeUpdate(value) {
  const encoded = String(value || "").trim();
  if (!encoded || encoded.length > MAX_UPDATE_BYTES * 2) return null;
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) return null;
  const buffer = Buffer.from(encoded, "base64");
  if (!buffer.length || buffer.length > MAX_UPDATE_BYTES) return null;
  return new Uint8Array(buffer);
}

function sanitizeAwarenessClientIds(rawClientIds) {
  if (!Array.isArray(rawClientIds)) return [];
  return Array.from(new Set(
    rawClientIds
      .map((value) => Number(value))
      .filter((value) => Number.isSafeInteger(value) && value >= 0),
  )).slice(0, 8);
}

export function createPartyCodingRealtime(deps) {
  const {
    mongoose,
    GroupChatRoom,
    sanitizeId,
    broadcastGroupChatWsPayload,
    sendGroupChatWsPayload,
  } = deps;
  const Workspace = getPartyWebWorkspaceModel(mongoose);
  const learning = createPartyLearningService(deps);
  const rooms = new Map();
  const operations = new Map();

  function withRoomLock(roomId, operation) {
    const previous = operations.get(roomId) || Promise.resolve();
    const next = previous.catch(() => {}).then(operation);
    operations.set(roomId, next);
    void next.finally(() => { if (operations.get(roomId) === next) operations.delete(roomId); }).catch(() => {});
    return next;
  }


  async function getRoom(roomId) {
    const safeRoomId = sanitizeId(roomId, "");
    if (!safeRoomId) throw new Error("无效网页协作房间。");
    const existing = rooms.get(safeRoomId);
    if (existing) return existing;
    const loading = createRoom(safeRoomId);
    rooms.set(safeRoomId, loading);
    try {
      const room = await loading;
      rooms.set(safeRoomId, room);
      return room;
    } catch (error) {
      rooms.delete(safeRoomId);
      throw error;
    }
  }

  async function createRoom(roomId) {
    const workspace = await Workspace.findOneAndUpdate(
      { roomId },
      { $setOnInsert: { roomId } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();
    const doc = new Y.Doc();
    const htmlText = doc.getText(DOCUMENT_NAMES.html);
    const cssText = doc.getText(DOCUMENT_NAMES.css);
    const storedState = Buffer.isBuffer(workspace?.collaborationState)
      ? workspace.collaborationState
      : null;
    if (storedState?.length) {
      Y.applyUpdate(doc, new Uint8Array(storedState), SERVER_INITIALIZATION_ORIGIN);
    } else {
      doc.transact(() => {
        htmlText.insert(0, sanitizeDocument(workspace?.html));
        cssText.insert(0, sanitizeDocument(workspace?.css));
      }, SERVER_INITIALIZATION_ORIGIN);
    }
    const room = {
      roomId,
      epoch: Number(workspace?.documentEpoch || 0),
      doc,
      htmlText,
      cssText,
      awareness: new Awareness(doc),
      clientIdsBySocket: new Map(),
      persistTimer: 0,
      persistPromise: Promise.resolve(),
      lastAuthor: { userId: "", name: "成员" },
    };
    doc.on("update", (_update, origin) => {
      if (origin === SERVER_INITIALIZATION_ORIGIN) return;
      if (origin?.partyCodingAuthor) room.lastAuthor = origin.partyCodingAuthor;
      schedulePersist(room);
    });
    return room;
  }

  function schedulePersist(room) {
    if (room.persistTimer) clearTimeout(room.persistTimer);
    room.persistTimer = setTimeout(() => {
      room.persistTimer = 0;
      void persistRoom(room);
    }, PERSIST_DELAY_MS);
  }

  async function persistRoom(room, author = room.lastAuthor) {
    if (room.persistTimer) {
      clearTimeout(room.persistTimer);
      room.persistTimer = 0;
    }
    room.persistPromise = room.persistPromise.then(async () => {
      const html = sanitizeDocument(room.htmlText.toString());
      const css = sanitizeDocument(room.cssText.toString());
      const current = await Workspace.findOne({ roomId: room.roomId }).lean();
      const changedHtml = sanitizeDocument(current?.html) !== html;
      const changedCss = sanitizeDocument(current?.css) !== css;
      const changed = changedHtml || changedCss;
      if (!changed) return current;
      const safeAuthor = {
        userId: sanitizeId(author?.userId, ""),
        name: String(author?.name || "成员").trim().slice(0, 60) || "成员",
      };
      const revision = Math.max(1, Number(current?.revision || 1) + 1);
      const workspace = await Workspace.findOneAndUpdate(
        { roomId: room.roomId },
        {
          $set: {
            html,
            css,
            collaborationState: Buffer.from(Y.encodeStateAsUpdate(room.doc)),
            revision,
          },
          $push: {
            versions: {
              $each: [{
                revision,
                html,
                css,
                savedByUserId: safeAuthor.userId,
                savedByName: safeAuthor.name,
                createdAt: new Date(),
              }],
              $slice: -VERSION_LIMIT,
            },
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      ).lean();
      const changedCharacters = estimateChangedCharacters(current?.html, html)
        + estimateChangedCharacters(current?.css, css);
      await learning.recordEvent({
        roomId: room.roomId,
        userId: safeAuthor.userId,
        userName: safeAuthor.name,
        eventType: "code_edit",
        metadata: {
          revision,
          documents: [changedHtml ? "html" : "", changedCss ? "css" : ""].filter(Boolean),
          changedCharacters,
          htmlLength: html.length,
          cssLength: css.length,
        },
        workspace,
      });
      broadcastGroupChatWsPayload(room.roomId, {
        type: "coding_collab_workspace_updated",
        roomId: room.roomId,
        workspace: normalizeWorkspace(workspace),
      });
      return workspace;
    }).catch((error) => {
      console.error("[party-web] failed to persist collaboration state", error);
      return null;
    });
    return room.persistPromise;
  }

  function getAuthor(meta) {
    return {
      userId: sanitizeId(meta?.userId, ""),
      name: String(meta?.userName || "成员").trim().slice(0, 60) || "成员",
    };
  }

  async function handleWsMessage(input) {
    if (!String(input.payload?.type || "").startsWith("coding_collab_")) return false;
    return withRoomLock(sanitizeId(input.payload?.roomId, ""), () => handleLockedWsMessage(input));
  }

  async function handleLockedWsMessage({ socket, payload, meta }) {
    const type = String(payload?.type || "").trim().toLowerCase();
    if (!type.startsWith("coding_collab_")) return false;
    const roomId = sanitizeId(payload?.roomId, "");
    if (!roomId || !meta?.authed || !meta?.userId || !meta.joinedRooms?.has(roomId)) return true;
    const room = await getRoom(roomId);
    const isObserver = isCollaborationObserverForRoom(
      meta?.collaborationObserverRoomId,
      roomId,
    );

    if (type === "coding_collab_join") {
      const groupRoom = await GroupChatRoom.findOne(
        isObserver
          ? { _id: roomId, teacherScopeKey: "shi-gaojun" }
          : { _id: roomId, memberUserIds: meta.userId },
        { memberUserIds: 1, teacherScopeKey: 1 },
      ).lean();
      if (!groupRoom) return true;
      const workspaceWithRoles = await ensurePartyPairRoles({
        Workspace,
        roomId,
        memberUserIds: groupRoom.memberUserIds,
      });
      sendGroupChatWsPayload(socket, {
        type: "coding_collab_sync",
        roomId,
        documentEpoch: room.epoch,
        update: encodeUpdate(Y.encodeStateAsUpdate(room.doc)),
      });
      const awarenessClientIds = Array.from(room.awareness.getStates().keys());
      if (awarenessClientIds.length) {
        sendGroupChatWsPayload(socket, {
          type: "coding_collab_awareness",
          roomId,
          clientIds: awarenessClientIds,
          update: encodeUpdate(encodeAwarenessUpdate(room.awareness, awarenessClientIds)),
        });
      }
      const intervention = await learning.getLatestIntervention(roomId);
      sendGroupChatWsPayload(socket, {
        type: "coding_collab_workspace_updated",
        roomId,
        workspace: normalizeWorkspace(workspaceWithRoles),
      });
      broadcastGroupChatWsPayload(roomId, {
        type: "coding_collab_workspace_updated",
        roomId,
        workspace: normalizeWorkspace(workspaceWithRoles),
      });
      if (intervention) {
        sendGroupChatWsPayload(socket, {
          type: "coding_collab_intervention",
          roomId,
          intervention,
        });
      }
      return true;
    }

    if (isObserver) {
      sendGroupChatWsPayload(socket, {
        type: "coding_collab_error",
        roomId,
        error: "教师旁观模式为只读，不能修改学生协作内容。",
      });
      return true;
    }

    if (type === "coding_collab_update") {
      const workspace = await Workspace.findOne(
        { roomId },
        { driverUserId: 1, navigatorUserId: 1, navigatorUserIds: 1 },
      ).lean();
      const driverUserId = sanitizeId(workspace?.driverUserId, "");
      const navigatorUserId = sanitizeId(workspace?.navigatorUserId, "");
      if (!driverUserId || !navigatorUserId) {
        sendGroupChatWsPayload(socket, {
          type: "coding_collab_error",
          roomId,
          error: "请等待第二名学生加入，结对角色分配后再开始编程。",
        });
        return true;
      }
      if (!canDriveParty(workspace, sanitizeId(meta.userId, ""))) {
        sendGroupChatWsPayload(socket, {
          type: "coding_collab_error",
          roomId,
          error: "当前由 Driver 操作代码，请以 Navigator 身份参与讨论和检查。",
        });
        return true;
      }
      if (Number(payload.documentEpoch || 0) !== room.epoch) {
        sendGroupChatWsPayload(socket, { type: "coding_collab_reset", roomId, documentEpoch: room.epoch,
          error: "工作区已载入新版本，正在同步最新内容。" });
        return true;
      }
      const update = decodeUpdate(payload?.update);
      if (!update) return true;
      Y.applyUpdate(room.doc, update, { partyCodingAuthor: getAuthor(meta) });
      broadcastGroupChatWsPayload(roomId, {
        type: "coding_collab_update",
        roomId,
        documentEpoch: room.epoch,
        update: encodeUpdate(update),
      });
      return true;
    }

    if (type === "coding_collab_awareness") {
      const update = decodeUpdate(payload?.update);
      const clientIds = sanitizeAwarenessClientIds(payload?.clientIds);
      if (!update || clientIds.length === 0) return true;
      applyAwarenessUpdate(room.awareness, update, socket);
      room.clientIdsBySocket.set(socket, new Set(clientIds));
      broadcastGroupChatWsPayload(roomId, {
        type: "coding_collab_awareness",
        roomId,
        clientIds,
        update: encodeUpdate(update),
      });
      return true;
    }
    return true;
  }

  async function replaceRoomDocuments(options) {
    return withRoomLock(options.roomId, async () => {
      const { roomId, html, css, author, expectedStateVector, expectedEpoch, template, requestId, requireDriver = false } = options;
      const room = await getRoom(roomId);
      const fail = (status, message) => { const error = new Error(message); error.status = status; throw error; };
      const current = await Workspace.findOne({ roomId }).lean();
      if (requireDriver && !canDriveParty(current, author.userId)) fail(403, "角色已变化，仅当前 Driver 可以修改代码。");
      if (template) {
        if (current?.loadedTemplate?.requestId === requestId) return normalizeWorkspace(current);
        if (!canDriveParty(current, author.userId)) fail(403, "角色已变化，仅当前 Driver 可以载入模板。");
        if (expectedEpoch !== room.epoch || expectedStateVector !== encodeUpdate(Y.encodeStateVector(room.doc))) {
          fail(409, "代码已变化，请等待同步完成后重新载入模板。");
        }
      }
      // Flush the original shared document before creating its recovery snapshot.
      const saved = await persistRoom(room);
      if (!saved) fail(500, "保存原作品失败，未载入新内容。");
      if (!(saved.versions || []).some((version) => Number(version.revision) === Number(saved.revision))) await Workspace.updateOne({ roomId }, { $push: { versions: { $each: [{
        revision: saved.revision, html: saved.html, css: saved.css,
        savedByUserId: author.userId, savedByName: author.name, createdAt: new Date(),
      }], $slice: -VERSION_LIMIT } } });
      const nextDoc = new Y.Doc();
      nextDoc.getText("html").insert(0, sanitizeDocument(html));
      nextDoc.getText("css").insert(0, sanitizeDocument(css));
      const documentEpoch = room.epoch + 1;
      const loadedTemplate = template ? { lessonId: template.lessonId, version: template.version, requestId, loadedAt: new Date(), loadedByUserId: author.userId } : current.loadedTemplate;
      const workspace = await Workspace.findOneAndUpdate({ roomId }, {
        $set: { html: sanitizeDocument(html), css: sanitizeDocument(css),
          collaborationState: Buffer.from(Y.encodeStateAsUpdate(nextDoc)), documentEpoch, loadedTemplate },
        $inc: { revision: 1 },
      }, { new: true }).lean();
      if (!workspace) { nextDoc.destroy(); fail(409, "工作区已变化，未载入新内容。"); }
      room.doc.destroy();
      room.awareness.destroy();
      room.doc = nextDoc;
      room.htmlText = nextDoc.getText("html");
      room.cssText = nextDoc.getText("css");
      room.awareness = new Awareness(nextDoc);
      room.clientIdsBySocket.clear();
      room.epoch = documentEpoch;
      room.lastAuthor = author;
      nextDoc.on("update", (_update, origin) => {
        if (origin?.partyCodingAuthor) room.lastAuthor = origin.partyCodingAuthor;
        schedulePersist(room);
      });
      broadcastGroupChatWsPayload(roomId, { type: "coding_collab_reset", roomId, documentEpoch });
      await learning.recordEvent({ roomId, userId: author.userId, userName: author.name,
        eventType: template ? "template_load" : "code_edit", workspace,
        metadata: template ? { lessonId: template.lessonId, templateVersion: template.version, previousRevision: saved.revision }
          : { revision: workspace.revision, previousRevision: saved.revision, documents: ["html", "css"] },
      });
      return normalizeWorkspace(workspace);
    });
  }

  function handleSocketRoomLeft(socket, roomId) {
    const room = rooms.get(sanitizeId(roomId, ""));
    if (!room || typeof room.then === "function") return;
    const clientIds = Array.from(room.clientIdsBySocket.get(socket) || []);
    room.clientIdsBySocket.delete(socket);
    if (!clientIds.length) return;
    removeAwarenessStates(room.awareness, clientIds, socket);
    broadcastGroupChatWsPayload(room.roomId, {
      type: "coding_collab_awareness",
      roomId: room.roomId,
      clientIds,
      update: encodeUpdate(encodeAwarenessUpdate(room.awareness, clientIds)),
    });
  }

  function handleSocketClosed(socket) {
    Array.from(rooms.keys()).forEach((roomId) => handleSocketRoomLeft(socket, roomId));
  }

  return {
    withRoomLock,
    handleWsMessage,
    handleSocketRoomLeft,
    handleSocketClosed,
    replaceRoomDocuments,
  };
}

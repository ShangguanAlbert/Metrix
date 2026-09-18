import { PARTY_WEB_DEFAULTS } from "./model.js";
import { readNavigatorUserIds } from "../../../shared/party-roles.js";

const sanitizeDocument = (value) => String(value || "").replace(/\r\n/g, "\n").slice(0, 200_000);
const sanitizeDiagnostics = (value) => (Array.isArray(value) ? value : []).map((item) => String(item || "").replace(/\s+/g, " ").trim().slice(0, 300)).filter(Boolean).slice(0, 20);

export function normalizeWorkspace(doc) {
  if (!doc) return null;
  return {
    roomId: String(doc.roomId || ""),
    activeWorkspace: doc.activeWorkspace || "project",
    savedAt: doc.savedAt ? new Date(doc.savedAt).toISOString() : "",
    documentEpoch: Math.max(0, Number(doc.documentEpoch || 0)),
    loadedTemplate: doc.loadedTemplate || null,
    html: sanitizeDocument(doc.html),
    css: sanitizeDocument(doc.css),
    revision: Math.max(1, Number(doc.revision || 1)),
    taskRevision: Math.max(1, Number(doc.taskRevision || 1)),
    taskId: `${String(doc.roomId || "")}:${Math.max(1, Number(doc.taskRevision || 1))}`,
    taskStage: String(doc.taskStage || "understand"),
    driverUserId: String(doc.driverUserId || ""),
    navigatorUserId: String(doc.navigatorUserId || ""),
    navigatorUserIds: readNavigatorUserIds(doc),
    roleRotationCount: Math.max(0, Number(doc.roleRotationCount || 0)),
    rolesUpdatedAt: doc.rolesUpdatedAt ? new Date(doc.rolesUpdatedAt).toISOString() : "",
    lastPreviewAt: doc.lastPreviewAt ? new Date(doc.lastPreviewAt).toISOString() : "",
    lastPreviewByUserId: String(doc.lastPreviewByUserId || ""),
    lastDiagnostics: sanitizeDiagnostics(doc.lastDiagnostics),
    versions: (Array.isArray(doc.versions) ? doc.versions : []).map((item) => ({
      revision: Number(item?.revision || 0),
      html: sanitizeDocument(item?.html),
      css: sanitizeDocument(item?.css),
      savedByName: String(item?.savedByName || "成员").slice(0, 60),
      createdAt: item?.createdAt ? new Date(item.createdAt).toISOString() : "",
    })),
  };
}

// Only document-owned state is parked. Roles and the monotonically increasing
// revision/epoch remain shared by the room, so delayed messages cannot cross tabs.
export function snapshotWorkspaceDocument(workspace = {}) {
  return {
    html: workspace.html ?? PARTY_WEB_DEFAULTS.html,
    css: workspace.css ?? PARTY_WEB_DEFAULTS.css,
    collaborationState: workspace.collaborationState || null,
    loadedTemplate: workspace.loadedTemplate || null,
    versions: workspace.versions || [],
    taskStage: workspace.taskStage || "understand",
    lastPreviewAt: workspace.lastPreviewAt || null,
    lastPreviewByUserId: workspace.lastPreviewByUserId || "",
    lastDiagnostics: workspace.lastDiagnostics || [],
    savedAt: workspace.savedAt || null,
  };
}

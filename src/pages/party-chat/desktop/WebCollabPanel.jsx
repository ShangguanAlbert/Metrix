import { findImageSourceAtSelection } from "../../../../shared/party-images.js";
import { resolvePartyPreviewImages } from "../../../features/party/previewImages.js";
import { readNavigatorUserIds, canDriveParty } from "../../../../shared/party-roles.js";
import { Bot, CircleAlert, Download, Eye, RefreshCcw, Repeat2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { css as cssLanguage } from "@codemirror/lang-css";
import { html as htmlLanguage } from "@codemirror/lang-html";
import { EditorView } from "@codemirror/view";
import * as Y from "yjs";
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from "y-protocols/awareness";
import { yCollab } from "y-codemirror.next";
import {
  uploadPartyProgrammingImage,
  restorePartyWebWorkspace,
  fetchPartyProgrammingTemplate,
  loadPartyProgrammingTemplate,
  recordPartyWebPreview,
  submitPartyPaiaFeedback,
  updatePartyCodingSession,
} from "../../party/partyApi.js";
import {
  analyzeWebCode,
  buildDownloadDocument,
  buildSafePreviewDocument,
} from "../../party/webCode.js";

const REMOTE_DOCUMENT_ORIGIN = { type: "party-web-remote-document" };
const REMOTE_AWARENESS_ORIGIN = { type: "party-web-remote-awareness" };
const TASK_STAGE_OPTIONS = [
  { value: "understand", label: "理解任务" },
  { value: "plan", label: "设计方案" },
  { value: "build", label: "编写网页" },
  { value: "debug", label: "调试改进" },
  { value: "reflect", label: "总结反思" },
];
const FEEDBACK_OPTIONS = [
  { value: "correct", label: "很贴合" },
  { value: "partial", label: "有些贴合" },
  { value: "incorrect", label: "这次不太适合" },
];
const COLLABORATOR_COLORS = [
  { color: "#3a8dde", colorLight: "#3a8dde33" },
  { color: "#d76a4d", colorLight: "#d76a4d33" },
  { color: "#5f9d65", colorLight: "#5f9d6533" },
  { color: "#9a6fd4", colorLight: "#9a6fd433" },
];

function getEditorInitial(name) {
  return Array.from(String(name || "成员").trim())[0] || "成";
}

function getCollaboratorColor(userId) {
  const source = String(userId || "member");
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) - hash + source.charCodeAt(index)) | 0;
  }
  return COLLABORATOR_COLORS[Math.abs(hash) % COLLABORATOR_COLORS.length];
}

function encodeBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return window.btoa(binary);
}

function decodeBase64(value) {
  try {
    const binary = window.atob(String(value || ""));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
}

function resolveMemberName(members, userId, fallback) {
  return members.find((member) => String(member?.id || "") === String(userId || ""))?.name || fallback;
}

export default function WebCollabPanel({
  roomId,
  me,
  members = [],
  taskText = "",
  codingEditors = [],
  onAskPaia,
  onEditingChange,
  onJoinCollaboration,
  onLeaveCollaboration,
  onCollaborationUpdate,
  onCollaborationAwareness,
  subscribeToCollaboration,
  readOnlyObserver = false,
  ownerUserId = "",
  imageAccessToken = "",
}) {
  const [imageTarget, setImageTarget] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [restoreRevision, setRestoreRevision] = useState("");
  const [syncGeneration, setSyncGeneration] = useState(0);
  const [templateRefresh, setTemplateRefresh] = useState(0);
  const [lessonTemplate, setLessonTemplate] = useState(null);
  const [templateConfirmOpen, setTemplateConfirmOpen] = useState(false);
  const [activeDocument, setActiveDocument] = useState("html");
  const [ready, setReady] = useState(false);
  const [workspace, setWorkspace] = useState(null);
  const [previewDocument, setPreviewDocument] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [diagnostics, setDiagnostics] = useState([]);
  const [latestIntervention, setLatestIntervention] = useState(null);
  const [feedbackNote, setFeedbackNote] = useState("");
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");
  const editingRef = useRef(false);
  const sessionRef = useRef(null);
  const callbacksRef = useRef({});
  const editorViewRef = useRef(null);
  const imageInputRef = useRef(null);
  const imageSelectionRef = useRef(null);
  const permissionRef = useRef(false);
  const previewRequestRef = useRef(0);

  const renderPreview = useCallback(async (html, css) => {
    const request = ++previewRequestRef.current;
    try {
      const resolvedHtml = await resolvePartyPreviewImages(html, roomId, imageAccessToken);
      if (request !== previewRequestRef.current) return;
      setPreviewDocument(buildSafePreviewDocument(resolvedHtml, css));
      setDiagnostics(analyzeWebCode(html, css));
    } catch (error) { if (request === previewRequestRef.current) setActionError(error.message); }
  }, [roomId, imageAccessToken]);

  useEffect(() => {
    callbacksRef.current = {
      onEditingChange,
      onJoinCollaboration,
      onLeaveCollaboration,
      onCollaborationUpdate,
      onCollaborationAwareness,
      subscribeToCollaboration,
    };
  }, [onCollaborationAwareness, onCollaborationUpdate, onEditingChange, onJoinCollaboration, onLeaveCollaboration, subscribeToCollaboration]);

  const setEditingPresence = useCallback((active) => {
    if (editingRef.current === active) return;
    editingRef.current = active;
    callbacksRef.current.onEditingChange?.(roomId, active);
  }, [roomId]);

  useEffect(() => {
    const doc = new Y.Doc();
    const htmlText = doc.getText("html");
    const cssText = doc.getText("css");
    const awareness = new Awareness(doc);
    const collaboratorColor = getCollaboratorColor(me?.id);
    const session = { doc, htmlText, cssText, awareness, initialized: false, documentEpoch: 0 };
    sessionRef.current = session;
    setReady(false);
    setWorkspace(null);
    setLatestIntervention(null);
    setActionError("");
    if (!readOnlyObserver) {
      awareness.setLocalStateField("user", {
        name: String(me?.name || "成员").trim() || "成员",
        color: collaboratorColor.color,
        colorLight: collaboratorColor.colorLight,
      });
    }

    const handleDocumentUpdate = (update, origin) => {
      if (origin === REMOTE_DOCUMENT_ORIGIN || readOnlyObserver) return;
      if (session.initialized) callbacksRef.current.onCollaborationUpdate?.(roomId, encodeBase64(update), session.documentEpoch);
    };
    const handleAwarenessUpdate = ({ added, updated, removed }, origin) => {
      if (origin === REMOTE_AWARENESS_ORIGIN || readOnlyObserver) return;
      const clientIds = [...added, ...updated, ...removed];
      if (!clientIds.length) return;
      callbacksRef.current.onCollaborationAwareness?.(
        roomId,
        encodeBase64(encodeAwarenessUpdate(awareness, clientIds)),
        clientIds,
      );
    };
    const handleCollaborationMessage = (payload) => {
      const type = String(payload?.type || "").trim().toLowerCase();
      if (type === "coding_collab_reset") {
        session.initialized = false;
        setReady(false);
        setSyncGeneration((value) => value + 1);
        return;
      }
      if (type === "coding_collab_template_published") {
        setTemplateRefresh((value) => value + 1);
        return;
      }
      if (type === "coding_collab_sync" || type === "coding_collab_update") {
        if (type === "coding_collab_sync") session.documentEpoch = Number(payload.documentEpoch || 0);
        if (type === "coding_collab_update" && (!session.initialized || Number(payload.documentEpoch || 0) !== session.documentEpoch)) return;
        const update = decodeBase64(payload?.update);
        if (!update) return;
        Y.applyUpdate(doc, update, REMOTE_DOCUMENT_ORIGIN);
        if (!session.initialized || readOnlyObserver) {
          session.initialized = true;
          const initialHtml = htmlText.toString();
          const initialCss = cssText.toString();
          void renderPreview(initialHtml, initialCss);
          setReady(true);
        }
        return;
      }
      if (type === "coding_collab_awareness") {
        const update = decodeBase64(payload?.update);
        if (update) applyAwarenessUpdate(awareness, update, REMOTE_AWARENESS_ORIGIN);
        return;
      }
      if (type === "coding_collab_workspace_updated") {
        const nextWorkspace = payload?.workspace || null;
        setWorkspace((previousWorkspace) => {
          if (previousWorkspace?.taskId && nextWorkspace?.taskId !== previousWorkspace.taskId) {
            setLatestIntervention(null);
            setFeedbackNote("");
          }
          return nextWorkspace;
        });
        return;
      }
      if (type === "coding_collab_intervention") {
        setLatestIntervention(payload?.intervention || null);
        setFeedbackNote(String(payload?.intervention?.feedbackNote || ""));
        return;
      }
      if (type === "coding_collab_error") {
        setActionError(String(payload?.error || "协作操作失败。"));
      }
    };

    doc.on("update", handleDocumentUpdate);
    awareness.on("update", handleAwarenessUpdate);
    const unsubscribe = callbacksRef.current.subscribeToCollaboration?.(roomId, handleCollaborationMessage) || (() => {});
    callbacksRef.current.onJoinCollaboration?.(roomId);
    return () => {
      previewRequestRef.current += 1;
      if (editingRef.current) {
        editingRef.current = false;
        callbacksRef.current.onEditingChange?.(roomId, false);
      }
      if (!readOnlyObserver) awareness.setLocalState(null);
      awareness.off("update", handleAwarenessUpdate);
      doc.off("update", handleDocumentUpdate);
      unsubscribe();
      callbacksRef.current.onLeaveCollaboration?.(roomId);
      doc.destroy();
      if (sessionRef.current === session) sessionRef.current = null;
    };
  }, [me?.id, me?.name, readOnlyObserver, roomId, syncGeneration, renderPreview]);

  useEffect(() => {
    if (readOnlyObserver || !ready) return;
    let active = true;
    fetchPartyProgrammingTemplate(roomId).then((data) => {
      if (active) setLessonTemplate(data.template || null);
    }).catch((error) => { if (active) setActionError(error.message); });
    return () => { active = false; };
  }, [roomId, ready, readOnlyObserver, templateRefresh]);

  async function loadTemplate() {
    const session = sessionRef.current;
    if (!isDriver || !ready || actionSubmitting || !lessonTemplate || !session?.initialized) return;
    setActionSubmitting(true);
    setActionError("");
    try {
      await loadPartyProgrammingTemplate(roomId, {
        lessonId: lessonTemplate.lessonId, version: lessonTemplate.version,
        requestId: crypto.randomUUID(), documentEpoch: session.documentEpoch,
        stateVector: encodeBase64(Y.encodeStateVector(session.doc)),
      });
      setTemplateConfirmOpen(false);
    } catch (error) { setActionError(error.message); }
    finally { setActionSubmitting(false); }
  }

  const assignedStudentIds = [workspace?.driverUserId, ...readNavigatorUserIds(workspace)]
    .map((userId) => String(userId || ""))
    .filter(Boolean);
  const pairReady = assignedStudentIds.length >= 2 && assignedStudentIds.length <= 3
    && assignedStudentIds.every((userId) => members.some((member) => String(member?.id || "") === userId));
  const isDriver = pairReady && canDriveParty(workspace, me?.id);
  permissionRef.current = isDriver && !readOnlyObserver;
  const isNavigator = pairReady && readNavigatorUserIds(workspace).includes(String(me?.id || ""));
  const driverName = resolveMemberName(members, workspace?.driverUserId, "等待分配");
  const navigatorName = readNavigatorUserIds(workspace).map((id) => resolveMemberName(members, id, "等待同伴加入")).join("、") || "等待同伴加入";
  const nextDriverName = resolveMemberName(members, readNavigatorUserIds(workspace)[0], "下一位同学");
  const feedbackByName = resolveMemberName(
    members,
    latestIntervention?.feedbackByUserId,
    "小组成员",
  );
  const activeText = activeDocument === "html" ? sessionRef.current?.htmlText : sessionRef.current?.cssText;
  const editorExtensions = useMemo(() => {
    if (!ready || !activeText || !sessionRef.current?.awareness) return [];
    return [
      activeDocument === "html" ? htmlLanguage() : cssLanguage(),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (activeDocument !== "html") { setImageTarget(null); return; }
        if (update.selectionSet || update.docChanged) setImageTarget(findImageSourceAtSelection(update.state.doc.toString(), update.state.selection.main.head));
      }),
      EditorView.editable.of(!readOnlyObserver && pairReady && isDriver),
      yCollab(activeText, sessionRef.current.awareness),
    ];
  }, [activeDocument, activeText, isDriver, pairReady, readOnlyObserver, ready]);

  useEffect(() => {
    const session = sessionRef.current;
    if (!ready || !session?.initialized || !workspace?.lastPreviewAt) return;
    void renderPreview(session.htmlText.toString(), session.cssText.toString());
  }, [ready, workspace?.lastPreviewAt, renderPreview]);

  function selectImage() {
    const session = sessionRef.current;
    const view = editorViewRef.current;
    if (!isDriver || readOnlyObserver || activeDocument !== "html" || !view || !session?.initialized) return;
    const target = findImageSourceAtSelection(view.state.doc.toString(), view.state.selection.main.head);
    if (!target) return;
    imageSelectionRef.current = {
      session, value: target.value,
      from: Y.createRelativePositionFromTypeIndex(session.htmlText, target.from),
      to: Y.createRelativePositionFromTypeIndex(session.htmlText, target.to),
    };
    imageInputRef.current?.click();
  }

  async function insertImage(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    const selected = imageSelectionRef.current;
    if (!file || !selected || imageUploading) return;
    setImageUploading(true);
    setActionError("");
    try {
      const result = await uploadPartyProgrammingImage(roomId, file, selected.session.documentEpoch);
      if (selected.session !== sessionRef.current || !permissionRef.current || !selected.session.initialized) {
        throw new Error("角色或作品已变化，未插入图片。请由当前 Driver 重新选择。");
      }
      const start = Y.createAbsolutePositionFromRelativePosition(selected.from, selected.session.doc);
      const end = Y.createAbsolutePositionFromRelativePosition(selected.to, selected.session.doc);
      const text = selected.session.htmlText;
      if (!start || !end || start.type !== text || end.type !== text || text.toString().slice(start.index, end.index) !== selected.value) {
        throw new Error("图片位置已被修改，请重新选择插入位置。");
      }
      const target = findImageSourceAtSelection(text.toString(), start.index);
      if (!target || target.from !== start.index || target.to !== end.index) throw new Error("原 src 已变化，请重新选择图片位置。");
      selected.session.doc.transact(() => { text.delete(start.index, end.index - start.index); text.insert(start.index, result.path); });
    } catch (error) { setActionError(error.message || "插入图片失败。"); }
    finally { setImageUploading(false); }
  }

  async function restoreVersion() {
    if (!restoreRevision || actionSubmitting) return;
    if (!window.confirm("恢复将替换当前 HTML/CSS，当前作品会先保存为历史版本。")) return;
    setActionSubmitting(true);
    try { await restorePartyWebWorkspace(roomId, Number(restoreRevision)); setRestoreRevision(""); }
    catch (error) { setActionError(error.message); }
    finally { setActionSubmitting(false); }
  }

  async function refreshPreview({ openPreview = false } = {}) {
    if (actionSubmitting) return;
    if (!readOnlyObserver && !isDriver) { if (openPreview) setPreviewOpen(true); return; }
    const html = sessionRef.current?.htmlText.toString() || "";
    const css = sessionRef.current?.cssText.toString() || "";
    const nextDiagnostics = analyzeWebCode(html, css);
    await renderPreview(html, css);
    if (openPreview) setPreviewOpen(true);
    if (readOnlyObserver) return;
    setActionSubmitting(true);
    try {
      const result = await recordPartyWebPreview(roomId, nextDiagnostics);
      setWorkspace(result?.workspace || workspace);
      setActionError("");
    } catch (error) {
      setActionError(error?.message || "记录网页预览失败。");
    } finally {
      setActionSubmitting(false);
    }
  }

  async function updateSession(payload) {
    if (actionSubmitting) return;
    setActionSubmitting(true);
    try {
      const result = await updatePartyCodingSession(roomId, payload);
      setWorkspace(result?.workspace || workspace);
      setActionError("");
    } catch (error) {
      setActionError(error?.message || "更新协作状态失败。");
    } finally {
      setActionSubmitting(false);
    }
  }

  function downloadWebPage() {
    const source = buildDownloadDocument(
      sessionRef.current?.htmlText.toString() || "",
      sessionRef.current?.cssText.toString() || "",
    );
    const url = URL.createObjectURL(new Blob([source], { type: "text/html;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "paia-pair-work.html";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function submitFeedback(feedback) {
    if (!latestIntervention?.id || feedbackSubmitting) return;
    setFeedbackSubmitting(true);
    try {
      const result = await submitPartyPaiaFeedback(roomId, latestIntervention.id, {
        feedback,
        note: feedbackNote,
      });
      setLatestIntervention(result?.intervention || latestIntervention);
      setActionError("");
    } catch (error) {
      setActionError(error?.message || "提交判断反馈失败。");
    } finally {
      setFeedbackSubmitting(false);
    }
  }

  return <aside className="party-coding-column party-web-coding-column" aria-label="HTML和CSS结对编程区">
    <div className="party-web-session-bar">
      <div className="party-web-task-summary">
        <span>当前任务</span>
        <strong>{taskText || "等待老师发布网页设计任务"}</strong>
        <select
          value={workspace?.taskStage || "understand"}
          onChange={(event) => void updateSession({ action: "stage", taskStage: event.target.value })}
          disabled={readOnlyObserver || !workspace || actionSubmitting}
          aria-label="当前任务阶段"
        >
          {TASK_STAGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <div className="party-web-role-summary">
        <span className={isDriver ? "is-current-role" : ""}>Driver：{driverName}</span>
        <span className={isNavigator ? "is-current-role" : ""}>Navigator：{navigatorName}</span>
        {isDriver ? <button
          type="button"
          onClick={() => void updateSession({ action: "rotate" })}
          disabled={!pairReady || actionSubmitting}
          title={`完成本轮并将 Driver 角色交给${nextDriverName}`}
        ><Repeat2 size={13} />完成本轮，交棒给{nextDriverName}</button> : null}
      </div>
    </div>

    {!readOnlyObserver && lessonTemplate ? <div className="party-web-template-bar">
      <span>本课模板：{lessonTemplate.lessonName}{workspace?.loadedTemplate?.lessonId === lessonTemplate.lessonId && workspace?.loadedTemplate?.version === lessonTemplate.version ? "（已载入）" : "（可载入新模板）"}</span>
      <button type="button" disabled={!ready || !isDriver || actionSubmitting} onClick={() => setTemplateConfirmOpen(true)}>载入本课模板</button>
    </div> : null}
    {templateConfirmOpen ? <div className="party-web-template-confirm" role="alertdialog" aria-label="确认载入模板">
      <p>载入将替换当前 HTML 和 CSS。原作品会保存为可恢复的版本，所有组员同步切换。</p>
      <button type="button" disabled={actionSubmitting} onClick={() => setTemplateConfirmOpen(false)}>取消</button>
      <button type="button" disabled={!isDriver || actionSubmitting} onClick={() => void loadTemplate()}>{actionSubmitting ? "载入中..." : "保存原作品并载入"}</button>
    </div> : null}

    <div className="party-coding-head party-web-coding-head">
      <div className="party-web-document-tabs" role="tablist" aria-label="网页代码文件">
        {[
          { value: "html", label: "HTML" },
          { value: "css", label: "CSS" },
        ].map((item) => <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={activeDocument === item.value}
          className={activeDocument === item.value ? "active" : ""}
          onClick={() => setActiveDocument(item.value)}
        >{item.label}</button>)}
      </div>
      <div className="party-coding-head-actions">
        <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={(event) => void insertImage(event)} />
        {activeDocument === "html" && imageTarget && isDriver && !readOnlyObserver ? <button type="button"
          onClick={selectImage} disabled={imageUploading || !ready}>{imageUploading ? "上传中..." : "为 src 选择图片"}</button> : null}
        {codingEditors.length > 0 ? <div className="party-coding-editor-avatars" aria-label={`${codingEditors.map((editor) => editor.name).join("、")}正在编辑`}>
          {codingEditors.slice(0, 3).map((editor) => <span className="party-coding-editor-avatar" key={editor.userId} title={`${editor.name}正在编辑`}>{getEditorInitial(editor.name)}</span>)}
        </div> : null}
        <div className="party-coding-head-buttons">
          <button type="button" onClick={() => void refreshPreview()} disabled={!ready || (!readOnlyObserver && (!pairReady || !isDriver)) || actionSubmitting}><RefreshCcw size={14} />{readOnlyObserver ? "同步检查" : "运行检查"}</button>
          <button type="button" onClick={() => void refreshPreview({ openPreview: true })} disabled={!ready || actionSubmitting}><Eye size={14} />{readOnlyObserver ? "查看预览" : "预览"}</button>
          {!readOnlyObserver ? <button type="button" onClick={downloadWebPage} disabled={!ready} title="下载可独立打开的 HTML 文件"><Download size={14} /></button> : null}
        </div>
      </div>
    </div>

    {readOnlyObserver ? <div className="party-web-role-notice is-observer">教师旁观模式：代码、任务阶段和预览均为只读，您的访问不会改变学生角色或协作状态。</div>
      : !pairReady ? <div className="party-web-role-notice is-waiting">当前只有一名学生。第二名学生加入后，系统会分配 Driver 和 Navigator，随后才能开始共同编程。</div>
      : isDriver ? <div className="party-web-role-notice is-driver">你当前是 Driver：根据小组讨论输入 HTML/CSS、刷新预览；完成一轮后点击“交棒”。</div>
        : isNavigator ? <div className="party-web-role-notice is-navigator">你当前是 Navigator：暂时不能输入代码，请在群聊中提出建议、发现问题，并和 Driver 一起检查预览。</div>
          : <div className="party-web-role-notice is-observer">你当前未分配结对角色，只能查看本轮过程。请联系老师调整小教室成员。</div>}
    <div className="party-code-editor party-web-code-editor">
      {ready && activeText ? <CodeMirror
        key={`${roomId}:${activeDocument}:${isDriver ? "driver" : isNavigator ? "navigator" : "observer"}`}
        value={activeText.toString()}
        height="100%"
        onCreateEditor={(view) => { editorViewRef.current = view; }}
        extensions={editorExtensions}
        onFocus={() => !readOnlyObserver && pairReady && isDriver && setEditingPresence(true)}
        onBlur={() => setEditingPresence(false)}
        basicSetup={{ lineNumbers: true, bracketMatching: true, closeBrackets: true, indentOnInput: true }}
        aria-label={`${activeDocument.toUpperCase()} 共享代码编辑器`}
      /> : <div className="party-code-editor-loading">正在同步共享网页代码…</div>}
    </div>

    <section className={`party-web-diagnostics-console${diagnostics.length ? " has-errors" : ""}`} aria-label="代码检查结果">
      <div className="party-web-diagnostics-head">
        <strong><CircleAlert size={14} />检查结果</strong>
        <span>{diagnostics.length ? `${diagnostics.length} 个待检查问题` : "未发现基础结构问题"}</span>
      </div>
      {diagnostics.length ? <ul className="party-web-diagnostics">
        {diagnostics.map((item) => <li key={item}>
          <span>{item}</span>
          {!readOnlyObserver ? <button type="button" onClick={() => onAskPaia?.(item)}>让琳琳解释</button> : null}
        </li>)}
      </ul> : null}
    </section>

    {!readOnlyObserver && String(ownerUserId) === String(me?.id) && workspace?.versions?.length ? <div className="party-web-template-bar">
      <select aria-label="历史代码版本" value={restoreRevision} onChange={(event) => setRestoreRevision(event.target.value)}>
        <option value="">选择要恢复的代码版本</option>
        {[...new Map(workspace.versions.map((version) => [version.revision, version])).values()].reverse().map((version) =>
          <option key={version.revision} value={version.revision}>版本 {version.revision} · {version.savedByName}</option>)}
      </select>
      <button type="button" disabled={!restoreRevision || actionSubmitting} onClick={() => void restoreVersion()}>恢复版本</button>
    </div> : null}

    {latestIntervention ? <section className="party-paia-intervention has-intervention" aria-label="琳琳的协作提示">
      <div className="party-paia-intervention-head">
        <strong><Bot size={14} />琳琳</strong>
        <span>{latestIntervention.feedback ? "已收到你们对这条建议的反馈" : "一起试试这个协作步骤"}</span>
      </div>
      <>
        <div className="party-paia-prompt"><span>建议下一步</span><p>{latestIntervention.prompt}</p></div>
      {!latestIntervention.feedback && readOnlyObserver ? <div className="party-web-observer-note">教师旁观模式下仅展示琳琳的协作建议，不能代替学生提交反馈。</div>
        : !latestIntervention.feedback ? <div className="party-paia-feedback-box">
        <strong>这条建议对你们有帮助吗？</strong>
        <small>你们的反馈会作为小组协作记忆，帮助琳琳调整同类情境下的支持方式。</small>
        <textarea
          value={feedbackNote}
          onChange={(event) => setFeedbackNote(event.target.value)}
          placeholder="可选：说明这条建议和你们当前协作情况是否贴合"
          maxLength={500}
        />
        <div className="party-paia-feedback-actions">
          {FEEDBACK_OPTIONS.map((option) => <button
            type="button"
            key={option.value}
            onClick={() => void submitFeedback(option.value)}
            disabled={feedbackSubmitting}
          >{option.label}</button>)}
        </div>
      </div> : <div className="party-paia-feedback-result">
        <strong>{feedbackByName}的反馈：</strong>
        {FEEDBACK_OPTIONS.find((item) => item.value === latestIntervention.feedback)?.label || latestIntervention.feedback}
        {latestIntervention.feedbackNote ? <p>{latestIntervention.feedbackNote}</p> : null}
        <small>琳琳已记录这次反馈，并会调整同类情境下的支持方式。</small>
      </div>}
      </>
    </section> : null}
    {actionError ? <div className="party-web-action-error" role="alert">{actionError}</div> : null}
    {previewOpen ? <div className="party-web-preview-modal-backdrop" role="presentation" onMouseDown={() => setPreviewOpen(false)}>
      <section className="party-web-preview-modal" role="dialog" aria-modal="true" aria-label="网页预览" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <strong><Eye size={15} />网页预览</strong>
            <span>{diagnostics.length ? `${diagnostics.length} 个待检查问题` : "代码检查通过"}</span>
          </div>
          <button type="button" onClick={() => setPreviewOpen(false)} title="关闭预览" aria-label="关闭预览"><X size={18} /></button>
        </header>
        <iframe title="学生网页作品预览" sandbox="" srcDoc={previewDocument} />
      </section>
    </div> : null}
  </aside>;
}

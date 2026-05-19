import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Square,
} from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  downloadAdminClassroomLessonFile,
  endAdminTeachingSession,
  fetchAdminClassroomPlans,
  restoreAdminTeachingSession,
  startAdminTeachingSession,
  updateAdminTeachingSessionPage,
  updateAdminTeachingSessionPdf,
} from "../../../pages/admin/adminApi.js";
import { normalizeTeachingCenterConfig } from "../teachingCenterConfig.js";
import { createTeachingPdfSource } from "../teachingPdfSource.js";
import { createTeachingSessionSocketClient } from "../teachingSessionSocket.js";
import ClassroomTeachingPdfViewer from "../components/ClassroomTeachingPdfViewer.jsx";
import { getAdminToken } from "../../../pages/login/adminSession.js";
import {
  resolveActiveAuthSlot,
  withAuthSlot,
} from "../../../app/authStorage.js";
import "../../../styles/teacher-home.css";
import "../../../styles/classroom-teaching.css";

function isPdfFile(file) {
  const fileName = String(file?.name || "").trim().toLowerCase();
  const mimeType = String(file?.mimeType || "").trim().toLowerCase();
  return fileName.endsWith(".pdf") || mimeType.includes("pdf");
}

function formatFileSize(size) {
  const bytes = Number(size);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${bytes} B`;
}

function formatRaisedAt(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString("zh-CN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
}

function appendTeachingQuestion(previous, question) {
  const nextQuestionId = String(question?.questionId || "").trim();
  const nextList = Array.isArray(previous) ? previous : [];
  if (!nextQuestionId) return nextList;
  return [
    question,
    ...nextList.filter(
      (item) => String(item?.questionId || "").trim() !== nextQuestionId,
    ),
  ].slice(0, 20);
}

export default function TeacherTeachingSessionPage() {
  const { lessonId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const activeSlot = resolveActiveAuthSlot(location.search);
  const adminToken = getAdminToken();
  const socketRef = useRef(null);
  const pdfSourceRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lesson, setLesson] = useState(null);
  const [session, setSession] = useState(null);
  const [raisedHands, setRaisedHands] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [pdfSource, setPdfSource] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfPageCount, setPdfPageCount] = useState(0);

  useEffect(() => {
    if (!adminToken) {
      navigate(withAuthSlot("/login", activeSlot), { replace: true });
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [plansData, sessionData] = await Promise.all([
          fetchAdminClassroomPlans(adminToken),
          startAdminTeachingSession(adminToken, lessonId),
        ]);
        if (cancelled) return;
        const lessons = Array.isArray(plansData?.teacherCoursePlans)
          ? plansData.teacherCoursePlans
          : [];
        const currentLesson =
          lessons.find((item) => String(item?.id || "") === String(lessonId || "")) ||
          null;
        setLesson(currentLesson);
        setSession(sessionData?.session || null);
        setRaisedHands(Array.isArray(sessionData?.raisedHands) ? sessionData.raisedHands : []);
        setQuestions(Array.isArray(sessionData?.questions) ? sessionData.questions : []);
      } catch (rawError) {
        if (cancelled) return;
        setError(rawError?.message || "读取授课会话失败，请稍后重试。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [activeSlot, adminToken, lessonId, navigate]);

  useEffect(() => {
    if (!adminToken || !lessonId) return undefined;
    const client = createTeachingSessionSocketClient({
      token: adminToken,
      onSessionUpdated: (payload) => {
        setSession(payload?.session || null);
      },
      onRaisedHandsUpdated: (payload) => {
        setRaisedHands(Array.isArray(payload?.raisedHands) ? payload.raisedHands : []);
      },
      onQuestionCreated: (payload) => {
        if (!payload?.question) return;
        setQuestions((current) => appendTeachingQuestion(current, payload.question));
      },
      onError: (payload) => {
        setError(payload?.message || "课堂推送失败，请稍后重试。");
      },
    });
    socketRef.current = client;
    client.connect();
    client.selectLesson(lessonId);
    const pingTimer = window.setInterval(() => {
      client.ping();
    }, 25000);
    return () => {
      window.clearInterval(pingTimer);
      client.close();
      if (socketRef.current === client) {
        socketRef.current = null;
      }
    };
  }, [adminToken, lessonId]);

  const teachingConfig = useMemo(
    () => normalizeTeachingCenterConfig(lesson?.teachingConfig),
    [lesson?.teachingConfig],
  );
  const pdfFiles = useMemo(() => {
    const fileMap = new Map(
      (Array.isArray(lesson?.files) ? lesson.files : [])
        .filter(isPdfFile)
        .map((file) => [String(file?.id || "").trim(), file]),
    );
    return teachingConfig.pdfFiles
      .map((item) => ({
        fileId: String(item?.fileId || "").trim(),
        file: fileMap.get(String(item?.fileId || "").trim()) || null,
      }))
      .filter((item) => item.file);
  }, [lesson?.files, teachingConfig.pdfFiles]);

  const activePdf = useMemo(
    () =>
      pdfFiles.find(
        (item) => item.fileId === String(session?.activePdfFileId || "").trim(),
      ) || null,
    [pdfFiles, session?.activePdfFileId],
  );

  useEffect(() => {
    let cancelled = false;
    if (pdfSourceRef.current?.revoke) {
      pdfSourceRef.current.revoke();
    }
    pdfSourceRef.current = null;
    setPdfSource(null);
    setPdfPageCount(0);

    const fileId = String(activePdf?.fileId || "").trim();
    if (!adminToken || !fileId) {
      setPdfLoading(false);
      return undefined;
    }

    async function loadPdf() {
      setPdfLoading(true);
      try {
        const result = await downloadAdminClassroomLessonFile(adminToken, fileId, {
          inline: true,
        });
        if (cancelled) return;
        const nextSource = await createTeachingPdfSource(result);
        if (!nextSource) {
          throw new Error("授课 PDF 读取失败，请稍后重试。");
        }
        pdfSourceRef.current = nextSource;
        setPdfSource(nextSource);
      } catch (rawError) {
        if (!cancelled) {
          setError(rawError?.message || "授课 PDF 读取失败，请稍后重试。");
        }
      } finally {
        if (!cancelled) {
          setPdfLoading(false);
        }
      }
    }

    void loadPdf();

    return () => {
      cancelled = true;
      if (pdfSourceRef.current?.revoke) {
        pdfSourceRef.current.revoke();
      }
      pdfSourceRef.current = null;
    };
  }, [activePdf?.fileId, adminToken]);

  async function handleChangePage(nextPage) {
    if (!adminToken || !session || session.status !== "live") return;
    setSaving(true);
    setError("");
    try {
      const data = await updateAdminTeachingSessionPage(adminToken, lessonId, nextPage);
      setSession(data?.session || null);
    } catch (rawError) {
      setError(rawError?.message || "更新页码失败，请稍后重试。");
    } finally {
      setSaving(false);
    }
  }

  async function handleSwitchPdf(fileId) {
    if (!adminToken || !session || session.status !== "live") return;
    setSaving(true);
    setError("");
    try {
      const data = await updateAdminTeachingSessionPdf(adminToken, lessonId, fileId, 1);
      setSession(data?.session || null);
    } catch (rawError) {
      setError(rawError?.message || "切换课件失败，请稍后重试。");
    } finally {
      setSaving(false);
    }
  }

  async function handleRestore() {
    if (!adminToken) return;
    setSaving(true);
    setError("");
    try {
      const data = await restoreAdminTeachingSession(adminToken, lessonId);
      setSession(data?.session || null);
    } catch (rawError) {
      setError(rawError?.message || "恢复上次进度失败，请稍后重试。");
    } finally {
      setSaving(false);
    }
  }

  async function handleEnd() {
    if (!adminToken) return;
    setSaving(true);
    setError("");
    try {
      const data = await endAdminTeachingSession(adminToken, lessonId);
      setSession(data?.session || null);
    } catch (rawError) {
      setError(rawError?.message || "结束授课失败，请稍后重试。");
    } finally {
      setSaving(false);
    }
  }

  const activePage = Math.max(1, Number(session?.activePage || 1));
  const canGoPrev = session?.status === "live" && activePage > 1;
  const canGoNext =
    session?.status === "live" &&
    (pdfPageCount <= 0 || activePage < pdfPageCount);
  const sessionStatusText =
    session?.status === "live"
      ? "授课中"
      : session?.status === "ended"
        ? "课后回看"
        : "准备中";
  const sessionHelpText =
    session?.status === "live"
      ? "当前正在授课，学生默认跟随你的 PDF 与页码。"
      : session?.status === "ended"
        ? "本次授课已结束，学生可进入课后自由回看。"
        : "正在初始化授课会话。";
  const courseTimeLabel = String(lesson?.courseTime || "").trim() || "时间待教师更新";
  const classNameLabel = String(lesson?.className || "").trim() || "未分配班级";
  const currentPdfName = activePdf?.file?.name || pdfSource?.fileName || "未选择课件";

  return (
    <div className="teacher-home-page">
      <div className="teacher-home-shell teaching-session-shell">
        <aside className="teacher-home-sidebar teaching-session-sidebar">
          <div className="teacher-home-profile teaching-session-sidebar-profile">
            <div className="teacher-home-avatar teaching-session-sidebar-avatar">授</div>
            <h1>授课工作台</h1>
            <p>{lesson?.courseName || "正在准备授课课时"}</p>
            <dl className="teacher-home-profile-meta">
              <div>
                <dt>班级</dt>
                <dd>{classNameLabel}</dd>
              </div>
              <div>
                <dt>时间</dt>
                <dd>{courseTimeLabel}</dd>
              </div>
              <div>
                <dt>状态</dt>
                <dd>{sessionStatusText}</dd>
              </div>
            </dl>
          </div>

          <section className="teacher-card teaching-session-sidebar-card">
            <div className="teacher-task-draft-head">
              <strong>授课操作</strong>
            </div>
            <div className="teaching-session-sidebar-actions">
              <button
                type="button"
                className="teacher-ghost-btn teaching-session-sidebar-btn"
                onClick={() =>
                  navigate(
                    withAuthSlot("/admin/settings?teacherPanel=teaching-center", activeSlot),
                  )
                }
              >
                <ArrowLeft size={15} />
                <span>返回授课中心</span>
              </button>
              <button
                type="button"
                className="teacher-ghost-btn teaching-session-sidebar-btn"
                onClick={() => void handleRestore()}
                disabled={saving || !session?.lastCheckpoint?.pdfFileId}
              >
                <RotateCcw size={15} />
                <span>恢复上次进度</span>
              </button>
              <button
                type="button"
                className="teacher-ghost-btn teaching-session-sidebar-btn teaching-session-danger-btn"
                onClick={() => void handleEnd()}
                disabled={saving || session?.status !== "live"}
              >
                <Square size={15} />
                <span>结束本次授课</span>
              </button>
            </div>
          </section>

          <section className="teacher-card teaching-session-sidebar-card">
            <div className="teacher-task-draft-head">
              <strong>课堂概览</strong>
            </div>
            <div className="teaching-session-summary-list">
              <div className="teaching-session-summary-item">
                <strong>当前课件</strong>
                <span>{currentPdfName}</span>
              </div>
              <div className="teaching-session-summary-item">
                <strong>当前页码</strong>
                <span>{`第 ${activePage}${pdfPageCount > 0 ? ` / ${pdfPageCount}` : ""} 页`}</span>
              </div>
              <div className="teaching-session-summary-item">
                <strong>学生举手</strong>
                <span>{`${raisedHands.length} 人`}</span>
              </div>
              <div className="teaching-session-summary-item">
                <strong>学生提问</strong>
                <span>{`${questions.length} 条`}</span>
              </div>
            </div>
          </section>
        </aside>

        <main className="teacher-home-main teaching-session-main">
          <div className="teacher-panel-stack teacher-classroom-stack">
            <header className="teacher-panel-head">
              <div>
                <h2>{lesson?.courseName || "授课会话"}</h2>
                <p>{sessionHelpText}</p>
              </div>
              <div className="teacher-panel-actions">
                <span
                  className={`teacher-lesson-status${
                    session?.status === "live" ? "" : " closed"
                  }`}
                >
                  {sessionStatusText}
                </span>
                <button
                  type="button"
                  className="teacher-ghost-btn"
                  onClick={() => void handleChangePage(Math.max(1, activePage - 1))}
                  disabled={saving || !canGoPrev}
                >
                  <ChevronLeft size={15} />
                  <span>上一页</span>
                </button>
                <button
                  type="button"
                  className="teacher-ghost-btn"
                  onClick={() => void handleChangePage(activePage + 1)}
                  disabled={saving || !canGoNext}
                >
                  <span>下一页</span>
                  <ChevronRight size={15} />
                </button>
              </div>
            </header>

            {loading ? (
              <section className="teacher-card">
                <p className="teacher-empty-text">正在载入授课会话...</p>
              </section>
            ) : (
              <section className="teacher-card teacher-lesson-workbench">
                <div className="teacher-lesson-list-panel">
                  <div className="teacher-lesson-list-head">
                    <h3>授课 PDF</h3>
                    <div className="teacher-lesson-list-head-right">
                      <span>{`${pdfFiles.length} 份`}</span>
                    </div>
                  </div>
                  <div className="teacher-lesson-list">
                    {pdfFiles.length === 0 ? (
                      <p className="teacher-empty-text">
                        当前课时还没有可用的授课 PDF。
                      </p>
                    ) : (
                      pdfFiles.map((item, index) => {
                        const isActive =
                          item.fileId === String(session?.activePdfFileId || "").trim();
                        return (
                          <article
                            key={item.fileId || `pdf-${index + 1}`}
                            className={`teacher-lesson-row${isActive ? " active" : ""}`}
                          >
                            <button
                              type="button"
                              className="teacher-lesson-row-main"
                              onClick={() => void handleSwitchPdf(item.fileId)}
                              disabled={session?.status !== "live"}
                            >
                              <strong>{item.file?.name || `课件 ${index + 1}`}</strong>
                              <p>
                                <span className="teacher-lesson-row-time">
                                  {formatFileSize(item.file?.size)}
                                </span>
                                <span className="teacher-lesson-row-meta">
                                  {isActive ? `当前第 ${activePage} 页` : "待切换"}
                                </span>
                              </p>
                            </button>
                            <div className="teacher-lesson-row-actions">
                              <span
                                className={`teacher-lesson-status${
                                  isActive ? "" : " closed"
                                }`}
                              >
                                {isActive ? "进行中" : "待命"}
                              </span>
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="teacher-lesson-detail-panel">
                  <div className="teacher-lesson-detail-scroll">
                    <section className="teacher-card">
                      <div className="teacher-task-draft-head">
                        <strong>当前授课区</strong>
                        <div className="teacher-task-draft-actions">
                          <span
                            className={`teacher-lesson-status${
                              session?.status === "live" ? "" : " closed"
                            }`}
                          >
                            {session?.status === "live" ? "授课中" : "课后回看"}
                          </span>
                        </div>
                      </div>

                      <ClassroomTeachingPdfViewer
                        fileUrl={pdfSource?.url || ""}
                        fileName={activePdf?.file?.name || pdfSource?.fileName || ""}
                        pageNumber={activePage}
                        onPageCountChange={setPdfPageCount}
                        emptyTitle={
                          pdfLoading
                            ? "正在读取授课 PDF"
                            : "当前还没有可显示的授课 PDF"
                        }
                        emptyText={
                          pdfLoading
                            ? "请稍候，系统正在加载当前课件。"
                            : "请先在授课中心为这节课配置并启用至少一份 PDF。"
                        }
                        label="教师授课 PDF"
                        actionSlot={
                          <span className="teaching-pdf-viewer-inline-status">
                            {session?.status === "live"
                              ? `学生默认跟随 · 当前第 ${activePage} 页`
                              : `已结束授课 · 结束于 ${session?.endedAt ? formatRaisedAt(session.endedAt) : "--"}`}
                          </span>
                        }
                      />
                    </section>

                    <div className="teaching-session-info-grid">
                      <section className="teacher-card">
                        <div className="teacher-task-draft-head">
                          <strong>教师私有讲稿</strong>
                        </div>
                        <textarea
                          className="teacher-req-editor-textarea"
                          value={teachingConfig.teacherNotes || ""}
                          readOnly
                        />
                      </section>

                      <section className="teacher-card">
                        <div className="teacher-task-draft-head">
                          <strong>学生举手</strong>
                          <span className="teacher-panel-save-time">{`${raisedHands.length} 人`}</span>
                        </div>
                        {raisedHands.length === 0 ? (
                          <p className="teacher-empty-text">
                            当前还没有学生举手。
                          </p>
                        ) : (
                          <div className="teaching-session-feedback-list">
                            {raisedHands.map((item, index) => (
                              <article
                                key={String(item?.studentUserId || `hand-${index + 1}`)}
                                className="teaching-session-feedback-item"
                              >
                                <strong>{item?.studentName || item?.studentUsername || "未命名学生"}</strong>
                                <span>{formatRaisedAt(item?.raisedAt)}</span>
                              </article>
                            ))}
                          </div>
                        )}
                      </section>

                      <section className="teacher-card">
                        <div className="teacher-task-draft-head">
                          <strong>学生提问</strong>
                          <span className="teacher-panel-save-time">
                            {teachingConfig.allowQuestions === false ? "已关闭文字提问" : "按时间倒序显示"}
                          </span>
                        </div>
                        {questions.length === 0 ? (
                          <p className="teacher-empty-text">
                            当前还没有学生提问。
                          </p>
                        ) : (
                          <div className="teaching-session-feedback-list">
                            {questions.map((item, index) => (
                              <article
                                key={String(item?.questionId || `question-${index + 1}`)}
                                className="teaching-session-feedback-item"
                              >
                                <div className="teaching-session-feedback-head">
                                  <strong>{item?.studentName || item?.studentUsername || "未命名学生"}</strong>
                                  <span>{formatRaisedAt(item?.createdAt)}</span>
                                </div>
                                <p>{item?.content || ""}</p>
                              </article>
                            ))}
                          </div>
                        )}
                      </section>
                    </div>
                  </div>
                </div>
              </section>
            )}
            {error ? <p className="teacher-home-alert error">{error}</p> : null}
          </div>
        </main>
      </div>
    </div>
  );
}

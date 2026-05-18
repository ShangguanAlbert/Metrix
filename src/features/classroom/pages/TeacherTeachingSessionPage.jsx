import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  RotateCcw,
  Square,
} from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  endAdminTeachingSession,
  fetchAdminClassroomPlans,
  restoreAdminTeachingSession,
  startAdminTeachingSession,
  updateAdminTeachingSessionPage,
  updateAdminTeachingSessionPdf,
} from "../../../pages/admin/adminApi.js";
import { normalizeTeachingCenterConfig } from "../teachingCenterConfig.js";
import { getAdminToken } from "../../../pages/login/adminSession.js";
import {
  resolveActiveAuthSlot,
  withAuthSlot,
} from "../../../app/authStorage.js";
import "../../../styles/teacher-home.css";

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

export default function TeacherTeachingSessionPage() {
  const { lessonId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const activeSlot = resolveActiveAuthSlot(location.search);
  const adminToken = getAdminToken();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lesson, setLesson] = useState(null);
  const [session, setSession] = useState(null);

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

  async function handleChangePage(nextPage) {
    if (!adminToken || !session) return;
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
    if (!adminToken || !session) return;
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

  return (
    <div className="teacher-home-page">
      <div className="teacher-home-shell">
        <main className="teacher-home-main">
          <div className="teacher-panel-stack teacher-classroom-stack">
            <header className="teacher-panel-head">
              <div>
                <h2>{lesson?.courseName || "授课会话"}</h2>
                <p className="teacher-panel-save-time">
                  {session?.status === "live"
                    ? "当前正在授课中"
                    : session?.status === "ended"
                      ? "本次授课已结束，可恢复上次进度"
                      : "正在初始化授课会话"}
                </p>
              </div>
              <div className="teacher-panel-actions">
                <button
                  type="button"
                  className="teacher-ghost-btn"
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
                  className="teacher-ghost-btn"
                  onClick={() => void handleRestore()}
                  disabled={saving || !session?.lastCheckpoint?.pdfFileId}
                >
                  <RotateCcw size={15} />
                  <span>恢复上次进度</span>
                </button>
                <button
                  type="button"
                  className="teacher-delete-btn"
                  onClick={() => void handleEnd()}
                  disabled={saving || session?.status !== "live"}
                >
                  <Square size={15} />
                  <span>结束授课</span>
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
                      pdfFiles.map((item, index) => (
                        <article
                          key={item.fileId || `pdf-${index + 1}`}
                          className={`teacher-lesson-row${
                            item.fileId === String(session?.activePdfFileId || "").trim()
                              ? " active"
                              : ""
                          }`}
                        >
                          <button
                            type="button"
                            className="teacher-lesson-row-main"
                            onClick={() => void handleSwitchPdf(item.fileId)}
                          >
                            <strong>{item.file?.name || `课件 ${index + 1}`}</strong>
                            <p>
                              <span className="teacher-lesson-row-time">
                                {formatFileSize(item.file?.size)}
                              </span>
                            </p>
                          </button>
                        </article>
                      ))
                    )}
                  </div>
                </div>

                <div className="teacher-lesson-detail-panel">
                  <div className="teacher-lesson-detail-scroll">
                    <section className="teacher-card">
                      <div className="teacher-task-draft-head">
                        <strong>当前授课区</strong>
                        <div className="teacher-task-draft-actions">
                          <button
                            type="button"
                            className="teacher-ghost-btn"
                            onClick={() =>
                              void handleChangePage(Math.max(1, Number(session?.activePage || 1) - 1))
                            }
                            disabled={saving || Number(session?.activePage || 1) <= 1}
                          >
                            <ChevronLeft size={15} />
                            <span>上一页</span>
                          </button>
                          <button
                            type="button"
                            className="teacher-ghost-btn"
                            onClick={() =>
                              void handleChangePage(Number(session?.activePage || 1) + 1)
                            }
                            disabled={saving}
                          >
                            <span>下一页</span>
                            <ChevronRight size={15} />
                          </button>
                        </div>
                      </div>
                      <p className="teacher-panel-save-time">
                        {activePdf?.file?.name || "尚未选择授课 PDF"}
                      </p>
                      <div
                        className="teacher-empty-text"
                        style={{
                          minHeight: 240,
                          display: "grid",
                          placeItems: "center",
                          border: "1px dashed var(--teacher-border-soft)",
                          borderRadius: 20,
                        }}
                      >
                        <div style={{ textAlign: "center" }}>
                          <strong>{`当前第 ${Number(session?.activePage || 1)} 页`}</strong>
                          <p style={{ marginTop: 8 }}>
                            当前已接通会话控制，下一步可在这里补真正的 PDF 页面渲染。
                          </p>
                          {activePdf?.file?.id ? (
                            <p style={{ marginTop: 8 }}>
                              <ExternalLink size={14} style={{ verticalAlign: "text-bottom" }} />
                              {` 当前文件：${activePdf.file.name}`}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </section>

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

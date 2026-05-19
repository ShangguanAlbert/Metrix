import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Hand,
  Radio,
  RefreshCw,
  Send,
} from "lucide-react";
import {
  createClassroomTeachingQuestion,
  downloadClassroomLessonFile,
  fetchClassroomTeachingSessionSnapshot,
  raiseClassroomTeachingHand,
} from "../../../pages/classroom/classroomApi.js";
import { getUserToken } from "../../../app/authStorage.js";
import { createTeachingPdfSource } from "../teachingPdfSource.js";
import { createTeachingSessionSocketClient } from "../teachingSessionSocket.js";
import {
  applyStudentViewport,
  applyTeacherViewport,
  createTeachingSyncState,
  resyncTeachingViewport,
} from "../teachingSessionSync.js";
import { normalizeTeachingCenterConfig } from "../teachingCenterConfig.js";
import ClassroomTeachingPdfViewer from "./ClassroomTeachingPdfViewer.jsx";
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

function formatTimestamp(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function appendQuestion(previous, question) {
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

function readTeachingMode(snapshot = {}) {
  return String(snapshot?.mode || "").trim().toLowerCase() === "live"
    ? "live"
    : "readonly";
}

export default function StudentTeachingPanel({ lessons = [] }) {
  const socketRef = useRef(null);
  const pdfSourceRef = useRef(null);
  const userToken = getUserToken();
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState(null);
  const [syncState, setSyncState] = useState(() => createTeachingSyncState());
  const [raisedHands, setRaisedHands] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [questionDraft, setQuestionDraft] = useState("");
  const [questionSaving, setQuestionSaving] = useState(false);
  const [handSaving, setHandSaving] = useState(false);
  const [pdfSource, setPdfSource] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfPageCount, setPdfPageCount] = useState(0);

  const teachingLessons = useMemo(
    () =>
      (Array.isArray(lessons) ? lessons : []).filter((lesson) => {
        const config = normalizeTeachingCenterConfig(lesson?.teachingConfig);
        return config.pdfFiles.length > 0;
      }),
    [lessons],
  );

  useEffect(() => {
    if (teachingLessons.length === 0) {
      setSelectedLessonId("");
      return;
    }
    const hasSelected = teachingLessons.some(
      (lesson) => String(lesson?.id || "") === String(selectedLessonId || ""),
    );
    if (hasSelected) return;
    setSelectedLessonId(String(teachingLessons[0]?.id || ""));
  }, [selectedLessonId, teachingLessons]);

  const selectedLesson = useMemo(
    () =>
      teachingLessons.find(
        (lesson) => String(lesson?.id || "") === String(selectedLessonId || ""),
      ) || null,
    [selectedLessonId, teachingLessons],
  );

  const teachingConfig = useMemo(
    () => normalizeTeachingCenterConfig(selectedLesson?.teachingConfig),
    [selectedLesson?.teachingConfig],
  );

  const pdfFiles = useMemo(() => {
    const fileMap = new Map(
      (Array.isArray(selectedLesson?.files) ? selectedLesson.files : [])
        .filter(isPdfFile)
        .map((file) => [String(file?.id || "").trim(), file]),
    );
    return teachingConfig.pdfFiles
      .map((item) => ({
        fileId: String(item?.fileId || "").trim(),
        file: fileMap.get(String(item?.fileId || "").trim()) || null,
      }))
      .filter((item) => item.file);
  }, [selectedLesson?.files, teachingConfig.pdfFiles]);

  const currentPdf = useMemo(
    () =>
      pdfFiles.find(
        (item) => item.fileId === String(syncState.currentPdfFileId || "").trim(),
      ) || null,
    [pdfFiles, syncState.currentPdfFileId],
  );
  const teacherPdf = useMemo(
    () =>
      pdfFiles.find(
        (item) => item.fileId === String(syncState.teacherPdfFileId || "").trim(),
      ) || null,
    [pdfFiles, syncState.teacherPdfFileId],
  );

  useEffect(() => {
    let cancelled = false;
    const lessonId = String(selectedLesson?.id || "").trim();
    if (!lessonId) {
      setSnapshot(null);
      setRaisedHands([]);
      setQuestions([]);
      setSyncState(createTeachingSyncState());
      setError("");
      return undefined;
    }

    async function loadSnapshot() {
      setLoading(true);
      setError("");
      try {
        const data = await fetchClassroomTeachingSessionSnapshot(lessonId);
        if (cancelled) return;
        const nextMode = readTeachingMode(data);
        const nextSession = data?.session || null;
        const nextLesson = data?.lesson || {};
        const nextConfig = normalizeTeachingCenterConfig(nextLesson?.teachingConfig);
        const initialPdfFileId =
          String(nextSession?.activePdfFileId || "").trim() ||
          String(nextConfig.defaultPdfFileId || "").trim() ||
          String(nextConfig.pdfFiles[0]?.fileId || "").trim();
        setSnapshot(data);
        setRaisedHands(Array.isArray(data?.raisedHands) ? data.raisedHands : []);
        setQuestions(Array.isArray(data?.questions) ? data.questions : []);
        setSyncState(
          createTeachingSyncState({
            mode: nextMode,
            activePdfFileId: initialPdfFileId,
            activePage: nextSession?.activePage || 1,
          }),
        );
      } catch (rawError) {
        if (!cancelled) {
          setError(rawError?.message || "读取授课内容失败，请稍后重试。");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSnapshot();
    return () => {
      cancelled = true;
    };
  }, [selectedLesson?.id]);

  useEffect(() => {
    if (!userToken || !selectedLessonId) return undefined;
    const client = createTeachingSessionSocketClient({
      token: userToken,
      onSessionUpdated: (payload) => {
        const nextSession = payload?.session || null;
        const nextMode = readTeachingMode(payload);
        setSnapshot((current) => ({
          ...(current && typeof current === "object" ? current : {}),
          session: nextSession,
          mode: nextMode,
        }));
        setSyncState((current) =>
          applyTeacherViewport(current, {
            mode: nextMode,
            activePdfFileId: nextSession?.activePdfFileId || current.teacherPdfFileId,
            activePage: nextSession?.activePage || current.teacherPage,
          }),
        );
      },
      onRaisedHandsUpdated: (payload) => {
        setRaisedHands(Array.isArray(payload?.raisedHands) ? payload.raisedHands : []);
      },
      onQuestionCreated: (payload) => {
        if (!payload?.question) return;
        setQuestions((current) => appendQuestion(current, payload.question));
      },
      onError: (payload) => {
        setError(payload?.message || "课堂推送失败，请稍后重试。");
      },
    });
    socketRef.current = client;
    client.connect();
    client.selectLesson(selectedLessonId);
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
  }, [selectedLessonId, userToken]);

  useEffect(() => {
    let cancelled = false;
    if (pdfSourceRef.current?.revoke) {
      pdfSourceRef.current.revoke();
    }
    pdfSourceRef.current = null;
    setPdfSource(null);
    setPdfPageCount(0);

    const fileId = String(currentPdf?.fileId || "").trim();
    if (!fileId) {
      setPdfLoading(false);
      return undefined;
    }

    async function loadPdf() {
      setPdfLoading(true);
      try {
        const result = await downloadClassroomLessonFile(fileId, {
          fileKind: "lesson",
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
  }, [currentPdf?.fileId]);

  async function handleRaiseHand() {
    if (!selectedLessonId) return;
    setHandSaving(true);
    setError("");
    try {
      const data = await raiseClassroomTeachingHand(selectedLessonId);
      setRaisedHands(Array.isArray(data?.raisedHands) ? data.raisedHands : []);
    } catch (rawError) {
      setError(rawError?.message || "举手失败，请稍后重试。");
    } finally {
      setHandSaving(false);
    }
  }

  async function handleSubmitQuestion() {
    const content = String(questionDraft || "").trim();
    if (!selectedLessonId || !content || questionSaving) return;
    setQuestionSaving(true);
    setError("");
    try {
      const data = await createClassroomTeachingQuestion(selectedLessonId, content);
      if (data?.question) {
        setQuestions((current) => appendQuestion(current, data.question));
      }
      setQuestionDraft("");
    } catch (rawError) {
      setError(rawError?.message || "提问失败，请稍后重试。");
    } finally {
      setQuestionSaving(false);
    }
  }

  function handleSwitchPdf(fileId) {
    const nextFileId = String(fileId || "").trim();
    if (!nextFileId) return;
    setSyncState((current) => {
      if (nextFileId === String(current.currentPdfFileId || "").trim()) {
        return current;
      }
      const nextPage =
        nextFileId === String(current.teacherPdfFileId || "").trim() &&
          current.mode === "live"
          ? Math.max(1, Number(current.teacherPage || 1))
          : 1;
      return applyStudentViewport(current, {
        pdfFileId: nextFileId,
        page: nextPage,
      });
    });
  }

  const session = snapshot?.session || null;
  const mode = readTeachingMode(snapshot);
  const isLive = mode === "live";
  const allowQuestions = teachingConfig.allowQuestions !== false;
  const currentPage = Math.max(1, Number(syncState.currentPage || 1));
  const canGoPrev = currentPage > 1;
  const canGoNext = pdfPageCount <= 0 || currentPage < pdfPageCount;
  const teacherPageText =
    syncState.teacherPdfFileId && syncState.teacherPage
      ? `教师当前在${teacherPdf?.file?.name ? `《${teacherPdf.file.name}》` : "当前课件"}第 ${syncState.teacherPage} 页`
      : "教师暂未开始授课";

  return (
    <div className="teacher-panel-stack student-panel-stack">
      <header className="teacher-panel-head">
        <div>
          <h2>授课阅读</h2>
          <p>
            {isLive
              ? "默认跟随教师授课，可临时自行翻页，再一键回到教师当前页。"
              : "课后可自由回看教师本节课使用的 PDF 课件。"}
          </p>
        </div>
      </header>

      {loading ? (
        <div className="student-classroom-loading" role="status" aria-live="polite">
          <span className="student-classroom-loading-spinner" />
        </div>
      ) : null}
      {error ? (
        <p className="task-status-tip error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="teacher-card teacher-lesson-workbench student-lesson-workbench">
        <div className="teacher-lesson-list-panel student-lesson-list-panel">
          <div className="teacher-lesson-list-head">
            <h3>授课课时</h3>
            <div className="teacher-lesson-list-head-right">
              <span>{`${teachingLessons.length} 节课`}</span>
            </div>
          </div>

          {teachingLessons.length === 0 ? (
            <p className="teacher-empty-text">
              教师暂时还没有开放可阅读的授课课件。
            </p>
          ) : (
            <div className="teacher-lesson-list">
              {teachingLessons.map((lesson, index) => {
                const lessonId = String(lesson?.id || "");
                const active = lessonId === String(selectedLessonId || "");
                const lessonConfig = normalizeTeachingCenterConfig(lesson?.teachingConfig);
                const isLessonLive =
                  lessonId === String(snapshot?.lesson?.id || "") && isLive;
                return (
                  <article
                    key={lessonId || `teaching-lesson-${index + 1}`}
                    className={`teacher-lesson-row${active ? " active" : ""}`}
                  >
                    <button
                      type="button"
                      className="teacher-lesson-row-main"
                      onClick={() => setSelectedLessonId(lessonId)}
                    >
                      <strong>{lesson?.courseName || `第${index + 1}节课`}</strong>
                      <p>
                        <span className="teacher-lesson-row-time">
                          {lesson?.courseTime || "时间待教师更新"}
                        </span>
                        <span className="teacher-lesson-row-meta">
                          {`${lessonConfig.pdfFiles.length} 份授课 PDF`}
                        </span>
                      </p>
                    </button>
                    <div className="teacher-lesson-row-actions">
                      <span className={`teacher-lesson-status${isLessonLive ? "" : " closed"}`}>
                        {isLessonLive ? "授课中" : "课后回看"}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="teacher-lesson-detail-panel student-lesson-detail-panel">
          {!selectedLesson ? (
            <p className="teacher-empty-text">请选择左侧课时查看授课内容。</p>
          ) : (
            <div className="teacher-lesson-detail-scroll">
              <section className="teacher-card">
                <div className="teacher-task-draft-head">
                  <strong>{selectedLesson?.courseName || "授课课件"}</strong>
                  <div className="teacher-task-draft-actions">
                    {isLive ? (
                      <span className="teacher-lesson-status">
                        <Radio size={13} />
                        <span>授课中</span>
                      </span>
                    ) : (
                      <span className="teacher-lesson-status closed">课后回看</span>
                    )}
                    {!syncState.followTeacher && isLive ? (
                      <button
                        type="button"
                        className="teacher-ghost-btn"
                        onClick={() => setSyncState((current) => resyncTeachingViewport(current))}
                      >
                        <RefreshCw size={15} />
                        <span>回到教师当前页</span>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="teacher-ghost-btn"
                      onClick={() =>
                        setSyncState((current) =>
                          applyStudentViewport(current, {
                            pdfFileId:
                              current.currentPdfFileId || current.teacherPdfFileId,
                            page: Math.max(1, current.currentPage - 1),
                          }),
                        )
                      }
                      disabled={!canGoPrev}
                    >
                      <ChevronLeft size={15} />
                      <span>上一页</span>
                    </button>
                    <button
                      type="button"
                      className="teacher-ghost-btn"
                      onClick={() =>
                        setSyncState((current) =>
                          applyStudentViewport(current, {
                            pdfFileId:
                              current.currentPdfFileId || current.teacherPdfFileId,
                            page: current.currentPage + 1,
                          }),
                        )
                      }
                      disabled={!canGoNext}
                    >
                      <span>下一页</span>
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>

                {!syncState.followTeacher && isLive ? (
                  <p className="teaching-session-sync-tip">
                    你正在临时自主查看。{teacherPageText}，需要时可点“回到教师当前页”重新跟随。
                  </p>
                ) : (
                  <p className="teacher-panel-save-time">
                    {isLive
                      ? `当前默认跟随教师 · ${teacherPageText}`
                      : "教师本次授课已结束，当前页面已切换为自由回看。"}
                  </p>
                )}

                <ClassroomTeachingPdfViewer
                  fileUrl={pdfSource?.url || ""}
                  fileName={currentPdf?.file?.name || pdfSource?.fileName || ""}
                  pageNumber={currentPage}
                  onPageCountChange={setPdfPageCount}
                  emptyTitle={
                    pdfLoading ? "正在读取授课 PDF" : "当前还没有可显示的授课 PDF"
                  }
                  emptyText={
                    pdfLoading
                      ? "请稍候，系统正在加载当前课件。"
                      : "教师还没有为这节课配置可阅读的授课 PDF。"
                  }
                  label="学生授课 PDF"
                  actionSlot={
                    <span className="teaching-pdf-viewer-inline-status">
                      {syncState.followTeacher && isLive
                        ? "跟随教师"
                        : isLive
                          ? "临时自主翻页"
                          : "自由回看"}
                    </span>
                  }
                />
                {pdfFiles.length > 1 ? (
                  <div className="teaching-session-file-strip">
                    <div className="teacher-task-draft-head">
                      <strong>本节课件</strong>
                      <span className="teacher-panel-save-time">
                        {isLive
                          ? "切换到其他 PDF 会临时离开教师当前视口"
                          : "课后可自由切换并阅读所有授课 PDF"}
                      </span>
                    </div>
                    <div className="teacher-file-chip-list teaching-session-file-chip-list">
                      {pdfFiles.map((item, index) => {
                        const isCurrent =
                          item.fileId === String(syncState.currentPdfFileId || "").trim();
                        const isTeacherPdf =
                          item.fileId === String(syncState.teacherPdfFileId || "").trim();
                        return (
                          <button
                            key={item.fileId || `student-pdf-${index + 1}`}
                            type="button"
                            className={`teacher-file-chip teaching-session-file-chip${
                              isCurrent ? " active" : ""
                            }`}
                            onClick={() => handleSwitchPdf(item.fileId)}
                          >
                            <div className="teacher-file-chip-info">
                              <div className="teacher-file-chip-meta">
                                <div className="teacher-file-chip-headline">
                                  <strong>{item.file?.name || `课件 ${index + 1}`}</strong>
                                </div>
                                <div className="teacher-file-chip-subline">
                                  <span>{formatFileSize(item.file?.size)}</span>
                                  <span>
                                    {isCurrent
                                      ? `当前第 ${currentPage}${pdfPageCount > 0 ? ` / ${pdfPageCount}` : ""} 页`
                                      : isTeacherPdf
                                        ? `教师在第 ${syncState.teacherPage} 页`
                                        : "点击查看"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </section>

              <div className="teaching-session-info-grid">
                <section className="teacher-card">
                  <div className="teacher-task-draft-head">
                    <strong>课堂互动</strong>
                    <span className="teacher-panel-save-time">
                      {isLive ? "已接入实时状态" : "课后仅保留阅读"}
                    </span>
                  </div>
                  <div className="teaching-session-student-actions">
                    <button
                      type="button"
                      className="teacher-ghost-btn"
                      onClick={() => void handleRaiseHand()}
                      disabled={!isLive || handSaving}
                    >
                      <Hand size={15} />
                      <span>{handSaving ? "提交中..." : "举手"}</span>
                    </button>
                  </div>
                  {allowQuestions ? (
                    <div className="teaching-session-question-composer">
                      <textarea
                        value={questionDraft}
                        onChange={(event) => setQuestionDraft(event.target.value)}
                        placeholder={
                          isLive
                            ? "输入你想提的问题，教师端会实时收到。"
                            : "当前已结束授课，暂不能继续提问。"
                        }
                        disabled={!isLive || questionSaving}
                      />
                      <button
                        type="button"
                        className="teacher-primary-btn"
                        onClick={() => void handleSubmitQuestion()}
                        disabled={!isLive || questionSaving || !String(questionDraft).trim()}
                      >
                        <Send size={15} />
                        <span>{questionSaving ? "发送中..." : "发送问题"}</span>
                      </button>
                    </div>
                  ) : (
                    <p className="teacher-empty-text">教师暂未开放文字提问。</p>
                  )}
                </section>

                <section className="teacher-card">
                  <div className="teacher-task-draft-head">
                    <strong>最近提问</strong>
                    <span className="teacher-panel-save-time">{`${questions.length} 条`}</span>
                  </div>
                  {questions.length === 0 ? (
                    <p className="teacher-empty-text">当前还没有课堂提问。</p>
                  ) : (
                    <div className="teaching-session-feedback-list">
                      {questions.map((item, index) => (
                        <article
                          key={String(item?.questionId || `question-${index + 1}`)}
                          className="teaching-session-feedback-item"
                        >
                          <div className="teaching-session-feedback-head">
                            <strong>{item?.studentName || item?.studentUsername || "未命名学生"}</strong>
                            <span>{formatTimestamp(item?.createdAt)}</span>
                          </div>
                          <p>{item?.content || ""}</p>
                        </article>
                      ))}
                    </div>
                  )}
                </section>

                <section className="teacher-card">
                  <div className="teacher-task-draft-head">
                    <strong>课堂状态</strong>
                  </div>
                  <div className="teaching-session-summary-list">
                    <div className="teaching-session-summary-item">
                      <strong>当前模式</strong>
                      <span>{isLive ? "弱同步授课中" : "课后自由回看"}</span>
                    </div>
                    <div className="teaching-session-summary-item">
                      <strong>当前页</strong>
                      <span>{`第 ${currentPage}${pdfPageCount > 0 ? ` / ${pdfPageCount}` : ""} 页`}</span>
                    </div>
                    <div className="teaching-session-summary-item">
                      <strong>举手人数</strong>
                      <span>{`${raisedHands.length} 人`}</span>
                    </div>
                    <div className="teaching-session-summary-item">
                      <strong>当前课件</strong>
                      <span>{currentPdf?.file?.name || "未选择"}</span>
                    </div>
                    {currentPdf?.file ? (
                      <div className="teaching-session-summary-item">
                        <strong>文件大小</strong>
                        <span>{formatFileSize(currentPdf.file.size)}</span>
                      </div>
                    ) : null}
                    {teachingConfig.welcomeText ? (
                      <div className="teaching-session-summary-item">
                        <strong>课堂提示</strong>
                        <span>{teachingConfig.welcomeText}</span>
                      </div>
                    ) : null}
                    <div className="teaching-session-summary-item">
                      <strong>最近更新</strong>
                      <span>{formatTimestamp(session?.endedAt || session?.startedAt || selectedLesson?.updatedAt)}</span>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

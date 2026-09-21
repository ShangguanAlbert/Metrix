import { useEffect, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { downloadClassroomLessonFile, fetchClassroomTaskSettings } from "../../classroom/classroomApi.js";

const REFRESH_MS = 15000;

function taskLinks(content) {
  return String(content || "").split(/\s+/).filter((value) => /^https?:\/\//i.test(value));
}

export default function LessonTaskBoard({ roomId, subscribeToCollaboration }) {
  const [lessons, setLessons] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [downloadingId, setDownloadingId] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const selectedLesson = lessons.find((lesson) => lesson.id === selectedId) || lessons[0];

  useEffect(() => {
    if (!roomId || !subscribeToCollaboration) return undefined;
    return subscribeToCollaboration(roomId, (event) => {
      if (event.type === "coding_collab_template_published") setRefreshKey((value) => value + 1);
    });
  }, [roomId, subscribeToCollaboration]);

  useEffect(() => {
    let cancelled = false;
    let pending = false;
    async function refresh() {
      if (pending) return;
      pending = true;
      try {
        const data = await fetchClassroomTaskSettings();
        if (cancelled) return;
        const plans = Array.isArray(data.teacherCoursePlans) ? data.teacherCoursePlans : [];
        setLessons([...plans].reverse().sort((a, b) =>
          (Date.parse(b.courseStartAt || b.createdAt) || 0) - (Date.parse(a.courseStartAt || a.createdAt) || 0),
        ));
        setError("");
      } catch (cause) {
        if (!cancelled) setError(cause.message || "课时任务加载失败，请刷新重试。");
      } finally {
        pending = false;
        if (!cancelled) setLoading(false);
      }
    }
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshKey]);

  async function download(file) {
    setDownloadingId(file.id);
    setDownloadError("");
    try {
      const result = await downloadClassroomLessonFile(file.id, { fileKind: "task" });
      const objectUrl = result.blob ? URL.createObjectURL(result.blob) : "";
      const url = result.downloadUrl || objectUrl;
      if (!url) throw new Error("任务附件下载失败，请重试。");
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.fileName || file.name;
      if (result.downloadUrl) {
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
      }
      anchor.click();
      if (objectUrl) window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (cause) {
      setDownloadError(cause.message || "任务附件下载失败，请重试。");
    } finally {
      setDownloadingId("");
    }
  }

  function renderFiles(files) {
    if (!files?.length) return null;
    return <div className="party-lesson-files">
      <span>任务附件</span>
      {files.map((file) => <button key={file.id} type="button" disabled={!!downloadingId}
        onClick={() => void download(file)} title={`下载 ${file.name}`}>
        <Download size={14} aria-hidden="true" />
        <span>{downloadingId === file.id ? "下载中..." : file.name}</span>
      </button>)}
    </div>;
  }

  return <section className="party-card party-lesson-board" aria-label="课时任务发布栏">
    <div className="party-announcement-head">
      <h2 className="party-card-title">任务发布栏</h2>
      <button type="button" className="party-announcement-edit-btn" disabled={loading}
        aria-label="刷新课时任务" onClick={() => { setLoading(true); setRefreshKey((value) => value + 1); }}>
        <RefreshCw size={13} aria-hidden="true" /> 刷新
      </button>
    </div>
    {error ? <p className="party-lesson-error" role="alert">{error}</p> : null}
    {loading && !selectedLesson ? <p className="party-tip">正在加载课时任务...</p> : null}
    {!loading && !error && !selectedLesson ? <p className="party-tip">老师暂未开放本班课时任务。</p> : null}
    {selectedLesson ? <>
      <label className="party-lesson-select">课时
        <select aria-label="选择课时任务" value={selectedLesson.id} onChange={(event) => {
          setSelectedId(event.target.value); setDownloadError("");
        }}>
          {lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.courseName}</option>)}
        </select>
      </label>
      {selectedLesson.notes ? <p className="party-lesson-notes">{selectedLesson.notes}</p> : null}
      <div className="party-lesson-tasks">
        {selectedLesson.announcement ? <article className="party-lesson-task">
          <h3>本课公告</h3>
          <p>{selectedLesson.announcement}</p>
        </article> : null}
        {selectedLesson.tasks?.length ? selectedLesson.tasks.map((task, index) => <article className="party-lesson-task" key={task.id}>
          <h3>{index + 1}. {task.title || "课堂任务"}</h3>
          {task.type === "link" ? <>
            {task.description ? <p>{task.description}</p> : null}
            {taskLinks(task.content).map((url, linkIndex) => <a key={`${url}-${linkIndex}`} href={url} target="_blank" rel="noopener noreferrer">{url}</a>)}
          </> : <p>{task.content}</p>}
          {renderFiles(task.files)}
        </article>) : <p className="party-tip">本节课暂无任务内容。</p>}
        {renderFiles(selectedLesson.files)}
      </div>
    </> : null}
    {downloadError ? <p className="party-lesson-error" role="alert">{downloadError}</p> : null}
  </section>;
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Download,
  Loader2,
  Music,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { withAuthSlot } from "../../../app/authStorage.js";
import {
  readReturnUrlFromSearch,
  redirectToReturnUrl,
} from "../../../app/returnNavigation.js";
import {
  clearMusicHistory,
  deleteMusicHistoryItem,
  fetchMusicHistoryDownloadLink,
  fetchMusicHistory,
  fetchMusicHistoryContent,
  generateMusic,
  renameMusicHistoryItem,
} from "../api/musicApi.js";
import "../../../styles/music-generation.css";

const MODEL_OPTIONS = [
  { value: "music-2.6", label: "music-2.6" },
  { value: "music-2.6-free", label: "music-2.6-free" },
];

const HISTORY_LIMIT = 40;
const BROWSER_PLAYABLE_FORMATS = new Set(["mp3", "wav"]);
const DEFAULT_FORM = {
  model: "music-2.6-free",
  prompt: "",
  lyrics: "",
  isInstrumental: false,
  lyricsOptimizer: false,
};

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("zh-CN", { hour12: false });
}

function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "--";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDuration(value) {
  const milliseconds = Number(value);
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return "--";
  const totalSeconds = Math.round(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function buildTaskTitle(item) {
  const customTitle = String(item?.title || "").replace(/\s+/g, " ").trim();
  if (customTitle) return customTitle;
  const prompt = String(item?.prompt || "").replace(/\s+/g, " ").trim();
  if (prompt) return prompt;
  const lyrics = String(item?.lyrics || "").replace(/\s+/g, " ").trim();
  if (lyrics) return lyrics;
  return item?.isInstrumental ? "纯音乐任务" : "歌曲任务";
}

function buildTaskTitlePreview(item) {
  return buildTaskTitle(item).slice(0, 5);
}

function buildTaskPreview(item) {
  const parts = [
    item?.model || "",
    item?.isInstrumental ? "纯音乐" : "人声",
    formatDuration(item?.durationMs),
  ].filter(Boolean);
  return parts.join(" · ");
}

function isBrowserPlayableFormat(format) {
  return BROWSER_PLAYABLE_FORMATS.has(
    String(format || "")
      .trim()
      .toLowerCase(),
  );
}

function MusicPreviewPlayer({
  item,
  previewUrl,
  loading,
  onEnsurePreview,
}) {
  const audioRef = useRef(null);
  const [asyncPlayerError, setAsyncPlayerError] = useState("");
  const itemFormat = String(item?.format || "")
    .trim()
    .toLowerCase();
  const canPreview = isBrowserPlayableFormat(itemFormat);
  const playerError = !canPreview
    ? "PCM 是原始音频流，Chrome 原生播放器无法直接试听；请下载文件，或生成 MP3/WAV。"
    : asyncPlayerError;

  useEffect(() => {
    if (!canPreview) return;
    if (previewUrl || loading) return;

    let cancelled = false;
    void onEnsurePreview(item).catch((error) => {
      if (cancelled) return;
      setAsyncPlayerError(error?.message || "加载试听失败，请稍后重试。");
    });

    return () => {
      cancelled = true;
    };
  }, [canPreview, item, loading, onEnsurePreview, previewUrl]);

  return (
    <div className="music-audio-player">
      {previewUrl ? (
        <audio
          ref={audioRef}
          controls
          preload="metadata"
          src={previewUrl}
          onError={() => {
            setAsyncPlayerError("Chrome 无法解码当前音频，请下载文件确认，或改用 MP3/WAV 重新生成。");
          }}
        />
      ) : loading ? (
        <p className="music-audio-player-loading">正在加载试听...</p>
      ) : null}

      {playerError ? (
        <p className="music-audio-player-error">{playerError}</p>
      ) : null}
    </div>
  );
}

export default function MusicGenerationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnUrl = useMemo(
    () => readReturnUrlFromSearch(location.search),
    [location.search],
  );
  const [form, setForm] = useState(DEFAULT_FORM);
  const [searchValue, setSearchValue] = useState("");
  const [selectedHistoryId, setSelectedHistoryId] = useState("");
  const [historyItems, setHistoryItems] = useState([]);
  const [audioPreviewUrls, setAudioPreviewUrls] = useState({});
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [generateError, setGenerateError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [generating, setGenerating] = useState(false);
  const [audioLoadingId, setAudioLoadingId] = useState("");
  const [linkLoadingId, setLinkLoadingId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [clearing, setClearing] = useState(false);
  const [toastState, setToastState] = useState(null);
  const [editingTitleId, setEditingTitleId] = useState("");
  const [titleDraft, setTitleDraft] = useState("");
  const [renamingId, setRenamingId] = useState("");
  const toastTimerRef = useRef(0);

  const showToast = useCallback((message, type = "success") => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToastState({ message, type });
    toastTimerRef.current = window.setTimeout(() => {
      setToastState(null);
      toastTimerRef.current = 0;
    }, 2000);
  }, []);

  const loadHistory = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setHistoryLoading(true);
    }
    setHistoryError("");
    try {
      const response = await fetchMusicHistory({ limit: HISTORY_LIMIT });
      setHistoryItems(Array.isArray(response?.items) ? response.items : []);
    } catch (error) {
      setHistoryError(error?.message || "加载音乐历史失败，请稍后重试。");
    } finally {
      if (!silent) {
        setHistoryLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const audioPreviewUrlsRef = useRef(audioPreviewUrls);

  useEffect(() => {
    audioPreviewUrlsRef.current = audioPreviewUrls;
  }, [audioPreviewUrls]);

  const filteredHistoryItems = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase();
    if (!keyword) return historyItems;
    return historyItems.filter((item) => {
      const searchableText = [
        item?.prompt,
        item?.lyrics,
        item?.model,
        formatDateTime(item?.createdAt),
        item?.isInstrumental ? "纯音乐" : "人声歌曲",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchableText.includes(keyword);
    });
  }, [historyItems, searchValue]);

  const selectedHistoryItem = useMemo(
    () =>
      historyItems.find((item) => String(item?._id || "") === selectedHistoryId) || null,
    [historyItems, selectedHistoryId],
  );

  useEffect(() => () => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    Object.values(audioPreviewUrlsRef.current).forEach((url) => {
      if (url) {
        URL.revokeObjectURL(url);
      }
    });
  }, []);

  useEffect(() => {
    if (historyLoading) return;
    if (!filteredHistoryItems.length) {
      if (selectedHistoryId) {
        setSelectedHistoryId("");
      }
      return;
    }
    if (!filteredHistoryItems.some((item) => String(item?._id || "") === selectedHistoryId)) {
      setSelectedHistoryId(String(filteredHistoryItems[0]?._id || ""));
    }
  }, [filteredHistoryItems, historyLoading, selectedHistoryId]);

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function startEditingTitle(item) {
    const itemId = String(item?._id || "");
    if (!itemId) return;
    setEditingTitleId(itemId);
    setTitleDraft(buildTaskTitle(item));
    setHistoryError("");
  }

  function cancelEditingTitle() {
    setEditingTitleId("");
    setTitleDraft("");
  }

  async function submitTitleRename(item) {
    const itemId = String(item?._id || "");
    if (!itemId || renamingId) return;
    const nextTitle = String(titleDraft || "").trim();
    const currentTitle = buildTaskTitle(item);
    if (nextTitle === currentTitle) {
      cancelEditingTitle();
      return;
    }

    setRenamingId(itemId);
    setHistoryError("");
    try {
      const response = await renameMusicHistoryItem(itemId, nextTitle);
      if (response?.item?._id) {
        setHistoryItems((current) =>
          current.map((entry) =>
            entry._id === response.item._id ? { ...entry, ...response.item } : entry,
          ),
        );
      }
      cancelEditingTitle();
    } catch (error) {
      setHistoryError(error?.message || "重命名音乐任务失败，请稍后重试。");
    } finally {
      setRenamingId("");
    }
  }

  const ensureAudioPreview = useCallback(async (item) => {
    const itemId = String(item?._id || "");
    if (!itemId) return "";
    if (audioPreviewUrls[itemId]) {
      return audioPreviewUrls[itemId];
    }
    setAudioLoadingId(itemId);
    try {
      const { blob } = await fetchMusicHistoryContent(itemId);
      const nextUrl = URL.createObjectURL(blob);
      setAudioPreviewUrls((current) => {
        if (current[itemId]) {
          URL.revokeObjectURL(nextUrl);
          return current;
        }
        return {
          ...current,
          [itemId]: nextUrl,
        };
      });
      return nextUrl;
    } finally {
      setAudioLoadingId("");
    }
  }, [audioPreviewUrls]);

  async function handleSubmit(event) {
    event.preventDefault();
    setGenerating(true);
    setGenerateError("");
    setSuccessMessage("");
    try {
      const response = await generateMusic(form);
      if (response?.item?._id) {
        setHistoryItems((current) => [
          response.item,
          ...current.filter((item) => item._id !== response.item._id),
        ]);
        setSelectedHistoryId(String(response.item._id));
      } else {
        await loadHistory({ silent: true });
      }
      setSuccessMessage("音乐已生成，并已备份到阿里云 OSS 历史记录。");
    } catch (error) {
      setGenerateError(error?.message || "音乐生成失败，请稍后重试。");
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete(itemId) {
    if (!itemId) return;
    setDeletingId(itemId);
    setHistoryError("");
    try {
      await deleteMusicHistoryItem(itemId);
      setHistoryItems((current) => current.filter((item) => item._id !== itemId));
      setAudioPreviewUrls((current) => {
        const next = { ...current };
        if (next[itemId]) {
          URL.revokeObjectURL(next[itemId]);
          delete next[itemId];
        }
        return next;
      });
    } catch (error) {
      setHistoryError(error?.message || "删除音乐历史失败，请稍后重试。");
    } finally {
      setDeletingId("");
    }
  }

  async function handleClearHistory() {
    setClearing(true);
    setHistoryError("");
    try {
      await clearMusicHistory();
      setHistoryItems([]);
      setAudioPreviewUrls((current) => {
        Object.values(current).forEach((url) => {
          if (url) URL.revokeObjectURL(url);
        });
        return {};
      });
      setSelectedHistoryId("");
    } catch (error) {
      setHistoryError(error?.message || "清空音乐历史失败，请稍后重试。");
    } finally {
      setClearing(false);
    }
  }

  async function handleCreateDownloadLink(item) {
    const itemId = String(item?._id || "");
    if (!itemId || !item?.hasOssBackup) return;
    setLinkLoadingId(itemId);
    try {
      const result = await fetchMusicHistoryDownloadLink(itemId);
      const anchor = document.createElement("a");
      anchor.href = result.downloadUrl;
      anchor.rel = "noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      showToast("下载成功");
    } catch {
      showToast("下载失败", "error");
    } finally {
      setLinkLoadingId("");
    }
  }

  function handleBack() {
    if (redirectToReturnUrl(returnUrl, { replace: true })) {
      return;
    }
    navigate(withAuthSlot("/c"));
  }

  function handleCreateTask() {
    setForm(DEFAULT_FORM);
    setSelectedHistoryId("");
    setGenerateError("");
    setSuccessMessage("");
  }

  return (
    <div className="chat-layout music-generation-page">
      <aside className="sidebar music-workbench-sidebar">
        <div className="sidebar-top">
          <div className="music-brand-row">
            <div className="sidebar-brand-row music-brand-copy-row">
              <div className="sidebar-brand-mark" aria-hidden="true">
                <Music size={18} />
              </div>
              <div className="sidebar-brand-copy">
                <strong className="sidebar-brand-title">音乐</strong>
              </div>
            </div>
            <button
              type="button"
              className="music-create-btn"
              onClick={handleCreateTask}
              aria-label="新建音乐任务"
              title="新建音乐任务"
            >
              <span className="music-create-btn-plus" aria-hidden="true">+</span>
            </button>
          </div>
        </div>

        <section className="music-sidebar-panel">
          <div className="music-filters">
            <div className="music-search-wrap">
              <input
                type="search"
                className="music-search-input"
                placeholder="搜索任务名称、描述、歌词"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
              />
            </div>
          </div>

          <div className="music-task-list">
            {historyLoading ? (
              <div className="music-task-empty">正在加载音乐任务...</div>
            ) : null}
            {!historyLoading && filteredHistoryItems.length === 0 ? (
              <div className="music-task-empty">
                {searchValue.trim() ? "没有匹配的音乐任务。" : "还没有音乐任务。"}
              </div>
            ) : null}

            {!historyLoading &&
              filteredHistoryItems.map((item) => (
                <div
                  key={item._id}
                  className={`music-task-row${selectedHistoryId === item._id ? " active" : ""}`}
                >
                  <button
                    type="button"
                    className="music-task-item"
                    onClick={() => setSelectedHistoryId(String(item._id))}
                  >
                    <span className="music-task-item-title" title={buildTaskTitle(item)}>
                      {buildTaskTitlePreview(item)}
                    </span>
                    <span className="music-task-item-meta">
                      {formatDateTime(item.createdAt)}
                    </span>
                    <span className="music-task-item-preview">
                      {buildTaskPreview(item)}
                    </span>
                  </button>
                </div>
              ))}
          </div>
        </section>

        <div className="music-sidebar-bottom">
          <button
            type="button"
            className="music-side-back-btn"
            onClick={handleBack}
            title="返回"
            aria-label="返回"
          >
            <ArrowLeft size={18} />
            <span>返回</span>
            <span className="music-side-back-status">对话</span>
          </button>
        </div>
      </aside>

      <main className="music-main">
        <div className="music-generation-shell">
          <header className="music-generation-hero">
            <div className="music-hero-copy">
              <div className="music-hero-eyebrow">MUSIC GENERATION</div>
              <h1>音乐生成</h1>
            </div>
            <div className="music-main-actions">
              <button
                type="button"
                className="music-ghost-button music-icon-action"
                onClick={() => loadHistory()}
                disabled={historyLoading}
                title={historyLoading ? "刷新中" : "刷新"}
                aria-label={historyLoading ? "刷新中" : "刷新"}
              >
                {historyLoading ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
              </button>
              <button
                type="button"
                className="music-ghost-button danger music-icon-action"
                onClick={handleClearHistory}
                disabled={clearing || historyItems.length === 0}
                title={clearing ? "清空中" : "清空任务"}
                aria-label={clearing ? "清空中" : "清空任务"}
              >
                {clearing ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />}
              </button>
            </div>
          </header>

          {historyError ? (
            <p className="music-banner-status music-status music-status-error">{historyError}</p>
          ) : null}
	          <div className="music-generation-grid">
	            <section className="music-panel music-form-panel">
	              <form className="music-form-shell" onSubmit={handleSubmit}>
	                <div className="music-panel-head music-form-head">
	                  <div>
	                    <h2>创建任务</h2>
	                  </div>
	                  <div className="music-panel-actions music-form-submit">
	                    <button
	                      type="submit"
	                      className="music-primary-button music-form-submit-button"
	                      disabled={generating}
	                    >
	                      {generating ? <Loader2 size={16} className="spin" /> : <Music size={16} />}
	                      <span>{generating ? "生成中…" : "开始生成"}</span>
	                    </button>
	                  </div>
	                </div>

	                <div className="music-panel-body">
	                  <div className="music-form">
	                    <label className="music-field">
	                      <span>模型</span>
	                      <select
	                        value={form.model}
	                        onChange={(event) => updateField("model", event.target.value)}
	                      >
	                        {MODEL_OPTIONS.map((option) => (
	                          <option key={option.value} value={option.value}>
	                            {option.label}
	                          </option>
	                        ))}
	                      </select>
	                    </label>

	                    <label className="music-field music-field-full">
	                      <span>风格 / 场景描述</span>
	                      <textarea
	                        value={form.prompt}
	                        onChange={(event) => updateField("prompt", event.target.value)}
	                        placeholder="例如：温暖木吉他、轻鼓点、适合校园晨读视频的治愈氛围"
	                        rows={3}
	                      />
	                    </label>

	                    <label className="music-field music-field-full">
	                      <span>歌词</span>
	                      <textarea
	                        value={form.lyrics}
	                        onChange={(event) => updateField("lyrics", event.target.value)}
	                        placeholder={
	                          form.isInstrumental
	                            ? "当前为纯音乐模式，可留空。"
	                            : "输入歌词；若只想给主题，可开启自动歌词优化。"
	                        }
	                        rows={5}
	                      />
	                    </label>

	                    <label className="music-switch">
	                      <input
	                        type="checkbox"
	                        checked={form.isInstrumental}
	                        onChange={(event) =>
	                          updateField("isInstrumental", event.target.checked)
	                        }
	                      />
	                      <span>纯音乐模式</span>
	                    </label>

	                    <label className="music-switch">
	                      <input
	                        type="checkbox"
	                        checked={form.lyricsOptimizer}
	                        onChange={(event) =>
	                          updateField("lyricsOptimizer", event.target.checked)
	                        }
	                      />
	                      <span>自动歌词优化</span>
	                    </label>

	                  </div>

	                  {generateError ? (
	                    <p className="music-status music-status-error">{generateError}</p>
	                  ) : null}
	                  {successMessage ? (
	                    <p className="music-status music-status-success">{successMessage}</p>
	                  ) : null}
	                </div>
	              </form>
	            </section>

            <section className="music-panel music-detail-panel">
              <div className="music-panel-body">
                {!selectedHistoryItem ? (
                  <div className="music-history-empty">
                    <Music size={20} />
                    <span>
                      {historyItems.length > 0
                        ? "从左侧选择一个音乐任务查看详情。"
                        : "还没有音乐任务，先创建第一条吧。"}
                    </span>
                  </div>
                ) : (
                  <div className="music-detail-content">
                    <div className="music-history-card-head">
                      <div>
                        {editingTitleId === selectedHistoryItem._id ? (
                          <input
                            className="music-history-title-input"
                            value={titleDraft}
                            onChange={(event) => setTitleDraft(event.target.value)}
                            onBlur={() => void submitTitleRename(selectedHistoryItem)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                event.currentTarget.blur();
                              }
                              if (event.key === "Escape") {
                                event.preventDefault();
                                cancelEditingTitle();
                              }
                            }}
                            autoFocus
                            disabled={renamingId === selectedHistoryItem._id}
                            maxLength={80}
                          />
                        ) : (
                          <h3
                            className="music-history-title"
                            title={buildTaskTitle(selectedHistoryItem)}
                            onClick={() => startEditingTitle(selectedHistoryItem)}
                          >
                            {buildTaskTitlePreview(selectedHistoryItem)}
                          </h3>
                        )}
                        <p>{formatDateTime(selectedHistoryItem.createdAt)}</p>
                      </div>
                      <div className="music-history-card-actions">
                        <button
                          type="button"
                          className="music-mini-button music-icon-action"
                          onClick={() => handleCreateDownloadLink(selectedHistoryItem)}
                          disabled={
                            !selectedHistoryItem.hasOssBackup ||
                            linkLoadingId === selectedHistoryItem._id ||
                            deletingId === selectedHistoryItem._id
                          }
                          title={linkLoadingId === selectedHistoryItem._id ? "生成下载链接中" : "30天下载"}
                          aria-label={linkLoadingId === selectedHistoryItem._id ? "生成下载链接中" : "30天下载"}
                        >
                          {linkLoadingId === selectedHistoryItem._id ? (
                            <Loader2 size={15} className="spin" />
                          ) : (
                            <Download size={15} />
                          )}
                        </button>
                        <button
                          type="button"
                          className="music-mini-button danger music-icon-action"
                          onClick={() => handleDelete(selectedHistoryItem._id)}
                          disabled={deletingId === selectedHistoryItem._id}
                          title={deletingId === selectedHistoryItem._id ? "删除中" : "删除"}
                          aria-label={deletingId === selectedHistoryItem._id ? "删除中" : "删除"}
                        >
                          {deletingId === selectedHistoryItem._id ? (
                            <Loader2 size={15} className="spin" />
                          ) : (
                            <Trash2 size={15} />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="music-history-meta">
                      <span>{selectedHistoryItem.isInstrumental ? "纯音乐" : "人声歌曲"}</span>
                      <span>{selectedHistoryItem.format?.toUpperCase() || "--"}</span>
                      <span>{formatDuration(selectedHistoryItem.durationMs)}</span>
                      <span>{formatBytes(selectedHistoryItem.audioSize)}</span>
                      <span>
                        {selectedHistoryItem.hasOssBackup ? "OSS 已备份" : "仅本地历史"}
                      </span>
                    </div>

                    <p className="music-history-prompt">
                      <strong>描述：</strong>
                      {selectedHistoryItem.prompt || "—"}
                    </p>
                    {!selectedHistoryItem.isInstrumental ? (
                      <p className="music-history-lyrics">
                        <strong>歌词：</strong>
                        {selectedHistoryItem.lyrics || "自动歌词 / 未展示"}
                      </p>
                    ) : null}

                    <MusicPreviewPlayer
                      key={selectedHistoryItem._id}
                      item={selectedHistoryItem}
                      previewUrl={audioPreviewUrls[selectedHistoryItem._id] || ""}
                      loading={audioLoadingId === selectedHistoryItem._id}
                      onEnsurePreview={ensureAudioPreview}
                    />
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
      {toastState ? (
        <div className={`music-toast music-toast-${toastState.type}`}>
          {toastState.message}
        </div>
      ) : null}
    </div>
  );
}

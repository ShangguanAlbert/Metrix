import { useBeforeUnload, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Download,
  FileText,
  Loader2,
  Music,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { withAuthSlot } from "../../../app/authStorage.js";
import {
  readReturnUrlFromSearch,
  redirectToReturnUrl,
} from "../../../app/returnNavigation.js";
import {
  clearLyricsHistory,
  clearMusicHistory,
  deleteLyricsHistoryItem,
  deleteMusicHistoryItem,
  fetchLyricsHistory,
  fetchMusicHistory,
  fetchMusicHistoryContent,
  fetchMusicHistoryDownloadLink,
  generateLyrics,
  generateMusic,
  renameLyricsHistoryItem,
  renameMusicHistoryItem,
} from "../api/musicApi.js";
import "../../../styles/music-generation.css";

const TAB_MUSIC = "music";
const TAB_LYRICS = "lyrics";
const HISTORY_LIMIT = 40;
const BROWSER_PLAYABLE_FORMATS = new Set(["mp3", "wav"]);
const MUSIC_MODELS = [
  { value: "music-2.6", label: "music-2.6" },
  { value: "music-2.6-free", label: "music-2.6-free" },
  { value: "music-cover", label: "music-cover" },
  { value: "music-cover-free", label: "music-cover-free" },
];
const MUSIC_GENERATING_LEAVE_CONFIRM_MESSAGE =
  "当前音乐或歌词仍在生成中，离开页面会中断本次生成。确定要离开吗？";
const DEFAULT_MUSIC_FORM = {
  model: "music-2.6-free",
  prompt: "",
  lyrics: "",
  isInstrumental: false,
  lyricsOptimizer: false,
  referenceAudio: null,
};
const DEFAULT_LYRICS_FORM = {
  mode: "write_full_song",
  title: "",
  prompt: "",
  lyrics: "",
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

function isCoverModel(model) {
  return String(model || "").trim().startsWith("music-cover");
}

function isBrowserPlayableFormat(format) {
  return BROWSER_PLAYABLE_FORMATS.has(
    String(format || "")
      .trim()
      .toLowerCase(),
  );
}

function buildMusicTaskTitle(item) {
  const customTitle = String(item?.title || "").replace(/\s+/g, " ").trim();
  if (customTitle) return customTitle;
  const prompt = String(item?.prompt || "").replace(/\s+/g, " ").trim();
  if (prompt) return prompt;
  const lyrics = String(item?.lyrics || "").replace(/\s+/g, " ").trim();
  if (lyrics) return lyrics;
  return item?.generationType === "cover" ? "翻唱任务" : item?.isInstrumental ? "纯音乐任务" : "歌曲任务";
}

function buildLyricsTaskTitle(item) {
  const customTitle = String(item?.title || "").replace(/\s+/g, " ").trim();
  if (customTitle) return customTitle;
  const songTitle = String(item?.songTitle || "").replace(/\s+/g, " ").trim();
  if (songTitle) return songTitle;
  const prompt = String(item?.prompt || "").replace(/\s+/g, " ").trim();
  if (prompt) return prompt;
  return item?.mode === "edit" ? "歌词续写任务" : "歌词创作任务";
}

function buildMusicTaskPreview(item) {
  return [
    item?.model || "",
    item?.generationType === "cover" ? "翻唱" : item?.isInstrumental ? "纯音乐" : "人声",
    formatDuration(item?.durationMs),
  ]
    .filter(Boolean)
    .join(" · ");
}

function buildLyricsTaskPreview(item) {
  return [
    item?.mode === "edit" ? "续写" : "完整创作",
    item?.songTitle || "",
    item?.styleTags || "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function MusicPreviewPlayer({
  item,
  previewUrl,
  loading,
  onEnsurePreview,
}) {
  const [asyncPlayerError, setAsyncPlayerError] = useState("");
  const itemFormat = String(item?.format || "")
    .trim()
    .toLowerCase();
  const canPreview = isBrowserPlayableFormat(itemFormat);
  const playerError = !canPreview
    ? "PCM 是原始音频流，Chrome 原生播放器无法直接试听；请下载文件，或生成 MP3/WAV。"
    : asyncPlayerError;

  useEffect(() => {
    if (!canPreview || previewUrl || loading) return;
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

      {playerError ? <p className="music-audio-player-error">{playerError}</p> : null}
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
  const [activeTab, setActiveTab] = useState(TAB_MUSIC);
  const [musicForm, setMusicForm] = useState(DEFAULT_MUSIC_FORM);
  const [lyricsForm, setLyricsForm] = useState(DEFAULT_LYRICS_FORM);
  const [searchValue, setSearchValue] = useState("");
  const [selectedMusicHistoryId, setSelectedMusicHistoryId] = useState("");
  const [selectedLyricsHistoryId, setSelectedLyricsHistoryId] = useState("");
  const [musicHistoryItems, setMusicHistoryItems] = useState([]);
  const [lyricsHistoryItems, setLyricsHistoryItems] = useState([]);
  const [audioPreviewUrls, setAudioPreviewUrls] = useState({});
  const [musicHistoryLoading, setMusicHistoryLoading] = useState(true);
  const [lyricsHistoryLoading, setLyricsHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [generateError, setGenerateError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [musicGenerating, setMusicGenerating] = useState(false);
  const [lyricsGenerating, setLyricsGenerating] = useState(false);
  const [audioLoadingId, setAudioLoadingId] = useState("");
  const [linkLoadingId, setLinkLoadingId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [clearing, setClearing] = useState(false);
  const [toastState, setToastState] = useState(null);
  const [editingKind, setEditingKind] = useState("");
  const [editingId, setEditingId] = useState("");
  const [titleDraft, setTitleDraft] = useState("");
  const [renamingId, setRenamingId] = useState("");
  const toastTimerRef = useRef(0);
  const musicAbortControllerRef = useRef(null);
  const lyricsAbortControllerRef = useRef(null);
  const audioPreviewUrlsRef = useRef(audioPreviewUrls);

  const shouldConfirmLeave = musicGenerating || lyricsGenerating;

  useEffect(() => {
    audioPreviewUrlsRef.current = audioPreviewUrls;
  }, [audioPreviewUrls]);

  const showToast = useCallback((message, type = "success") => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToastState({ message, type });
    toastTimerRef.current = window.setTimeout(() => {
      setToastState(null);
      toastTimerRef.current = 0;
    }, 2200);
  }, []);

  const abortActiveRequests = useCallback(() => {
    musicAbortControllerRef.current?.abort();
    lyricsAbortControllerRef.current?.abort();
  }, []);

  const confirmLeavingPage = useCallback(() => {
    if (!shouldConfirmLeave) return true;
    const confirmed = window.confirm(MUSIC_GENERATING_LEAVE_CONFIRM_MESSAGE);
    if (!confirmed) return false;
    abortActiveRequests();
    return true;
  }, [abortActiveRequests, shouldConfirmLeave]);

  useBeforeUnload(
    useCallback(
      (event) => {
        if (!shouldConfirmLeave) return;
        event.preventDefault();
        event.returnValue = "";
      },
      [shouldConfirmLeave],
    ),
  );

  const loadMusicHistory = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setMusicHistoryLoading(true);
    setHistoryError("");
    try {
      const response = await fetchMusicHistory({ limit: HISTORY_LIMIT });
      setMusicHistoryItems(Array.isArray(response?.items) ? response.items : []);
    } catch (error) {
      setHistoryError(error?.message || "加载音乐历史失败，请稍后重试。");
    } finally {
      if (!silent) setMusicHistoryLoading(false);
    }
  }, []);

  const loadLyricsHistory = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLyricsHistoryLoading(true);
    setHistoryError("");
    try {
      const response = await fetchLyricsHistory({ limit: HISTORY_LIMIT });
      setLyricsHistoryItems(Array.isArray(response?.items) ? response.items : []);
    } catch (error) {
      setHistoryError(error?.message || "加载歌词历史失败，请稍后重试。");
    } finally {
      if (!silent) setLyricsHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.all([loadMusicHistory(), loadLyricsHistory()]);
  }, [loadLyricsHistory, loadMusicHistory]);

  useEffect(() => () => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    abortActiveRequests();
    Object.values(audioPreviewUrlsRef.current).forEach((url) => {
      if (url) URL.revokeObjectURL(url);
    });
  }, [abortActiveRequests]);

  const filteredMusicHistoryItems = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase();
    if (!keyword) return musicHistoryItems;
    return musicHistoryItems.filter((item) => {
      const searchableText = [
        item?.title,
        item?.prompt,
        item?.lyrics,
        item?.model,
        item?.referenceAudioFileName,
        item?.generationType === "cover" ? "翻唱" : "作曲",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchableText.includes(keyword);
    });
  }, [musicHistoryItems, searchValue]);

  const filteredLyricsHistoryItems = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase();
    if (!keyword) return lyricsHistoryItems;
    return lyricsHistoryItems.filter((item) => {
      const searchableText = [
        item?.title,
        item?.prompt,
        item?.songTitle,
        item?.styleTags,
        item?.lyrics,
        item?.sourceLyrics,
        item?.mode === "edit" ? "续写" : "完整创作",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchableText.includes(keyword);
    });
  }, [lyricsHistoryItems, searchValue]);

  const selectedMusicHistoryItem = useMemo(
    () =>
      musicHistoryItems.find((item) => String(item?._id || "") === selectedMusicHistoryId) || null,
    [musicHistoryItems, selectedMusicHistoryId],
  );
  const selectedLyricsHistoryItem = useMemo(
    () =>
      lyricsHistoryItems.find((item) => String(item?._id || "") === selectedLyricsHistoryId) ||
      null,
    [lyricsHistoryItems, selectedLyricsHistoryId],
  );

  useEffect(() => {
    if (musicHistoryLoading) return;
    if (!filteredMusicHistoryItems.length) {
      if (selectedMusicHistoryId) setSelectedMusicHistoryId("");
      return;
    }
    if (
      !filteredMusicHistoryItems.some(
        (item) => String(item?._id || "") === selectedMusicHistoryId,
      )
    ) {
      setSelectedMusicHistoryId(String(filteredMusicHistoryItems[0]?._id || ""));
    }
  }, [filteredMusicHistoryItems, musicHistoryLoading, selectedMusicHistoryId]);

  useEffect(() => {
    if (lyricsHistoryLoading) return;
    if (!filteredLyricsHistoryItems.length) {
      if (selectedLyricsHistoryId) setSelectedLyricsHistoryId("");
      return;
    }
    if (
      !filteredLyricsHistoryItems.some(
        (item) => String(item?._id || "") === selectedLyricsHistoryId,
      )
    ) {
      setSelectedLyricsHistoryId(String(filteredLyricsHistoryItems[0]?._id || ""));
    }
  }, [filteredLyricsHistoryItems, lyricsHistoryLoading, selectedLyricsHistoryId]);

  const ensureAudioPreview = useCallback(
    async (item) => {
      const itemId = String(item?._id || "");
      if (!itemId) return "";
      if (audioPreviewUrls[itemId]) return audioPreviewUrls[itemId];
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
    },
    [audioPreviewUrls],
  );

  function resetActiveComposer() {
    setGenerateError("");
    setSuccessMessage("");
    if (activeTab === TAB_MUSIC) {
      setMusicForm(DEFAULT_MUSIC_FORM);
      setSelectedMusicHistoryId("");
      return;
    }
    setLyricsForm(DEFAULT_LYRICS_FORM);
    setSelectedLyricsHistoryId("");
  }

  function startEditingTitle(kind, item) {
    const itemId = String(item?._id || "");
    if (!itemId) return;
    setEditingKind(kind);
    setEditingId(itemId);
    setTitleDraft(
      kind === TAB_MUSIC ? buildMusicTaskTitle(item) : buildLyricsTaskTitle(item),
    );
    setHistoryError("");
  }

  function cancelEditingTitle() {
    setEditingKind("");
    setEditingId("");
    setTitleDraft("");
  }

  async function submitTitleRename(kind, item) {
    const itemId = String(item?._id || "");
    if (!itemId || renamingId) return;
    const nextTitle = String(titleDraft || "").trim();
    const currentTitle =
      kind === TAB_MUSIC ? buildMusicTaskTitle(item) : buildLyricsTaskTitle(item);
    if (nextTitle === currentTitle) {
      cancelEditingTitle();
      return;
    }

    setRenamingId(itemId);
    setHistoryError("");
    try {
      if (kind === TAB_MUSIC) {
        const response = await renameMusicHistoryItem(itemId, nextTitle);
        if (response?.item?._id) {
          setMusicHistoryItems((current) =>
            current.map((entry) =>
              entry._id === response.item._id ? { ...entry, ...response.item } : entry,
            ),
          );
        }
      } else {
        const response = await renameLyricsHistoryItem(itemId, nextTitle);
        if (response?.item?._id) {
          setLyricsHistoryItems((current) =>
            current.map((entry) =>
              entry._id === response.item._id ? { ...entry, ...response.item } : entry,
            ),
          );
        }
      }
      cancelEditingTitle();
    } catch (error) {
      setHistoryError(error?.message || "重命名任务失败，请稍后重试。");
    } finally {
      setRenamingId("");
    }
  }

  async function handleMusicSubmit(event) {
    event.preventDefault();
    const controller = new AbortController();
    musicAbortControllerRef.current = controller;
    setMusicGenerating(true);
    setGenerateError("");
    setSuccessMessage("");
    try {
      const response = await generateMusic(musicForm, {
        signal: controller.signal,
      });
      if (response?.item?._id) {
        setMusicHistoryItems((current) => [
          response.item,
          ...current.filter((item) => item._id !== response.item._id),
        ]);
        setSelectedMusicHistoryId(String(response.item._id));
      } else {
        await loadMusicHistory({ silent: true });
      }
      setSuccessMessage("音乐已生成，并已备份到阿里云 OSS 历史记录。");
      setMusicForm((current) => ({
        ...DEFAULT_MUSIC_FORM,
        model: current.model,
      }));
    } catch (error) {
      if (error?.name === "AbortError") return;
      setGenerateError(error?.message || "音乐生成失败，请稍后重试。");
    } finally {
      if (musicAbortControllerRef.current === controller) {
        musicAbortControllerRef.current = null;
      }
      setMusicGenerating(false);
    }
  }

  async function handleLyricsSubmit(event) {
    event.preventDefault();
    const controller = new AbortController();
    lyricsAbortControllerRef.current = controller;
    setLyricsGenerating(true);
    setGenerateError("");
    setSuccessMessage("");
    try {
      const response = await generateLyrics(lyricsForm, {
        signal: controller.signal,
      });
      if (response?.item?._id) {
        setLyricsHistoryItems((current) => [
          response.item,
          ...current.filter((item) => item._id !== response.item._id),
        ]);
        setSelectedLyricsHistoryId(String(response.item._id));
      } else {
        await loadLyricsHistory({ silent: true });
      }
      setSuccessMessage("歌词已生成并写入历史记录。");
      setLyricsForm((current) => ({
        ...DEFAULT_LYRICS_FORM,
        mode: current.mode,
      }));
    } catch (error) {
      if (error?.name === "AbortError") return;
      setGenerateError(error?.message || "歌词生成失败，请稍后重试。");
    } finally {
      if (lyricsAbortControllerRef.current === controller) {
        lyricsAbortControllerRef.current = null;
      }
      setLyricsGenerating(false);
    }
  }

  async function handleDelete(kind, itemId) {
    if (!itemId) return;
    setDeletingId(itemId);
    setHistoryError("");
    try {
      if (kind === TAB_MUSIC) {
        await deleteMusicHistoryItem(itemId);
        setMusicHistoryItems((current) => current.filter((item) => item._id !== itemId));
        setAudioPreviewUrls((current) => {
          const next = { ...current };
          if (next[itemId]) {
            URL.revokeObjectURL(next[itemId]);
            delete next[itemId];
          }
          return next;
        });
      } else {
        await deleteLyricsHistoryItem(itemId);
        setLyricsHistoryItems((current) => current.filter((item) => item._id !== itemId));
      }
    } catch (error) {
      setHistoryError(error?.message || "删除历史失败，请稍后重试。");
    } finally {
      setDeletingId("");
    }
  }

  async function handleClearHistory() {
    setClearing(true);
    setHistoryError("");
    try {
      if (activeTab === TAB_MUSIC) {
        await clearMusicHistory();
        setMusicHistoryItems([]);
        setAudioPreviewUrls((current) => {
          Object.values(current).forEach((url) => {
            if (url) URL.revokeObjectURL(url);
          });
          return {};
        });
        setSelectedMusicHistoryId("");
      } else {
        await clearLyricsHistory();
        setLyricsHistoryItems([]);
        setSelectedLyricsHistoryId("");
      }
    } catch (error) {
      setHistoryError(error?.message || "清空历史失败，请稍后重试。");
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
    if (!confirmLeavingPage()) return;
    if (redirectToReturnUrl(returnUrl, { replace: true })) {
      return;
    }
    navigate(withAuthSlot("/c"));
  }

  async function handleRefreshActiveTab() {
    if (activeTab === TAB_MUSIC) {
      await loadMusicHistory();
      return;
    }
    await loadLyricsHistory();
  }

  function handleUseLyricsForMusic(item) {
    setMusicForm((current) => ({
      ...current,
      model: current.model.startsWith("music-cover") ? "music-2.6-free" : current.model,
      prompt: item?.styleTags || item?.prompt || "",
      lyrics: item?.lyrics || "",
      isInstrumental: false,
      lyricsOptimizer: false,
      referenceAudio: null,
    }));
    setActiveTab(TAB_MUSIC);
    setGenerateError("");
    setSuccessMessage("已将歌词内容带入音乐工作台。");
  }

  const currentList = activeTab === TAB_MUSIC ? filteredMusicHistoryItems : filteredLyricsHistoryItems;
  const currentSelectedItem =
    activeTab === TAB_MUSIC ? selectedMusicHistoryItem : selectedLyricsHistoryItem;
  const currentLoading = activeTab === TAB_MUSIC ? musicHistoryLoading : lyricsHistoryLoading;
  const searchPlaceholder =
    activeTab === TAB_MUSIC ? "搜索音乐任务、描述、歌词" : "搜索歌词标题、风格、正文";

  return (
    <div className="chat-layout music-generation-page">
      <aside className="sidebar music-workbench-sidebar">
        <div className="sidebar-top">
          <div className="music-brand-row">
            <div className="sidebar-brand-row music-brand-copy-row">
              <div className="sidebar-brand-mark" aria-hidden="true">
                {activeTab === TAB_MUSIC ? <Music size={18} /> : <FileText size={18} />}
              </div>
              <div className="sidebar-brand-copy">
                <strong className="sidebar-brand-title">
                  {activeTab === TAB_MUSIC ? "音乐" : "歌词"}
                </strong>
              </div>
            </div>
            <button
              type="button"
              className="music-create-btn"
              onClick={resetActiveComposer}
              aria-label="新建任务"
              title="新建任务"
              disabled={shouldConfirmLeave}
            >
              <span className="music-create-btn-plus" aria-hidden="true">+</span>
            </button>
          </div>
        </div>

        <section className="music-sidebar-panel">
          <div className="music-filters">
            <div className="music-tab-row">
              <button
                type="button"
                className={`music-tab-button${activeTab === TAB_MUSIC ? " active" : ""}`}
                onClick={() => setActiveTab(TAB_MUSIC)}
              >
                <Music size={15} />
                <span>音乐工作台</span>
              </button>
              <button
                type="button"
                className={`music-tab-button${activeTab === TAB_LYRICS ? " active" : ""}`}
                onClick={() => setActiveTab(TAB_LYRICS)}
              >
                <FileText size={15} />
                <span>歌词工作台</span>
              </button>
            </div>
            <div className="music-search-wrap">
              <input
                type="search"
                className="music-search-input"
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
              />
            </div>
          </div>

          <div className="music-task-list">
            {currentLoading ? (
              <div className="music-task-empty">正在加载历史记录...</div>
            ) : null}
            {!currentLoading && currentList.length === 0 ? (
              <div className="music-task-empty">
                {searchValue.trim() ? "没有匹配的任务。" : "还没有历史任务。"}
              </div>
            ) : null}

            {!currentLoading &&
              currentList.map((item) => {
                const itemId = String(item?._id || "");
                const isActive =
                  activeTab === TAB_MUSIC
                    ? selectedMusicHistoryId === itemId
                    : selectedLyricsHistoryId === itemId;
                return (
                  <div
                    key={itemId}
                    className={`music-task-row${isActive ? " active" : ""}`}
                  >
                    <button
                      type="button"
                      className="music-task-item"
                      onClick={() => {
                        if (activeTab === TAB_MUSIC) {
                          setSelectedMusicHistoryId(itemId);
                        } else {
                          setSelectedLyricsHistoryId(itemId);
                        }
                      }}
                    >
                      <span
                        className="music-task-item-title"
                        title={
                          activeTab === TAB_MUSIC
                            ? buildMusicTaskTitle(item)
                            : buildLyricsTaskTitle(item)
                        }
                      >
                        {(activeTab === TAB_MUSIC
                          ? buildMusicTaskTitle(item)
                          : buildLyricsTaskTitle(item)
                        ).slice(0, 12)}
                      </span>
                      <span className="music-task-item-meta">{formatDateTime(item.createdAt)}</span>
                      <span className="music-task-item-preview">
                        {activeTab === TAB_MUSIC
                          ? buildMusicTaskPreview(item)
                          : buildLyricsTaskPreview(item)}
                      </span>
                    </button>
                  </div>
                );
              })}
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
              <div className="music-hero-eyebrow">
                {activeTab === TAB_MUSIC ? "MUSIC GENERATION" : "LYRICS GENERATION"}
              </div>
              <h1>{activeTab === TAB_MUSIC ? "音乐生成" : "歌词生成"}</h1>
            </div>
            <div className="music-main-actions">
              <button
                type="button"
                className="music-ghost-button music-icon-action"
                onClick={() => void handleRefreshActiveTab()}
                disabled={currentLoading}
                title={currentLoading ? "刷新中" : "刷新"}
                aria-label={currentLoading ? "刷新中" : "刷新"}
              >
                {currentLoading ? <Loader2 size={16} className="spin" /> : <RefreshCw size={16} />}
              </button>
              <button
                type="button"
                className="music-ghost-button danger music-icon-action"
                onClick={handleClearHistory}
                disabled={clearing || currentList.length === 0}
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
              {activeTab === TAB_MUSIC ? (
                <form className="music-form-shell" onSubmit={handleMusicSubmit}>
                  <div className="music-panel-head music-form-head">
                    <div>
                      <h2>创建音乐任务</h2>
                    </div>
                    <div className="music-panel-actions music-form-submit">
                      <button
                        type="submit"
                        className="music-primary-button music-form-submit-button"
                        disabled={musicGenerating || lyricsGenerating}
                      >
                        {musicGenerating ? <Loader2 size={16} className="spin" /> : <Music size={16} />}
                        <span>{musicGenerating ? "生成中…" : "开始生成"}</span>
                      </button>
                    </div>
                  </div>

                  <div className="music-panel-body">
                    <div className="music-form">
                      <label className="music-field">
                        <span>模型</span>
                        <select
                          value={musicForm.model}
                          onChange={(event) =>
                            setMusicForm((current) => ({
                              ...current,
                              model: event.target.value,
                              referenceAudio:
                                event.target.value.startsWith("music-cover")
                                  ? current.referenceAudio
                                  : null,
                            }))
                          }
                          disabled={musicGenerating || lyricsGenerating}
                        >
                          {MUSIC_MODELS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="music-field music-field-full">
                        <span>风格 / 场景描述</span>
                        <textarea
                          value={musicForm.prompt}
                          onChange={(event) =>
                            setMusicForm((current) => ({
                              ...current,
                              prompt: event.target.value,
                            }))
                          }
                          placeholder={
                            isCoverModel(musicForm.model)
                              ? "例如：转换成女声流行、温暖抒情、带轻鼓点"
                              : "例如：温暖木吉他、轻鼓点、适合校园晨读视频的治愈氛围"
                          }
                          rows={3}
                          disabled={musicGenerating || lyricsGenerating}
                        />
                      </label>

                      <label className="music-field music-field-full">
                        <span>{isCoverModel(musicForm.model) ? "歌词（可选）" : "歌词"}</span>
                        <textarea
                          value={musicForm.lyrics}
                          onChange={(event) =>
                            setMusicForm((current) => ({
                              ...current,
                              lyrics: event.target.value,
                            }))
                          }
                          placeholder={
                            isCoverModel(musicForm.model)
                              ? "如不填写，将由参考音频自动推断或使用原有内容。"
                              : musicForm.isInstrumental
                                ? "当前为纯音乐模式，可留空。"
                                : "输入歌词；若只想给主题，可开启自动歌词优化。"
                          }
                          rows={5}
                          disabled={musicGenerating || lyricsGenerating}
                        />
                      </label>

                      {isCoverModel(musicForm.model) ? (
                        <label className="music-field music-field-full">
                          <span>参考音频（上传后会自动备份到 OSS）</span>
                          <div className="music-file-input-wrap">
                            <input
                              type="file"
                              accept="audio/*"
                              onChange={(event) =>
                                setMusicForm((current) => ({
                                  ...current,
                                  referenceAudio: event.target.files?.[0] || null,
                                }))
                              }
                              disabled={musicGenerating || lyricsGenerating}
                            />
                            <div className="music-file-helper">
                              <Upload size={14} />
                              <span>
                                {musicForm.referenceAudio
                                  ? `${musicForm.referenceAudio.name} · ${formatBytes(
                                      musicForm.referenceAudio.size,
                                    )}`
                                  : "支持常见音频格式，最大 50MB"}
                              </span>
                            </div>
                          </div>
                        </label>
                      ) : (
                        <>
                          <label className="music-switch">
                            <input
                              type="checkbox"
                              checked={musicForm.isInstrumental}
                              onChange={(event) =>
                                setMusicForm((current) => ({
                                  ...current,
                                  isInstrumental: event.target.checked,
                                }))
                              }
                              disabled={musicGenerating || lyricsGenerating}
                            />
                            <span>纯音乐模式</span>
                          </label>

                          <label className="music-switch">
                            <input
                              type="checkbox"
                              checked={musicForm.lyricsOptimizer}
                              onChange={(event) =>
                                setMusicForm((current) => ({
                                  ...current,
                                  lyricsOptimizer: event.target.checked,
                                }))
                              }
                              disabled={musicGenerating || lyricsGenerating}
                            />
                            <span>自动歌词优化</span>
                          </label>
                        </>
                      )}

                      {musicGenerating ? (
                        <p className="music-status music-status-success">
                          正在生成，请勿离开页面。
                        </p>
                      ) : null}
                      {generateError ? (
                        <p className="music-status music-status-error">{generateError}</p>
                      ) : null}
                      {successMessage ? (
                        <p className="music-status music-status-success">{successMessage}</p>
                      ) : null}
                    </div>
                  </div>
                </form>
              ) : (
                <form className="music-form-shell" onSubmit={handleLyricsSubmit}>
                  <div className="music-panel-head music-form-head">
                    <div>
                      <h2>创建歌词任务</h2>
                    </div>
                    <div className="music-panel-actions music-form-submit">
                      <button
                        type="submit"
                        className="music-primary-button music-form-submit-button"
                        disabled={musicGenerating || lyricsGenerating}
                      >
                        {lyricsGenerating ? <Loader2 size={16} className="spin" /> : <FileText size={16} />}
                        <span>{lyricsGenerating ? "生成中…" : "开始生成"}</span>
                      </button>
                    </div>
                  </div>

                  <div className="music-panel-body">
                    <div className="music-form">
                      <label className="music-field">
                        <span>模式</span>
                        <select
                          value={lyricsForm.mode}
                          onChange={(event) =>
                            setLyricsForm((current) => ({
                              ...current,
                              mode: event.target.value,
                            }))
                          }
                          disabled={musicGenerating || lyricsGenerating}
                        >
                          <option value="write_full_song">写完整歌曲</option>
                          <option value="edit">编辑 / 续写</option>
                        </select>
                      </label>

                      <label className="music-field">
                        <span>标题（可选）</span>
                        <input
                          className="music-text-input"
                          value={lyricsForm.title}
                          onChange={(event) =>
                            setLyricsForm((current) => ({
                              ...current,
                              title: event.target.value,
                            }))
                          }
                          placeholder="例如：夏夜未眠"
                          disabled={musicGenerating || lyricsGenerating}
                        />
                      </label>

                      <label className="music-field music-field-full">
                        <span>主题 / 风格提示</span>
                        <textarea
                          value={lyricsForm.prompt}
                          onChange={(event) =>
                            setLyricsForm((current) => ({
                              ...current,
                              prompt: event.target.value,
                            }))
                          }
                          placeholder="例如：校园毕业季、钢琴抒情、带一点遗憾和成长感"
                          rows={3}
                          disabled={musicGenerating || lyricsGenerating}
                        />
                      </label>

                      {lyricsForm.mode === "edit" ? (
                        <label className="music-field music-field-full">
                          <span>原歌词</span>
                          <textarea
                            value={lyricsForm.lyrics}
                            onChange={(event) =>
                              setLyricsForm((current) => ({
                                ...current,
                                lyrics: event.target.value,
                              }))
                            }
                            placeholder="输入原歌词，系统将按你的提示进行编辑或续写。"
                            rows={7}
                            disabled={musicGenerating || lyricsGenerating}
                          />
                        </label>
                      ) : null}

                      {lyricsGenerating ? (
                        <p className="music-status music-status-success">
                          正在生成，请勿离开页面。
                        </p>
                      ) : null}
                      {generateError ? (
                        <p className="music-status music-status-error">{generateError}</p>
                      ) : null}
                      {successMessage ? (
                        <p className="music-status music-status-success">{successMessage}</p>
                      ) : null}
                    </div>
                  </div>
                </form>
              )}
            </section>

            <section className="music-panel music-detail-panel">
              <div className="music-panel-body">
                {!currentSelectedItem ? (
                  <div className="music-history-empty">
                    {activeTab === TAB_MUSIC ? <Music size={20} /> : <FileText size={20} />}
                    <span>
                      {currentList.length > 0 ? "从左侧选择一个任务查看详情。" : "还没有任务，先创建第一条吧。"}
                    </span>
                  </div>
                ) : activeTab === TAB_MUSIC ? (
                  <div className="music-detail-content">
                    <div className="music-history-card-head">
                      <div>
                        {editingKind === TAB_MUSIC && editingId === currentSelectedItem._id ? (
                          <input
                            className="music-history-title-input"
                            value={titleDraft}
                            onChange={(event) => setTitleDraft(event.target.value)}
                            onBlur={() => void submitTitleRename(TAB_MUSIC, currentSelectedItem)}
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
                            disabled={renamingId === currentSelectedItem._id}
                            maxLength={80}
                          />
                        ) : (
                          <h3
                            className="music-history-title"
                            title={buildMusicTaskTitle(currentSelectedItem)}
                            onClick={() => startEditingTitle(TAB_MUSIC, currentSelectedItem)}
                          >
                            {buildMusicTaskTitle(currentSelectedItem)}
                          </h3>
                        )}
                        <p>{formatDateTime(currentSelectedItem.createdAt)}</p>
                      </div>
                      <div className="music-history-card-actions">
                        <button
                          type="button"
                          className="music-mini-button music-icon-action"
                          onClick={() => handleCreateDownloadLink(currentSelectedItem)}
                          disabled={
                            !currentSelectedItem.hasOssBackup ||
                            linkLoadingId === currentSelectedItem._id ||
                            deletingId === currentSelectedItem._id
                          }
                          title={linkLoadingId === currentSelectedItem._id ? "生成下载链接中" : "30天下载"}
                          aria-label={linkLoadingId === currentSelectedItem._id ? "生成下载链接中" : "30天下载"}
                        >
                          {linkLoadingId === currentSelectedItem._id ? (
                            <Loader2 size={15} className="spin" />
                          ) : (
                            <Download size={15} />
                          )}
                        </button>
                        <button
                          type="button"
                          className="music-mini-button danger music-icon-action"
                          onClick={() => void handleDelete(TAB_MUSIC, currentSelectedItem._id)}
                          disabled={deletingId === currentSelectedItem._id}
                        >
                          {deletingId === currentSelectedItem._id ? (
                            <Loader2 size={15} className="spin" />
                          ) : (
                            <Trash2 size={15} />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="music-history-meta">
                      <span>{currentSelectedItem.generationType === "cover" ? "翻唱" : "作曲"}</span>
                      <span>{currentSelectedItem.isInstrumental ? "纯音乐" : "人声歌曲"}</span>
                      <span>{currentSelectedItem.format?.toUpperCase() || "--"}</span>
                      <span>{formatDuration(currentSelectedItem.durationMs)}</span>
                      <span>{formatBytes(currentSelectedItem.audioSize)}</span>
                      <span>{currentSelectedItem.hasOssBackup ? "OSS 已备份" : "仅本地历史"}</span>
                      {currentSelectedItem.generationType === "cover" ? (
                        <span>
                          {currentSelectedItem.hasReferenceAudioBackup ? "参考音频已备份" : "参考音频未备份"}
                        </span>
                      ) : null}
                    </div>

                    <p className="music-history-prompt">
                      <strong>描述：</strong>
                      {currentSelectedItem.prompt || "—"}
                    </p>
                    <p className="music-history-lyrics">
                      <strong>歌词：</strong>
                      {currentSelectedItem.lyrics || "—"}
                    </p>
                    {currentSelectedItem.generationType === "cover" ? (
                      <p className="music-history-lyrics">
                        <strong>参考音频：</strong>
                        {currentSelectedItem.referenceAudioFileName || "—"} ·{" "}
                        {formatBytes(currentSelectedItem.referenceAudioSize)}
                      </p>
                    ) : null}

                    <MusicPreviewPlayer
                      key={currentSelectedItem._id}
                      item={currentSelectedItem}
                      previewUrl={audioPreviewUrls[currentSelectedItem._id] || ""}
                      loading={audioLoadingId === currentSelectedItem._id}
                      onEnsurePreview={ensureAudioPreview}
                    />
                  </div>
                ) : (
                  <div className="music-detail-content">
                    <div className="music-history-card-head">
                      <div>
                        {editingKind === TAB_LYRICS && editingId === currentSelectedItem._id ? (
                          <input
                            className="music-history-title-input"
                            value={titleDraft}
                            onChange={(event) => setTitleDraft(event.target.value)}
                            onBlur={() => void submitTitleRename(TAB_LYRICS, currentSelectedItem)}
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
                            disabled={renamingId === currentSelectedItem._id}
                            maxLength={80}
                          />
                        ) : (
                          <h3
                            className="music-history-title"
                            title={buildLyricsTaskTitle(currentSelectedItem)}
                            onClick={() => startEditingTitle(TAB_LYRICS, currentSelectedItem)}
                          >
                            {buildLyricsTaskTitle(currentSelectedItem)}
                          </h3>
                        )}
                        <p>{formatDateTime(currentSelectedItem.createdAt)}</p>
                      </div>
                      <div className="music-history-card-actions">
                        <button
                          type="button"
                          className="music-mini-button"
                          onClick={() => handleUseLyricsForMusic(currentSelectedItem)}
                        >
                          带入音乐工作台
                        </button>
                        <button
                          type="button"
                          className="music-mini-button danger music-icon-action"
                          onClick={() => void handleDelete(TAB_LYRICS, currentSelectedItem._id)}
                          disabled={deletingId === currentSelectedItem._id}
                        >
                          {deletingId === currentSelectedItem._id ? (
                            <Loader2 size={15} className="spin" />
                          ) : (
                            <Trash2 size={15} />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="music-history-meta">
                      <span>{currentSelectedItem.mode === "edit" ? "编辑 / 续写" : "完整创作"}</span>
                      {currentSelectedItem.songTitle ? (
                        <span>{currentSelectedItem.songTitle}</span>
                      ) : null}
                      {currentSelectedItem.styleTags ? (
                        <span>{currentSelectedItem.styleTags}</span>
                      ) : null}
                    </div>

                    <p className="music-history-prompt">
                      <strong>主题提示：</strong>
                      {currentSelectedItem.prompt || "—"}
                    </p>
                    {currentSelectedItem.mode === "edit" ? (
                      <p className="music-history-lyrics">
                        <strong>原歌词：</strong>
                        {currentSelectedItem.sourceLyrics || "—"}
                      </p>
                    ) : null}
                    <p className="music-history-lyrics">
                      <strong>生成歌词：</strong>
                      {currentSelectedItem.lyrics || "—"}
                    </p>
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

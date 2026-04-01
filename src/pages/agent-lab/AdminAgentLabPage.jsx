import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Bot,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  deleteAdminAgentLabAccessGrant,
  fetchAdminAgentLabAccessGrants,
  fetchAdminAgentLabOverview,
  fetchAdminAgentLabSettings,
  resetAdminAgentLabRoom,
  saveAdminAgentLabRoom,
  saveAdminAgentLabSettings,
} from "../admin/adminApi.js";
import { clearAdminToken, getAdminToken } from "../login/adminSession.js";
import { resolveActiveAuthSlot, withAuthSlot } from "../../app/authStorage.js";
import "../../styles/admin-settings.css";
import "../../styles/agent-lab-admin.css";

function readErrorMessage(error) {
  if (!error) return "请求失败，请稍后重试。";
  return typeof error?.message === "string" && error.message.trim()
    ? error.message.trim()
    : "请求失败，请稍后重试。";
}

function formatDisplayTime(input) {
  if (!input) return "--";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function createDraft(settings) {
  const source = settings && typeof settings === "object" ? settings : {};
  return {
    shadowModeratorEnabled: source.shadowModeratorEnabled !== false,
    proactiveSpeechEnabled: source.proactiveSpeechEnabled === true,
    proactivityLevel: String(source.proactivityLevel || "medium").trim() || "medium",
    modePreset: String(source.modePreset || "classroom_host").trim() || "classroom_host",
    silenceTriggerSeconds:
      Math.max(15, Math.round(Number(source.silenceTriggerMs || 180000) / 1000)) || 180,
    repeatWindowMessages: Number(source.repeatWindowMessages || 6) || 6,
    stageSummaryMessageCount: Number(source.stageSummaryMessageCount || 8) || 8,
    systemPersonaPrompt: String(source.systemPersonaPrompt || ""),
  };
}

function splitTextareaLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);
}

function createTaskDraft(room) {
  const taskConfig = room?.taskConfig && typeof room.taskConfig === "object" ? room.taskConfig : {};
  return {
    title: String(taskConfig.title || "Agent Lab 课程任务"),
    objective: String(taskConfig.objective || ""),
    requirementsText: Array.isArray(taskConfig.requirements) ? taskConfig.requirements.join("\n") : "",
    expectedOutputsText: Array.isArray(taskConfig.expectedOutputs)
      ? taskConfig.expectedOutputs.join("\n")
      : "",
  };
}

function modePresetLabel(value) {
  if (value === "learning_companion") return "学习陪伴";
  if (value === "community_manager") return "通用社群";
  return "课堂主持";
}

export default function AdminAgentLabPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeSlot = resolveActiveAuthSlot(location.search);
  const [adminToken, setAdminToken] = useState(() => getAdminToken());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [overview, setOverview] = useState(null);
  const [grants, setGrants] = useState([]);
  const [settings, setSettings] = useState(null);
  const [draft, setDraft] = useState(() => createDraft(null));
  const [taskDraft, setTaskDraft] = useState(() => createTaskDraft(null));

  const handleAuthError = useCallback(
    (rawError) => {
      const message = readErrorMessage(rawError);
      if (!message.includes("管理员")) return false;
      clearAdminToken();
      setAdminToken("");
      navigate(withAuthSlot("/login", activeSlot), { replace: true });
      return true;
    },
    [activeSlot, navigate],
  );

  const loadAll = useCallback(
    async ({ silent = false } = {}) => {
      if (!adminToken) {
        navigate(withAuthSlot("/login", activeSlot), { replace: true });
        return;
      }
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError("");
      try {
        const [overviewData, grantData, settingsData] = await Promise.all([
          fetchAdminAgentLabOverview(adminToken),
          fetchAdminAgentLabAccessGrants(adminToken),
          fetchAdminAgentLabSettings(adminToken),
        ]);
        const nextSettings =
          settingsData?.settings && typeof settingsData.settings === "object"
            ? settingsData.settings
            : overviewData?.settings;
        setOverview(overviewData && typeof overviewData === "object" ? overviewData : null);
        setGrants(Array.isArray(grantData?.grants) ? grantData.grants : []);
        setSettings(nextSettings || null);
        setDraft(createDraft(nextSettings));
        setTaskDraft(createTaskDraft(overviewData?.room || null));
      } catch (rawError) {
        if (handleAuthError(rawError)) return;
        setError(readErrorMessage(rawError));
      } finally {
        if (silent) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [activeSlot, adminToken, handleAuthError, navigate],
  );

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const counts = overview?.counts || {};
  const room = overview?.room || null;
  const roomUsers = Array.isArray(overview?.users) ? overview.users : [];

  const hasDraftChanges = useMemo(() => {
    return JSON.stringify(createDraft(settings)) !== JSON.stringify(draft);
  }, [draft, settings]);

  const hasTaskDraftChanges = useMemo(() => {
    return JSON.stringify(createTaskDraft(room)) !== JSON.stringify(taskDraft);
  }, [room, taskDraft]);

  async function handleSaveSettings() {
    if (!adminToken || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        shadowModeratorEnabled: draft.shadowModeratorEnabled,
        proactiveSpeechEnabled: draft.proactiveSpeechEnabled,
        proactivityLevel: draft.proactivityLevel,
        modePreset: draft.modePreset,
        silenceTriggerMs: Math.max(15, Number(draft.silenceTriggerSeconds) || 180) * 1000,
        repeatWindowMessages: Number(draft.repeatWindowMessages) || 6,
        stageSummaryMessageCount: Number(draft.stageSummaryMessageCount) || 8,
        systemPersonaPrompt: draft.systemPersonaPrompt,
      };
      const data = await saveAdminAgentLabSettings(adminToken, payload);
      const nextSettings =
        data?.settings && typeof data.settings === "object" ? data.settings : payload;
      setSettings(nextSettings);
      setDraft(createDraft(nextSettings));
      setNotice("Agent Lab 设置已保存。");
      void loadAll({ silent: true });
    } catch (rawError) {
      if (handleAuthError(rawError)) return;
      setError(readErrorMessage(rawError));
    } finally {
      setSaving(false);
    }
  }

  async function handleResetRoom() {
    if (!adminToken || resetting) return;
    if (!window.confirm("确定重置 Agent Lab 默认实验群吗？消息将被清空，但资格名单会保留。")) return;
    setResetting(true);
    setError("");
    setNotice("");
    try {
      await resetAdminAgentLabRoom(adminToken);
      setNotice("Agent Lab 房间已重置。");
      await loadAll({ silent: true });
    } catch (rawError) {
      if (handleAuthError(rawError)) return;
      setError(readErrorMessage(rawError));
    } finally {
      setResetting(false);
    }
  }

  async function handleSaveRoomTask() {
    if (!adminToken || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        taskConfig: {
          title: taskDraft.title,
          objective: taskDraft.objective,
          requirements: splitTextareaLines(taskDraft.requirementsText),
          expectedOutputs: splitTextareaLines(taskDraft.expectedOutputsText),
        },
      };
      const data = await saveAdminAgentLabRoom(adminToken, payload);
      const nextRoom = data?.room && typeof data.room === "object" ? data.room : room;
      setOverview((current) =>
        current && typeof current === "object"
          ? {
              ...current,
              room: nextRoom,
            }
          : current,
      );
      setTaskDraft(createTaskDraft(nextRoom));
      setNotice("Agent Lab 课程任务已保存。");
      void loadAll({ silent: true });
    } catch (rawError) {
      if (handleAuthError(rawError)) return;
      setError(readErrorMessage(rawError));
    } finally {
      setSaving(false);
    }
  }

  async function handleRevokeGrant(userId) {
    if (!adminToken || !userId) return;
    if (!window.confirm("确定撤销该用户的 Agent Lab 访问资格吗？")) return;
    setError("");
    setNotice("");
    try {
      await deleteAdminAgentLabAccessGrant(adminToken, userId);
      setNotice("已撤销 Agent Lab 访问资格。");
      await loadAll({ silent: true });
    } catch (rawError) {
      if (handleAuthError(rawError)) return;
      setError(readErrorMessage(rawError));
    }
  }

  return (
    <div className="agent-lab-admin-page">
      <div className="agent-lab-admin-shell">
        <header className="agent-lab-admin-topbar">
          <div className="agent-lab-admin-topbar-left">
            <button
              type="button"
              className="admin-icon-btn"
              onClick={() => navigate(withAuthSlot("/admin/settings", activeSlot))}
              aria-label="返回教师主页"
              title="返回教师主页"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1>Agent Lab 管理台</h1>
              <p>邀请制主动参与型 AI 测试群后台</p>
            </div>
          </div>

          <div className="agent-lab-admin-topbar-right">
            <button
              type="button"
              className="admin-ghost-btn"
              onClick={() => navigate(withAuthSlot("/admin/agent-settings", activeSlot))}
            >
              <span>智能体设置</span>
            </button>
            <button
              type="button"
              className="admin-ghost-btn"
              onClick={() => void loadAll({ silent: true })}
              disabled={refreshing}
            >
              <RefreshCw size={15} className={refreshing ? "is-spinning" : ""} />
              <span>{refreshing ? "刷新中..." : "刷新"}</span>
            </button>
          </div>
        </header>

        {error ? <p className="agent-lab-admin-banner is-error">{error}</p> : null}
        {notice ? <p className="agent-lab-admin-banner is-success">{notice}</p> : null}

        <main className="agent-lab-admin-content">
          <section className="agent-lab-admin-summary-grid">
            <article className="agent-lab-admin-summary-card">
              <div className="agent-lab-admin-summary-head">
                <Users size={16} />
                <span>资格名单</span>
              </div>
              <strong>{loading ? "--" : counts.accessGrantCount || 0}</strong>
              <small>已开通访问资格</small>
            </article>
            <article className="agent-lab-admin-summary-card">
              <div className="agent-lab-admin-summary-head">
                <ShieldCheck size={16} />
                <span>当前成员</span>
              </div>
              <strong>{loading ? "--" : counts.memberCount || 0}</strong>
              <small>默认实验群成员数</small>
            </article>
            <article className="agent-lab-admin-summary-card">
              <div className="agent-lab-admin-summary-head">
                <Sparkles size={16} />
                <span>消息总数</span>
              </div>
              <strong>{loading ? "--" : counts.messageCount || 0}</strong>
              <small>当前默认实验群消息</small>
            </article>
            <article className="agent-lab-admin-summary-card">
              <div className="agent-lab-admin-summary-head">
                <Bot size={16} />
                <span>在线人数</span>
              </div>
              <strong>{loading ? "--" : counts.onlineCount || 0}</strong>
              <small>基于 Agent Lab WebSocket</small>
            </article>
          </section>

          <section className="agent-lab-admin-grid">
            <section className="agent-lab-admin-card">
              <div className="agent-lab-admin-card-head">
                <div>
                  <h2>实验群概况</h2>
                  <p>{room?.name || "Agent Lab 默认房间"}</p>
                </div>
                <button
                  type="button"
                  className="admin-danger-btn"
                  onClick={handleResetRoom}
                  disabled={resetting}
                >
                  <Trash2 size={14} />
                  <span>{resetting ? "重置中..." : "重置实验群"}</span>
                </button>
              </div>
              <div className="agent-lab-admin-room-meta">
                <span>{`房间 Key：${room?.roomKey || "default"}`}</span>
                <span>{`最近 AI 发言：${formatDisplayTime(room?.lastAgentAt)}`}</span>
                <span>{`最近更新：${formatDisplayTime(room?.updatedAt)}`}</span>
                <span>{`当前模式：${modePresetLabel(settings?.modePreset)}`}</span>
              </div>
              <div className="agent-lab-admin-member-list">
                {roomUsers.length === 0 ? (
                  <p className="agent-lab-admin-empty">当前默认实验群暂无成员。</p>
                ) : (
                  roomUsers.map((user) => (
                    <div key={user.id} className="agent-lab-admin-member-item">
                      <strong>{user.name || user.username || "用户"}</strong>
                      <span>{user.username ? `@${user.username}` : "-"}</span>
                      <span>{user.profile?.className || "-"}</span>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="agent-lab-admin-card">
              <div className="agent-lab-admin-card-head">
                <div>
                  <h2>课程任务配置</h2>
                  <p>配置 Agent Lab 右侧任务卡，供影子主持与主动参与使用。</p>
                </div>
                <button
                  type="button"
                  className="admin-save-btn"
                  onClick={handleSaveRoomTask}
                  disabled={saving || !hasTaskDraftChanges}
                >
                  <Save size={15} />
                  <span>{saving ? "保存中..." : "保存任务"}</span>
                </button>
              </div>

              <div className="agent-lab-admin-form">
                <label className="is-textarea">
                  <span>任务标题</span>
                  <input
                    type="text"
                    value={taskDraft.title}
                    onChange={(event) =>
                      setTaskDraft((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    maxLength={80}
                    placeholder="例如：第 3 课时讨论任务"
                  />
                </label>

                <label className="is-textarea">
                  <span>任务目标</span>
                  <textarea
                    value={taskDraft.objective}
                    onChange={(event) =>
                      setTaskDraft((current) => ({
                        ...current,
                        objective: event.target.value,
                      }))
                    }
                    placeholder="描述本轮讨论想达成的学习目标。"
                    maxLength={1000}
                  />
                </label>

                <label className="is-textarea">
                  <span>讨论要求</span>
                  <textarea
                    value={taskDraft.requirementsText}
                    onChange={(event) =>
                      setTaskDraft((current) => ({
                        ...current,
                        requirementsText: event.target.value,
                      }))
                    }
                    placeholder={"每行一条，例如：\n先明确你的具体问题\n尽量给出理由或案例"}
                    maxLength={2200}
                  />
                </label>

                <label className="is-textarea">
                  <span>预期产出</span>
                  <textarea
                    value={taskDraft.expectedOutputsText}
                    onChange={(event) =>
                      setTaskDraft((current) => ({
                        ...current,
                        expectedOutputsText: event.target.value,
                      }))
                    }
                    placeholder={"每行一条，例如：\n形成阶段性共识\n整理待补充的信息"}
                    maxLength={2200}
                  />
                </label>
              </div>
            </section>

            <section className="agent-lab-admin-card">
              <div className="agent-lab-admin-card-head">
                <div>
                  <h2>AI 配置</h2>
                  <p>这些设置只作用于 Agent Lab，不影响现有派·协作。</p>
                </div>
                <button
                  type="button"
                  className="admin-save-btn"
                  onClick={handleSaveSettings}
                  disabled={saving || !hasDraftChanges}
                >
                  <Save size={15} />
                  <span>{saving ? "保存中..." : "保存设置"}</span>
                </button>
              </div>

              <div className="agent-lab-admin-form">
                <label className="agent-lab-admin-toggle">
                  <input
                    type="checkbox"
                    checked={draft.shadowModeratorEnabled}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        shadowModeratorEnabled: event.target.checked,
                      }))
                    }
                  />
                  <span>启用影子主持建议</span>
                </label>

                <label className="agent-lab-admin-toggle">
                  <input
                    type="checkbox"
                    checked={draft.proactiveSpeechEnabled}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        proactiveSpeechEnabled: event.target.checked,
                      }))
                    }
                  />
                  <span>允许 Agent Lab 主动在群内发言</span>
                </label>

                <label>
                  <span>模式预设</span>
                  <select
                    value={draft.modePreset}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        modePreset: event.target.value,
                      }))
                    }
                  >
                    <option value="classroom_host">课堂主持</option>
                    <option value="learning_companion">学习陪伴</option>
                    <option value="community_manager">通用社群</option>
                  </select>
                </label>

                <label>
                  <span>主动性等级</span>
                  <select
                    value={draft.proactivityLevel}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        proactivityLevel: event.target.value,
                      }))
                    }
                  >
                    <option value="low">低</option>
                    <option value="medium">中</option>
                    <option value="high">高</option>
                  </select>
                </label>

                <label>
                  <span>冷场触发阈值（秒）</span>
                  <input
                    type="number"
                    min={15}
                    max={86400}
                    value={draft.silenceTriggerSeconds}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        silenceTriggerSeconds: event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  <span>重复问题检测窗口（条）</span>
                  <input
                    type="number"
                    min={2}
                    max={20}
                    value={draft.repeatWindowMessages}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        repeatWindowMessages: event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  <span>阶段总结阈值（条）</span>
                  <input
                    type="number"
                    min={2}
                    max={50}
                    value={draft.stageSummaryMessageCount}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        stageSummaryMessageCount: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className="is-textarea">
                  <span>系统人设补充</span>
                  <textarea
                    value={draft.systemPersonaPrompt}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        systemPersonaPrompt: event.target.value,
                      }))
                    }
                    placeholder="例如：更偏温和鼓励；每次发言尽量先总结再追问。"
                    maxLength={4000}
                  />
                </label>
              </div>
            </section>
          </section>

          <section className="agent-lab-admin-card">
            <div className="agent-lab-admin-card-head">
              <div>
                <h2>资格管理</h2>
                <p>已开通邀请码资格的用户名单</p>
              </div>
              <span>{`${grants.length} 人`}</span>
            </div>
            <div className="agent-lab-admin-grant-list">
              {grants.length === 0 ? (
                <p className="agent-lab-admin-empty">当前还没有任何已开通资格的用户。</p>
              ) : (
                grants.map((grant) => (
                  <div key={grant.userId} className="agent-lab-admin-grant-item">
                    <div>
                      <strong>{grant.user?.name || grant.user?.username || "用户"}</strong>
                      <p>
                        {grant.user?.username ? `@${grant.user.username}` : "-"}
                        {grant.user?.profile?.className ? ` · ${grant.user.profile.className}` : ""}
                        {grant.user?.profile?.studentId ? ` · ${grant.user.profile.studentId}` : ""}
                      </p>
                      <small>{`开通时间：${formatDisplayTime(grant.claimedAt)}`}</small>
                    </div>
                    <button
                      type="button"
                      className="admin-danger-btn"
                      onClick={() => void handleRevokeGrant(grant.userId)}
                    >
                      <Trash2 size={14} />
                      <span>撤销资格</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

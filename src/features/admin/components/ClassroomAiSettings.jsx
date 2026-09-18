import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { fetchClassroomAiSettings, saveClassroomAiSettings } from "../services/classroomAiApi.js";

export default function ClassroomAiSettings({ adminToken, onAuthError, onDirtyChange }) {
  const [config, setConfig] = useState(null);
  const [savedConfig, setSavedConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const dirty = config !== null && JSON.stringify(config) !== JSON.stringify(savedConfig);

  useEffect(() => {
    let cancelled = false;
    fetchClassroomAiSettings(adminToken).then((data) => {
      if (cancelled) return;
      setConfig(data.groupChatAiConfig);
      setSavedConfig(data.groupChatAiConfig);
    }).catch((err) => {
      if (cancelled) return;
      if (!onAuthError(err)) setError(err.message);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [adminToken, onAuthError]);

  useEffect(() => {
    onDirtyChange(dirty);
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    if (dirty) window.addEventListener("beforeunload", warn);
    return () => { window.removeEventListener("beforeunload", warn); };
  }, [dirty, onDirtyChange]);

  function update(key, value) {
    setConfig((current) => ({ ...current, [key]: value }));
    setNotice("");
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const data = await saveClassroomAiSettings(adminToken, config);
      setConfig(data.groupChatAiConfig);
      setSavedConfig(data.groupChatAiConfig);
      setNotice("已保存，后续课堂 AI 回复将使用此配置。");
    } catch (err) {
      if (!onAuthError(err)) setError(err.message);
    } finally { setSaving(false); }
  }

  return (
    <form className="teacher-panel-stack teacher-classroom-ai" onSubmit={save}>
      <header className="teacher-panel-head">
        <div><h2>AI 教学配置</h2><p className="teacher-panel-save-time">琳琳 · 协作课堂学习同伴</p></div>
        <div className="teacher-panel-actions">
          <span className="teacher-ai-save-state" role="status">{dirty ? "有未保存的修改" : notice}</span>
          <button type="submit" className="teacher-primary-btn" disabled={loading || saving || !config || !dirty}>
            <Save size={14} />{saving ? "保存中…" : "保存配置"}
          </button>
        </div>
      </header>
      {error ? <p className="teacher-ai-error" role="alert">{error}</p> : null}
      {loading ? <p className="teacher-empty-text">正在读取课堂 AI 配置…</p> : config ? (
        <div className="teacher-ai-fields">
          <p className="teacher-ai-context">学生在协作课堂中通过 @AI 向琳琳提问。这里设置她的教学要求与回复方式，保存后对所有协作小教室生效。</p>
          <label className="teacher-ai-prompt-label" htmlFor="classroom-ai-prompt">教学提示词 <span>说明怎么引导学生、可以提供哪些帮助，以及哪些答案不能直接给出。</span></label>
          <textarea id="classroom-ai-prompt" value={config.systemPrompt} onChange={(e) => update("systemPrompt", e.target.value)} disabled={saving} maxLength={24000} rows={16} />
          <details className="teacher-ai-connection">
            <summary>模型设置 <span>{config.model} · 阿里云 DashScope</span></summary>
            <div className="teacher-ai-model-fields">
              <label htmlFor="classroom-ai-model">模型<input id="classroom-ai-model" required maxLength={180} value={config.model} onChange={(e) => update("model", e.target.value)} disabled={saving} /></label>
              <label htmlFor="classroom-ai-protocol">接口协议<select id="classroom-ai-protocol" value={config.protocol} onChange={(e) => update("protocol", e.target.value)} disabled={saving}>
                <option value="dashscope">DashScope 原生接口</option><option value="chat">Chat API</option><option value="responses">Responses API</option>
              </select></label>
            </div>
          </details>
        </div>
      ) : null}
    </form>
  );
}

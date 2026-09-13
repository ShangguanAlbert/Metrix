import { useState } from "react";
import { resetAdminStudentPassword } from "../../../pages/admin/adminApi.js";

export default function StudentPasswordResetDialog({ user, adminToken, onClose }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event) {
    event.preventDefault();
    if (saving || saved) return;
    if (password !== confirmation) {
      setError("两次输入的密码不一致。");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await resetAdminStudentPassword(adminToken, user.id, password);
      setPassword("");
      setConfirmation("");
      setSaved(true);
    } catch (requestError) {
      setError(requestError?.message || "重置密码失败，请稍后重试。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="teacher-time-overlay" role="presentation" onClick={() => { if (!saving) onClose(); }}>
      <div className="teacher-time-card" role="dialog" aria-modal="true" aria-labelledby="student-password-reset-title" onClick={(event) => event.stopPropagation()}>
        <h3 id="student-password-reset-title">重置学生密码</h3>
        <p>{`${user.profile?.name || "学生"} · 登录账号：${user.username}`}</p>
        {saved ? (
          <>
            <p role="status">密码已重置。请将新密码发给该学生，使用上述账号和新密码点击“学生登录”。</p>
            <div className="teacher-time-actions">
              <button type="button" className="teacher-primary-btn" onClick={onClose}>完成</button>
            </div>
          </>
        ) : (
          <form className="teacher-time-form" onSubmit={onSubmit}>
            <p className="teacher-time-form-hint">设置后立即生效，下次登录须使用新密码。请先妥善记录，再发给该学生。</p>
            <label>
              <span>新密码</span>
              <input type="password" autoComplete="new-password" minLength={6} maxLength={128} required value={password} disabled={saving} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <label>
              <span>确认新密码</span>
              <input type="password" autoComplete="new-password" minLength={6} maxLength={128} required value={confirmation} disabled={saving} onChange={(event) => setConfirmation(event.target.value)} />
            </label>
            {error ? <p className="teacher-confirm-error" role="alert">{error}</p> : null}
            <div className="teacher-time-actions">
              <button type="button" className="teacher-ghost-btn" disabled={saving} onClick={onClose}>取消</button>
              <button type="submit" className="teacher-primary-btn" disabled={saving}>{saving ? "重置中…" : "确认重置"}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

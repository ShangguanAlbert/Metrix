import { useCallback, useEffect, useRef, useState } from "react";
import { PARTY_EVENT_LABELS } from "../../../../shared/party-activity.js";

export default function TeacherActivityDialog({ adminToken, room, onClose }) {
  const [roomId, setRoomId] = useState(room?.id || "");
  const [rooms, setRooms] = useState([]);
  const [events, setEvents] = useState([]);
  const [cursor, setCursor] = useState("");
  const [eventType, setEventType] = useState("");
  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(null);
  const [code, setCode] = useState(null);
  const generation = useRef(0);
  const request = useCallback(async (path) => {
    const response = await fetch(path, { headers: { Authorization: `Bearer ${adminToken}` } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "读取记录失败。");
    return data;
  }, [adminToken]);
  useEffect(() => {
    let active = true;
    request("/api/auth/admin/collaboration-activity-rooms").then((data) => {
      if (active) { setRooms(data.rooms); if (!room?.id) setRoomId(data.rooms[0]?.id || ""); }
    }).catch((cause) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [request, room?.id]);
  const load = useCallback(async (after = "") => {
    if (!roomId) return;
    const current = ++generation.current;
    setBusy(true); setError("");
    const query = new URLSearchParams({ eventType, userId, cursor: after });
    try {
      if (from) query.set("from", new Date(from).toISOString());
      if (to) query.set("to", new Date(to).toISOString());
      const data = await request(`/api/auth/admin/collaboration-classrooms/${roomId}/activity?${query}`);
      if (current !== generation.current) return;
      setEvents((previous) => after ? [...previous, ...data.events] : data.events);
      setCursor(data.nextCursor); setRecording(data.recording);
    } catch (cause) { if (current === generation.current) setError(cause.message); }
    finally { if (current === generation.current) setBusy(false); }
  }, [eventType, from, request, roomId, to, userId]);
  useEffect(() => { setEvents([]); setCode(null); void load(); return () => { generation.current += 1; }; }, [load]);
  useEffect(() => {
    const escape = (event) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [onClose]);
  async function download(allRooms = false) {
    setBusy(true); setError("");
    try {
      const path = allRooms ? "/api/auth/admin/collaboration-activity/export"
        : `/api/auth/admin/collaboration-classrooms/${roomId}/activity/export`;
      const response = await fetch(path, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!response.ok) throw new Error("导出失败，请稍后重试。");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = `学习全过程-${allRooms ? "全部授权小组" : roomId}.zip`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  }
  const selected = rooms.find((item) => item.id === roomId);
  return <div className="teacher-memory-modal" role="presentation">
    <section className="teacher-memory-dialog teacher-activity-dialog" role="dialog" aria-modal="true" aria-label="完整学习过程">
      <header className="teacher-memory-dialog-head"><h2>学习过程记录</h2><button type="button" className="teacher-ghost-btn" onClick={onClose}>关闭</button></header>
      <div className="teacher-activity-filters">
        <select aria-label="选择小组" value={roomId} onChange={(event) => { setRoomId(event.target.value); setUserId(""); }}>
          {rooms.map((item) => <option key={item.id} value={item.id}>{item.name}{item.archived ? "（已归档）" : ""}</option>)}
        </select>
        <select aria-label="筛选学生" value={userId} onChange={(event) => setUserId(event.target.value)}>
          <option value="">全部成员</option>{(selected?.members || []).map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
        </select>
        <select aria-label="筛选事件" value={eventType} onChange={(event) => setEventType(event.target.value)}>
          <option value="">全部事件</option>{Object.entries(PARTY_EVENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <input type="datetime-local" aria-label="开始时间" value={from} onChange={(event) => setFrom(event.target.value)} />
        <input type="datetime-local" aria-label="结束时间" value={to} onChange={(event) => setTo(event.target.value)} />
        <button type="button" className="teacher-ghost-btn" disabled={busy} onClick={() => void load()}>刷新</button>
        <button type="button" className="teacher-ghost-btn" disabled={busy || !roomId} onClick={() => void download()}>打包导出该组 JSON</button>
        <button type="button" className="teacher-ghost-btn" disabled={busy || !rooms.length} onClick={() => void download(true)}>打包导出全部小组 JSON</button>
      </div>
      <p>按时间倒序展示，可继续加载早期记录。消息呈现、下载和后续操作属于行为证据，不直接代表阅读、理解或采纳。</p>
      {recording ? <p>后台待写入 {recording.pendingInMemory} 条 · 待同步 {recording.queuedFiles} 批{recording.lastError ? " · 记录正在重试，当前结果可能尚未齐全" : ""}</p> : null}
      {error ? <p className="teacher-memory-error" role="alert">{error}</p> : null}
      <div className="teacher-memory-content">
        {code ? <details open className="teacher-memory-code-snapshot"><summary>代码档案 · {code.kind === "update" ? "协作增量" : "完整快照"}</summary>
          <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{`${code.html}\n\n/* CSS */\n${code.css}`}</pre>
        </details> : null}
        <div className="teacher-memory-event-list">
        {events.map((event) => <article key={event._id}>
          <strong>{PARTY_EVENT_LABELS[event.eventType] || event.eventType}</strong>
          <span> · {event.userName} · {new Date(event.occurredAt).toLocaleString("zh-CN")} · {event.role}</span>
          <details><summary>查看记录依据</summary><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify({ source: event.source || "legacy", sessionId: event.sessionId, sequence: event.sequence, taskId: event.taskId, receivedAt: event.receivedAt, ...event.metadata }, null, 2)}</pre></details>
          {event.metadata?.archiveEventId ? <button type="button" className="teacher-ghost-btn" onClick={() => {
            const current = generation.current;
            request(`/api/auth/admin/collaboration-classrooms/${roomId}/activity/code/${encodeURIComponent(event.metadata.archiveEventId)}`)
              .then((data) => { if (current === generation.current) setCode(data.code); })
              .catch((cause) => { if (current === generation.current) setError(cause.message); });
          }}>查看代码档案</button> : null}
        </article>)}
        {!events.length && !busy ? <p>该筛选范围暂无记录。</p> : null}
        {cursor ? <button type="button" className="teacher-ghost-btn" disabled={busy} onClick={() => void load(cursor)}>继续加载更早记录</button> : null}
        {busy ? <p>正在读取…</p> : null}
      </div></div>
    </section>
  </div>;
}

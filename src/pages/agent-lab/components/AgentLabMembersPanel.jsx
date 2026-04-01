function computeHue(text) {
  const value = String(text || "");
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 360;
  }
  return Math.abs(hash);
}

function AgentLabMemberAvatar({ name = "" }) {
  const label = String(name || "成员").trim();
  const firstChar = label.slice(0, 1) || "成";
  const hue = computeHue(label);
  return (
    <span className="agent-lab-member-avatar" aria-hidden="true">
      <svg viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="18" fill={`hsl(${hue} 68% 46%)`} />
        <text
          x="18"
          y="22"
          textAnchor="middle"
          fontSize="16"
          fontWeight="700"
          fill="#ffffff"
          fontFamily="Segoe UI, PingFang SC, sans-serif"
        >
          {firstChar}
        </text>
      </svg>
    </span>
  );
}

function isAdminLikeRole(role) {
  const value = String(role || "").trim().toLowerCase();
  return value === "admin" || value === "teacher";
}

export default function AgentLabMembersPanel({
  room = null,
  usersById = {},
  meUserId = "",
} = {}) {
  const memberUserIds = Array.isArray(room?.memberUserIds) ? room.memberUserIds : [];
  const onlineIdSet = new Set(
    (Array.isArray(room?.onlineMemberUserIds) ? room.onlineMemberUserIds : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean),
  );
  const members = memberUserIds
    .map((userId) => {
      const id = String(userId || "").trim();
      const user = usersById && typeof usersById === "object" ? usersById[id] : null;
      return {
        id,
        name: user?.name || user?.username || "成员",
        role: user?.role || "user",
        isOnline: onlineIdSet.has(id),
        isSelf: id === String(meUserId || "").trim(),
        isOwnerLike: isAdminLikeRole(user?.role),
      };
    })
    .sort((a, b) => {
      if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      if (a.isOwnerLike !== b.isOwnerLike) return a.isOwnerLike ? -1 : 1;
      return String(a.name || "").localeCompare(String(b.name || ""), "zh-CN");
    });

  const onlineCount = Array.isArray(room?.onlineMemberUserIds) ? room.onlineMemberUserIds.length : 0;
  const totalCount = Array.isArray(room?.memberUserIds) ? room.memberUserIds.length : 0;

  return (
    <aside className="agent-lab-members-panel">
      <div className="agent-lab-members-head">
        <h3 className="agent-lab-members-title">成员</h3>
        <span className="agent-lab-member-count-badge">{`${onlineCount}/${totalCount || 0}`}</span>
      </div>

      <div className="agent-lab-members-list">
        {members.length === 0 ? (
          <p className="agent-lab-members-empty">暂无成员</p>
        ) : (
          members.map((member) => (
            <div
              key={member.id}
              className={`agent-lab-member-item${member.isSelf ? " is-self" : ""}`}
            >
              <AgentLabMemberAvatar name={member.name} />
              <span className="agent-lab-member-name">{member.name}</span>
              <span className={`agent-lab-member-status${member.isOnline ? " online" : ""}`}>
                {member.isOnline ? "在线" : "离线"}
              </span>
              {member.isOwnerLike ? <span className="agent-lab-member-owner">管理员</span> : null}
              {member.isSelf ? <span className="agent-lab-member-self">我</span> : null}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

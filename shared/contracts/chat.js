export const CHAT_SESSION_ID_MAX_LENGTH = 80;

export function sanitizeChatSessionId(value) {
  const text = String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[.$]/g, "");
  if (!text) return "";
  return text.slice(0, CHAT_SESSION_ID_MAX_LENGTH);
}

export function normalizeChatBootstrapResponse(payload = {}) {
  const state = payload?.state && typeof payload.state === "object" ? payload.state : {};
  const agentRuntimeConfigs =
    payload?.agentRuntimeConfigs && typeof payload.agentRuntimeConfigs === "object"
      ? payload.agentRuntimeConfigs
      : {};
  const agentProviderDefaults =
    payload?.agentProviderDefaults && typeof payload.agentProviderDefaults === "object"
      ? payload.agentProviderDefaults
      : {};

  return {
    ok: !!payload?.ok,
    user: payload?.user && typeof payload.user === "object" ? payload.user : null,
    teacherScopeKey: String(payload?.teacherScopeKey || ""),
    teacherScopeLabel: String(payload?.teacherScopeLabel || ""),
    profile: payload?.profile && typeof payload.profile === "object" ? payload.profile : {},
    profileComplete: !!payload?.profileComplete,
    state,
    agentRuntimeConfigs,
    agentProviderDefaults,
  };
}

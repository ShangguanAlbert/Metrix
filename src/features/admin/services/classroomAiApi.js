async function request(adminToken, config) {
  const response = await fetch("/api/auth/admin/classroom-ai-settings", {
    method: config ? "PUT" : "GET",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      ...(config ? { "Content-Type": "application/json" } : {}),
    },
    ...(config ? { body: JSON.stringify({ groupChatAiConfig: config }) } : {}),
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || "课堂 AI 配置请求失败。");
    error.status = response.status;
    throw error;
  }
  return data;
}
export const fetchClassroomAiSettings = (adminToken) => request(adminToken);
export const saveClassroomAiSettings = (adminToken, config) => request(adminToken, config);

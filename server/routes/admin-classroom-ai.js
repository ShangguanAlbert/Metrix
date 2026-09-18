import { sanitizeGroupChatAiConfig } from "../services/group-chat-ai-config.js";

export function registerAdminClassroomAiRoutes(app, {
  authenticateAdminRequest,
  readAdminAgentConfig,
  AdminConfig,
  ADMIN_CONFIG_KEY,
}) {
  app.get("/api/auth/admin/classroom-ai-settings", async (req, res) => {
    if (!(await authenticateAdminRequest(req, res))) return;
    const config = await readAdminAgentConfig();
    res.json({ groupChatAiConfig: sanitizeGroupChatAiConfig(config.groupChatAiConfig) });
  });
  app.put("/api/auth/admin/classroom-ai-settings", async (req, res) => {
    if (!(await authenticateAdminRequest(req, res))) return;
    const input = req.body?.groupChatAiConfig;
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      res.status(400).json({ error: "请提供课堂 AI 配置。" });
      return;
    }
    const groupChatAiConfig = sanitizeGroupChatAiConfig(input);
    // 课堂入口只写群聊 AI 配置，避免覆盖独立的单聊 Agent 设置。
    const doc = await AdminConfig.findOneAndUpdate(
      { key: ADMIN_CONFIG_KEY },
      { $set: { groupChatAiConfig } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    res.json({ groupChatAiConfig: sanitizeGroupChatAiConfig(doc.groupChatAiConfig) });
  });
}

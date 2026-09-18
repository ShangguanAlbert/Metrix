import assert from "node:assert/strict";
import test from "node:test";
import { registerAdminClassroomAiRoutes } from "../../server/routes/admin-classroom-ai.js";
import { readGroupChatAiConfig } from "../../server/services/group-chat-ai-config.js";

function fixture(authorized = true) {
  const routes = {};
  const stored = { key: "global", agentSystemPrompts: { A: "单聊提示词" }, agentRuntimeConfigs: { A: { model: "unchanged" } } };
  const Model = {
    findOne: () => ({ lean: async () => structuredClone(stored) }),
    findOneAndUpdate: (query, patch) => {
      assert.equal(query.key, "global");
      Object.assign(stored, patch.$set);
      return { lean: async () => structuredClone(stored) };
    },
  };
  registerAdminClassroomAiRoutes({
    get: (path, handler) => { routes.GET = handler; },
    put: (path, handler) => { routes.PUT = handler; },
  }, {
    authenticateAdminRequest: async (req, res) => {
      if (!authorized) res.status(401).json({ error: "unauthorized" });
      return authorized;
    },
    readAdminAgentConfig: async () => structuredClone(stored),
    AdminConfig: Model,
    ADMIN_CONFIG_KEY: "global",
  });
  const response = { code: 200, data: null, status(code) { this.code = code; return this; }, json(data) { this.data = data; } };
  return { routes, stored, Model, response };
}

test("课堂配置可保存供 worker 读取，且不覆盖单聊配置", async () => {
  const { routes, stored, Model, response } = fixture();
  const originalPrompts = structuredClone(stored.agentSystemPrompts);
  const originalRuntime = structuredClone(stored.agentRuntimeConfigs);
  const config = { provider: "aliyun", model: "qwen3.7-plus", protocol: "dashscope", systemPrompt: "先引导学生检查自己的代码。" };
  await routes.PUT({ body: { groupChatAiConfig: config } }, response);
  assert.deepEqual(await readGroupChatAiConfig(Model), config);
  assert.deepEqual(stored.agentSystemPrompts, originalPrompts);
  assert.deepEqual(stored.agentRuntimeConfigs, originalRuntime);
  await routes.GET({}, response);
  assert.deepEqual(response.data, { groupChatAiConfig: config });
});

test("未授权请求不能读取或写入课堂 AI 配置", async () => {
  const { routes, stored, response } = fixture(false);
  await routes.GET({}, response);
  assert.equal(response.code, 401);
  await routes.PUT({ body: { groupChatAiConfig: { systemPrompt: "changed" } } }, response);
  assert.equal(response.code, 401);
  assert.equal(stored.groupChatAiConfig, undefined);
});

test("缺少配置的保存请求被拒绝，不重置已有配置", async () => {
  const { routes, stored, response } = fixture();
  await routes.PUT({ body: {} }, response);
  assert.equal(response.code, 400);
  assert.equal(stored.groupChatAiConfig, undefined);
});

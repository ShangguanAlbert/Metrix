import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  defaultChatState,
  getModelByAgent,
  getProviderByAgent,
  sanitizeSingleAgentRuntimeConfig,
} from "../server/services/core-runtime.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function runCase(name, runner) {
  try {
    runner();
    console.log(`✅ ${name}`);
  } catch (error) {
    console.error(`❌ ${name}`);
    throw error;
  }
}

async function runAsyncCase(name, runner) {
  try {
    await runner();
    console.log(`✅ ${name}`);
  } catch (error) {
    console.error(`❌ ${name}`);
    throw error;
  }
}

runCase("默认聊天状态不再自动创建占位会话", () => {
  const state = defaultChatState();
  assert.equal(state.activeId, "");
  assert.deepEqual(state.sessions, []);
  assert.deepEqual(state.sessionMessages, {});
});

runCase("固定公开 Agent 的 provider / model 映射正确", () => {
  assert.equal(getProviderByAgent("A"), "packycode");
  assert.equal(getModelByAgent("A"), "gpt-5.4");

  assert.equal(getProviderByAgent("B"), "minimax");
  assert.equal(getModelByAgent("B"), "MiniMax-M2.7");

  assert.equal(getProviderByAgent("C"), "volcengine");
  assert.equal(getModelByAgent("C"), "doubao-seed-2-0-pro-260215");

  assert.equal(getProviderByAgent("D"), "aliyun");
  assert.equal(getModelByAgent("D"), "qwen3.5-plus");
});

runCase("Agent B 的运行时配置会被强制收敛到 MiniMax 固定值", () => {
  const config = sanitizeSingleAgentRuntimeConfig(
    {
      provider: "openrouter",
      model: "glm-4-7-251222",
      protocol: "responses",
      temperature: 0.2,
      topP: 0.6,
    },
    "B",
  );

  assert.equal(config.provider, "minimax");
  assert.equal(config.model, "MiniMax-M2.7");
  assert.equal(config.protocol, "chat");
  assert.equal(getProviderByAgent("B", config), "minimax");
  assert.equal(getModelByAgent("B", config), "MiniMax-M2.7");
});

await runAsyncCase("聊天前端已切换为先选 Agent 再建会话", async () => {
  const chatPageSource = await readFile(
    path.join(repoRoot, "src/pages/chat/desktop/ChatDesktopPage.jsx"),
    "utf8",
  );
  const modalSource = await readFile(
    path.join(repoRoot, "src/features/chat/components/AgentSelectionModal.jsx"),
    "utf8",
  );

  assert.match(chatPageSource, /AgentSelectionModal/);
  assert.match(modalSource, /Which agent do you want to use\?/);
  assert.match(chatPageSource, /createSessionWithAgent/);
  assert.doesNotMatch(chatPageSource, /LOCKED_AGENT_BY_TEACHER_SCOPE/);
  assert.doesNotMatch(chatPageSource, /resolveLockedAgentByTeacherScope/);
});

await runAsyncCase("聊天顶部 Agent 展示已改为只读，侧边栏含音乐入口", async () => {
  const chatPageSource = await readFile(
    path.join(repoRoot, "src/pages/chat/desktop/ChatDesktopPage.jsx"),
    "utf8",
  );
  const sidebarSource = await readFile(
    path.join(repoRoot, "src/components/Sidebar.jsx"),
    "utf8",
  );

  assert.match(chatPageSource, /<AgentSelect[\s\S]*readOnly/);
  assert.match(sidebarSource, /Music Generation/);
  assert.match(sidebarSource, /sidebar-music-entry/);
});

console.log("\n全部通过：会话级 Agent 锁定与前端入口未发现回归。");

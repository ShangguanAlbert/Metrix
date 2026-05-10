import process from "node:process";
import { createAppContext } from "../app/createAppContext.js";
import { createGroupChatAiWorker } from "../services/group-chat-ai-worker.js";
import {
  createGroupChatAiRedisConnection,
  resolveGroupChatAiRedisPrefix,
  resolveGroupChatAiRedisUrl,
} from "../runtime/group-chat-ai-redis.js";

async function main() {
  const redisUrl = resolveGroupChatAiRedisUrl(process.env);
  if (!redisUrl) {
    throw new Error("缺少 GROUP_CHAT_AI_REDIS_URL 或 REDIS_URL，无法启动群聊 AI worker。");
  }

  const deps = createAppContext();
  await deps.mongoose.connect(deps.mongoUri, { serverSelectionTimeoutMS: 6000 });

  const redis = createGroupChatAiRedisConnection({ env: process.env });
  const worker = createGroupChatAiWorker({
    redis,
    redisPrefix: resolveGroupChatAiRedisPrefix(process.env),
    logger: console,
  });

  const shutdown = async () => {
    await worker.stop();
    try {
      await redis?.quit();
    } catch {
      // ignore
    }
    try {
      await deps.mongoose.disconnect();
    } catch {
      // ignore
    }
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.log("Group chat AI worker started.");
  await worker.runForever();
}

main().catch((error) => {
  console.error("Failed to start group chat AI worker:", error);
  process.exit(1);
});

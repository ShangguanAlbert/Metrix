import {
  createGroupChatAiRedisConnection,
  isGroupChatAiRedisEnabled,
  resolveGroupChatAiRedisPrefix,
} from "./group-chat-ai-redis.js";

let groupChatAiRedis = null;

export function getGroupChatAiRedisClient(env = process.env) {
  if (!isGroupChatAiRedisEnabled(env)) return null;
  if (!groupChatAiRedis) {
    groupChatAiRedis = createGroupChatAiRedisConnection({
      env,
      logger: console,
      connectionName: "group-chat-ai-runtime",
    });
  }
  return groupChatAiRedis;
}

export function getGroupChatAiRedisPrefix(env = process.env) {
  return resolveGroupChatAiRedisPrefix(env);
}

import {
  buildGroupChatAiRedisKeys,
  createGroupChatAiRedisConnection,
  isGroupChatAiRedisEnabled,
  resolveGroupChatAiRedisPrefix,
} from "./group-chat-ai-redis.js";

export function subscribeGroupChatAiEvents({
  env = process.env,
  onMessageUpdated,
  logger = console,
} = {}) {
  if (!isGroupChatAiRedisEnabled(env)) {
    return async () => {};
  }

  const subscriber = createGroupChatAiRedisConnection({ env });
  const prefix = resolveGroupChatAiRedisPrefix(env);
  const channel = buildGroupChatAiRedisKeys({ prefix }).events;

  subscriber.on("message", (_channel, payloadText) => {
    try {
      const payload = JSON.parse(String(payloadText || "{}"));
      if (String(payload?.type || "").trim().toLowerCase() === "message_updated") {
        onMessageUpdated?.(payload);
      }
    } catch (error) {
      logger.warn?.("[group-chat-ai-events] failed to parse event payload:", error);
    }
  });

  void subscriber.subscribe(channel).catch((error) => {
    logger.warn?.("[group-chat-ai-events] subscribe failed:", error);
  });

  return async () => {
    try {
      await subscriber.unsubscribe(channel);
    } catch {
      // ignore
    }
    try {
      await subscriber.quit();
    } catch {
      // ignore
    }
  };
}

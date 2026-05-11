import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import { attachGroupChatAiRedisLifecycleLogging } from "../../server/runtime/group-chat-ai-redis.js";

test("attachGroupChatAiRedisLifecycleLogging throttles repeated redis connection errors and resets after ready", () => {
  const redis = new EventEmitter();
  const warnings = [];
  const infos = [];
  const logger = {
    warn: (...args) => warnings.push(args),
    info: (...args) => infos.push(args),
  };

  attachGroupChatAiRedisLifecycleLogging(redis, {
    logger,
    connectionName: "group-chat-ai-events",
    redisUrl: "redis://127.0.0.1:6380",
  });

  const error = new Error("connect ECONNREFUSED 127.0.0.1:6380");
  redis.emit("error", error);
  redis.emit("error", error);

  assert.equal(warnings.length, 1);
  assert.match(String(warnings[0][0]), /group-chat-ai-events/);
  assert.match(String(warnings[0][0]), /redis:\/\/127\.0\.0\.1:6380/);
  assert.equal(warnings[0][1], error);

  redis.emit("ready");
  assert.equal(infos.length, 1);
  assert.match(String(infos[0][0]), /group-chat-ai-events/);

  redis.emit("error", error);
  assert.equal(warnings.length, 2);
});

test("attachGroupChatAiRedisLifecycleLogging only binds one error handler per redis client", () => {
  const redis = new EventEmitter();
  const warnings = [];
  const logger = {
    warn: (...args) => warnings.push(args),
    info: () => {},
  };

  attachGroupChatAiRedisLifecycleLogging(redis, {
    logger,
    connectionName: "group-chat-ai-worker",
  });
  attachGroupChatAiRedisLifecycleLogging(redis, {
    logger,
    connectionName: "group-chat-ai-worker",
  });

  redis.emit("error", new Error("connect ECONNREFUSED 127.0.0.1:6380"));
  assert.equal(warnings.length, 1);
});

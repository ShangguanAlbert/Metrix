import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { createAuthRateLimiter } from "../../server/modules/auth/rate-limit.js";

function createResponse() {
  return Object.assign(new EventEmitter(), {
    headers: {},
    statusCode: 200,
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  });
}

test("auth limiter rejects attempts beyond the configured address quota", () => {
  const limiter = createAuthRateLimiter({
    windowMs: 60_000,
    maxAttempts: 2,
    errorMessage: "请求过多",
  });
  const req = { ip: "127.0.0.1" };

  let allowedCount = 0;
  limiter(req, createResponse(), () => {
    allowedCount += 1;
  });
  limiter(req, createResponse(), () => {
    allowedCount += 1;
  });
  const blockedResponse = createResponse();
  limiter(req, blockedResponse, () => {
    allowedCount += 1;
  });

  assert.equal(allowedCount, 2);
  assert.equal(blockedResponse.statusCode, 429);
  assert.equal(blockedResponse.body?.error, "请求过多");
  assert.ok(Number(blockedResponse.headers["Retry-After"]) > 0);
});

test("auth limiter counts different addresses independently", () => {
  const limiter = createAuthRateLimiter({
    windowMs: 60_000,
    maxAttempts: 1,
  });
  let allowedCount = 0;

  limiter({ ip: "10.0.0.1" }, createResponse(), () => {
    allowedCount += 1;
  });
  limiter({ ip: "10.0.0.2" }, createResponse(), () => {
    allowedCount += 1;
  });

  assert.equal(allowedCount, 2);
});

test("login limiter isolates accounts and clears failures after successful authentication", () => {
  const limiter = createAuthRateLimiter({
    windowMs: 60_000,
    maxAttempts: 2,
    keyGenerator: (req) => `${req.ip}:${req.body.username}`,
    resetOnSuccess: true,
  });
  const attempt = (username, statusCode = 401) => {
    const res = createResponse();
    limiter({ ip: "127.0.0.1", body: { username } }, res, () => {
      res.statusCode = statusCode;
      res.emit("finish");
    });
    return res.statusCode;
  };
  assert.equal(attempt("student-a"), 401);
  assert.equal(attempt("student-a"), 401);
  assert.equal(attempt("student-a", 200), 429);
  assert.equal(attempt("student-b"), 401);
  assert.equal(attempt("student-b", 200), 200);
  for (let index = 0; index < 30; index += 1) {
    assert.equal(attempt("student-b", 200), 200);
  }
  assert.equal(attempt("student-b"), 401);
});

test("limiter reports remaining seconds and permits retry after the window expires", (t) => {
  let now = 1_000_000;
  t.mock.method(Date, "now", () => now);
  const limiter = createAuthRateLimiter({
    windowMs: 600_000,
    maxAttempts: 1,
    errorMessage: (seconds) => `请 ${seconds} 秒后再试。`,
  });
  const req = { ip: "127.0.0.1" };
  limiter(req, createResponse(), () => {});
  now += 591_000;
  const blocked = createResponse();
  limiter(req, blocked, () => assert.fail("request should be blocked"));
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.headers["Retry-After"], "9");
  assert.equal(blocked.body.error, "请 9 秒后再试。");
  now += 9_000;
  let allowed = false;
  limiter(req, createResponse(), () => { allowed = true; });
  assert.equal(allowed, true);
});

test("pending authentication requests cannot bypass the limit", () => {
  const limiter = createAuthRateLimiter({
    windowMs: 60_000,
    maxAttempts: 2,
    resetOnSuccess: true,
  });
  const req = { ip: "127.0.0.1" };
  const first = createResponse();
  limiter(req, first, () => {});
  limiter(req, createResponse(), () => {});
  const blocked = createResponse();
  limiter(req, blocked, () => assert.fail("pending attempts must be counted"));
  assert.equal(blocked.statusCode, 429);
  first.emit("finish");
  let allowed = false;
  limiter(req, createResponse(), () => { allowed = true; });
  assert.equal(allowed, true);
});

test("a late success from an expired window does not clear newer failures", (t) => {
  let now = 1_000_000;
  t.mock.method(Date, "now", () => now);
  const limiter = createAuthRateLimiter({
    windowMs: 1000,
    maxAttempts: 1,
    resetOnSuccess: true,
  });
  const req = { ip: "127.0.0.1" };
  const oldResponse = createResponse();
  limiter(req, oldResponse, () => {});
  now += 1000;
  const newResponse = createResponse();
  limiter(req, newResponse, () => {});
  newResponse.statusCode = 401;
  newResponse.emit("finish");
  oldResponse.emit("finish");
  const blocked = createResponse();
  limiter(req, blocked, () => assert.fail("new failures must remain counted"));
  assert.equal(blocked.statusCode, 429);
});

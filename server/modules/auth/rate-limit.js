function readRequestAddress(req) {
  return String(req?.ip || req?.socket?.remoteAddress || "unknown").trim();
}

export function createAuthRateLimiter({
  windowMs,
  maxAttempts,
  errorMessage,
  maxTrackedAddresses = 5000,
  keyGenerator = readRequestAddress,
  resetOnSuccess = false,
}) {
  const safeWindowMs = Math.max(1000, Number(windowMs) || 1000);
  const safeMaxAttempts = Math.max(1, Number(maxAttempts) || 1);
  const attemptsByKey = new Map();

  return function authRateLimiter(req, res, next) {
    const now = Date.now();
    const key = keyGenerator(req);
    const current = attemptsByKey.get(key);
    const active = current && current.expiresAt > now ? current : null;
    const expiresAt = active?.expiresAt || now + safeWindowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((expiresAt - now) / 1000));

    res.setHeader("RateLimit-Reset", String(retryAfterSeconds));
    if (Number(active?.count || 0) >= safeMaxAttempts) {
      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.status(429).json({
        error: typeof errorMessage === "function"
          ? errorMessage(retryAfterSeconds)
          : String(errorMessage || "尝试次数过多，请稍后再试。"),
      });
      return;
    }

    // Reserve an attempt before authentication so concurrent requests share the limit.
    const entry = active || { count: 0, expiresAt };
    entry.count += 1;
    attemptsByKey.set(key, entry);

    if (attemptsByKey.size > maxTrackedAddresses) {
      for (const [trackedKey, trackedEntry] of attemptsByKey) {
        if (trackedEntry.expiresAt <= now || attemptsByKey.size > maxTrackedAddresses) {
          attemptsByKey.delete(trackedKey);
        }
        if (attemptsByKey.size <= maxTrackedAddresses) break;
      }
    }

    if (resetOnSuccess) {
      res.once("finish", () => {
        if (res.statusCode >= 200 && res.statusCode < 300 && attemptsByKey.get(key) === entry) {
          attemptsByKey.delete(key);
        }
      });
    }
    next();
  };
}

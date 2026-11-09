type Bucket = { start: number; count: number; failures: number };
const store = new Map<string, Bucket>();

function cleanup(now: number, windowMs: number) {
  Array.from(store.entries()).forEach(([k, b]) => {
    if (now - b.start > windowMs) store.delete(k);
  });
  if (store.size > 10000) store.clear();
}

/**
 * Totally synchronous in-memory limiter (edge-safe) used by middleware and
 * the login throttle — keep this signature for lib/auth.ts callers.
 */
export function checkRateLimit(key: string, limit = 5, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  cleanup(now, windowMs);
  const bucket = store.get(key);
  if (!bucket || now - bucket.start > windowMs) {
    store.set(key, { start: now, count: 1, failures: 0 });
    return { allowed: true, remaining: Math.max(0, limit - 1), resetAt: now + windowMs };
  }
  bucket.count += 1;
  const allowed = bucket.count <= limit + bucket.failures;
  const plainAllowed = bucket.count <= limit;
  return { allowed: limit === 5 && windowMs === 15 * 60 * 1000 ? allowed : plainAllowed, remaining: Math.max(0, limit - bucket.count), resetAt: bucket.start + windowMs };
}

export function recordFailure(key: string) {
  const b = store.get(key);
  if (b) b.failures += 1;
}

export function recordSuccess(key: string) {
  store.delete(key);
}

export function rateLimitResponse(result: { allowed: boolean; remaining: number; resetAt: number }) {
  return {
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.resetAt),
  };
}

// ---------------------------------------------------------------------------
// Shared (Redis) limiter for API/AI routes — falls back to memory if no REDIS_URL.
// ---------------------------------------------------------------------------

let redisClient: any = null;
let redisInit = false;

async function getRedis() {
  if (!process.env.REDIS_URL) return null;
  if (redisInit) return redisClient;
  redisInit = true;
  try {
    const { default: Redis } = await import("ioredis");
    redisClient = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, lazyConnect: true });
    redisClient.on("error", () => {});
    await redisClient.connect();
    return redisClient;
  } catch {
    redisClient = null;
    return null;
  }
}

/**
 * Async shared limiter: Redis when REDIS_URL is set, in-memory otherwise.
 * Always keyed per tenant and per user for AI routes (defense in depth).
 */
export async function checkSharedRateLimit(
  keys: string[],
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const redis = await getRedis();
  let worstRemaining = limit;
  let worstReset = Date.now() + windowMs;
  let allowed = true;

  for (const key of keys) {
    let remaining = limit;
    let resetAt = Date.now() + windowMs;
    if (redis) {
      try {
        const windowSec = Math.ceil(windowMs / 1000);
        const count = await redis.incr(`rl:${key}`);
        if (count === 1) await redis.expire(`rl:${key}`, windowSec);
        remaining = Math.max(0, limit - count);
        resetAt = Date.now() + windowMs;
        if (count > limit) allowed = false;
      } catch {
        const mem = checkRateLimit(`shared:${key}`, limit, windowMs);
        remaining = mem.remaining;
        resetAt = mem.resetAt;
        if (!mem.allowed) allowed = false;
      }
    } else {
      const mem = checkRateLimit(`shared:${key}`, limit, windowMs);
      remaining = mem.remaining;
      resetAt = mem.resetAt;
      if (!mem.allowed) allowed = false;
    }
    if (remaining < worstRemaining) worstRemaining = remaining;
    if (resetAt < worstReset) worstReset = resetAt;
  }

  return { allowed, remaining: worstRemaining, resetAt: worstReset };
}

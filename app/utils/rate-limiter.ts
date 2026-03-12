// rate-limiter.ts — Redis-backed rate limiter with in-memory fallback
// Per-shop limits per route. Returns 429 with Retry-After.
// Redis = primary (shared across instances), Map = fallback if Redis unavailable.

import { getRedis } from "./redis.js";
import { logger } from "./logger.js";

// ── Types ──
interface RateBucket {
  windowStart: number;
  count: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds?: number;
}

type RateLimitChecker = (shop: string) => Promise<RateLimitResult>;

export interface RateLimitPresets {
  state: RateLimitChecker;
  scan: RateLimitChecker;
  campaign: RateLimitChecker;
  subscription: RateLimitChecker;
  aiEngine: RateLimitChecker;
  aiImprove: RateLimitChecker;
  keywords: RateLimitChecker;
  marketIntel: RateLimitChecker;
  storeAnalytics: RateLimitChecker;
  campaignManage: RateLimitChecker;
  campaignStatus: RateLimitChecker;
  sync: RateLimitChecker;
}

// ── In-memory fallback (used when Redis is unavailable) ──
const buckets: Map<string, RateBucket> = new Map();

// Auto-cleanup: remove expired entries every 5 minutes
setInterval((): void => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > bucket.windowMs * 2) {
      buckets.delete(key);
    }
  }
}, 5 * 60 * 1000);

function checkRateLimitMemory(
  shop: string,
  route: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  const key = `${shop}:${route}`;
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart > windowMs) {
    bucket = { windowStart: now, count: 0, windowMs };
    buckets.set(key, bucket);
  }
  bucket.count++;
  if (bucket.count > maxRequests) {
    const retryAfterSeconds = Math.ceil((bucket.windowStart + windowMs - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, retryAfterSeconds) };
  }
  return { allowed: true, remaining: maxRequests - bucket.count };
}

/**
 * Check rate limit using Redis (primary) with in-memory fallback.
 * Uses Redis INCR + EXPIRE for atomic counter per window.
 */
export async function checkRateLimit(
  shop: string,
  route: string,
  maxRequests: number = 60,
  windowMs: number = 60000
): Promise<RateLimitResult> {
  const redis = getRedis();
  if (!redis) {
    return checkRateLimitMemory(shop, route, maxRequests, windowMs);
  }

  const windowSeconds = Math.ceil(windowMs / 1000);
  const windowId = Math.floor(Date.now() / windowMs);
  const key = `rl:${shop}:${route}:${windowId}`;

  try {
    const count = await redis.incr(key);
    // Set expiry on first request in this window
    if (count === 1) {
      await redis.expire(key, windowSeconds + 1);
    }

    if (count > maxRequests) {
      const elapsed = Date.now() % windowMs;
      const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - elapsed) / 1000));
      return { allowed: false, remaining: 0, retryAfterSeconds };
    }

    return { allowed: true, remaining: maxRequests - count };
  } catch (err) {
    logger.warn("[RateLimit]", `Redis error, falling back to memory: ${(err as Error).message}`);
    return checkRateLimitMemory(shop, route, maxRequests, windowMs);
  }
}

/**
 * Create a 429 Too Many Requests response.
 */
export function rateLimitResponse(retryAfterSeconds: number): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: "Too many requests. Please slow down.",
      retryAfter: retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSeconds),
      },
    }
  );
}

// ── Route-specific presets ──
export const rateLimit: RateLimitPresets = {
  state:          (shop: string): Promise<RateLimitResult> => checkRateLimit(shop, "state", 60, 60000),
  scan:           (shop: string): Promise<RateLimitResult> => checkRateLimit(shop, "scan", 10, 60000),
  campaign:       (shop: string): Promise<RateLimitResult> => checkRateLimit(shop, "campaign", 20, 60000),
  subscription:   (shop: string): Promise<RateLimitResult> => checkRateLimit(shop, "subscription", 20, 60000),
  aiEngine:       (shop: string): Promise<RateLimitResult> => checkRateLimit(shop, "ai-engine", 20, 60000),
  aiImprove:      (shop: string): Promise<RateLimitResult> => checkRateLimit(shop, "ai-improve", 20, 60000),
  keywords:       (shop: string): Promise<RateLimitResult> => checkRateLimit(shop, "keywords", 20, 60000),
  marketIntel:    (shop: string): Promise<RateLimitResult> => checkRateLimit(shop, "market-intel", 15, 60000),
  storeAnalytics: (shop: string): Promise<RateLimitResult> => checkRateLimit(shop, "store-analytics", 15, 60000),
  campaignManage: (shop: string): Promise<RateLimitResult> => checkRateLimit(shop, "campaign-manage", 30, 60000),
  campaignStatus: (shop: string): Promise<RateLimitResult> => checkRateLimit(shop, "campaign-status", 60, 60000),
  sync:           (shop: string): Promise<RateLimitResult> => checkRateLimit(shop, "sync", 10, 60000),
};

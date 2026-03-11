// rate-limiter.ts — In-memory rate limiter (Map-based, auto-cleanup)
// Per-shop limits per route. Returns 429 with Retry-After.
// Future: replace Map with Redis for multi-instance deployments.

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

type RateLimitChecker = (shop: string) => RateLimitResult;

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

// ── Redis integration (Phase 3 activation) ──
// When USE_REDIS=true, rate limiting will use Redis instead of in-memory Map.
// This enables multi-instance deployments with shared rate limit state.
// For now, falls back to in-memory if Redis is not available.
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

/**
 * Check rate limit for a shop+route combination.
 */
export function checkRateLimit(
  shop: string,
  route: string,
  maxRequests: number = 60,
  windowMs: number = 60000
): RateLimitResult {
  const key = `${shop}:${route}`;
  const now = Date.now();

  let bucket = buckets.get(key);

  // Create new bucket or reset if window expired
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
  state:          (shop: string): RateLimitResult => checkRateLimit(shop, "state", 60, 60000),
  scan:           (shop: string): RateLimitResult => checkRateLimit(shop, "scan", 10, 60000),
  campaign:       (shop: string): RateLimitResult => checkRateLimit(shop, "campaign", 20, 60000),
  subscription:   (shop: string): RateLimitResult => checkRateLimit(shop, "subscription", 20, 60000),
  aiEngine:       (shop: string): RateLimitResult => checkRateLimit(shop, "ai-engine", 20, 60000),
  aiImprove:      (shop: string): RateLimitResult => checkRateLimit(shop, "ai-improve", 20, 60000),
  keywords:       (shop: string): RateLimitResult => checkRateLimit(shop, "keywords", 20, 60000),
  marketIntel:    (shop: string): RateLimitResult => checkRateLimit(shop, "market-intel", 15, 60000),
  storeAnalytics: (shop: string): RateLimitResult => checkRateLimit(shop, "store-analytics", 15, 60000),
  campaignManage: (shop: string): RateLimitResult => checkRateLimit(shop, "campaign-manage", 30, 60000),
  campaignStatus: (shop: string): RateLimitResult => checkRateLimit(shop, "campaign-status", 60, 60000),
  sync:           (shop: string): RateLimitResult => checkRateLimit(shop, "sync", 10, 60000),
};

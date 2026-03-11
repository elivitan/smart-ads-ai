// app/utils/rate-limiter.js
// ════════════════════════════════════════════
// In-memory rate limiter (Map-based, auto-cleanup)
// Per-shop limits per route. Returns 429 with Retry-After.
// Future: replace Map with Redis for multi-instance deployments.
// ════════════════════════════════════════════

const buckets = new Map();

// Auto-cleanup: remove expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > bucket.windowMs * 2) {
      buckets.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Check rate limit for a shop+route combination.
 *
 * @param {string} shop - The shop identifier (e.g. "mystore.myshopify.com")
 * @param {string} route - The route name (e.g. "state", "scan", "campaign")
 * @param {number} maxRequests - Max requests per window (default 60)
 * @param {number} windowMs - Window size in milliseconds (default 60000 = 1 minute)
 * @returns {{ allowed: boolean, remaining: number, retryAfterSeconds?: number }}
 */
export function checkRateLimit(shop, route, maxRequests = 60, windowMs = 60000) {
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
 *
 * @param {number} retryAfterSeconds
 * @returns {Response}
 */
export function rateLimitResponse(retryAfterSeconds) {
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
// Usage: const limit = rateLimit.state(shop);
//        if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

export const rateLimit = {
  state:        (shop) => checkRateLimit(shop, "state", 60, 60000),        // 60/min
  scan:         (shop) => checkRateLimit(shop, "scan", 10, 60000),         // 10/min
  campaign:     (shop) => checkRateLimit(shop, "campaign", 20, 60000),     // 20/min
  subscription: (shop) => checkRateLimit(shop, "subscription", 20, 60000), // 20/min
  aiEngine:     (shop) => checkRateLimit(shop, "ai-engine", 20, 60000),    // 20/min
  aiImprove:    (shop) => checkRateLimit(shop, "ai-improve", 20, 60000),   // 20/min
  keywords:     (shop) => checkRateLimit(shop, "keywords", 20, 60000),     // 20/min
  marketIntel:  (shop) => checkRateLimit(shop, "market-intel", 15, 60000), // 15/min
  storeAnalytics: (shop) => checkRateLimit(shop, "store-analytics", 15, 60000), // 15/min
  campaignManage: (shop) => checkRateLimit(shop, "campaign-manage", 30, 60000), // 30/min
  campaignStatus: (shop) => checkRateLimit(shop, "campaign-status", 60, 60000), // 60/min (polling)
  sync:         (shop) => checkRateLimit(shop, "sync", 10, 60000),         // 10/min
};

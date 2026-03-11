// redis.js — Redis connection for caching & rate limiting at scale
// Phase 4: Replace in-memory rate limiter with Redis-based
// Install: npm install ioredis
//
// USAGE:
//   import { getRedis, cache } from "../utils/redis.js";
//   const cached = await cache.get("scan:shop123:product456");
//   if (!cached) { const data = await doExpensiveScan(); await cache.set("scan:...", data, 3600); }

import { logger } from "./logger.js";

// Lazy Redis connection — only connects when first used
let redisClient = null;

export function getRedis() {
  if (redisClient) return redisClient;
  try {
    const Redis = require("ioredis");
    redisClient = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 200, 5000),
      lazyConnect: true,
      enableReadyCheck: true,
    });
    redisClient.on("error", (err) => logger.error("[Redis] Connection error:", err.message));
    redisClient.on("connect", () => logger.info("[Redis] Connected"));
    return redisClient;
  } catch (e) {
    logger.warn("[Redis] ioredis not installed — falling back to in-memory. Run: npm install ioredis");
    return null;
  }
}

// Cache helper with automatic JSON serialization
export const cache = {
  async get(key) {
    const redis = getRedis();
    if (!redis) return null;
    try {
      const val = await redis.get(key);
      return val ? JSON.parse(val) : null;
    } catch (e) { logger.warn("[Cache] get failed:", e.message); return null; }
  },

  async set(key, value, ttlSeconds = 3600) {
    const redis = getRedis();
    if (!redis) return false;
    try {
      await redis.setex(key, ttlSeconds, JSON.stringify(value));
      return true;
    } catch (e) { logger.warn("[Cache] set failed:", e.message); return false; }
  },

  async del(key) {
    const redis = getRedis();
    if (!redis) return false;
    try { await redis.del(key); return true; }
    catch (e) { return false; }
  },
};

// TTL constants (seconds)
export const TTL = {
  SCAN_RESULT: 24 * 3600,      // 24h — competitor data
  AI_ANALYSIS: 48 * 3600,      // 48h — AI product analysis
  KEYWORD_DATA: 12 * 3600,     // 12h — keyword research
  RATE_LIMIT: 60,              // 1min — rate limit window
  SESSION: 7 * 24 * 3600,      // 7 days — user session
};

// redis.ts — Redis connection for caching & rate limiting at scale
// Phase 4: Replace in-memory rate limiter with Redis-based
// Install: npm install ioredis
//
// USAGE:
//   import { getRedis, cache } from "./redis.js";
//   const cached = await cache.get("scan:shop123:product456");
//   if (!cached) { const data = await doExpensiveScan(); await cache.set("scan:...", data, 3600); }

import { logger } from "./logger.js";

// Type for Redis client (ioredis)
interface RedisClient {
  get(key: string): Promise<string | null>;
  setex(key: string, seconds: number, value: string): Promise<string>;
  del(key: string | string[]): Promise<number>;
  on(event: string, listener: (...args: unknown[]) => void): this;
}

interface CacheHelper {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<boolean>;
  del(key: string): Promise<boolean>;
}

// Lazy Redis connection — only connects when first used
let redisClient: RedisClient | null = null;

export function getRedis(): RedisClient | null {
  if (redisClient) return redisClient;
  try {
    const Redis = require("ioredis");
    redisClient = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number): number => Math.min(times * 200, 5000),
      lazyConnect: true,
      enableReadyCheck: true,
    }) as RedisClient;
    redisClient.on("error", (err: unknown) => logger.error("[Redis]", `Connection error: ${(err as Error).message}`));
    redisClient.on("connect", () => logger.info("[Redis]", "Connected"));
    return redisClient;
  } catch (e) {
    logger.warn("[Redis]", "ioredis not installed — falling back to in-memory. Run: npm install ioredis");
    return null;
  }
}

// Cache helper with automatic JSON serialization
export const cache: CacheHelper = {
  async get<T = unknown>(key: string): Promise<T | null> {
    const redis = getRedis();
    if (!redis) return null;
    try {
      const val = await redis.get(key);
      return val ? (JSON.parse(val) as T) : null;
    } catch (e) {
      logger.warn("[Cache]", `get failed: ${(e as Error).message}`);
      return null;
    }
  },

  async set(key: string, value: unknown, ttlSeconds: number = 3600): Promise<boolean> {
    const redis = getRedis();
    if (!redis) return false;
    try {
      await redis.setex(key, ttlSeconds, JSON.stringify(value));
      return true;
    } catch (e) {
      logger.warn("[Cache]", `set failed: ${(e as Error).message}`);
      return false;
    }
  },

  async del(key: string): Promise<boolean> {
    const redis = getRedis();
    if (!redis) return false;
    try {
      await redis.del(key);
      return true;
    } catch (e) {
      return false;
    }
  },
};

// TTL constants (seconds)
export const TTL = {
  SCAN_RESULT: 24 * 3600,      // 24h — competitor data
  AI_ANALYSIS: 48 * 3600,      // 48h — AI product analysis
  KEYWORD_DATA: 12 * 3600,     // 12h — keyword research
  RATE_LIMIT: 60,              // 1min — rate limit window
  SESSION: 7 * 24 * 3600,      // 7 days — user session
} as const;

export type TTLKey = keyof typeof TTL;

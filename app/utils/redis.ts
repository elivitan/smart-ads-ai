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
  set(key: string, value: string): Promise<string>;
  setex(key: string, seconds: number, value: string): Promise<string>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
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

/**
 * Stale-While-Revalidate cache pattern.
 * Returns cached data immediately (even if stale), then refreshes in background.
 * - staleMultiplier: how many times the TTL before data is considered too old (default 2x)
 * - If cache miss: calls fetchFn, caches result, returns it
 * - If cache hit but stale: returns cached data, refreshes in background
 * - If cache hit and fresh: returns cached data
 */
export async function cacheWithSWR<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds: number = 3600,
  staleMultiplier: number = 2
): Promise<T> {
  const redis = getRedis();
  if (!redis) return fetchFn();

  try {
    const raw = await redis.get(key);
    if (raw) {
      const parsed = JSON.parse(raw) as { data: T; cachedAt: number };
      const ageSeconds = (Date.now() - parsed.cachedAt) / 1000;
      const isStale = ageSeconds > ttlSeconds;
      const isTooOld = ageSeconds > ttlSeconds * staleMultiplier;

      if (!isTooOld) {
        // Return cached data
        if (isStale) {
          // Background refresh (fire and forget)
          fetchFn().then(freshData => {
            const wrapped = JSON.stringify({ data: freshData, cachedAt: Date.now() });
            redis.setex(key, ttlSeconds * staleMultiplier, wrapped).catch(() => {});
          }).catch(err => {
            logger.warn("[SWR]", `Background refresh failed for ${key}: ${(err as Error).message}`);
          });
        }
        return parsed.data;
      }
    }
  } catch (e) {
    logger.warn("[SWR]", `Cache read failed for ${key}: ${(e as Error).message}`);
  }

  // Cache miss or too old — fetch fresh
  const freshData = await fetchFn();
  try {
    const wrapped = JSON.stringify({ data: freshData, cachedAt: Date.now() });
    await redis.setex(key, ttlSeconds * staleMultiplier, wrapped);
  } catch (e) {
    logger.warn("[SWR]", `Cache write failed for ${key}: ${(e as Error).message}`);
  }
  return freshData;
}

// TTL constants (seconds)
export const TTL = {
  SCAN_RESULT: 24 * 3600,      // 24h — competitor data
  AI_ANALYSIS: 48 * 3600,      // 48h — AI product analysis
  KEYWORD_DATA: 12 * 3600,     // 12h — keyword research
  RATE_LIMIT: 60,              // 1min — rate limit window
  SESSION: 7 * 24 * 3600,      // 7 days — user session
} as const;

export type TTLKey = keyof typeof TTL;

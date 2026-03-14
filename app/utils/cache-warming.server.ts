// cache-warming.server.ts — Pre-warm caches on startup
// Prevents cold-start latency for first requests after deploy.

import { cache, TTL } from "./redis.js";
import { logger } from "./logger.js";

/**
 * Warm critical caches on startup.
 * Call from entry.server.tsx after Redis connects.
 * Non-blocking — failures don't prevent startup.
 */
export async function warmCaches(): Promise<void> {
  const start = Date.now();
  let warmed = 0;

  try {
    // 1. Check Redis connectivity
    const redis = (await import("./redis.js")).getRedis();
    if (!redis) {
      logger.info("[CacheWarm]", "No Redis — skipping cache warming");
      return;
    }

    // 2. Pre-warm feature flags
    try {
      const { refreshFeatureFlags } = await import("./feature-flags.server.js");
      await refreshFeatureFlags();
      warmed++;
    } catch {
      // Not critical
    }

    // 3. Verify cache read/write works
    try {
      await cache.set("_warmup_test", { ts: Date.now() }, 60);
      const test = await cache.get("_warmup_test");
      if (test) {
        await cache.del("_warmup_test");
        warmed++;
      }
    } catch {
      logger.warn("[CacheWarm]", "Cache read/write test failed");
    }

    const duration = Date.now() - start;
    logger.info("[CacheWarm]", `Cache warming complete: ${warmed} items in ${duration}ms`);
  } catch (err: unknown) {
    logger.warn("[CacheWarm]", `Cache warming failed: ${(err as Error).message}`);
  }
}

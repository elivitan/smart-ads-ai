// feature-flags.server.ts — Runtime feature flag management
// Extends the static CONFIG.features with runtime overrides via Redis or env vars.

import { CONFIG } from "./config.js";
import { getRedis } from "./redis.js";
import { logger } from "./logger.js";

type FeatureKey = keyof typeof CONFIG.features;

// Runtime overrides (in-memory cache, refreshed from Redis periodically)
let overrides: Partial<Record<FeatureKey, boolean>> = {};
let lastRefresh = 0;
const REFRESH_INTERVAL_MS = 60_000; // 1 minute

/**
 * Check if a feature is enabled.
 * Priority: ENV override > Redis override > CONFIG default
 */
export function isFeatureEnabled(key: FeatureKey, shopId?: string): boolean {
  // 1. ENV override: FEATURE_FLAG_ENABLE_PMAX_IMAGES=true|false
  const envKey = `FEATURE_FLAG_${key.replace(/([A-Z])/g, "_$1").toUpperCase()}`;
  const envVal = process.env[envKey];
  if (envVal === "true") return true;
  if (envVal === "false") return false;

  // 2. Per-shop override (if Redis has shop-specific flag)
  // Key format: ff:{shopId}:{featureKey}
  // This is checked async, so we use the cached value
  const shopKey = shopId ? `${shopId}:${key}` : null;
  if (shopKey && overrides[key] !== undefined) {
    return overrides[key]!;
  }

  // 3. Global Redis override
  if (overrides[key] !== undefined) {
    return overrides[key]!;
  }

  // 4. Static config default
  return CONFIG.features[key] ?? false;
}

/**
 * Refresh feature flag overrides from Redis.
 * Called periodically — non-blocking, fails silently.
 */
export async function refreshFeatureFlags(): Promise<void> {
  const now = Date.now();
  if (now - lastRefresh < REFRESH_INTERVAL_MS) return;
  lastRefresh = now;

  const redis = getRedis();
  if (!redis) return;

  try {
    const keys = Object.keys(CONFIG.features) as FeatureKey[];
    for (const key of keys) {
      const val = await redis.get(`ff:global:${key}`);
      if (val === "true") overrides[key] = true;
      else if (val === "false") overrides[key] = false;
      else delete overrides[key]; // No override, use default
    }
  } catch (err: unknown) {
    logger.warn("[FeatureFlags]", `Redis refresh failed: ${(err as Error).message}`);
  }
}

/**
 * Set a feature flag override in Redis.
 * This affects all instances. Set value to null to remove override.
 */
export async function setFeatureFlag(
  key: FeatureKey,
  value: boolean | null,
  shopId?: string
): Promise<void> {
  const redis = getRedis();
  const redisKey = shopId ? `ff:${shopId}:${key}` : `ff:global:${key}`;

  if (redis) {
    if (value === null) {
      await redis.del(redisKey);
    } else {
      await redis.set(redisKey, String(value));
    }
  }

  // Update local cache immediately
  if (value === null) {
    delete overrides[key];
  } else {
    overrides[key] = value;
  }

  logger.info("[FeatureFlags]", `${key} = ${value} (${shopId || "global"})`);
}

/**
 * Get all feature flag values (for admin/debug).
 */
export function getAllFeatureFlags(): Record<string, boolean> {
  const flags: Record<string, boolean> = {};
  const keys = Object.keys(CONFIG.features) as FeatureKey[];
  for (const key of keys) {
    flags[key] = isFeatureEnabled(key);
  }
  return flags;
}

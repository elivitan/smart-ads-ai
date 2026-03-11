// db-health.ts — Database connection health monitoring
// For scale: monitors connection pool, query latency, and connection count
// Integrates with health endpoint for monitoring dashboards

import { logger } from "./logger.js";
import { SCALE } from "./scale-config.js";

// ── Types ──
interface DbHealthStats {
  totalQueries: number;
  slowQueries: number;
  errors: number;
  poolConfig: {
    min: number;
    max: number;
    timeoutMs: number;
  };
}

// ── State ──
let queryCount = 0;
let slowQueryCount = 0;
let errorCount = 0;
const SLOW_QUERY_THRESHOLD_MS = 2000;

/**
 * Wrap a Prisma operation with monitoring.
 * Tracks latency, counts errors and slow queries.
 */
export async function monitoredQuery<T>(label: string, queryFn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  queryCount++;

  try {
    const result = await queryFn();
    const duration = Date.now() - start;

    if (duration > SLOW_QUERY_THRESHOLD_MS) {
      slowQueryCount++;
      logger.warn("[DB]", `Slow query "${label}": ${duration}ms`);
    }

    return result;
  } catch (error) {
    errorCount++;
    const duration = Date.now() - start;
    logger.error("[DB]", `Query "${label}" failed after ${duration}ms: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * Get DB health stats for the health endpoint.
 */
export function getDbHealthStats(): DbHealthStats {
  return {
    totalQueries: queryCount,
    slowQueries: slowQueryCount,
    errors: errorCount,
    poolConfig: {
      min: SCALE.DB_POOL_MIN,
      max: SCALE.DB_POOL_MAX,
      timeoutMs: SCALE.DB_TIMEOUT_MS,
    },
  };
}

/**
 * Reset stats (for testing).
 */
export function resetDbStats(): void {
  queryCount = 0;
  slowQueryCount = 0;
  errorCount = 0;
}

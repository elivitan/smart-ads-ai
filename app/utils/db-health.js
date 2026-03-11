// db-health.js — Database connection health monitoring
// For scale: monitors connection pool, query latency, and connection count
// Integrates with health endpoint for monitoring dashboards

import { logger } from "./logger.js";
import { SCALE } from "./scale-config.js";

let queryCount = 0;
let slowQueryCount = 0;
let errorCount = 0;
const SLOW_QUERY_THRESHOLD_MS = 2000;

/**
 * Wrap a Prisma operation with monitoring.
 * Tracks latency, counts errors and slow queries.
 *
 * Usage:
 *   const products = await monitoredQuery("getProducts", () => prisma.product.findMany());
 *
 * @param {string} label - Query label for logging
 * @param {Function} queryFn - The async query function
 * @returns {Promise<any>} Query result
 */
export async function monitoredQuery(label, queryFn) {
  const start = Date.now();
  queryCount++;

  try {
    const result = await queryFn();
    const duration = Date.now() - start;

    if (duration > SLOW_QUERY_THRESHOLD_MS) {
      slowQueryCount++;
      logger.warn(`[DB] Slow query "${label}": ${duration}ms`);
    }

    return result;
  } catch (error) {
    errorCount++;
    const duration = Date.now() - start;
    logger.error(`[DB] Query "${label}" failed after ${duration}ms: ${error.message}`);
    throw error;
  }
}

/**
 * Get DB health stats for the health endpoint.
 * @returns {object}
 */
export function getDbHealthStats() {
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
export function resetDbStats() {
  queryCount = 0;
  slowQueryCount = 0;
  errorCount = 0;
}

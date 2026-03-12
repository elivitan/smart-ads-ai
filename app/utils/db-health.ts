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
 * Wrap a DB operation with monitoring + retry for transient errors.
 * Retries only on connection errors (ECONNRESET, ETIMEDOUT, connection refused).
 * Max 2 attempts, 500ms delay.
 */
export async function withDbRetry<T>(label: string, queryFn: () => Promise<T>): Promise<T> {
  const maxAttempts = 2;
  const delayMs = 500;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await monitoredQuery(label, queryFn);
    } catch (error) {
      const msg = (error as Error).message || "";
      const isTransient = msg.includes("ECONNRESET") || 
                          msg.includes("ETIMEDOUT") || 
                          msg.includes("connection") ||
                          msg.includes("Connection") ||
                          msg.includes("connect ECONNREFUSED") ||
                          msg.includes("prepared statement") ||
                          msg.includes("server closed the connection");
      
      if (isTransient && attempt < maxAttempts) {
        logger.warn("[DB]", `Transient error on "${label}" (attempt ${attempt}/${maxAttempts}), retrying in ${delayMs}ms: ${msg}`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      
      throw error;
    }
  }
  
  // TypeScript: unreachable but needed for type safety
  throw new Error("withDbRetry: unexpected exit");
}

/**
 * Reset stats (for testing).
 */
export function resetDbStats(): void {
  queryCount = 0;
  slowQueryCount = 0;
  errorCount = 0;
}

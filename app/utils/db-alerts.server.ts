// db-alerts.server.ts — Database slow query alerts to Sentry
// Monitors query performance and sends alerts for anomalies.

import { captureApiError, trackSlowOperation } from "./sentry.server.js";
import { logger } from "./logger.js";

// ── Thresholds ──
const SLOW_QUERY_MS = 2000;
const VERY_SLOW_QUERY_MS = 5000;
const ERROR_BURST_THRESHOLD = 5; // errors in 1 minute = alert

// ── State ──
let recentErrors: number[] = [];

/**
 * Track a DB query and alert if slow.
 */
export function trackDbQuery(label: string, durationMs: number, error?: Error): void {
  if (error) {
    recentErrors.push(Date.now());
    // Clean old entries (keep last minute)
    const oneMinAgo = Date.now() - 60_000;
    recentErrors = recentErrors.filter((t) => t > oneMinAgo);

    if (recentErrors.length >= ERROR_BURST_THRESHOLD) {
      captureApiError(new Error(`DB error burst: ${recentErrors.length} errors in 1 minute`), {
        route: "db-monitor",
        action: "error-burst",
      });
      logger.error("[DB-Alert]", `Error burst detected: ${recentErrors.length} errors in 1 minute`);
      recentErrors = []; // Reset to avoid spam
    }
    return;
  }

  if (durationMs > VERY_SLOW_QUERY_MS) {
    captureApiError(new Error(`Very slow DB query: "${label}" took ${durationMs}ms`), {
      route: "db-monitor",
      action: "very-slow-query",
    });
    logger.error("[DB-Alert]", `Very slow query "${label}": ${durationMs}ms`);
  } else if (durationMs > SLOW_QUERY_MS) {
    trackSlowOperation(`db:${label}`, durationMs, SLOW_QUERY_MS);
  }
}

/**
 * Wrap a DB query with automatic alerting.
 */
export async function monitoredDbQuery<T>(label: string, queryFn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    const result = await queryFn();
    trackDbQuery(label, Date.now() - start);
    return result;
  } catch (error) {
    trackDbQuery(label, Date.now() - start, error as Error);
    throw error;
  }
}

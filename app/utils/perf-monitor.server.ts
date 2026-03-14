// perf-monitor.server.ts — Performance monitoring and metrics collection
// Tracks response times, error rates, and throughput per route.

import { logger } from "./logger.js";

interface RouteMetrics {
  count: number;
  totalMs: number;
  maxMs: number;
  errors: number;
  lastError?: string;
  p95Samples: number[];
}

// In-memory metrics (reset periodically or on read)
const metrics: Map<string, RouteMetrics> = new Map();
const startTime = Date.now();
const MAX_P95_SAMPLES = 100;

/**
 * Record a request metric.
 */
export function recordMetric(
  route: string,
  durationMs: number,
  isError: boolean = false,
  errorMessage?: string
): void {
  let m = metrics.get(route);
  if (!m) {
    m = { count: 0, totalMs: 0, maxMs: 0, errors: 0, p95Samples: [] };
    metrics.set(route, m);
  }

  m.count++;
  m.totalMs += durationMs;
  if (durationMs > m.maxMs) m.maxMs = durationMs;
  if (isError) {
    m.errors++;
    m.lastError = errorMessage;
  }

  // Keep rolling P95 samples
  m.p95Samples.push(durationMs);
  if (m.p95Samples.length > MAX_P95_SAMPLES) {
    m.p95Samples.shift();
  }
}

/**
 * Get metrics summary for all routes.
 */
export function getMetrics(): Record<string, {
  count: number;
  avgMs: number;
  maxMs: number;
  p95Ms: number;
  errorRate: string;
  lastError?: string;
}> {
  const result: Record<string, any> = {};

  for (const [route, m] of metrics) {
    const sorted = [...m.p95Samples].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);

    result[route] = {
      count: m.count,
      avgMs: m.count > 0 ? Math.round(m.totalMs / m.count) : 0,
      maxMs: m.maxMs,
      p95Ms: sorted[p95Index] || 0,
      errorRate: m.count > 0 ? `${((m.errors / m.count) * 100).toFixed(1)}%` : "0%",
      ...(m.lastError ? { lastError: m.lastError } : {}),
    };
  }

  return result;
}

/**
 * Get system-wide stats.
 */
export function getSystemStats(): {
  uptimeSeconds: number;
  memoryMB: { heapUsed: number; heapTotal: number; rss: number };
  totalRequests: number;
  totalErrors: number;
} {
  const mem = process.memoryUsage();
  let totalRequests = 0;
  let totalErrors = 0;

  for (const m of metrics.values()) {
    totalRequests += m.count;
    totalErrors += m.errors;
  }

  return {
    uptimeSeconds: Math.round((Date.now() - startTime) / 1000),
    memoryMB: {
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      rss: Math.round(mem.rss / 1024 / 1024),
    },
    totalRequests,
    totalErrors,
  };
}

/**
 * Reset metrics (for periodic cleanup).
 */
export function resetMetrics(): void {
  metrics.clear();
  logger.info("[PerfMonitor]", "Metrics reset");
}

// Auto-log metrics summary every 5 minutes
setInterval(() => {
  const stats = getSystemStats();
  if (stats.totalRequests > 0) {
    logger.info("[PerfMonitor]", `Requests: ${stats.totalRequests} | Errors: ${stats.totalErrors} | Memory: ${stats.memoryMB.heapUsed}MB`);
  }
}, 5 * 60 * 1000);

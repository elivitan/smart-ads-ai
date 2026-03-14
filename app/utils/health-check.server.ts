// health-check.server.ts — Comprehensive system health verification
// Used by DR runbook and monitoring. Checks all external dependencies.

import { getRedis } from "./redis.js";
import { logger } from "./logger.js";

export interface HealthStatus {
  status: "ok" | "degraded" | "down";
  checks: Record<string, { ok: boolean; latencyMs: number; error?: string }>;
  timestamp: string;
  uptime: number;
}

/**
 * Run all health checks and return system status.
 */
export async function runHealthChecks(): Promise<HealthStatus> {
  const checks: HealthStatus["checks"] = {};
  let allOk = true;

  // ── Database ──
  try {
    const start = Date.now();
    const { default: prisma } = await import("../db.server.js");
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { ok: true, latencyMs: Date.now() - start };
  } catch (err: unknown) {
    checks.database = { ok: false, latencyMs: 0, error: (err as Error).message };
    allOk = false;
  }

  // ── Redis ──
  try {
    const start = Date.now();
    const redis = getRedis();
    if (redis) {
      await (redis as any).ping();
      checks.redis = { ok: true, latencyMs: Date.now() - start };
    } else {
      checks.redis = { ok: true, latencyMs: 0, error: "Using in-memory fallback" };
    }
  } catch (err: unknown) {
    checks.redis = { ok: false, latencyMs: 0, error: (err as Error).message };
    // Redis failure is degraded, not down
  }

  // ── API Keys ──
  checks.anthropic = {
    ok: !!process.env.ANTHROPIC_API_KEY,
    latencyMs: 0,
    ...(!process.env.ANTHROPIC_API_KEY ? { error: "Missing ANTHROPIC_API_KEY" } : {}),
  };
  if (!process.env.ANTHROPIC_API_KEY) allOk = false;

  checks.searchApi = {
    ok: !!(process.env.SERPER_API_KEY || process.env.SERPAPI_KEY),
    latencyMs: 0,
    ...(!process.env.SERPER_API_KEY && !process.env.SERPAPI_KEY
      ? { error: "No search API key configured" }
      : {}),
  };

  // ── Memory ──
  const mem = process.memoryUsage();
  const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
  checks.memory = {
    ok: heapUsedMB < heapTotalMB * 0.9,
    latencyMs: 0,
    ...(heapUsedMB >= heapTotalMB * 0.9
      ? { error: `High memory: ${heapUsedMB}/${heapTotalMB}MB` }
      : {}),
  };

  const status: HealthStatus["status"] = allOk
    ? "ok"
    : checks.database?.ok
      ? "degraded"
      : "down";

  return {
    status,
    checks,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };
}

/**
 * Quick readiness check — is the app ready to serve requests?
 */
export async function isReady(): Promise<boolean> {
  try {
    const { default: prisma } = await import("../db.server.js");
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

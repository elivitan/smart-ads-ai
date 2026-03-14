// app/routes/app.api.health.js
// ════════════════════════════════════════════
// Health Check Endpoint (upgraded Session 56)
// GET → Returns system health: DB, Redis, API keys, circuits, queues, uptime
// Used by: Pingdom, UptimeRobot, internal monitoring
// ════════════════════════════════════════════
import prisma from "../db.server";
import { checkRateLimit, rateLimitResponse } from "../utils/rate-limiter";
import { logger } from "../utils/logger";
import { getCircuitStatus } from "../utils/retry.js";
import { getRedis } from "../utils/redis";
import { getDbHealthStats } from "../utils/db-health";

interface LoaderArgs {
  request: Request;
}

interface HealthResults {
  status: string;
  version: string;
  uptime: number;
  timestamp: string;
  checks: any;
  responseTime?: number;
}


const START_TIME = Date.now();
const APP_VERSION = "1.1.0-beta";

export const loader = async ({ request }: LoaderArgs): Promise<Response> => {
  // Basic rate limiting (prevent abuse)
  const limit = await checkRateLimit("_health", "health", 30, 60000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds ?? 0);

  const start = Date.now();
  const results: HealthResults = {
    status: "ok",
    version: APP_VERSION,
    uptime: Math.floor((Date.now() - START_TIME) / 1000),
    timestamp: new Date().toISOString(),
    checks: {},
  };

  // ── 1. Database connectivity ──
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    results.checks.database = { status: "ok", latency: Date.now() - dbStart };
  } catch (error: unknown) {
    results.checks.database = { status: "error", error: (error instanceof Error ? error.message : String(error)) };
    results.status = "degraded";
    logger.error("health", "Database check failed", { error: (error instanceof Error ? error.message : String(error)) });
  }

  // ── 2. Database health stats ──
  try {
    const dbStats = getDbHealthStats();
    results.checks.dbStats = {
      totalQueries: dbStats.totalQueries,
      slowQueries: dbStats.slowQueries,
      errors: dbStats.errors,
      poolConfig: dbStats.poolConfig,
    };
  } catch (error: unknown) {
    results.checks.dbStats = { status: "error", error: (error instanceof Error ? error.message : String(error)) };
  }

  // ── 3. Redis connectivity ──
  try {
    const redis = getRedis();
    if (redis) {
      const redisStart = Date.now();
      await redis.set("health:ping", "pong");
      const pong = await redis.get("health:ping");
      results.checks.redis = {
        status: pong === "pong" ? "ok" : "degraded",
        latency: Date.now() - redisStart,
      };
    } else {
      results.checks.redis = { status: "not_configured", note: "Using in-memory fallback" };
    }
  } catch (error: unknown) {
    results.checks.redis = { status: "error", error: (error instanceof Error ? error.message : String(error)) };
    results.status = "degraded";
    logger.error("health", "Redis check failed", { error: (error instanceof Error ? error.message : String(error)) });
  }

  // ── 4. Anthropic API key ──
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  results.checks.anthropic = {
    status: anthropicKey && anthropicKey.length > 10 ? "configured" : "missing",
    circuit: getCircuitStatus("anthropic"),
  };
  if (!anthropicKey) results.status = "degraded";

  // ── 5. Serper API key (primary search) ──
  const serperKey = process.env.SERPER_API_KEY;
  results.checks.serper = {
    status: serperKey && serperKey.length > 5 ? "configured" : "missing",
    circuit: getCircuitStatus("serper"),
  };

  // ── 6. SerpAPI key (fallback search) ──
  const serpApiKey = process.env.SERPAPI_KEY;
  results.checks.serpApi = {
    status: serpApiKey && serpApiKey.length > 5 ? "configured" : "missing",
    note: "fallback only — may be exhausted",
    circuit: getCircuitStatus("serpapi"),
  };

  // ── 7. Google Ads credentials ──
  const gadsToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const gadsClient = process.env.GOOGLE_ADS_CLIENT_ID;
  results.checks.googleAds = {
    status: gadsToken && gadsClient ? "configured" : "missing",
    mode: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ? "test" : "unknown",
    circuit: getCircuitStatus("googleAds"),
  };
  if (!gadsToken) results.status = "degraded";

  // ── 8. Memory usage ──
  const mem = process.memoryUsage();
  results.checks.memory = {
    heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
    rssMB: Math.round(mem.rss / 1024 / 1024),
  };

  // ── 9. Queue status ──
  try {
    const { getQueueHealth } = await import("../utils/queue.js");
    if (typeof getQueueHealth === "function") {
      results.checks.queue = await getQueueHealth();
    } else {
      results.checks.queue = { status: "no_stats_fn", note: "getQueueHealth not exported" };
    }
  } catch (error: unknown) {
    results.checks.queue = { status: "not_available", note: (error instanceof Error ? error.message : String(error)) };
  }

  // ── Overall latency ──
  results.responseTime = Date.now() - start;

  logger.info("health", `Health check: ${results.status}`, {
    extra: { status: results.status, responseTime: results.responseTime },
  });

  return Response.json(results, {
    status: results.status === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-cache, no-store" },
  });
};


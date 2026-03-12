// app/routes/app.api.health.js
// ════════════════════════════════════════════
// Health Check Endpoint
// GET → Returns system health: DB, API keys, circuits, uptime
// Used by: Pingdom, UptimeRobot, internal monitoring
// ════════════════════════════════════════════
import prisma from "../db.server.js";
import { checkRateLimit, rateLimitResponse } from "../utils/rate-limiter";
import { logger } from "../utils/logger.ts";
import { getCircuitStatus } from "../utils/retry.ts";

const START_TIME = Date.now();
const APP_VERSION = "1.0.0-beta";

export const loader = async ({ request }) => {
  // Basic rate limiting (prevent abuse)
  const limit = await checkRateLimit("_health", "health", 30, 60000);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

  const start = Date.now();
  const results = {
    status: "ok",
    version: APP_VERSION,
    uptime: Math.floor((Date.now() - START_TIME) / 1000),
    timestamp: new Date().toISOString(),
    checks: {},
  };

  // ── 1. Database connectivity ──
  try {
    await prisma.$queryRaw`SELECT 1`;
    results.checks.database = { status: "ok", latency: Date.now() - start };
  } catch (error) {
    results.checks.database = { status: "error", error: error.message };
    results.status = "degraded";
    logger.error("health", "Database check failed", { error: error.message });
  }

  // ── 2. Anthropic API key ──
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  results.checks.anthropic = {
    status: anthropicKey && anthropicKey.length > 10 ? "configured" : "missing",
    circuit: getCircuitStatus("anthropic"),
  };
  if (!anthropicKey) results.status = "degraded";

  // ── 3. Serper API key (primary search) ──
  const serperKey = process.env.SERPER_API_KEY;
  results.checks.serper = {
    status: serperKey && serperKey.length > 5 ? "configured" : "missing",
    circuit: getCircuitStatus("serper"),
  };

  // ── 4. SerpAPI key (fallback search) ──
  const serpApiKey = process.env.SERPAPI_KEY;
  results.checks.serpApi = {
    status: serpApiKey && serpApiKey.length > 5 ? "configured" : "missing",
    note: "fallback only — may be exhausted",
    circuit: getCircuitStatus("serpapi"),
  };

  // ── 5. Google Ads credentials ──
  const gadsToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const gadsClient = process.env.GOOGLE_ADS_CLIENT_ID;
  results.checks.googleAds = {
    status: gadsToken && gadsClient ? "configured" : "missing",
    mode: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ? "test" : "unknown",
    circuit: getCircuitStatus("googleAds"),
  };
  if (!gadsToken) results.status = "degraded";

  // ── 6. Memory usage ──
  const mem = process.memoryUsage();
  results.checks.memory = {
    heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
    rssMB: Math.round(mem.rss / 1024 / 1024),
  };

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

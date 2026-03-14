// app.api.metrics.ts — Internal metrics endpoint
// Returns performance metrics, system stats, and feature flags.
// Protected: only accessible with valid Shopify session.

import { getMetrics, getSystemStats } from "../utils/perf-monitor.server.js";
import { getAllFeatureFlags } from "../utils/feature-flags.server.js";
import { getDbHealthStats } from "../utils/db-health.js";
import { withSentryMonitoring, type HandlerArgs } from "../utils/sentry-wrapper.server.js";
import { checkRateLimit, rateLimitResponse } from "../utils/rate-limiter.js";

export const loader = withSentryMonitoring("api.metrics", async ({ request }: HandlerArgs) => {
  // Rate limit: 10 requests per minute
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") || "unknown";
  const rl = await checkRateLimit(shop, "metrics", 10, 60000);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds ?? 60);

  const routeMetrics = getMetrics();
  const systemStats = getSystemStats();
  const dbStats = getDbHealthStats();
  const featureFlags = getAllFeatureFlags();

  return new Response(
    JSON.stringify({
      system: systemStats,
      routes: routeMetrics,
      database: dbStats,
      featureFlags,
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store",
      },
    }
  );
});

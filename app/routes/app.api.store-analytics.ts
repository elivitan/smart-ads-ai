// app/routes/app.api.store-analytics.js
// ══════════════════════════════════════════════
// Store Analytics API — pre-campaign intelligence
// Returns store performance data + AI readiness assessment
// ══════════════════════════════════════════════

import { authenticate } from "../shopify.server";
import { getShopifyAnalytics, analyzeCampaignReadiness } from "../store-analytics.server";
import { z } from "zod";
import { logger } from "../utils/logger";
import { rateLimit, rateLimitResponse } from "../utils/rate-limiter";
import { cacheWithSWR, TTL } from "../utils/redis";
import { withRequestLogging } from "../utils/request-logger";
import { withSentryMonitoring } from "../utils/sentry-wrapper.server";

// ── Types ──
interface RouteHandlerArgs {
  request: Request;
  params?: Record<string, string>;
  context?: unknown;
}

const _action = async ({ request }: RouteHandlerArgs): Promise<Response> => {
  let admin, session;
  try {
    ({ admin, session } = await authenticate.admin(request));
  } catch (authErr: unknown) {
    logger.error("store-analytics.action", "Auth failed", { error: (authErr as Error).message });
    return Response.json({ success: false, error: "Authentication failed" }, { status: 401 });
  }

  const shop = session.shop;

  // Rate limit check
  const rl = await rateLimit.storeAnalytics(shop);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds || 60);

  try {
    const formData = await request.formData();
    const mode = (formData.get("mode") as string) || "full"; // "data" = just data, "full" = data + AI analysis

    // Use SWR cache for expensive analytics + AI calls
    const cacheKey = `store-analytics:${shop}:${mode}`;
    const result = await cacheWithSWR(
      cacheKey,
      async () => {
        // Fetch Shopify analytics
        const analytics = await getShopifyAnalytics(admin, shop);
        if (analytics.error) {
          throw new Error(analytics.error);
        }

        let aiAnalysis = null;
        if (mode === "full") {
          aiAnalysis = await analyzeCampaignReadiness(analytics);
        }

        return { analytics, readiness: aiAnalysis };
      },
      TTL.SCAN_RESULT // 24h
    );

    return Response.json({
      success: true,
      ...result,
    });
  } catch (err: unknown) {
    logger.error("store-analytics.action", "Store analytics error", { shop, error: (err as Error).message });
    return Response.json(
      { success: false, error: "Store analytics failed: " + (err as Error).message },
      { status: 500 }
    );
  }
};


// ── Middleware wrappers (Session 56) ──
export const action = withSentryMonitoring("api.store-analytics", withRequestLogging("api.store-analytics", _action));
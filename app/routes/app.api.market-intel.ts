// app/routes/app.api.market-intel.js
// ══════════════════════════════════════════════
// Market Intelligence API endpoint
// Returns market conditions, holiday alerts, and ad recommendations
// ══════════════════════════════════════════════

import { authenticate } from "../shopify.server";
import { getMarketIntelligence, getQuickMarketSignal } from "../market-intel.server.js";
import { z } from "zod";
import { logger } from "../utils/logger";
import { rateLimit, rateLimitResponse } from "../utils/rate-limiter";
import { cache, TTL } from "../utils/redis";
import { withRequestLogging } from "../utils/request-logger";
import { withSentryMonitoring } from "../utils/sentry-wrapper.server";

// ── Types ──
interface RouteHandlerArgs {
  request: Request;
  params?: Record<string, string>;
  context?: unknown;
}

const _action = async ({ request }: RouteHandlerArgs): Promise<Response> => {
  let session;
  try {
    ({ session } = await authenticate.admin(request));
  } catch (authErr: unknown) {
    logger.error("market-intel.action", "Auth failed", { error: (authErr as Error).message });
    return Response.json({ success: false, error: "Authentication failed" }, { status: 401 });
  }

  const shop = session.shop;

  // Rate limit check
  const rl = await rateLimit.marketIntel(shop);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds || 60);

  try {
    const formData = await request.formData();
    const mode = (formData.get("mode") as string) || "full"; // "full" or "quick"
    const regionsStr = (formData.get("regions") as string) || "US";
    const productCategory = (formData.get("productCategory") as string) || "general";
    const topKeywordsStr = (formData.get("topKeywords") as string) || "";

    const regions = regionsStr.split(",").map(r => r.trim().toUpperCase()).filter(Boolean);
    const topKeywords = topKeywordsStr ? topKeywordsStr.split(",").map(k => k.trim()).filter(Boolean) : undefined;

    const storeInfo = {
      domain: shop,
      regions,
      productCategory,
      topKeywords,
    };

    let result;
    if (mode === "quick") {
      const cacheKeyQuick = `intel:quick:${shop}:${productCategory}`;
      result = await cache.get(cacheKeyQuick);
      if (!result) {
        result = await getQuickMarketSignal(storeInfo);
        await cache.set(cacheKeyQuick, result, 3600); // 1h
      }
    } else {
      const cacheKeyFull = `intel:full:${shop}:${productCategory}:${regions.join(",")}`;
      result = await cache.get(cacheKeyFull);
      if (!result) {
        result = await getMarketIntelligence(storeInfo);
        await cache.set(cacheKeyFull, result, TTL.KEYWORD_DATA); // 12h
      }
    }

    return Response.json({ success: true, intel: result });
  } catch (err: unknown) {
    logger.error("market-intel.action", "Market intelligence error", { shop, error: (err as Error).message });
    return Response.json(
      { success: false, error: "Market intelligence analysis failed" },
      { status: 500 }
    );
  }
};


// ── Middleware wrappers (Session 56) ──
export const action = withSentryMonitoring("api.market-intel", withRequestLogging("api.market-intel", _action));
// app/routes/app.api.ai-engine.js
// ═══════════════════════════════════════════════════════════════
// Smart Ads AI Engine v2 — Powered by AI Brain
// All endpoints collect real data first, then let Claude decide.
// ═══════════════════════════════════════════════════════════════
import { authenticate } from "../shopify.server";
import { getQuickMarketSignal } from "../market-intel.server.js";
import {
  collectCompetitorData,
  analyzeMarket,
  buildCampaignStrategy,
  getDailyAdvice,
  improveAdCopy,
} from "../ai-brain.server.js";
import { checkLicense } from "../license.server";
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


// Cache key helper
function quickHash(str) {
  return require("crypto").createHash("md5").update(str).digest("hex").slice(0, 12);
}

// Helper: get holidays + seasonal from market-intel
async function getSeasonalContext(category) {
  try {
    const mod = await import("../market-intel.server.js");
    const holidays = typeof mod.getUpcomingHolidays === "function"
      ? mod.getUpcomingHolidays(["US"], 30) : [];
    const seasonal = typeof mod.getSeasonalInsight === "function"
      ? mod.getSeasonalInsight(category, new Date().getMonth() + 1) : null;
    return { month: new Date().getMonth() + 1, holidays, seasonal };
  } catch {
    return { month: new Date().getMonth() + 1, holidays: [], seasonal: null };
  }
}

// ─── Main action handler ───
const _action = async ({ request }: RouteHandlerArgs): Promise<Response> => {
  let session;
  try {
    ({ session } = await authenticate.admin(request));
  } catch (authErr: unknown) {
    return Response.json({ success: false, error: "Auth failed" }, { status: 401 });
  }
  const shop = session.shop;

  // Rate limit check
  const rl = await rateLimit.aiEngine(shop);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds || 60);

  const formData = await request.formData();
  const actionType = (formData.get("action") as string);

  try {
    // ══════════════════════════════════════════
    // MARKET ANALYSIS — "Should I advertise?"
    // Collects real data → Claude analyzes
    // ══════════════════════════════════════════
    if (actionType === "market-analysis") {
      const category = (formData.get("category") as string) || "bedding";
      const productsJson = (formData.get("products") as string) || "[]";
      const products = JSON.parse(productsJson as string);

      // Step 1: Collect real data
      const searchTerms = products.length > 0
        ? products.slice(0, 3).flatMap(p => [p.title, "buy " + p.title]).slice(0, 5)
        : ["buy " + category, "best " + category, category + " online"];

      const cacheKeyComp = `ai:comp:${shop}:${quickHash(searchTerms.join("|"))}`;
      let competitorData = await cache.get(cacheKeyComp);
      if (!competitorData) {
        competitorData = await collectCompetitorData(searchTerms, shop);
        await cache.set(cacheKeyComp, competitorData, TTL.KEYWORD_DATA); // 12h
      }

      // Step 2: Get seasonal context
      const seasonalContext = await getSeasonalContext(category);

      // Step 3: Claude analyzes everything (cache the full analysis)
      const cacheKeyAnalysis = `ai:market:${shop}:${quickHash(category + JSON.stringify(products.map(p => p.title)))}`;
      let analysis = await cache.get(cacheKeyAnalysis);
      if (!analysis) {
        analysis = await analyzeMarket({
          competitorData: competitorData as any,
          products,
          storeInfo: { domain: shop, category, size: "small" },
          seasonalContext: seasonalContext as any,
        });
        await cache.set(cacheKeyAnalysis, analysis, TTL.KEYWORD_DATA); // 12h
      }

      return Response.json({
        success: true,
        analysis,
        _raw: {
          competitorCount: (competitorData as any).competitorCount,
          bigPlayerCount: (competitorData as any).bigPlayerCount,
          bigPlayers: (competitorData as any).bigPlayers,
          trends: (competitorData as any).trends,
          storeRankings: (competitorData as any).storeRankings,
          shoppingPrices: (competitorData as any).shopping?.slice(0, 5),
          competitorAds: (competitorData as any).ads?.slice(0, 5),
          analyzedAt: new Date().toISOString(),
        },
      });
    }

    // ══════════════════════════════════════════
    // QUICK SIGNAL — lightweight, no AI cost
    // ══════════════════════════════════════════
    if (actionType === "quick-signal") {
      const category = (formData.get("category") as string) || "bedding";
      const signal = await getQuickMarketSignal({
        regions: ["US"],
        productCategory: category,
      });
      return Response.json({ success: true, ...signal });
    }

    // ══════════════════════════════════════════
    // CAMPAIGN BUILD — "Design my campaign"
    // Real data → Claude builds optimal campaign
    // ══════════════════════════════════════════
    if (actionType === "build-campaign") {
      const products = JSON.parse((formData.get("products") as string) || "[]");
      const goal = (formData.get("goal") as string) || "sales";
      const category = (formData.get("category") as string) || "bedding";

      // Step 1: Collect competitor data for these products
      let searchTerms = products.slice(0, 3)
        .flatMap(p => [p.title, "buy " + p.title])
        .slice(0, 5);

      if (searchTerms.length === 0) {
        searchTerms = ["buy " + category, "best " + category];
      }

      const cacheKeyComp2 = `ai:comp:${shop}:${quickHash(searchTerms.join("|"))}`;
      let competitorData = await cache.get(cacheKeyComp2);
      if (!competitorData) {
        competitorData = await collectCompetitorData(searchTerms, shop);
        await cache.set(cacheKeyComp2, competitorData, TTL.KEYWORD_DATA); // 12h
      }

      // Step 2: Claude designs the campaign (cache the strategy)
      const cacheKeyStrat = `ai:strategy:${shop}:${quickHash(goal + JSON.stringify(products.map(p => p.title)))}`;
      let campaign = await cache.get(cacheKeyStrat);
      if (!campaign) {
        campaign = await buildCampaignStrategy({
          products,
          competitorData: competitorData as any,
          goal,
          storeInfo: { domain: shop, category },
        });
        await cache.set(cacheKeyStrat, campaign, TTL.KEYWORD_DATA); // 12h
      }

      return Response.json({
        success: true,
        campaign,
        competitorData: {
          count: (competitorData as any).competitorCount,
          bigPlayers: (competitorData as any).bigPlayers,
          trends: (competitorData as any).trends,
          ads: (competitorData as any).ads?.slice(0, 5),
          shopping: (competitorData as any).shopping?.slice(0, 5),
        },
      });
    }

    // ══════════════════════════════════════════
    // DAILY ADVICE — "What should I do today?"
    // ══════════════════════════════════════════
    if (actionType === "daily-advice") {
      const category = (formData.get("category") as string) || "bedding";
      const campaignsJson = (formData.get("campaigns") as string) || "[]";
      const campaigns = JSON.parse(campaignsJson);

      // Get fresh competitor snapshot
      const searchTerms = ["buy " + category, "best " + category];
      const cacheKeyComp3 = `ai:comp:${shop}:${quickHash(searchTerms.join("|"))}`;
      let competitorData = await cache.get(cacheKeyComp3);
      if (!competitorData) {
        competitorData = await collectCompetitorData(searchTerms, shop);
        await cache.set(cacheKeyComp3, competitorData, TTL.KEYWORD_DATA); // 12h
      }

      // Cache daily advice for 4 hours
      const cacheKeyAdvice = `ai:advice:${shop}:${new Date().toISOString().slice(0, 13)}`;
      let advice = await cache.get(cacheKeyAdvice);
      if (!advice) {
        advice = await getDailyAdvice({
          campaigns,
          competitorData: competitorData as any,
          storeInfo: { domain: shop, category },
        });
        await cache.set(cacheKeyAdvice, advice, 4 * 3600); // 4h
      }

      return Response.json({ success: true, advice });
    }

    // ══════════════════════════════════════════
    // IMPROVE COPY — "Make this headline better"
    // ══════════════════════════════════════════
    if (actionType === "improve-copy") {
      const license = await checkLicense(shop, "ai-improve");
      if (!license.allowed) {
        return Response.json({ success: false, error: license.reason }, { status: 403 });
      }

      const text = (formData.get("text") as string);
      const type = ((formData.get("type") as string) || "headline") as "headline" | "description";
      const productTitle = (formData.get("productTitle") as string) || "";
      const competitorAdsJson = (formData.get("competitorAds") as string) || "[]";
      const competitorAds = JSON.parse(competitorAdsJson);

      const improved = await improveAdCopy({
        text,
        type,
        productTitle,
        competitorAds,
      });

      if (!improved) {
        return Response.json({ success: false, error: "AI could not improve this text" }, { status: 500 });
      }

      return Response.json({ success: true, improved });
    }

    // ══════════════════════════════════════════
    // COMPETITOR SNAPSHOT — just the raw data
    // ══════════════════════════════════════════
    if (actionType === "competitor-snapshot") {
      const keywords = JSON.parse((formData.get("keywords") as string) || "[]");
      const searchTerms = keywords.map(k => typeof k === "string" ? k : k.text || "").filter(Boolean);

      if (searchTerms.length === 0) {
        return Response.json({ success: false, error: "No keywords provided" }, { status: 400 });
      }

      const cacheKeySnap = `ai:comp:${shop}:${quickHash(searchTerms.join("|"))}`;
      let competitorData = await cache.get(cacheKeySnap);
      if (!competitorData) {
        competitorData = await collectCompetitorData(searchTerms, shop);
        await cache.set(cacheKeySnap, competitorData, TTL.KEYWORD_DATA); // 12h
      }
      return Response.json({ success: true, data: competitorData });
    }

    return Response.json({ success: false, error: "Unknown action type" }, { status: 400 });

  } catch (err: unknown) {
    logger.error("ai-engine.action", "AI Engine error", { shop, error: (err as Error).message });
    return Response.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
};


// ── Middleware wrappers (Session 56) ──
export const action = withSentryMonitoring("api.ai-engine", withRequestLogging("api.ai-engine", _action));
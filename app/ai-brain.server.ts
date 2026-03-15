// app/ai-brain.server.ts
// ═══════════════════════════════════════════════════════════════
// Smart Ads AI — The Brain
// This is the core intelligence engine. Claude receives REAL data
// from Serper.dev, SerpAPI (fallback), Google Ads API, and Shopify
// — and makes decisions like a senior ad agency campaign manager.
//
// SEARCH PRIORITY:
//   1. Serper.dev (SERPER_API_KEY) — 2,500 free searches
//   2. SerpAPI (SERPAPI_KEY) — fallback if Serper unavailable
//
// RULE: Claude never invents numbers. Every metric shown to the
// user must come from a real source. If data is missing, say so.
// ═══════════════════════════════════════════════════════════════

import Anthropic from "@anthropic-ai/sdk";
import { isCostLimitReached, recordCost } from "./utils/api-cost-tracker.js";
import { withRetry } from "./retry.server";
import { logPrompt } from "./utils/prompt-logger.server.js";
import { sanitizeForPrompt, safeParseAiJson } from "./utils/ai-safety.server.js";
import prisma from "./db.server.js";
import { logger } from "./utils/logger.js";
import { getCampaignPerformanceByDate, listSmartAdsCampaigns } from "./google-ads.server.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Cost guard helper
function checkCostLimits(options?: { requireSearch?: boolean }): void {
  if (isCostLimitReached("anthropic")) {
    throw new Error("Daily AI processing limit reached. Try again tomorrow.");
  }
  if (options?.requireSearch !== false && isCostLimitReached("serper")) {
    throw new Error("Daily search limit reached. Try again tomorrow.");
  }
}
const SERPER_KEY: string = process.env.SERPER_API_KEY || "";
const SERP_KEY: string = process.env.SERPAPI_KEY || "";

function getCalendarWeekBounds(): { weekStart: Date; weekEnd: Date } {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const mondayOffset = day === 0 ? 6 : day - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - mondayOffset);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  return { weekStart, weekEnd };
}

// ─────────────────────────────────────────────
// DATA COLLECTION — Layer 1: Get real data
// ─────────────────────────────────────────────

interface SearchResult {
  source: string;
  data: Record<string, any>;
}

interface AdEntry {
  keyword: string;
  title: string;
  domain: string;
  description: string;
  position: number;
  sitelinks: any[];
}

interface OrganicEntry {
  keyword: string;
  position: number;
  title: string;
  domain: string;
  snippet: string;
}

interface ShoppingEntry {
  keyword: string;
  title: string;
  price: string;
  source: string;
  rating: number | null;
  reviews: number | null;
}

interface StoreRanking {
  keyword: string;
  position: number | null;
  found: boolean;
}

interface ParsedResults {
  ads: AdEntry[];
  organic: OrganicEntry[];
  shopping: ShoppingEntry[];
  storeRanking: StoreRanking | null;
}

interface CompetitorData {
  ads: AdEntry[];
  organic: OrganicEntry[];
  shopping: ShoppingEntry[];
  trends: TrendData | null;
  storeRankings?: StoreRanking[];
  competitorCount: number;
  bigPlayerCount?: number;
  bigPlayers?: string[];
  searchSource: string;
}

interface TrendData {
  keywords: string;
  recentInterest: number;
  previousInterest: number;
  changePercent: number;
  direction: string;
}

interface StoreInfo {
  domain?: string;
  category?: string;
  size?: string;
  regions?: string[];
  [key: string]: any;
}

interface Product {
  title: string;
  price: string;
  description?: string;
  [key: string]: any;
}

interface SeasonalContext {
  month?: number;
  holidays?: Array<{ name: string; daysUntil: number; impact: string }>;
  seasonal?: string;
}

interface AnalyzeMarketInput {
  competitorData: CompetitorData;
  products: Product[];
  storeInfo: StoreInfo;
  seasonalContext: SeasonalContext;
  storeContext?: string;
}

interface BuildCampaignInput {
  products: Product[];
  competitorData: CompetitorData;
  goal?: string;
  storeInfo: StoreInfo;
  storeContext?: string;
}

interface Campaign {
  name: string;
  status: string;
  cost?: number;
  clicks?: number;
  conversions?: number;
  roas?: string | number;
  avgCpc?: string | number;
  [key: string]: any;
}

interface DailyAdviceInput {
  campaigns: Campaign[];
  competitorData: CompetitorData;
  storeInfo: StoreInfo;
  storeContext?: string;
  keywordDetails?: Array<{ text: string; clicks: number; cost: number; conversions: number; qualityScore: number | null }>;
  wastefulSearchTerms?: Array<{ term: string; clicks: number; cost: number }>;
  profitMargin?: number | null;
  competitorTrends?: Array<{ domain: string; spendChange: number; priceChange: number; isNew: boolean }>;
}

interface ImproveAdCopyInput {
  text: string;
  type: "headline" | "description";
  productTitle: string;
  competitorAds?: AdEntry[];
  storeContext?: string;
}

/**
 * Search via Serper.dev (primary) or SerpAPI (fallback)
 * Serper returns: organic, ads (peopleAlsoAsk, knowledgeGraph, shopping)
 * Returns unified format regardless of source
 */
async function searchWithSerper(keyword: string): Promise<SearchResult | null> {
  if (!SERPER_KEY) return null;
  try {
    // Fetch organic + ads from /search
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": SERPER_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: keyword,
        gl: "us",
        hl: "en",
        num: 20,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.warn("[AI-Brain] Serper HTTP error:", res.status);
      return null;
    }
    const data: Record<string, any> = await res.json();

    // Fetch shopping from separate endpoint
    try {
      const shopRes = await fetch("https://google.serper.dev/shopping", {
        method: "POST",
        headers: {
          "X-API-KEY": SERPER_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: keyword,
          gl: "us",
          num: 5,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (shopRes.ok) {
        const shopData = await shopRes.json();
        data.shopping = shopData.shopping || [];
      }
    } catch (shopErr: any) {
      console.warn("[AI-Brain] Serper shopping failed:", shopErr.message);
    }

    return { source: "serper", data };
  } catch (err: any) {
    console.warn("[AI-Brain] Serper failed:", err.message);
    return null;
  }
}

async function searchWithSerpAPI(keyword: string): Promise<SearchResult | null> {
  if (!SERP_KEY) return null;
  try {
    const url = `https://serpapi.com/search.json?q=${encodeURIComponent(keyword)}&api_key=${SERP_KEY}&num=20&hl=en&gl=us`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json();
    return { source: "serpapi", data };
  } catch (err: any) {
    console.warn("[AI-Brain] SerpAPI failed:", err.message);
    return null;
  }
}

/**
 * Parse Serper.dev results into our unified format
 */
function parseSerperResults(data: Record<string, any>, keyword: string, storeDomain?: string): ParsedResults {
  const ads: AdEntry[] = [];
  const organic: OrganicEntry[] = [];
  const shopping: ShoppingEntry[] = [];
  let storeRanking: StoreRanking | null = null;

  // Paid ads
  if (data.ads) {
    for (const ad of data.ads) {
      ads.push({
        keyword,
        title: ad.title || "",
        domain: ad.link ? new URL(ad.link).hostname.replace("www.", "") : "",
        description: ad.description || "",
        position: ad.position || 0,
        sitelinks: ad.sitelinks || [],
      });
    }
  }

  // Organic results
  if (data.organic) {
    for (const r of data.organic.slice(0, 10)) {
      const domain = r.link ? new URL(r.link).hostname.replace("www.", "") : "";
      organic.push({
        keyword,
        position: r.position || 0,
        title: r.title || "",
        domain,
        snippet: r.snippet || "",
      });
    }

    // Check store ranking
    if (storeDomain) {
      const cleanDomain = storeDomain.replace(/https?:\/\//, "").replace(/\/$/, "").toLowerCase();
      const found = data.organic.find((r: any) =>
        r.link?.toLowerCase().includes(cleanDomain)
      );
      storeRanking = {
        keyword,
        position: found?.position || null,
        found: !!found,
      };
    }
  }

  // Shopping results
  if (data.shopping) {
    for (const s of data.shopping.slice(0, 5)) {
      shopping.push({
        keyword,
        title: s.title || "",
        price: s.price || "",
        source: s.source || "",
        rating: s.rating || null,
        reviews: s.reviews || null,
      });
    }
  }

  return { ads, organic, shopping, storeRanking };
}

/**
 * Parse SerpAPI results into our unified format (legacy)
 */
function parseSerpAPIResults(data: Record<string, any>, keyword: string, storeDomain?: string): ParsedResults {
  const ads: AdEntry[] = [];
  const organic: OrganicEntry[] = [];
  const shopping: ShoppingEntry[] = [];
  let storeRanking: StoreRanking | null = null;

  if (data.ads) {
    for (const ad of data.ads) {
      ads.push({
        keyword,
        title: ad.title || "",
        domain: ad.displayed_link?.replace(/https?:\/\//, "").split("/")[0] || "",
        description: ad.description || "",
        position: ad.position || 0,
        sitelinks: ad.sitelinks || [],
      });
    }
  }

  if (data.organic_results) {
    for (const r of data.organic_results.slice(0, 10)) {
      organic.push({
        keyword,
        position: r.position,
        title: r.title,
        domain: r.displayed_link?.replace(/https?:\/\//, "").split("/")[0] || "",
        snippet: r.snippet || "",
      });
    }

    if (storeDomain) {
      const cleanDomain = storeDomain.replace(/https?:\/\//, "").replace(/\/$/, "").toLowerCase();
      const found = data.organic_results.find((r: any) =>
        r.displayed_link?.toLowerCase().includes(cleanDomain) ||
        r.link?.toLowerCase().includes(cleanDomain)
      );
      storeRanking = {
        keyword,
        position: found?.position || null,
        found: !!found,
      };
    }
  }

  if (data.shopping_results) {
    for (const s of data.shopping_results.slice(0, 5)) {
      shopping.push({
        keyword,
        title: s.title || "",
        price: s.price || "",
        source: s.source || "",
        rating: s.rating || null,
        reviews: s.reviews || null,
      });
    }
  }

  return { ads, organic, shopping, storeRanking };
}

/**
 * collectCompetitorData — Main search function
 * Priority: Serper.dev > SerpAPI > empty
 */
export async function collectCompetitorData(keywords: string[], storeDomain?: string): Promise<CompetitorData> {
  if (!SERPER_KEY && !SERP_KEY) {
    console.warn("[AI-Brain] No search API keys available (SERPER_API_KEY or SERPAPI_KEY)");
    return { ads: [], organic: [], shopping: [], trends: null, competitorCount: 0, searchSource: "none" };
  }

  const allAds: AdEntry[] = [];
  const allOrganic: OrganicEntry[] = [];
  const allShopping: ShoppingEntry[] = [];
  const storeRankings: StoreRanking[] = [];
  let searchSource = "unknown";

  // Search top keywords (max 3 to save API calls)
  for (const kw of keywords.slice(0, 3)) {
    // Try Serper first, fall back to SerpAPI
    let result = await searchWithSerper(kw);
    let parsed: ParsedResults;

    if (result) {
      searchSource = "serper.dev";
      parsed = parseSerperResults(result.data, kw, storeDomain);
    } else {
      result = await searchWithSerpAPI(kw);
      if (result) {
        searchSource = "serpapi";
        parsed = parseSerpAPIResults(result.data, kw, storeDomain);
      } else {
        console.warn(`[AI-Brain] All search APIs failed for "${kw}"`);
        continue;
      }
    }

    allAds.push(...parsed.ads);
    allOrganic.push(...parsed.organic);
    allShopping.push(...parsed.shopping);
    if (parsed.storeRanking) storeRankings.push(parsed.storeRanking);
  }

  // Google Trends via SerpAPI (only if SerpAPI key exists — Serper doesn't have trends)
  let trends: TrendData | null = null;
  if (SERP_KEY) {
    try {
      const trendQuery = keywords.slice(0, 3).join(",");
      const trendUrl = `https://serpapi.com/search.json?engine=google_trends&q=${encodeURIComponent(trendQuery)}&geo=US&date=today 3-m&api_key=${SERP_KEY}`;
      const trendRes = await fetch(trendUrl, { signal: AbortSignal.timeout(10000) });
      if (trendRes.ok) {
        const trendData = await trendRes.json();
        const timeline: any[] = trendData.interest_over_time?.timeline_data || [];
        if (timeline.length > 4) {
          const recent = timeline.slice(-4);
          const older = timeline.slice(-8, -4);
          const recentAvg = recent.reduce((s: number, t: any) => s + (t.values?.[0]?.extracted_value || 0), 0) / recent.length;
          const olderAvg = older.reduce((s: number, t: any) => s + (t.values?.[0]?.extracted_value || 0), 0) / Math.max(older.length, 1);
          const change = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg * 100) : 0;
          trends = {
            keywords: trendQuery,
            recentInterest: Math.round(recentAvg),
            previousInterest: Math.round(olderAvg),
            changePercent: parseFloat(change.toFixed(1)),
            direction: change > 10 ? "rising" : change < -10 ? "falling" : "stable",
          };
        }
      }
    } catch (err: any) {
      console.warn("[AI-Brain] Trends failed:", err.message);
    }
  } else {
    console.log("[AI-Brain] No SERPAPI_KEY — skipping Google Trends (Serper doesn't support trends)");
  }

  // Deduplicate competitor domains
  const uniqueDomains = new Set<string>();
  const uniqueAds = allAds.filter(a => {
    if (uniqueDomains.has(a.domain)) return false;
    uniqueDomains.add(a.domain);
    return true;
  });

  // Count big players
  const bigPlayers = ["amazon", "walmart", "wayfair", "target", "bedbathandbeyond", "overstock", "macys", "pottery barn", "ikea", "costco"];
  const bigCompetitors = uniqueAds.filter(a => bigPlayers.some(bp => a.domain.toLowerCase().includes(bp)));

  console.log(`[AI-Brain] Search complete via ${searchSource}: ${allOrganic.length} organic, ${uniqueAds.length} ads, ${allShopping.length} shopping`);

  return {
    ads: uniqueAds.slice(0, 10),
    organic: allOrganic,
    shopping: allShopping.slice(0, 10),
    trends,
    storeRankings,
    competitorCount: uniqueAds.length,
    bigPlayerCount: bigCompetitors.length,
    bigPlayers: bigCompetitors.map(a => a.domain),
    searchSource,
  };
}

/**
 * Collect Shopify store data
 */
export async function collectShopifyData(session: any): Promise<Record<string, any>> {
  // This will be called with the authenticated session
  // For now returns what we know from products in DB
  return {
    // Will be enriched when we connect to Shopify orders API
    source: "shopify",
  };
}

// ─────────────────────────────────────────────
// THE BRAIN — Layer 2: Claude makes decisions
// ─────────────────────────────────────────────

/**
 * MARKET ANALYSIS — "Should I advertise right now?"
 * Claude looks at real competition data and trends,
 * and gives a professional recommendation.
 */
export async function analyzeMarket(data: AnalyzeMarketInput): Promise<Record<string, any>> {
  const {
    competitorData,  // from collectCompetitorData
    products,        // store products with prices
    storeInfo,       // { domain, category, size }
    seasonalContext,  // { month, holidays, seasonal }
    storeContext,     // business context (margins, audience, positioning)
  } = data;

  const contextBlock = storeContext ? `${storeContext}\n\nUse the store context above to tailor budget recommendations (consider profit margins), keyword strategy (consider audience), and risk assessment.\n\n` : "";

  const prompt = `${contextBlock}You are a senior Google Ads campaign manager at a top advertising agency. You have 15 years of experience managing campaigns for small e-commerce businesses competing against big retailers.

Your client is a SMALL online store. This is critical — they don't have Amazon's budget. Your job is to find smart opportunities where they can win, and warn them when they'll waste money.

═══ REAL DATA FROM GOOGLE (not estimates) ═══

STORE INFO:
- Domain: ${storeInfo?.domain || "unknown"}
- Category: ${storeInfo?.category || "home textiles / bedding"}
- Products: ${products?.length || 0} products
- Average price: $${products?.length ? (products.reduce((a: number, p: Product) => a + parseFloat(p.price || "0"), 0) / products.length).toFixed(2) : "N/A"}
- Price range: $${products?.length ? Math.min(...products.map(p => parseFloat(p.price || "999"))).toFixed(0) : "?"} - $${products?.length ? Math.max(...products.map(p => parseFloat(p.price || "0"))).toFixed(0) : "?"}

COMPETITOR ADS RUNNING RIGHT NOW (from Google search results):
${competitorData?.ads?.length > 0
    ? competitorData.ads.slice(0, 6).map(a => `- ${a.domain}: "${a.title}" [keyword: ${a.keyword}]`).join("\n")
    : "No competitor ads found (low competition or no data)"}

Number of advertisers: ${competitorData?.competitorCount || 0}
Big players detected: ${competitorData?.bigPlayerCount || 0} (${competitorData?.bigPlayers?.join(", ") || "none"})

COMPETITOR SHOPPING PRICES:
${competitorData?.shopping?.length > 0
    ? competitorData.shopping.slice(0, 5).map(s => `- ${s.source}: "${s.title}" — ${s.price}${s.rating ? ` (${s.rating}\u2605, ${s.reviews} reviews)` : ""}`).join("\n")
    : "No shopping data"}

STORE GOOGLE RANKINGS:
${(competitorData?.storeRankings?.length ?? 0) > 0
    ? competitorData!.storeRankings!.map(r => `- "${r.keyword}": ${r.found ? `#${r.position}` : "NOT in top 20"}`).join("\n")
    : "No ranking data"}

GOOGLE TRENDS (last 3 months):
${competitorData?.trends
    ? `Interest: ${competitorData.trends.recentInterest}/100 | Direction: ${competitorData.trends.direction} (${competitorData.trends.changePercent > 0 ? "+" : ""}${competitorData.trends.changePercent}%)`
    : "No trend data available"}

CURRENT DATE: ${new Date().toISOString().slice(0, 10)}
MONTH: ${seasonalContext?.month || new Date().getMonth() + 1}
UPCOMING HOLIDAYS: ${(seasonalContext?.holidays?.length ?? 0) > 0
    ? seasonalContext!.holidays!.map(h => `${h.name} in ${h.daysUntil} days (${h.impact} impact)`).join(", ")
    : "None in next 30 days"}

═══ YOUR ANALYSIS ═══

Think step by step:
1. How competitive is this market RIGHT NOW based on the actual ad data?
2. Can a small store compete, or will they get crushed by big players?
3. Are trends going up or down? Is demand growing?
4. Any upcoming holidays — but remember: holidays can HURT small stores because big players increase budgets 10x.
5. What specific keywords could this store win on? (long-tail, niche)

Return ONLY valid JSON:
{
  "market_signal": "green" | "yellow" | "red",
  "signal_reason": "One clear sentence why",
  "competition_level": "low" | "moderate" | "high" | "extreme",
  "competition_detail": "Who exactly is competing and how strong they are",
  "big_player_threat": "none" | "low" | "medium" | "high",
  "big_player_advice": "Specific advice about competing with big retailers",
  "trend_analysis": "What the Google Trends data tells us",
  "seasonal_advice": "Specific seasonal recommendation — NOT generic 'peak season' but actual impact on CPCs and competition",
  "budget_recommendation": {
    "daily_min": 10,
    "daily_recommended": 25,
    "daily_max": 50,
    "reasoning": "Why these specific numbers based on the CPC data"
  },
  "keyword_strategy": {
    "avoid": ["keywords too competitive for a small store"],
    "target": ["keywords where you can actually win"],
    "reasoning": "Why these keywords based on actual competition data"
  },
  "action_items": [
    "Specific thing to do right now #1",
    "Specific thing to do right now #2",
    "Specific thing to do right now #3"
  ],
  "risk_alerts": ["Any warnings based on the data"],
  "opportunity_score": 1-100,
  "confidence": 1-100,
  "data_sources_used": ["list which real data points informed this analysis"]
}

CRITICAL RULES:
- Every recommendation must be traceable to real data above
- If you don't have data for something, say "insufficient data" — don't guess
- Small store perspective: $30/day is a big budget for them
- Be honest: if the market is too competitive, say so
- Specific > generic: "Target 'organic cotton duvet cover queen' at $0.90 CPC" beats "use long-tail keywords"`;

  const startMs = Date.now();
  try {
    const response = await withRetry(
      () => client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
      { label: "AI-Brain:market" }
    );

    logPrompt({ shop: storeInfo?.domain || "unknown", action: "market_intel", model: "claude-sonnet-4-20250514", promptTokens: response.usage?.input_tokens || 0, outputTokens: response.usage?.output_tokens || 0, durationMs: Date.now() - startMs, success: true, metadata: { productsCount: products?.length || 0 } });

    const text = (response as any).content[0].text.trim();
    const { data, error: parseError } = safeParseAiJson(text);
    if (!data) throw new Error(`AI response parse failed: ${parseError}`);
    return data;
  } catch (err: any) {
    logPrompt({ shop: storeInfo?.domain || "unknown", action: "market_intel", model: "claude-sonnet-4-20250514", durationMs: Date.now() - startMs, success: false, error: err.message });
    console.error("[AI-Brain] Market analysis failed:", err.message);
    return {
      market_signal: "yellow",
      signal_reason: "Analysis temporarily unavailable",
      competition_level: "unknown",
      competition_detail: "Could not analyze — try again later",
      action_items: ["Refresh analysis when available"],
      confidence: 0,
      data_sources_used: [],
    };
  }
}

/**
 * CAMPAIGN BUILDER — "How should I build this campaign?"
 * Claude designs the campaign based on real market data.
 */
export async function buildCampaignStrategy(data: BuildCampaignInput): Promise<Record<string, any> | null> {
  const {
    products,        // selected products for the campaign
    competitorData,  // from collectCompetitorData
    goal,            // "sales" | "traffic" | "leads"
    storeInfo,
    storeContext,     // business context
  } = data;

  const contextBlock = storeContext ? `${storeContext}\n\nUse the store context above to tailor campaign messaging to the brand positioning and target audience.\n\n` : "";

  const productList = products.slice(0, 5).map(p =>
    `- "${p.title}" — $${p.price}${p.description ? ` — ${p.description.slice(0, 80)}` : ""}`
  ).join("\n");

  const competitorPrices = competitorData?.shopping?.slice(0, 5).map(s =>
    `- ${s.source}: ${s.price} for "${s.title?.slice(0, 50)}"`
  ).join("\n") || "No competitor pricing data";

  const prompt = `${contextBlock}You are building a Google Ads campaign for a small e-commerce store. You have real market data. Design the optimal campaign.

═══ REAL DATA ═══

PRODUCTS TO ADVERTISE:
${productList}

GOAL: ${goal || "sales"}

COMPETITORS CURRENTLY ADVERTISING:
${competitorData?.ads?.slice(0, 5).map(a => `- ${a.domain}: "${a.title}" — "${a.description?.slice(0, 60) || ""}" [on keyword: ${a.keyword}]`).join("\n") || "None found"}

COMPETITOR PRICES (from Google Shopping):
${competitorPrices}

OUR STORE RANKINGS:
${competitorData?.storeRankings?.map(r => `- "${r.keyword}": ${r.found ? `#${r.position}` : "NOT ranked"}`).join("\n") || "No ranking data"}

COMPETITION LEVEL: ${competitorData?.competitorCount || 0} advertisers, ${competitorData?.bigPlayerCount || 0} big players

DEMAND TREND: ${competitorData?.trends ? `${competitorData.trends.direction} (${competitorData.trends.changePercent > 0 ? "+" : ""}${competitorData.trends.changePercent}%)` : "unknown"}

═══ BUILD THE CAMPAIGN ═══

Think like a pro:
1. What keywords to target — based on competition level for each
2. What headlines will beat the competitor ads you see above
3. What descriptions highlight advantages over competitors
4. What budget makes sense given the CPCs in this market
5. How to position against big players (price? quality? niche? service?)

Return ONLY valid JSON:
{
  "strategy": {
    "approach": "aggressive" | "moderate" | "niche-focused" | "defensive",
    "reasoning": "Why this approach based on the data",
    "positioning": "How to position against competitors (e.g., 'premium quality at mid-range price' or 'niche specialist vs generalists')"
  },
  "keywords": [
    {
      "text": "keyword",
      "match_type": "BROAD" | "PHRASE" | "EXACT",
      "priority": "high" | "medium" | "low",
      "est_cpc_range": "$0.50-$1.20",
      "reasoning": "Why this keyword — based on competition data"
    }
  ],
  "negative_keywords": ["keywords to exclude and why"],
  "headlines": [
    "15 headlines max 30 chars — designed to beat the competitor ads above"
  ],
  "long_headlines": [
    "3 long headlines max 90 chars"
  ],
  "descriptions": [
    "4 descriptions max 90 chars — highlight advantages vs competitors"
  ],
  "budget": {
    "daily_recommended": 25,
    "reasoning": "Based on CPC data and competition level"
  },
  "sitelinks": [
    {"title": "max 25 chars", "description": "max 35 chars", "url": "/page"}
  ],
  "expected_results": {
    "monthly_impressions": "range",
    "monthly_clicks": "range",
    "estimated_cpc": "$X.XX",
    "confidence": "how confident based on available data"
  },
  "warnings": ["Honest warnings about this campaign"],
  "quick_wins": ["Immediate improvements to make"]
}

RULES:
- headlines: EXACTLY 15, each max 30 chars. Must BEAT competitor ads above.
- descriptions: EXACTLY 4, each max 90 chars.
- keywords: 10-15, with real CPC estimates based on competition data.
- sitelinks: EXACTLY 4.
- If competitor prices are lower, don't compete on price — compete on quality/service/niche.
- Be honest about expected results. Don't overpromise.`;

  const startMs = Date.now();
  try {
    const response = await withRetry(
      () => client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 3000,
        messages: [{ role: "user", content: prompt }],
      }),
      { label: "AI-Brain:campaign" }
    );

    logPrompt({ shop: storeInfo?.domain || "unknown", action: "campaign_builder", model: "claude-sonnet-4-20250514", promptTokens: response.usage?.input_tokens || 0, outputTokens: response.usage?.output_tokens || 0, durationMs: Date.now() - startMs, success: true, metadata: { goal, productsCount: products?.length || 0 } });

    const text = (response as any).content[0].text.trim();
    const { data: result, error: parseError } = safeParseAiJson<any>(text);
    if (!result) throw new Error(`AI response parse failed: ${parseError}`);

    // Enforce character limits
    if (result.headlines) result.headlines = result.headlines.map((h: string) => h.slice(0, 30));
    if (result.long_headlines) result.long_headlines = result.long_headlines.map((h: string) => h.slice(0, 90));
    if (result.descriptions) result.descriptions = result.descriptions.map((d: string) => d.slice(0, 90));
    if (result.sitelinks) result.sitelinks.forEach((sl: any) => {
      sl.title = (sl.title || "").slice(0, 25);
      sl.description = (sl.description || "").slice(0, 35);
    });

    return result;
  } catch (err: any) {
    logPrompt({ shop: storeInfo?.domain || "unknown", action: "campaign_builder", model: "claude-sonnet-4-20250514", durationMs: Date.now() - startMs, success: false, error: err.message });
    console.error("[AI-Brain] Campaign build failed:", err.message);
    return null;
  }
}

/**
 * DAILY ADVISOR — "What should I do today?"
 * Claude reviews campaign performance and gives daily action items.
 */
export async function getDailyAdvice(data: DailyAdviceInput): Promise<Record<string, any>> {
  const {
    campaigns,        // live campaign data from Google Ads
    competitorData,   // fresh competitor check
    storeInfo,
    storeContext,      // business context
    keywordDetails,
    wastefulSearchTerms,
    profitMargin,
    competitorTrends,
  } = data;

  const contextBlock = storeContext ? `${storeContext}\n\nUse the store context to frame your advice — consider profit margins when evaluating ROAS, and business goals when prioritizing actions.\n\n` : "";

  const campaignSummary = (campaigns || []).slice(0, 5).map(c =>
    `- "${c.name}" | Status: ${c.status} | Spend: $${c.cost || 0} | Clicks: ${c.clicks || 0} | Conversions: ${c.conversions || 0} | ROAS: ${c.roas || "N/A"}x | CPC: $${c.avgCpc || "N/A"}`
  ).join("\n") || "No active campaigns";

  // Keyword-level details
  const keywordBlock = keywordDetails && keywordDetails.length > 0
    ? `\nTOP KEYWORDS BY SPEND:\n${keywordDetails.slice(0, 10).map(kw =>
        `- "${kw.text}": $${kw.cost.toFixed(0)} spent, ${kw.clicks} clicks, ${kw.conversions} sales${kw.qualityScore ? `, Quality ${kw.qualityScore}/10` : ""}`
      ).join("\n")}`
    : "";

  // Wasteful search terms
  const wasteBlock = wastefulSearchTerms && wastefulSearchTerms.length > 0
    ? `\nWASTEFUL SEARCH TERMS (people searched this but didn't buy):\n${wastefulSearchTerms.slice(0, 10).map(st =>
        `- "${st.term}": $${st.cost.toFixed(0)} wasted, ${st.clicks} clicks, 0 sales`
      ).join("\n")}`
    : "";

  // Profit margin context
  const marginBlock = profitMargin
    ? `\nPROFIT MARGIN: ${profitMargin}%. Minimum ROAS to make money: ${(100 / profitMargin * 1.2).toFixed(1)}x`
    : "";

  // Competitor changes
  const competitorBlock = competitorTrends && competitorTrends.length > 0
    ? `\nCOMPETITOR CHANGES:\n${competitorTrends.slice(0, 5).map(t => {
        const parts: string[] = [t.domain];
        if (t.isNew) parts.push("NEW competitor!");
        if (t.spendChange) parts.push(`spend ${t.spendChange > 0 ? "+" : ""}${t.spendChange}%`);
        if (t.priceChange) parts.push(`price ${t.priceChange > 0 ? "+" : ""}${t.priceChange}%`);
        return `- ${parts.join(" | ")}`;
      }).join("\n")}`
    : "";

  const prompt = `${contextBlock}You are reviewing today's campaign performance for a small e-commerce store. Give a brief, actionable daily briefing.

IMPORTANT: Write in simple terms that any store owner understands. No jargon like "ROAS", "CTR", "CPC", "impressions". Instead say "return on ad spend", "click rate", "cost per click", "how many people saw the ad".

═══ TODAY'S DATA ═══

CAMPAIGN PERFORMANCE:
${campaignSummary}
${keywordBlock}
${wasteBlock}
${marginBlock}

COMPETITOR ACTIVITY:
${competitorData?.ads?.length || 0} competitors advertising
${competitorData?.bigPlayerCount || 0} big players active
Trend: ${competitorData?.trends?.direction || "unknown"}
${competitorBlock}

═══ DAILY BRIEFING ═══

Return ONLY valid JSON:
{
  "today_summary": "One sentence — the most important thing to know, in simple Hebrew",
  "performance_grade": "A" | "B" | "C" | "D" | "F",
  "grade_reason": "Why this grade, in simple terms",
  "ai_actions_taken": [
    {"action": "What AI did", "reason": "Why", "impact": "Expected result"}
  ],
  "recommended_actions": [
    {"action": "What the user should do", "urgency": "now" | "today" | "this_week", "reason": "Why"}
  ],
  "alerts": [
    {"type": "warning" | "opportunity" | "milestone", "message": "Short alert in simple Hebrew"}
  ],
  "competitor_update": "One sentence about competitor changes, or null",
  "negative_keyword_suggestions": ["search terms to block"],
  "profit_analysis": {
    "total_spend": 0,
    "estimated_profit_or_loss": 0,
    "verdict": "making money" | "losing money" | "breaking even"
  }
}

Rules:
- Maximum 3 AI actions, 3 recommended actions, 3 alerts
- EVERY recommendation MUST include specific keyword/campaign name and exact dollar amounts
- FORBIDDEN: Generic advice like "review underperforming keywords". REQUIRED: "Keyword 'luxury bedding set' — $45 spent, 0 sales in 30 days — stop it"
- Milestones matter: "First sale from ads!" is important for small store owners
- If campaigns lose money, be honest but explain in simple terms: "You spent $50 on ads but only made $30 in sales"
- Use the profit margin to calculate if the store is actually making money, not just getting sales`;

  const startMs = Date.now();
  try {
    const response = await withRetry(
      () => client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
      { label: "AI-Brain:daily" }
    );

    logPrompt({ shop: storeInfo?.domain || "unknown", action: "daily_advice", model: "claude-haiku-4-5-20251001", promptTokens: response.usage?.input_tokens || 0, outputTokens: response.usage?.output_tokens || 0, durationMs: Date.now() - startMs, success: true });

    const text = (response as any).content[0].text.trim();
    const { data, error: parseError } = safeParseAiJson(text);
    if (!data) throw new Error(`AI response parse failed: ${parseError}`);
    return data;
  } catch (err: any) {
    logPrompt({ shop: storeInfo?.domain || "unknown", action: "daily_advice", model: "claude-haiku-4-5-20251001", durationMs: Date.now() - startMs, success: false, error: err.message });
    console.error("[AI-Brain] Daily advice failed:", err.message);
    return {
      today_summary: "Analysis temporarily unavailable",
      performance_grade: "?",
      ai_actions_taken: [],
      recommended_actions: [],
      alerts: [],
    };
  }
}

/**
 * REVENUE PREDICTION ENGINE — "What happens if I increase budget?"
 * Uses 30 days of real performance data to forecast revenue at different spend levels.
 */

interface PredictionPoint {
  dailyBudget: number;
  estimatedConversions: number;
  estimatedRevenue: number;
  estimatedProfit: number;
  marginalRoas: number;
}

interface RevenuePrediction {
  currentState: { dailyBudget: number; estimatedDailyRevenue: number; estimatedDailyProfit: number };
  predictions: PredictionPoint[];
  optimalBudget: number;
  breakEvenBudget: number;
  diminishingReturnsStart: number;
  confidence: number;
  hebrewSummary: string;
}

export async function predictRevenue(
  dailyData: Array<{ cost: number; conversions: number; conversionValue: number }>,
  currentDailyBudget: number,
  profitMargin: number | null,
  avgOrderValue: number | null,
): Promise<RevenuePrediction> {
  const margin = profitMargin || 30; // Default 30% if unknown
  const minRoas = (100 / margin) * 1.2;

  // Filter days with actual spend
  const validDays = dailyData.filter((d) => d.cost > 0);
  if (validDays.length < 7) {
    return {
      currentState: { dailyBudget: currentDailyBudget, estimatedDailyRevenue: 0, estimatedDailyProfit: 0 },
      predictions: [],
      optimalBudget: currentDailyBudget,
      breakEvenBudget: currentDailyBudget,
      diminishingReturnsStart: currentDailyBudget,
      confidence: 10,
      hebrewSummary: "אין מספיק נתונים לתחזית — צריך לפחות שבוע של נתונים.",
    };
  }

  // Logarithmic regression: revenue = a * ln(spend + 1) + b
  // Transform: x = ln(spend + 1), y = revenue
  const xs = validDays.map((d) => Math.log(d.cost + 1));
  const ys = validDays.map((d) => d.conversionValue);
  const n = xs.length;

  const sumX = xs.reduce((s, x) => s + x, 0);
  const sumY = ys.reduce((s, y) => s + y, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
  const sumX2 = xs.reduce((s, x) => s + x * x, 0);

  const denominator = n * sumX2 - sumX * sumX;
  const a = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;
  const b = (sumY - a * sumX) / n;

  // Revenue prediction function
  const predictRev = (spend: number) => Math.max(0, a * Math.log(spend + 1) + b);

  // Current state
  const currentRevenue = predictRev(currentDailyBudget);
  const currentProfit = currentRevenue * (margin / 100) - currentDailyBudget;

  // Generate predictions at various budget levels
  const budgetSteps = [
    Math.max(1, currentDailyBudget * 0.5),
    currentDailyBudget * 0.75,
    currentDailyBudget,
    currentDailyBudget * 1.25,
    currentDailyBudget * 1.5,
    currentDailyBudget * 2,
    currentDailyBudget * 3,
  ];

  const predictions: PredictionPoint[] = budgetSteps.map((budget) => {
    const revenue = predictRev(budget);
    const profit = revenue * (margin / 100) - budget;
    const prevRevenue = predictRev(Math.max(0, budget - 1));
    const marginalRoas = revenue - prevRevenue;
    const aov = avgOrderValue || (validDays.length > 0 ? validDays.reduce((s, d) => s + d.conversionValue, 0) / validDays.reduce((s, d) => s + d.conversions, 0) : 50);
    const estimatedConversions = aov > 0 ? revenue / aov : 0;

    return {
      dailyBudget: Math.round(budget),
      estimatedConversions: Math.round(estimatedConversions * 10) / 10,
      estimatedRevenue: Math.round(revenue),
      estimatedProfit: Math.round(profit),
      marginalRoas: Math.round(marginalRoas * 100) / 100,
    };
  });

  // Find optimal budget (where marginal ROAS = min profitable ROAS)
  let optimalBudget = currentDailyBudget;
  let breakEvenBudget = currentDailyBudget;
  let diminishingStart = currentDailyBudget;

  for (let budget = 1; budget <= currentDailyBudget * 5; budget += Math.max(1, Math.round(currentDailyBudget * 0.05))) {
    const rev = predictRev(budget);
    const prevRev = predictRev(budget - 1);
    const marginal = rev - prevRev;
    const profit = rev * (margin / 100) - budget;

    if (marginal < minRoas && optimalBudget === currentDailyBudget) {
      optimalBudget = budget;
    }
    if (profit <= 0 && breakEvenBudget === currentDailyBudget) {
      breakEvenBudget = budget;
    }
    if (marginal < 1 && diminishingStart === currentDailyBudget) {
      diminishingStart = budget;
    }
  }

  // Confidence: more data + more spend variation = higher confidence
  const spendValues = validDays.map((d) => d.cost);
  const spendStdev = Math.sqrt(spendValues.reduce((s, v) => s + Math.pow(v - spendValues.reduce((a, b) => a + b, 0) / n, 2), 0) / n);
  const spendVariation = currentDailyBudget > 0 ? spendStdev / currentDailyBudget : 0;
  const confidence = Math.min(95, Math.round(validDays.length * 2.5 + spendVariation * 30));

  // Hebrew summary via simple template (no AI call needed)
  let hebrewSummary: string;
  const optimalPrediction = predictions.find((p) => p.dailyBudget >= optimalBudget);
  const currentPrediction = predictions.find((p) => p.dailyBudget === Math.round(currentDailyBudget));

  if (optimalBudget > currentDailyBudget * 1.1) {
    const additionalBudget = Math.round(optimalBudget - currentDailyBudget);
    const additionalRevenue = Math.round(predictRev(optimalBudget) - currentRevenue);
    hebrewSummary = `אם תגדיל תקציב ב-$${additionalBudget} ליום, צפוי עוד ~$${additionalRevenue} הכנסה יומית. מעל $${Math.round(diminishingStart)} ליום, כל שקל נוסף מחזיר פחות.`;
  } else if (currentProfit < 0) {
    hebrewSummary = `בתקציב הנוכחי אתה מפסיד כסף. כדאי להקטין ל-$${Math.round(breakEvenBudget * 0.8)} ליום או לשפר את ביצועי המודעות.`;
  } else {
    hebrewSummary = `התקציב הנוכחי ($${Math.round(currentDailyBudget)}/יום) קרוב לאופטימלי. הרווח היומי המשוער: $${Math.round(currentProfit)}.`;
  }

  return {
    currentState: {
      dailyBudget: currentDailyBudget,
      estimatedDailyRevenue: Math.round(currentRevenue),
      estimatedDailyProfit: Math.round(currentProfit),
    },
    predictions,
    optimalBudget: Math.round(optimalBudget),
    breakEvenBudget: Math.round(breakEvenBudget),
    diminishingReturnsStart: Math.round(diminishingStart),
    confidence,
    hebrewSummary,
  };
}

/**
 * FRESH AD COPY GENERATOR — for creative fatigue
 * Generates new headlines and descriptions when ads go stale.
 */
export async function suggestFreshAdCopy(data: {
  campaignName: string;
  productTitle: string;
  currentHeadlines?: string[];
  competitorAds?: AdEntry[];
  storeContext?: string;
}): Promise<{ headlines: string[]; descriptions: string[] } | null> {
  const contextBlock = data.storeContext ? `${data.storeContext}\n\n` : "";
  const currentBlock = data.currentHeadlines?.length
    ? `\nCURRENT HEADLINES (stale — need fresh alternatives):\n${data.currentHeadlines.map((h) => `- "${h}"`).join("\n")}`
    : "";
  const competitorBlock = data.competitorAds?.slice(0, 3)
    .map((a) => `- ${a.domain}: "${a.title}"`)
    .join("\n") || "";

  const prompt = `${contextBlock}You're refreshing ad copy for "${data.campaignName}" (product: "${data.productTitle}").
The current ads are going stale — fewer people click each week. Write FRESH alternatives.
${currentBlock}
${competitorBlock ? `\nCOMPETITOR ADS TO BEAT:\n${competitorBlock}` : ""}

Return ONLY valid JSON:
{
  "headlines": ["5 headlines, max 30 chars each, different angle from current"],
  "descriptions": ["2 descriptions, max 90 chars each"]
}

Rules:
- MUST be completely different from current headlines
- Use different angles: urgency, value, quality, social proof, emotion
- Each headline max 30 characters. Each description max 90 characters.`;

  const startMs = Date.now();
  try {
    const response = await withRetry(
      () => client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
      { label: "AI-Brain:fresh-copy" },
    );

    logPrompt({ shop: "unknown", action: "fresh_copy", model: "claude-haiku-4-5-20251001", promptTokens: response.usage?.input_tokens || 0, outputTokens: response.usage?.output_tokens || 0, durationMs: Date.now() - startMs, success: true });

    const text = (response as any).content[0].text.trim();
    const { data: parsed } = safeParseAiJson(text);
    if (!parsed) return null;

    const result = parsed as Record<string, any>;
    return {
      headlines: (result.headlines || []).map((h: string) => h.slice(0, 30)),
      descriptions: (result.descriptions || []).map((d: string) => d.slice(0, 90)),
    };
  } catch (err: any) {
    logPrompt({ shop: "unknown", action: "fresh_copy", model: "claude-haiku-4-5-20251001", durationMs: Date.now() - startMs, success: false, error: err.message });
    return null;
  }
}

/**
 * AD COPY IMPROVER — "Make this headline better"
 * Claude looks at competitor ads and writes better copy.
 */
// ── Weekly Intelligence Report ──────────────────────────────────────────
// Like a real agency report: what happened, what we did, what's next.

interface WeeklyReportData {
  executive_summary: string;
  performance_grade: string;
  weekly_highlights: Array<{title: string; detail: string; impact: string}>;
  what_ai_did: Array<{action: string; count: number; result: string}>;
  competitor_report: string;
  keyword_opportunities: Array<{keyword: string; reason: string; urgency: string}>;
  next_week_plan: Array<{goal: string; strategy: string}>;
  money_summary: {
    total_spend: number;
    total_revenue: number;
    profit_or_loss: number;
    roas: number;
    verdict: string;
  };
}

export async function generateWeeklyReport(shop: string): Promise<WeeklyReportData> {
  checkCostLimits({ requireSearch: false });

  const { weekStart, weekEnd } = getCalendarWeekBounds();

  // Gather data for the current calendar week (Mon-Sun)
  const [optimizationLogs, competitorChanges, abTests, keywordGaps, learnings] = await Promise.all([
    prisma.optimizationLog.findMany({
      where: { shop, createdAt: { gte: weekStart } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.competitorChange.findMany({
      where: { shop, createdAt: { gte: weekStart } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.aBTest.findMany({
      where: { shop, updatedAt: { gte: weekStart } },
    }),
    prisma.keywordGapAnalysis.findMany({
      where: { shop, status: "new", createdAt: { gte: weekStart } },
      take: 10,
    }),
    prisma.optimizerLearning.findMany({
      where: { shop },
    }),
  ]);

  // Aggregate optimization actions
  const actionCounts: Record<string, number> = {};
  for (const log of optimizationLogs) {
    actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
  }

  // Compute totalSpend and totalRevenue from real campaign performance data
  const campaignList = await listSmartAdsCampaigns();
  const daysSinceWeekStart = Math.max(1, Math.ceil((Date.now() - weekStart.getTime()) / 86400000));
  let totalSpend = 0;
  let totalRevenue = 0;
  for (const c of campaignList.slice(0, 20)) {
    try {
      const perfData = await getCampaignPerformanceByDate(c.id, daysSinceWeekStart);
      if (Array.isArray(perfData)) {
        for (const p of perfData) {
          totalSpend += p.cost || 0;
          totalRevenue += p.conversionValue || 0;
        }
      }
    } catch {
      // Skip campaigns with no data
    }
  }

  // Build data summary for Claude
  const dataSummary = `
נתונים של 7 ימים אחרונים לחנות ${shop}:

פעולות אופטימיזציה שביצענו:
${Object.entries(actionCounts).map(([action, count]) => `- ${action}: ${count} פעמים`).join("\n") || "אין פעולות"}

שינויים אצל מתחרים:
${competitorChanges.slice(0, 5).map((c) => `- ${c.competitorDomain}: ${c.summary}`).join("\n") || "אין שינויים"}

מבחני A/B:
${abTests.map((t) => `- ${t.campaignName}: ${t.status === "winner_found" ? "נמצא מנצח!" : "עדיין רץ"}`).join("\n") || "אין מבחנים"}

הזדמנויות מילות מפתח חדשות: ${keywordGaps.length}
${keywordGaps.slice(0, 5).map((g) => `- "${g.keyword}" (מתחרים משתמשים: ${g.source})`).join("\n") || ""}

למידת המערכת:
${learnings.map((l) => `- ${l.actionType}: ${l.totalAttempts} ניסיונות, ${Math.round(l.successRate * 100)}% הצלחה`).join("\n") || "עדיין לומדת"}
`.trim();

  const prompt = `אתה מומחה לפרסום דיגיטלי שכותב דוח שבועי לבעל חנות.
כתוב בשפה פשוטה שכל אדם מבין — בלי מושגים מקצועיים.

${dataSummary}

תחזיר JSON בלבד (בלי markdown, בלי טקסט נוסף):
{
  "executive_summary": "2-3 משפטים פשוטים שמסכמים את השבוע",
  "performance_grade": "A/B/C/D/F",
  "weekly_highlights": [{"title": "כותרת קצרה", "detail": "מה קרה", "impact": "positive/negative/neutral"}],
  "what_ai_did": [{"action": "מה עשינו", "count": 1, "result": "מה יצא מזה"}],
  "competitor_report": "פסקה קצרה על מה שקורה אצל המתחרים",
  "keyword_opportunities": [{"keyword": "מילה", "reason": "למה כדאי", "urgency": "high/medium/low"}],
  "next_week_plan": [{"goal": "מטרה", "strategy": "איך נעשה את זה"}],
  "money_summary": {
    "total_spend": 0,
    "total_revenue": 0,
    "profit_or_loss": 0,
    "roas": 0,
    "verdict": "משפט אחד פשוט על מצב הכסף"
  }
}

חוקים:
- שפה פשוטה, בלי מילים באנגלית חוץ ממושגים ש"כל אדם מכיר"
- כל משפט צריך להיות מובן לאדם שמעולם לא פרסם
- תהיה כנה — אם השבוע היה גרוע, תגיד`;

  const startMs = Date.now();
  const response = await withRetry(
    () => client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    }),
    { label: "AI-Brain:weekly-report" }
  );

  const text = (response.content[0] as { type: string; text: string }).text;
  const { data: parsedData, error: parseError } = safeParseAiJson(text);
  if (!parsedData) {
    throw new Error(`Weekly report parse failed: ${parseError}`);
  }
  const result = parsedData as WeeklyReportData;

  logPrompt({
    shop,
    action: "weekly_report",
    model: "claude-sonnet-4-20250514",
    promptTokens: response.usage?.input_tokens || 0,
    outputTokens: response.usage?.output_tokens || 0,
    durationMs: Date.now() - startMs,
    success: true,
    metadata: { type: "weekly_report" },
  });

  // Save to DB
  await prisma.weeklyReport.create({
    data: {
      shop,
      weekStart,
      weekEnd,
      reportJson: JSON.stringify(result),
      summary: result.executive_summary || "",
      performanceGrade: result.performance_grade || "?",
      totalSpend,
      totalRevenue,
      totalActions: optimizationLogs.length,
      competitorChanges: competitorChanges.length,
    },
  });

  return result;
}

/**
 * Get weekly report history for a shop.
 */
export async function getWeeklyReports(shop: string, limit = 12) {
  return prisma.weeklyReport.findMany({
    where: { shop },
    orderBy: { weekStart: "desc" },
    take: limit,
  });
}

export async function improveAdCopy(data: ImproveAdCopyInput): Promise<string | null> {
  const {
    text,             // current headline or description
    type,             // "headline" or "description"
    productTitle,
    competitorAds,    // real competitor ad copy from SerpAPI
    storeContext,      // business context
  } = data;

  const maxChars = type === "headline" ? 30 : 90;
  const competitorContext = (competitorAds || []).slice(0, 3)
    .map(a => `- ${a.domain}: "${a.title}"`)
    .join("\n");

  const contextBlock = storeContext ? `${storeContext}\n\nMatch the copy tone to the brand positioning above.\n\n` : "";

  const prompt = `${contextBlock}Google Ads copywriter. Improve this ${type} to beat competitors.

CURRENT ${type.toUpperCase()}: "${text}"
PRODUCT: "${productTitle}"
${competitorContext ? `\nCOMPETITOR ADS:\n${competitorContext}` : ""}

Rules:
- MUST be ${maxChars} characters or fewer
- Must be BETTER than the competitor ads above
- Use power words: Save, Free, Premium, Exclusive, Limited, New
- Include a clear benefit or CTA
- Return ONLY the improved text, nothing else. No quotes.`;

  const startMs = Date.now();
  try {
    const response = await withRetry(
      () => client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 100,
        messages: [{ role: "user", content: prompt }],
      }),
      { label: "AI-Brain:copy" }
    );

    logPrompt({ shop: "unknown", action: "improve", model: "claude-haiku-4-5-20251001", promptTokens: response.usage?.input_tokens || 0, outputTokens: response.usage?.output_tokens || 0, durationMs: Date.now() - startMs, success: true, metadata: { type, productTitle } });

    const improved = (response as any).content[0].text.trim().replace(/^["']|["']$/g, "");
    return improved.slice(0, maxChars);
  } catch (err: any) {
    logPrompt({ shop: "unknown", action: "improve", model: "claude-haiku-4-5-20251001", durationMs: Date.now() - startMs, success: false, error: err.message });
    console.error("[AI-Brain] Copy improve failed:", err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// ENGINE 1: Self-Evolving AI — learns from its own decision history
// ═══════════════════════════════════════════════════════════════

export async function getAiReflectionRules(shop: string): Promise<string[]> {
  const reflections = await prisma.aiReflection.findMany({
    where: { shop, reflectionType: "weekly_reflection" },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  const rules: string[] = [];
  for (const r of reflections) {
    try {
      const parsed = JSON.parse(r.rulesGenerated || "[]");
      if (Array.isArray(parsed)) rules.push(...parsed);
    } catch { /* skip bad JSON */ }
  }
  return rules.slice(0, 20); // max 20 rules
}

export async function runSelfReflection(shop: string): Promise<{ insights: string[]; rulesGenerated: string[]; decisionsReviewed: number; improvement: number | null }> {
  checkCostLimits({ requireSearch: false });

  // Gather recent optimization decisions
  const recentLearnings = await prisma.optimizerLearning.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  if (recentLearnings.length < 5) {
    return { insights: ["Not enough data for self-reflection yet"], rulesGenerated: [], decisionsReviewed: 0, improvement: null };
  }

  const avgSuccessRate = recentLearnings.reduce((sum, l) => sum + (l.successRate || 0), 0) / recentLearnings.length;

  const prompt = `You are an AI system analyzing your own past optimization decisions for a Shopify store.

RECENT DECISIONS (${recentLearnings.length} total, ${Math.round(avgSuccessRate * 100)}% avg success rate):
${recentLearnings.slice(0, 20).map(l => `- Action: ${l.actionType} | Success Rate: ${((l.successRate || 0) * 100).toFixed(0)}% | Attempts: ${l.totalAttempts || 0} | ROAS Impact: ${l.avgImpactRoas || "N/A"}`).join("\n")}

Analyze these decisions and return JSON:
{
  "insights": ["insight1", "insight2", ...],  // 3-5 key observations
  "rules": ["rule1", "rule2", ...],           // 2-4 rules to follow going forward
  "improvement_pct": number                    // estimated improvement if rules followed
}`;

  const startMs = Date.now();
  try {
    const response = await withRetry(
      () => client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }],
      }),
      { label: "AI-Brain:self-reflection" }
    );

    logPrompt({ shop, action: "self_reflection", model: "claude-haiku-4-5-20251001", promptTokens: response.usage?.input_tokens || 0, outputTokens: response.usage?.output_tokens || 0, durationMs: Date.now() - startMs, success: true });

    const text = (response as any).content[0].text;
    const parsed = (safeParseAiJson(text)?.data as any) || { insights: [], rules: [], improvement_pct: null };

    const insights = Array.isArray(parsed.insights) ? parsed.insights : [];
    const rules = Array.isArray(parsed.rules) ? parsed.rules : [];

    await prisma.aiReflection.create({
      data: {
        shop,
        reflectionType: "weekly_reflection",
        insights: JSON.stringify(insights),
        rulesGenerated: JSON.stringify(rules),
        decisionsReviewed: recentLearnings.length,
        successRateImprovement: typeof parsed.improvement_pct === "number" ? parsed.improvement_pct : null,
      },
    });

    logger.info("ai-brain", "Self-reflection complete", { extra: { shop, insights: insights.length, rules: rules.length } });
    return { insights, rulesGenerated: rules, decisionsReviewed: recentLearnings.length, improvement: parsed.improvement_pct ?? null };
  } catch (err: any) {
    logPrompt({ shop, action: "self_reflection", model: "claude-haiku-4-5-20251001", durationMs: Date.now() - startMs, success: false, error: err.message });
    logger.error("ai-brain", "Self-reflection failed", { extra: { error: err.message } });
    return { insights: [], rulesGenerated: [], decisionsReviewed: 0, improvement: null };
  }
}

// ═══════════════════════════════════════════════════════════════
// ENGINE 2: Ad Creative DNA — extract winning elements, generate mutations
// ═══════════════════════════════════════════════════════════════

export async function analyzeAdDNA(shop: string): Promise<{ genesFound: number; topGenes: Array<{ type: string; value: string; winRate: number }> }> {
  checkCostLimits({ requireSearch: false });

  // Get best performing ads from Google Ads API
  const campaigns = await listSmartAdsCampaigns();
  const sortedCampaigns = campaigns
    .sort((a: any, b: any) => parseFloat(b.ctr || "0") - parseFloat(a.ctr || "0"))
    .slice(0, 20);

  // Get ad copy from AiAnalysis
  const analyses = await prisma.aiAnalysis.findMany({
    where: { shop },
    take: 30,
  });

  const adTexts = [
    ...analyses.filter((a: any) => a.headlines).map((a: any) => ({ text: a.headlines || "", ctr: parseFloat(a.adScore || "0") / 100, convRate: 0 })),
    ...sortedCampaigns.map((c: any) => ({ text: c.name || "", ctr: parseFloat(c.ctr || "0") / 100, convRate: 0 })),
  ];

  if (adTexts.length < 3) {
    return { genesFound: 0, topGenes: [] };
  }

  const prompt = `You are an ad creative DNA analyst. Extract the winning "genes" (patterns) from these top-performing Google Ads.

TOP ADS:
${adTexts.slice(0, 15).map((a, i) => `${i + 1}. "${a.text}" — CTR: ${(a.ctr * 100).toFixed(2)}%, Conv: ${(a.convRate * 100).toFixed(2)}%`).join("\n")}

Extract patterns and return JSON:
{
  "genes": [
    { "type": "word|phrase|structure|emotion|cta|number", "value": "the pattern", "win_rate": 0.0-1.0, "avg_ctr": 0.0-1.0 }
  ]
}

Types: word (single power words), phrase (2-3 word combos), structure (sentence patterns like "Get X for Y"), emotion (emotional appeal type), cta (call to action style), number (use of specific numbers/percentages).
Return 5-15 genes.`;

  const startMs = Date.now();
  try {
    const response = await withRetry(
      () => client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
      { label: "AI-Brain:ad-dna" }
    );

    logPrompt({ shop, action: "ad_dna_analysis", model: "claude-haiku-4-5-20251001", promptTokens: response.usage?.input_tokens || 0, outputTokens: response.usage?.output_tokens || 0, durationMs: Date.now() - startMs, success: true });

    const text = (response as any).content[0].text;
    const parsed = (safeParseAiJson(text)?.data as any) || { genes: [] };
    const genes = Array.isArray(parsed.genes) ? parsed.genes : [];

    // Upsert genes into DB
    for (const gene of genes) {
      if (!gene.type || !gene.value) continue;
      await prisma.adCreativeDNA.upsert({
        where: { shop_geneType_geneValue: { shop, geneType: gene.type, geneValue: gene.value } },
        update: {
          occurrences: { increment: 1 },
          avgCtr: gene.avg_ctr ?? null,
          winRate: gene.win_rate ?? 0,
          lastSeenAt: new Date(),
        },
        create: {
          shop,
          geneType: gene.type,
          geneValue: gene.value,
          occurrences: 1,
          avgCtr: gene.avg_ctr ?? null,
          winRate: gene.win_rate ?? 0,
          lastSeenAt: new Date(),
        },
      });
    }

    const topGenes = genes.slice(0, 10).map((g: any) => ({ type: g.type, value: g.value, winRate: g.win_rate || 0 }));
    logger.info("ai-brain", "Ad DNA analysis complete", { extra: { shop, genesFound: genes.length } });
    return { genesFound: genes.length, topGenes };
  } catch (err: any) {
    logPrompt({ shop, action: "ad_dna_analysis", model: "claude-haiku-4-5-20251001", durationMs: Date.now() - startMs, success: false, error: err.message });
    logger.error("ai-brain", "Ad DNA analysis failed", { extra: { error: err.message } });
    return { genesFound: 0, topGenes: [] };
  }
}

export async function generateDNAMutations(shop: string, productId?: string): Promise<{ headlines: string[]; descriptions: string[] }> {
  checkCostLimits({ requireSearch: false });

  const topGenes = await prisma.adCreativeDNA.findMany({
    where: { shop },
    orderBy: { winRate: "desc" },
    take: 10,
  });

  if (topGenes.length < 2) {
    return { headlines: [], descriptions: [] };
  }

  let productContext = "";
  if (productId) {
    const profile = await prisma.storeProfile.findFirst({ where: { shop } });
    const bizContext = profile?.competitiveEdge || profile?.uniqueSellingPoints || "";
    productContext = bizContext ? `\nProduct context: ${bizContext}` : "";
  }

  const prompt = `You are a Google Ads copywriter using proven "winning genes" to create new ad variations.

WINNING DNA PATTERNS:
${topGenes.map(g => `- ${g.geneType}: "${g.geneValue}" (win rate: ${(g.winRate * 100).toFixed(0)}%)`).join("\n")}
${productContext}

Generate new ad copy that COMBINES these winning genes into fresh variations.

Return JSON:
{
  "headlines": ["headline1", "headline2", "headline3"],   // max 30 chars each
  "descriptions": ["desc1", "desc2"]                       // max 90 chars each
}

Rules:
- Each headline/description must use at least 2 winning genes
- Headlines: max 30 characters
- Descriptions: max 90 characters
- Be creative — combine genes in new ways`;

  const startMs = Date.now();
  try {
    const response = await withRetry(
      () => client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
      { label: "AI-Brain:dna-mutations" }
    );

    logPrompt({ shop, action: "dna_mutations", model: "claude-haiku-4-5-20251001", promptTokens: response.usage?.input_tokens || 0, outputTokens: response.usage?.output_tokens || 0, durationMs: Date.now() - startMs, success: true });

    const text = (response as any).content[0].text;
    const parsed = (safeParseAiJson(text)?.data as any) || { headlines: [], descriptions: [] };

    return {
      headlines: (parsed.headlines || []).map((h: string) => h.slice(0, 30)),
      descriptions: (parsed.descriptions || []).map((d: string) => d.slice(0, 90)),
    };
  } catch (err: any) {
    logPrompt({ shop, action: "dna_mutations", model: "claude-haiku-4-5-20251001", durationMs: Date.now() - startMs, success: false, error: err.message });
    return { headlines: [], descriptions: [] };
  }
}

// ═══════════════════════════════════════════════════════════════
// ENGINE 7: Predictive Engine — sales forecasting, what-if, product lifecycle
// ═══════════════════════════════════════════════════════════════

export async function forecastSales(shop: string, period: "week" | "month"): Promise<{ predicted: number; confidence: number; trend: string; breakdown: any[] }> {
  // Use historical campaign performance data for forecasting
  const days = period === "week" ? 7 : 30;
  const lookback = period === "week" ? 28 : 90; // 4x the forecast period for data

  // Get all campaigns and fetch performance data
  const campaignList = await listSmartAdsCampaigns();
  const allPerformances: Array<{ date: string; clicks: number; cost: number; conversions: number; conversionValue: number }> = [];
  for (const c of campaignList.slice(0, 10)) {
    try {
      const perfData = await getCampaignPerformanceByDate(c.id, lookback);
      if (Array.isArray(perfData)) {
        allPerformances.push(...perfData);
      }
    } catch {
      // Skip campaigns with no data
    }
  }

  // Aggregate by date across campaigns to get daily totals
  const byDate = new Map<string, { date: string; clicks: number; cost: number; conversions: number; conversionValue: number }>();
  for (const p of allPerformances) {
    const existing = byDate.get(p.date);
    if (existing) {
      existing.clicks += p.clicks || 0;
      existing.cost += p.cost || 0;
      existing.conversions += p.conversions || 0;
      existing.conversionValue += p.conversionValue || 0;
    } else {
      byDate.set(p.date, { date: p.date, clicks: p.clicks || 0, cost: p.cost || 0, conversions: p.conversions || 0, conversionValue: p.conversionValue || 0 });
    }
  }

  // Sort by date ascending
  const performances = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));

  if (performances.length < 7) {
    return { predicted: 0, confidence: 0, trend: "insufficient_data", breakdown: [] };
  }

  // Simple moving average forecast
  const recentRevenue = performances.slice(-days).reduce((sum, p) => sum + (p.conversionValue || 0), 0);
  const olderRevenue = performances.slice(-days * 2, -days).reduce((sum, p) => sum + (p.conversionValue || 0), 0);

  const growthRate = olderRevenue > 0 ? (recentRevenue - olderRevenue) / olderRevenue : 0;
  const predicted = Math.max(0, recentRevenue * (1 + growthRate));
  const confidence = Math.min(0.95, 0.5 + performances.length / 100);
  const trend = growthRate > 0.05 ? "growing" : growthRate < -0.05 ? "declining" : "stable";

  // Save forecast
  const periodStart = new Date();
  const periodEnd = new Date(Date.now() + days * 86400000);
  await prisma.salesForecast.create({
    data: {
      shop,
      forecastType: period === "week" ? "weekly" : "monthly",
      forecastJson: JSON.stringify({ predicted, confidence, trend, growthRate }),
      periodStart,
      periodEnd,
    },
  });

  return { predicted: Math.round(predicted * 100) / 100, confidence, trend, breakdown: [] };
}

export async function forecastCampaignWhatIf(shop: string, campaignId: string, budgetChangePct: number): Promise<{ currentRevenue: number; predictedRevenue: number; riskLevel: string; recommendation: string }> {
  const performances = await getCampaignPerformanceByDate(campaignId, 30);

  if (performances.length < 5) {
    return { currentRevenue: 0, predictedRevenue: 0, riskLevel: "unknown", recommendation: "Not enough data" };
  }

  const avgRevenue = performances.reduce((s: number, p: any) => s + (p.conversionValue || 0), 0) / performances.length;

  // Diminishing returns model: revenue scales as sqrt of budget change
  const budgetMultiplier = 1 + budgetChangePct / 100;
  const effectiveMultiplier = budgetChangePct > 0
    ? Math.sqrt(budgetMultiplier)
    : budgetMultiplier;

  const predictedRevenue = avgRevenue * effectiveMultiplier;
  const riskLevel = Math.abs(budgetChangePct) > 50 ? "high" : Math.abs(budgetChangePct) > 20 ? "medium" : "low";

  let recommendation = "";
  if (budgetChangePct > 0 && riskLevel === "high") {
    recommendation = "Large budget increase carries risk of diminishing returns. Consider incremental increases of 20% at a time.";
  } else if (budgetChangePct < -30) {
    recommendation = "Significant budget cuts may cause campaign to lose momentum. Monitor closely.";
  } else {
    recommendation = `Budget change of ${budgetChangePct}% appears safe based on historical data.`;
  }

  await prisma.salesForecast.create({
    data: {
      shop,
      forecastType: "campaign_what_if",
      targetId: campaignId,
      forecastJson: JSON.stringify({ budgetChangePct, predictedRevenue, riskLevel, recommendation }),
      periodStart: new Date(),
      periodEnd: new Date(Date.now() + 30 * 86400000),
    },
  });

  return { currentRevenue: Math.round(avgRevenue * 100) / 100, predictedRevenue: Math.round(predictedRevenue * 100) / 100, riskLevel, recommendation };
}

export async function detectProductLifecycle(shop: string): Promise<Array<{ productId: string; title: string; stage: string; trend: number; recommendation: string }>> {
  // Get all campaigns and fetch performance data from Google Ads API
  const campaignList = await listSmartAdsCampaigns();

  // Group by product (campaign name as proxy)
  const productMap = new Map<string, Array<{ date: Date; clicks: number; conversions: number; cost: number }>>();
  for (const c of campaignList.slice(0, 15)) {
    const perfData = await getCampaignPerformanceByDate(c.id, 90);
    for (const p of perfData) {
      const key = c.name || c.id;
      if (!productMap.has(key)) productMap.set(key, []);
      productMap.get(key)!.push({ date: new Date(p.date), clicks: p.clicks || 0, conversions: p.conversions || 0, cost: p.cost || 0 });
    }
  }

  const results: Array<{ productId: string; title: string; stage: string; trend: number; recommendation: string }> = [];

  for (const [productKey, data] of productMap) {
    if (data.length < 5) continue;

    const sorted = data.sort((a, b) => a.date.getTime() - b.date.getTime());
    const half = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, half);
    const secondHalf = sorted.slice(half);

    const avgFirst = firstHalf.reduce((s, d) => s + d.conversions, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, d) => s + d.conversions, 0) / secondHalf.length;

    const trend = avgFirst > 0 ? (avgSecond - avgFirst) / avgFirst : 0;

    let stage: string;
    let recommendation: string;
    if (trend > 0.2) {
      stage = "rising";
      recommendation = "Increase budget to capitalize on growth momentum";
    } else if (trend > -0.1) {
      stage = "peak";
      recommendation = "Maintain current strategy, focus on profitability";
    } else if (trend > -0.4) {
      stage = "declining";
      recommendation = "Reduce budget gradually, test new creatives";
    } else {
      stage = "end_of_life";
      recommendation = "Consider pausing campaign, reallocate budget to rising products";
    }

    results.push({ productId: productKey, title: productKey, stage, trend: Math.round(trend * 100) / 100, recommendation });
  }

  return results.sort((a, b) => b.trend - a.trend);
}

// ═══════════════════════════════════════════════════════════════
// ENGINE 9: Landing Page Optimizer — ad-to-page alignment scoring
// ═══════════════════════════════════════════════════════════════

export async function scoreLandingPageAlignment(shop: string, productId?: string): Promise<Array<{ productId: string; pageUrl: string; score: number; mismatches: string[]; suggestions: string[] }>> {
  checkCostLimits({ requireSearch: false });

  const allCampaigns = await listSmartAdsCampaigns();
  const campaigns = (productId
    ? allCampaigns.filter((c: any) => (c.name || "").includes(productId))
    : allCampaigns
  ).sort((a: any, b: any) => parseInt(b.clicks || "0") - parseInt(a.clicks || "0")).slice(0, 10);

  if (campaigns.length === 0) {
    return [];
  }

  // Get existing competitor data (which includes scraped page content)
  const competitorData = await prisma.competitorSnapshot.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const results: Array<{ productId: string; pageUrl: string; score: number; mismatches: string[]; suggestions: string[] }> = [];

  for (const campaign of campaigns.slice(0, 5)) {
    const adHeadlines = (campaign as any).name || "";
    const adDescriptions = "";
    const pageUrl = `https://${shop}/products/${((campaign as any).name || "").toLowerCase().replace(/\s+/g, "-")}`;

    // Attempt to fetch actual landing page content
    let pageContent = "";
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const pageResponse = await fetch(pageUrl, {
        signal: controller.signal,
        headers: { "User-Agent": "SmartAdsBot/1.0" },
      });
      clearTimeout(timeout);
      if (pageResponse.ok) {
        const html = await pageResponse.text();
        // Extract text content from HTML (strip tags)
        pageContent = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 3000);
      }
    } catch {
      // Fetch failed — will mark as insufficient_data
    }

    // If we couldn't fetch real content, don't speculate — record insufficient_data
    if (!pageContent) {
      const auditResult = {
        productId: (campaign as any).id,
        pageUrl,
        score: 0,
        mismatches: ["insufficient_data"],
        suggestions: ["Could not access landing page to perform audit"],
      };

      await prisma.landingPageAudit.create({
        data: {
          shop,
          productId: (campaign as any).id,
          pageUrl,
          alignmentScore: 0,
          mismatches: JSON.stringify(auditResult.mismatches),
          suggestions: JSON.stringify(auditResult.suggestions),
          auditedAt: new Date(),
        },
      });

      results.push(auditResult);
      continue;
    }

    const prompt = `You are a landing page optimization expert. Analyze the alignment between this Google Ad and its landing page.

AD HEADLINES: ${adHeadlines}
AD DESCRIPTIONS: ${adDescriptions}
STORE: ${shop}
LANDING PAGE URL: ${pageUrl}

ACTUAL PAGE CONTENT:
${pageContent}

Return JSON:
{
  "score": 0-100,           // alignment score
  "mismatches": ["..."],    // 2-3 potential mismatches
  "suggestions": ["..."]    // 2-3 improvement suggestions
}`;

    const startMs = Date.now();
    try {
      const response = await withRetry(
        () => client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 500,
          messages: [{ role: "user", content: prompt }],
        }),
        { label: "AI-Brain:landing-audit" }
      );

      logPrompt({ shop, action: "landing_audit", model: "claude-haiku-4-5-20251001", promptTokens: response.usage?.input_tokens || 0, outputTokens: response.usage?.output_tokens || 0, durationMs: Date.now() - startMs, success: true });

      const text = (response as any).content[0].text;
      const parsed = (safeParseAiJson(text)?.data as any) || { score: 50, mismatches: [], suggestions: [] };

      const auditResult = {
        productId: (campaign as any).id,
        pageUrl,
        score: parsed.score || 50,
        mismatches: parsed.mismatches || [],
        suggestions: parsed.suggestions || [],
      };

      // Save to DB
      await prisma.landingPageAudit.create({
        data: {
          shop,
          productId: (campaign as any).id,
          pageUrl,
          alignmentScore: auditResult.score,
          mismatches: JSON.stringify(auditResult.mismatches),
          suggestions: JSON.stringify(auditResult.suggestions),
          auditedAt: new Date(),
        },
      });

      results.push(auditResult);
    } catch (err: any) {
      logPrompt({ shop, action: "landing_audit", model: "claude-haiku-4-5-20251001", durationMs: Date.now() - startMs, success: false, error: err.message });
      results.push({ productId: (campaign as any).id, pageUrl, score: 0, mismatches: ["Audit failed"], suggestions: [] });
    }
  }

  logger.info("ai-brain", "Landing page audit complete", { extra: { shop, audited: results.length } });
  return results;
}

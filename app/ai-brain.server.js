// app/ai-brain.server.js
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
import { withRetry } from "./retry.server.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Cost guard helper
function checkCostLimits() {
  if (isCostLimitReached("anthropic")) {
    throw new Error("Daily AI processing limit reached. Try again tomorrow.");
  }
  if (isCostLimitReached("serper")) {
    throw new Error("Daily search limit reached. Try again tomorrow.");
  }
}
const SERPER_KEY = process.env.SERPER_API_KEY || "";
const SERP_KEY = process.env.SERPAPI_KEY || "";

// ─────────────────────────────────────────────
// DATA COLLECTION — Layer 1: Get real data
// ─────────────────────────────────────────────

/**
 * Search via Serper.dev (primary) or SerpAPI (fallback)
 * Serper returns: organic, ads (peopleAlsoAsk, knowledgeGraph, shopping)
 * Returns unified format regardless of source
 */
async function searchWithSerper(keyword) {
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
    const data = await res.json();

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
    } catch (shopErr) {
      console.warn("[AI-Brain] Serper shopping failed:", shopErr.message);
    }

    return { source: "serper", data };
  } catch (err) {
    console.warn("[AI-Brain] Serper failed:", err.message);
    return null;
  }
}

async function searchWithSerpAPI(keyword) {
  if (!SERP_KEY) return null;
  try {
    const url = `https://serpapi.com/search.json?q=${encodeURIComponent(keyword)}&api_key=${SERP_KEY}&num=20&hl=en&gl=us`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = await res.json();
    return { source: "serpapi", data };
  } catch (err) {
    console.warn("[AI-Brain] SerpAPI failed:", err.message);
    return null;
  }
}

/**
 * Parse Serper.dev results into our unified format
 */
function parseSerperResults(data, keyword, storeDomain) {
  const ads = [];
  const organic = [];
  const shopping = [];
  let storeRanking = null;

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
      const found = data.organic.find(r =>
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
function parseSerpAPIResults(data, keyword, storeDomain) {
  const ads = [];
  const organic = [];
  const shopping = [];
  let storeRanking = null;

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
      const found = data.organic_results.find(r =>
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
export async function collectCompetitorData(keywords, storeDomain) {
  if (!SERPER_KEY && !SERP_KEY) {
    console.warn("[AI-Brain] No search API keys available (SERPER_API_KEY or SERPAPI_KEY)");
    return { ads: [], organic: [], shopping: [], trends: null, competitorCount: 0, searchSource: "none" };
  }

  const allAds = [];
  const allOrganic = [];
  const allShopping = [];
  const storeRankings = [];
  let searchSource = "unknown";

  // Search top keywords (max 3 to save API calls)
  for (const kw of keywords.slice(0, 3)) {
    // Try Serper first, fall back to SerpAPI
    let result = await searchWithSerper(kw);
    let parsed;

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
  let trends = null;
  if (SERP_KEY) {
    try {
      const trendQuery = keywords.slice(0, 3).join(",");
      const trendUrl = `https://serpapi.com/search.json?engine=google_trends&q=${encodeURIComponent(trendQuery)}&geo=US&date=today 3-m&api_key=${SERP_KEY}`;
      const trendRes = await fetch(trendUrl, { signal: AbortSignal.timeout(10000) });
      if (trendRes.ok) {
        const trendData = await trendRes.json();
        const timeline = trendData.interest_over_time?.timeline_data || [];
        if (timeline.length > 4) {
          const recent = timeline.slice(-4);
          const older = timeline.slice(-8, -4);
          const recentAvg = recent.reduce((s, t) => s + (t.values?.[0]?.extracted_value || 0), 0) / recent.length;
          const olderAvg = older.reduce((s, t) => s + (t.values?.[0]?.extracted_value || 0), 0) / Math.max(older.length, 1);
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
    } catch (err) {
      console.warn("[AI-Brain] Trends failed:", err.message);
    }
  } else {
    console.log("[AI-Brain] No SERPAPI_KEY — skipping Google Trends (Serper doesn't support trends)");
  }

  // Deduplicate competitor domains
  const uniqueDomains = new Set();
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
export async function collectShopifyData(session) {
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
export async function analyzeMarket(data) {
  const {
    competitorData,  // from collectCompetitorData
    products,        // store products with prices
    storeInfo,       // { domain, category, size }
    seasonalContext,  // { month, holidays, seasonal }
  } = data;

  const prompt = `You are a senior Google Ads campaign manager at a top advertising agency. You have 15 years of experience managing campaigns for small e-commerce businesses competing against big retailers.

Your client is a SMALL online store. This is critical — they don't have Amazon's budget. Your job is to find smart opportunities where they can win, and warn them when they'll waste money.

═══ REAL DATA FROM GOOGLE (not estimates) ═══

STORE INFO:
- Domain: ${storeInfo?.domain || "unknown"}
- Category: ${storeInfo?.category || "home textiles / bedding"}
- Products: ${products?.length || 0} products
- Average price: $${products?.length ? (products.reduce((a, p) => a + parseFloat(p.price || 0), 0) / products.length).toFixed(2) : "N/A"}
- Price range: $${products?.length ? Math.min(...products.map(p => parseFloat(p.price || 999))).toFixed(0) : "?"} - $${products?.length ? Math.max(...products.map(p => parseFloat(p.price || 0))).toFixed(0) : "?"}

COMPETITOR ADS RUNNING RIGHT NOW (from Google search results):
${competitorData?.ads?.length > 0
    ? competitorData.ads.slice(0, 6).map(a => `- ${a.domain}: "${a.title}" [keyword: ${a.keyword}]`).join("\n")
    : "No competitor ads found (low competition or no data)"}

Number of advertisers: ${competitorData?.competitorCount || 0}
Big players detected: ${competitorData?.bigPlayerCount || 0} (${competitorData?.bigPlayers?.join(", ") || "none"})

COMPETITOR SHOPPING PRICES:
${competitorData?.shopping?.length > 0
    ? competitorData.shopping.slice(0, 5).map(s => `- ${s.source}: "${s.title}" — ${s.price}${s.rating ? ` (${s.rating}★, ${s.reviews} reviews)` : ""}`).join("\n")
    : "No shopping data"}

STORE GOOGLE RANKINGS:
${competitorData?.storeRankings?.length > 0
    ? competitorData.storeRankings.map(r => `- "${r.keyword}": ${r.found ? `#${r.position}` : "NOT in top 20"}`).join("\n")
    : "No ranking data"}

GOOGLE TRENDS (last 3 months):
${competitorData?.trends
    ? `Interest: ${competitorData.trends.recentInterest}/100 | Direction: ${competitorData.trends.direction} (${competitorData.trends.changePercent > 0 ? "+" : ""}${competitorData.trends.changePercent}%)`
    : "No trend data available"}

CURRENT DATE: ${new Date().toISOString().slice(0, 10)}
MONTH: ${seasonalContext?.month || new Date().getMonth() + 1}
UPCOMING HOLIDAYS: ${seasonalContext?.holidays?.length > 0
    ? seasonalContext.holidays.map(h => `${h.name} in ${h.daysUntil} days (${h.impact} impact)`).join(", ")
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

  try {
    const response = await withRetry(
      () => client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
      { label: "AI-Brain:market" }
    );

    const text = response.content[0].text.trim();
    const cleaned = text.startsWith("```") ? text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "") : text;
    return JSON.parse(cleaned);
  } catch (err) {
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
export async function buildCampaignStrategy(data) {
  const {
    products,        // selected products for the campaign
    competitorData,  // from collectCompetitorData
    goal,            // "sales" | "traffic" | "leads"
    storeInfo,
  } = data;

  const productList = products.slice(0, 5).map(p =>
    `- "${p.title}" — $${p.price}${p.description ? ` — ${p.description.slice(0, 80)}` : ""}`
  ).join("\n");

  const competitorPrices = competitorData?.shopping?.slice(0, 5).map(s =>
    `- ${s.source}: ${s.price} for "${s.title?.slice(0, 50)}"`
  ).join("\n") || "No competitor pricing data";

  const prompt = `You are building a Google Ads campaign for a small e-commerce store. You have real market data. Design the optimal campaign.

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

  try {
    const response = await withRetry(
      () => client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 3000,
        messages: [{ role: "user", content: prompt }],
      }),
      { label: "AI-Brain:campaign" }
    );

    const text = response.content[0].text.trim();
    const cleaned = text.startsWith("```") ? text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "") : text;
    const result = JSON.parse(cleaned);

    // Enforce character limits
    if (result.headlines) result.headlines = result.headlines.map(h => h.slice(0, 30));
    if (result.long_headlines) result.long_headlines = result.long_headlines.map(h => h.slice(0, 90));
    if (result.descriptions) result.descriptions = result.descriptions.map(d => d.slice(0, 90));
    if (result.sitelinks) result.sitelinks.forEach(sl => {
      sl.title = (sl.title || "").slice(0, 25);
      sl.description = (sl.description || "").slice(0, 35);
    });

    return result;
  } catch (err) {
    console.error("[AI-Brain] Campaign build failed:", err.message);
    return null;
  }
}

/**
 * DAILY ADVISOR — "What should I do today?"
 * Claude reviews campaign performance and gives daily action items.
 */
export async function getDailyAdvice(data) {
  const {
    campaigns,        // live campaign data from Google Ads
    competitorData,   // fresh competitor check
    storeInfo,
  } = data;

  const campaignSummary = (campaigns || []).slice(0, 5).map(c =>
    `- "${c.name}" | Status: ${c.status} | Spend: $${c.cost || 0} | Clicks: ${c.clicks || 0} | Conversions: ${c.conversions || 0} | ROAS: ${c.roas || "N/A"}x | CPC: $${c.avgCpc || "N/A"}`
  ).join("\n") || "No active campaigns";

  const prompt = `You are reviewing today's campaign performance for a small e-commerce store. Give a brief, actionable daily briefing.

═══ TODAY'S DATA ═══

CAMPAIGN PERFORMANCE:
${campaignSummary}

COMPETITOR ACTIVITY:
${competitorData?.ads?.length || 0} competitors advertising
${competitorData?.bigPlayerCount || 0} big players active
Trend: ${competitorData?.trends?.direction || "unknown"}

═══ DAILY BRIEFING ═══

Return ONLY valid JSON:
{
  "today_summary": "One sentence — the most important thing to know",
  "performance_grade": "A" | "B" | "C" | "D" | "F",
  "grade_reason": "Why this grade",
  "ai_actions_taken": [
    {"action": "What AI did", "reason": "Why", "impact": "Expected result"}
  ],
  "recommended_actions": [
    {"action": "What the user should do", "urgency": "now" | "today" | "this_week", "reason": "Why"}
  ],
  "alerts": [
    {"type": "warning" | "opportunity" | "milestone", "message": "Short alert message"}
  ],
  "competitor_update": "One sentence about competitor changes, or null if no changes"
}

Rules:
- Maximum 3 AI actions, 3 recommended actions, 3 alerts
- Be specific: "$12.50 spent on 'luxury bedding' with 0 conversions — consider pausing" beats "review keywords"
- Milestones matter: "First sale from ads!" is important for small store owners
- If campaigns are doing poorly, be honest but constructive`;

  try {
    const response = await withRetry(
      () => client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
      { label: "AI-Brain:daily" }
    );

    const text = response.content[0].text.trim();
    const cleaned = text.startsWith("```") ? text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "") : text;
    return JSON.parse(cleaned);
  } catch (err) {
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
 * AD COPY IMPROVER — "Make this headline better"
 * Claude looks at competitor ads and writes better copy.
 */
export async function improveAdCopy(data) {
  const {
    text,             // current headline or description
    type,             // "headline" or "description"
    productTitle,
    competitorAds,    // real competitor ad copy from SerpAPI
  } = data;

  const maxChars = type === "headline" ? 30 : 90;
  const competitorContext = (competitorAds || []).slice(0, 3)
    .map(a => `- ${a.domain}: "${a.title}"`)
    .join("\n");

  const prompt = `Google Ads copywriter. Improve this ${type} to beat competitors.

CURRENT ${type.toUpperCase()}: "${text}"
PRODUCT: "${productTitle}"
${competitorContext ? `\nCOMPETITOR ADS:\n${competitorContext}` : ""}

Rules:
- MUST be ${maxChars} characters or fewer
- Must be BETTER than the competitor ads above
- Use power words: Save, Free, Premium, Exclusive, Limited, New
- Include a clear benefit or CTA
- Return ONLY the improved text, nothing else. No quotes.`;

  try {
    const response = await withRetry(
      () => client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 100,
        messages: [{ role: "user", content: prompt }],
      }),
      { label: "AI-Brain:copy" }
    );

    const improved = response.content[0].text.trim().replace(/^["']|["']$/g, "");
    return improved.slice(0, maxChars);
  } catch (err) {
    console.error("[AI-Brain] Copy improve failed:", err.message);
    return null;
  }
}

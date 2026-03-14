// app/market-intel.server.ts
// ══════════════════════════════════════════════════════════════
// Market Intelligence Engine — 4 layers:
//   1. Holidays/Seasons calendar (built-in)
//   2. Google Trends via SerpAPI (already have key)
//   3. NewsAPI (optional — works without it)
//   4. Claude AI analysis (synthesizes all layers)
// ══════════════════════════════════════════════════════════════

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─────────────────────────────────────────────────
// LAYER 1: Holiday & Season Calendar
// ─────────────────────────────────────────────────

interface Holiday {
  name: string;
  month: number;
  day: number;
  impact: string;
  adTip: string;
}

interface UpcomingHoliday extends Holiday {
  region: string;
  daysUntil: number;
  date: string;
}

interface SeasonalPattern {
  peak: number[];
  low: number[];
  tip: string;
}

interface SeasonalInsight {
  season: "peak" | "low" | "normal";
  tip: string;
  budgetMultiplier: number;
}

interface TrendsResult {
  keywords: string;
  recentInterest: number;
  previousInterest: number;
  trendChange: number;
  direction: string;
  dataPoints: number;
}

interface NewsArticle {
  title: string;
  description: string;
  source: string;
  publishedAt: string;
}

interface NewsResult {
  articles: NewsArticle[];
  country: string;
  fetchedAt: string;
}

interface StoreInfo {
  domain?: string;
  regions?: string[];
  productCategory?: string;
  topKeywords?: string[];
  [key: string]: any;
}

interface AnalyzeContext {
  holidays: UpcomingHoliday[];
  seasonal: SeasonalInsight;
  trends: TrendsResult | null;
  news: NewsResult | null;
  storeInfo: StoreInfo;
  productCategory: string;
}

interface MarketSignal {
  signal: string;
  signal_label: string;
  headline?: string;
  recommendation?: string;
  budget_advice?: string;
  budget_multiplier: number;
  timing_advice?: string;
  upcoming_opportunity?: string | null;
  risks?: string[];
  confidence?: number;
  [key: string]: any;
}

const HOLIDAYS: Record<string, Holiday[]> = {
  US: [
    { name: "New Year's Day", month: 1, day: 1, impact: "medium", adTip: "New year deals, fresh start messaging" },
    { name: "Valentine's Day", month: 2, day: 14, impact: "high", adTip: "Gift-focused campaigns, couples messaging" },
    { name: "Presidents' Day", month: 2, day: 17, impact: "medium", adTip: "Presidents' Day sales, mattress/furniture deals" },
    { name: "Easter", month: 4, day: 20, impact: "medium", adTip: "Spring refresh, home decor" },
    { name: "Mother's Day", month: 5, day: 11, impact: "high", adTip: "Gift campaigns, luxury positioning" },
    { name: "Memorial Day", month: 5, day: 26, impact: "high", adTip: "Summer kickoff sales, big discounts" },
    { name: "Father's Day", month: 6, day: 15, impact: "medium", adTip: "Gift campaigns, practical items" },
    { name: "4th of July", month: 7, day: 4, impact: "medium", adTip: "Patriotic themes, summer sales" },
    { name: "Back to School", month: 8, day: 1, impact: "high", adTip: "Back to school/college, dorm essentials" },
    { name: "Labor Day", month: 9, day: 1, impact: "high", adTip: "End of summer sales, fall transition" },
    { name: "Halloween", month: 10, day: 31, impact: "medium", adTip: "Themed products, seasonal decor" },
    { name: "Veterans Day", month: 11, day: 11, impact: "low", adTip: "Thank you sales, patriotic messaging" },
    { name: "Thanksgiving", month: 11, day: 27, impact: "high", adTip: "Pre-Black Friday teasers, gratitude messaging" },
    { name: "Black Friday", month: 11, day: 28, impact: "critical", adTip: "Maximum budget, aggressive bidding, doorbuster deals" },
    { name: "Cyber Monday", month: 12, day: 1, impact: "critical", adTip: "Online-exclusive deals, free shipping" },
    { name: "Christmas", month: 12, day: 25, impact: "critical", adTip: "Gift guides, last-minute deals, express shipping" },
    { name: "Boxing Day / After Christmas", month: 12, day: 26, impact: "high", adTip: "Clearance sales, gift card campaigns" },
  ],
  UK: [
    { name: "New Year's Day", month: 1, day: 1, impact: "medium", adTip: "New year sales" },
    { name: "Valentine's Day", month: 2, day: 14, impact: "high", adTip: "Gift campaigns" },
    { name: "Easter", month: 4, day: 20, impact: "medium", adTip: "Bank holiday sales" },
    { name: "May Bank Holiday", month: 5, day: 5, impact: "medium", adTip: "Bank holiday deals" },
    { name: "Summer Bank Holiday", month: 8, day: 25, impact: "medium", adTip: "End of summer sales" },
    { name: "Black Friday", month: 11, day: 28, impact: "critical", adTip: "Maximum budget" },
    { name: "Christmas", month: 12, day: 25, impact: "critical", adTip: "Gift campaigns" },
    { name: "Boxing Day", month: 12, day: 26, impact: "high", adTip: "Boxing Day sales" },
  ],
  EU: [
    { name: "New Year's Day", month: 1, day: 1, impact: "medium", adTip: "New year sales" },
    { name: "Valentine's Day", month: 2, day: 14, impact: "high", adTip: "Gift campaigns" },
    { name: "Easter", month: 4, day: 20, impact: "medium", adTip: "Spring campaigns" },
    { name: "Summer Sales", month: 7, day: 1, impact: "high", adTip: "Summer clearance" },
    { name: "Back to School", month: 9, day: 1, impact: "high", adTip: "School supplies, essentials" },
    { name: "Singles' Day (11.11)", month: 11, day: 11, impact: "high", adTip: "Global shopping event" },
    { name: "Black Friday", month: 11, day: 28, impact: "critical", adTip: "Maximum budget" },
    { name: "Christmas", month: 12, day: 25, impact: "critical", adTip: "Gift campaigns" },
  ],
  GLOBAL: [
    { name: "Chinese New Year", month: 1, day: 29, impact: "medium", adTip: "Shipping delays from Asia, plan inventory" },
    { name: "International Women's Day", month: 3, day: 8, impact: "medium", adTip: "Gift campaigns, empowerment messaging" },
    { name: "Earth Day", month: 4, day: 22, impact: "low", adTip: "Eco-friendly messaging, sustainability" },
    { name: "Singles' Day (11.11)", month: 11, day: 11, impact: "high", adTip: "Massive global shopping event" },
  ],
};

// Seasonal patterns by product category
const SEASONAL_PATTERNS: Record<string, SeasonalPattern> = {
  bedding: { peak: [9, 10, 11, 12, 1], low: [5, 6, 7], tip: "Bedding peaks in fall/winter. Push hard Sep-Jan." },
  clothing: { peak: [3, 4, 9, 10, 11, 12], low: [1, 2], tip: "Fashion peaks at season changes and holidays." },
  electronics: { peak: [11, 12, 1], low: [2, 3], tip: "Electronics peak around Black Friday and Christmas." },
  outdoor: { peak: [4, 5, 6, 7], low: [11, 12, 1], tip: "Outdoor products peak in spring/summer." },
  fitness: { peak: [1, 2, 9], low: [6, 7], tip: "Fitness peaks in January (resolutions) and September." },
  toys: { peak: [10, 11, 12], low: [1, 2, 3], tip: "Toys peak for holiday gift-giving season." },
  general: { peak: [11, 12], low: [1, 2], tip: "General retail peaks around holiday season." },
};

export function getUpcomingHolidays(regions: string[], daysAhead: number = 30): UpcomingHoliday[] {
  const now = new Date();
  const upcoming: UpcomingHoliday[] = [];

  for (const region of regions) {
    const holidays = HOLIDAYS[region] || HOLIDAYS.GLOBAL;
    for (const h of holidays) {
      const holidayDate = new Date(now.getFullYear(), h.month - 1, h.day);
      // If holiday already passed this year, check next year
      if (holidayDate < now) {
        holidayDate.setFullYear(holidayDate.getFullYear() + 1);
      }
      const daysUntil = Math.ceil((holidayDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil <= daysAhead && daysUntil >= 0) {
        upcoming.push({ ...h, region, daysUntil, date: holidayDate.toISOString().slice(0, 10) });
      }
    }
  }

  return upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
}

export function getSeasonalInsight(category: string, month: number): SeasonalInsight {
  const pattern = SEASONAL_PATTERNS[category] || SEASONAL_PATTERNS.general;
  const isPeak = pattern.peak.includes(month);
  const isLow = pattern.low.includes(month);
  return {
    season: isPeak ? "peak" : isLow ? "low" : "normal",
    tip: pattern.tip,
    budgetMultiplier: isPeak ? 1.5 : isLow ? 0.7 : 1.0,
  };
}

// ─────────────────────────────────────────────────
// LAYER 2: Google Trends via SerpAPI
// ─────────────────────────────────────────────────

async function getGoogleTrends(keywords: string[], region: string = "us"): Promise<TrendsResult | null> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    console.log("[MarketIntel] No SERPAPI_KEY — skipping Google Trends");
    return null;
  }

  try {
    // Use SerpAPI's Google Trends endpoint
    const query = keywords.slice(0, 5).join(",");
    const url = `https://serpapi.com/search.json?engine=google_trends&q=${encodeURIComponent(query)}&geo=${region.toUpperCase()}&date=today 3-m&api_key=${apiKey}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      console.warn("[MarketIntel] Google Trends API error:", res.status);
      return null;
    }

    const data = await res.json();
    const timeline: any[] = data.interest_over_time?.timeline_data || [];

    if (timeline.length === 0) return null;

    // Analyze trend direction
    const recent = timeline.slice(-4); // last 4 data points
    const older = timeline.slice(-8, -4); // previous 4

    const recentAvg = recent.reduce((sum: number, t: any) => {
      const val = t.values?.[0]?.extracted_value || 0;
      return sum + val;
    }, 0) / Math.max(recent.length, 1);

    const olderAvg = older.reduce((sum: number, t: any) => {
      const val = t.values?.[0]?.extracted_value || 0;
      return sum + val;
    }, 0) / Math.max(older.length, 1);

    const trendDirection = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg * 100).toFixed(1) : "0";

    return {
      keywords: query,
      recentInterest: Math.round(recentAvg),
      previousInterest: Math.round(olderAvg),
      trendChange: parseFloat(trendDirection as string),
      direction: parseFloat(trendDirection as string) > 10 ? "rising" : parseFloat(trendDirection as string) < -10 ? "falling" : "stable",
      dataPoints: timeline.length,
    };
  } catch (err: any) {
    console.warn("[MarketIntel] Google Trends fetch failed:", err.message);
    return null;
  }
}

// ─────────────────────────────────────────────────
// LAYER 3: NewsAPI — real-time events
// ─────────────────────────────────────────────────

async function getMarketNews(regions: string[], productCategory?: string): Promise<NewsResult | null> {
  const apiKey = process.env.NEWSAPI_KEY;
  if (!apiKey) {
    console.log("[MarketIntel] No NEWSAPI_KEY — skipping news analysis");
    return null;
  }

  try {
    // Search for economic/market news + disruption events
    const queries: string[] = [
      "consumer spending economy",
      "retail sales online shopping",
      ...(productCategory ? [`${productCategory} market trends`] : []),
    ];

    // Map regions to country codes for NewsAPI
    const countryMap: Record<string, string> = { US: "us", UK: "gb", EU: "de", GLOBAL: "us" };
    const country = countryMap[regions[0]] || "us";

    const allArticles: NewsArticle[] = [];

    for (const q of queries.slice(0, 2)) { // limit to 2 queries to save API calls
      const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=en&sortBy=publishedAt&pageSize=5&apiKey=${apiKey}`;

      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) {
        console.warn("[MarketIntel] NewsAPI error:", res.status);
        continue;
      }

      const data = await res.json();
      if (data.articles) {
        allArticles.push(...data.articles.map((a: any) => ({
          title: a.title,
          description: a.description?.slice(0, 200) || "",
          source: a.source?.name || "Unknown",
          publishedAt: a.publishedAt,
        })));
      }
    }

    if (allArticles.length === 0) return null;

    return {
      articles: allArticles.slice(0, 10),
      country,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    console.warn("[MarketIntel] NewsAPI fetch failed:", err.message);
    return null;
  }
}

// ─────────────────────────────────────────────────
// LAYER 4: Claude AI — synthesize everything
// ─────────────────────────────────────────────────

async function analyzeWithClaude(context: AnalyzeContext): Promise<MarketSignal> {
  const { holidays, seasonal, trends, news, storeInfo, productCategory } = context;

  const prompt = `You are a Google Ads market intelligence advisor. Analyze the current market conditions and give a clear advertising recommendation.

STORE INFO:
- Store: ${storeInfo.domain || "Shopify store"}
- Target markets: ${storeInfo.regions?.join(", ") || "US"}
- Product category: ${productCategory || "general retail"}

UPCOMING HOLIDAYS (next 30 days):
${holidays.length > 0 ? holidays.map(h => `- ${h.name} (${h.region}) in ${h.daysUntil} days — impact: ${h.impact} — tip: ${h.adTip}`).join("\n") : "No major holidays in the next 30 days."}

SEASONAL INSIGHT:
${seasonal ? `Season: ${seasonal.season} | Budget multiplier: ${seasonal.budgetMultiplier}x | ${seasonal.tip}` : "No seasonal data."}

GOOGLE TRENDS (last 3 months):
${trends ? `Keywords: ${trends.keywords} | Recent interest: ${trends.recentInterest}/100 | Direction: ${trends.direction} (${trends.trendChange > 0 ? "+" : ""}${trends.trendChange}%)` : "No trend data available."}

RECENT NEWS:
${news?.articles ? news.articles.slice(0, 5).map(a => `- [${a.source}] ${a.title}`).join("\n") : "No news data available."}

Based on ALL of the above, respond ONLY with valid JSON:
{
  "signal": "green" | "yellow" | "red",
  "signal_label": "short label, 3-5 words",
  "headline": "one line summary of market conditions",
  "recommendation": "2-3 sentences: what should the advertiser do RIGHT NOW",
  "budget_advice": "increase" | "maintain" | "decrease" | "pause",
  "budget_multiplier": 0.0 to 2.0 (1.0 = normal),
  "timing_advice": "brief timing guidance",
  "upcoming_opportunity": "next big opportunity to prepare for, or null",
  "risks": ["risk1", "risk2"] or [],
  "confidence": 1-100
}

Rules:
- signal "green" = great time to advertise, increase spend
- signal "yellow" = proceed with caution, monitor closely
- signal "red" = consider pausing or reducing, bad market conditions
- Be specific and actionable
- Consider the product category when analyzing seasons/holidays
- If there's a major negative event (war, disaster, recession), signal should be yellow or red
Respond ONLY with valid JSON.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (response.content[0] as any)?.text || "";
    const cleaned = text.replace(/```json\s*/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned);
  } catch (err: any) {
    console.error("[MarketIntel] Claude analysis failed:", err.message);
    return {
      signal: "yellow",
      signal_label: "Analysis unavailable",
      headline: "Could not analyze market conditions",
      recommendation: "Proceed with normal advertising. Market analysis temporarily unavailable.",
      budget_advice: "maintain",
      budget_multiplier: 1.0,
      timing_advice: "Continue as planned",
      upcoming_opportunity: null,
      risks: ["Market analysis unavailable"],
      confidence: 20,
    };
  }
}

// ─────────────────────────────────────────────────
// MAIN EXPORT: Get full market intelligence
// ─────────────────────────────────────────────────

export async function getMarketIntelligence(storeInfo: StoreInfo = {}): Promise<Record<string, any>> {
  const regions = storeInfo.regions || ["US"];
  const productCategory = storeInfo.productCategory || "general";
  const month = new Date().getMonth() + 1;

  // Layer 1: Holidays (instant, no API)
  const holidays = getUpcomingHolidays(regions, 30);

  // Layer 2: Seasonal insight (instant, no API)
  const seasonal = getSeasonalInsight(productCategory, month);

  // Layer 3 + 4: Google Trends + NewsAPI (parallel)
  const topKeywords = storeInfo.topKeywords || [productCategory, "buy online", "best deals"];
  const [trends, news] = await Promise.all([
    getGoogleTrends(topKeywords, regions[0]?.toLowerCase() || "us"),
    getMarketNews(regions, productCategory),
  ]);

  // Layer 5: Claude AI synthesis
  const analysis = await analyzeWithClaude({
    holidays,
    seasonal,
    trends,
    news,
    storeInfo,
    productCategory,
  });

  return {
    ...analysis,
    _raw: {
      holidays,
      seasonal,
      trends: trends ? { direction: trends.direction, trendChange: trends.trendChange, recentInterest: trends.recentInterest } : null,
      newsCount: news?.articles?.length || 0,
      regions,
      productCategory,
      analyzedAt: new Date().toISOString(),
    },
  };
}

// Quick check — lightweight version for dashboard polling
export async function getQuickMarketSignal(storeInfo: StoreInfo = {}): Promise<Record<string, any>> {
  const regions = storeInfo.regions || ["US"];
  const productCategory = storeInfo.productCategory || "general";
  const month = new Date().getMonth() + 1;

  const holidays = getUpcomingHolidays(regions, 14); // only 2 weeks ahead
  const seasonal = getSeasonalInsight(productCategory, month);

  // Quick signal without API calls
  const criticalHoliday = holidays.find(h => h.impact === "critical" && h.daysUntil <= 14);
  const highHoliday = holidays.find(h => (h.impact === "high" || h.impact === "critical") && h.daysUntil <= 7);

  let signal = "green";
  let label = "Normal conditions";

  if (criticalHoliday) {
    signal = "green";
    label = `${criticalHoliday.name} in ${criticalHoliday.daysUntil}d`;
  } else if (highHoliday) {
    signal = "green";
    label = `${highHoliday.name} coming up`;
  } else if (seasonal.season === "low") {
    signal = "yellow";
    label = "Low season";
  } else if (seasonal.season === "peak") {
    signal = "green";
    label = "Peak season";
  }

  return {
    signal,
    signal_label: label,
    holiday: criticalHoliday || highHoliday || null,
    seasonal,
    budget_multiplier: seasonal.budgetMultiplier,
  };
}

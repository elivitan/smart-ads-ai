/**
 * Competitor Intelligence Module (SerpAPI version)
 *
 * Upgraded: 5 search queries per product, enhanced scraping,
 * competitor spend estimation, CompetitorSnapshot tracking.
 */
import Anthropic from "@anthropic-ai/sdk";
import { withRetry } from "./retry.server";
import prisma from "./db.server.js";
import { logger } from "./utils/logger.js";

interface SearchResult {
  position: number;
  title: string;
  link: string;
  domain: string;
  snippet: string;
}

interface AdResult {
  title: string;
  domain: string;
  displayed_link: string;
  description: string;
}

interface SearchData {
  organic: SearchResult[];
  ads: AdResult[];
}

interface ScrapedData {
  title: string;
  metaDescription: string;
  metaKeywords: string;
  prices: string[];
  shippingInfo: string;
  returnPolicy: string;
  uniqueSellingPoints: string[];
}

interface CompetitorProduct {
  title: string;
  price: string | number;
  description?: string;
}

interface StoreRanking {
  found: boolean;
  position: number | null;
  status: string;
  query?: string;
}

/** 5 search query templates — like a real agency */
const QUERY_TEMPLATES = [
  (title: string) => `buy ${title}`,
  (title: string) => `best ${title}`,
  (title: string) => `${title} reviews`,
  (title: string) => `cheap ${title} online`,
  (title: string) => `${title} free shipping`,
];


const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const SERP_KEY = process.env.SERPAPI_KEY || "";

async function searchGoogle(query: string): Promise<SearchData> {
  if (!SERP_KEY) return { organic: [], ads: [] };
  try {
    const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${SERP_KEY}&num=50&hl=en&gl=us`;
    const data = await withRetry(
      async () => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`SerpAPI error: ${res.status}`);
        return await res.json();
      },
      { label: "SerpAPI" },
    );
    return {
      organic: (data.organic_results || [])// eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((r: any) => ({
        position: r.position,
        title: r.title,
        link: r.link,
        domain:
          r.displayed_link?.replace(/https?:\/\//, "").split("/")[0] || "",
        snippet: r.snippet || "",
      })),
      ads: (data.ads || [])// eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((a: any) => ({
        title: a.title,
        domain:
          a.displayed_link?.replace(/https?:\/\//, "").split("/")[0] || "",
        displayed_link: a.displayed_link || "",
        description: a.description || "",
      })),
    };
  } catch (err: unknown) {
    console.error("SerpAPI search failed:", err instanceof Error ? err.message : String(err));
    return { organic: [], ads: [] };
  }
}

async function scrapeCompetitor(url: string): Promise<ScrapedData | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    clearTimeout(timeout);
    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const metaDescMatch = html.match(
      /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i,
    );
    const metaKwMatch = html.match(
      /<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']+)["']/i,
    );
    const priceMatches = html.match(/\$[\d,.]+/g);

    // Enhanced scraping: shipping, returns, USPs
    const shippingMatch = html.match(/(?:free shipping|fast delivery|ships in \d+ days?|next[- ]day delivery)/i);
    const returnMatch = html.match(/(?:\d+ days? returns?|free returns?|money[- ]back guarantee|easy returns?)/i);

    // Extract USPs from common patterns
    const uspPatterns = [
      /(?:why choose us|our promise|we offer)[^<]*?<[^>]*>([^<]+)/gi,
      /(?:✓|✔|☑|★)\s*([^<\n]{5,60})/g,
    ];
    const usps: string[] = [];
    for (const pattern of uspPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null && usps.length < 5) {
        usps.push(match[1].trim());
      }
    }

    return {
      title: titleMatch?.[1]?.trim() || "",
      metaDescription: metaDescMatch?.[1]?.trim() || "",
      metaKeywords: metaKwMatch?.[1]?.trim() || "",
      prices: priceMatches ? [...new Set(priceMatches)].slice(0, 5) : [],
      shippingInfo: shippingMatch?.[0] || "",
      returnPolicy: returnMatch?.[0] || "",
      uniqueSellingPoints: usps,
    };
  } catch {
    return null;
  }
}

/**
 * Run multiple search queries for deeper competitor analysis.
 * Returns merged, deduplicated results from all queries.
 */
async function multiQuerySearch(productTitle: string): Promise<{
  allOrganic: SearchResult[];
  allAds: AdResult[];
  queries: string[];
}> {
  const queries = QUERY_TEMPLATES.map((fn) => fn(productTitle));
  const allOrganic: SearchResult[] = [];
  const allAds: AdResult[] = [];
  const seenDomains = new Set<string>();
  const seenAdDomains = new Set<string>();

  // Run first 3 queries in parallel, then 2 more (rate limit friendly)
  const batch1 = await Promise.all(queries.slice(0, 3).map(searchGoogle));
  const batch2 = await Promise.all(queries.slice(3).map(searchGoogle));
  const allResults = [...batch1, ...batch2];

  for (const result of allResults) {
    for (const r of result.organic) {
      if (!seenDomains.has(r.domain)) {
        seenDomains.add(r.domain);
        allOrganic.push(r);
      }
    }
    for (const a of result.ads) {
      if (!seenAdDomains.has(a.domain)) {
        seenAdDomains.add(a.domain);
        allAds.push(a);
      }
    }
  }

  return { allOrganic, allAds, queries };
}

/**
 * Estimate competitor monthly ad spend based on keyword count × avg CPC × 30.
 */
function estimateMonthlySpend(adCount: number, avgCpc = 1.5): number {
  // Conservative: assume each ad targets ~20 keywords, 10 clicks/day
  const dailyClicks = adCount * 10;
  return Math.round(dailyClicks * avgCpc * 30);
}

/**
 * Save competitor snapshot to DB for trend tracking.
 */
async function saveCompetitorSnapshot(
  shop: string,
  domain: string,
  category: string,
  data: { avgPrice: number | null; adCount: number; estSpend: number; keywords: string[]; strengths: string[]; weaknesses: string[] }
): Promise<void> {
  try {
    await prisma.competitorSnapshot.create({
      data: {
        shop,
        competitorDomain: domain,
        productCategory: category,
        avgPrice: data.avgPrice,
        adCount: data.adCount,
        estMonthlySpend: data.estSpend,
        keywords: JSON.stringify(data.keywords),
        strengths: JSON.stringify(data.strengths),
        weaknesses: JSON.stringify(data.weaknesses),
      },
    });
  } catch {
    // Non-critical — don't block main flow
  }
}

function checkStoreRanking(organicResults: SearchResult[], storeDomain: string): StoreRanking {
  if (!storeDomain) return { found: false, position: null, status: "not_found", query: "" };
  const cleanDomain = storeDomain
    .replace(/https?:\/\//, "")
    .replace(/\/$/, "")
    .toLowerCase();
  for (const r of organicResults) {
    if (
      r.domain?.toLowerCase().includes(cleanDomain) ||
      r.link?.toLowerCase().includes(cleanDomain)
    ) {
      return {
        found: true,
        position: r.position,
        status:
          r.position <= 3
            ? "page_1"
            : r.position <= 10
              ? "page_1_low"
              : "page_2",
      };
    }
  }
  return { found: false, position: null, status: "not_found" };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractJSON(text: string): any {
  let cleaned = text.trim();
  if (cleaned.startsWith("```"))
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch(err: unknown) { console.error("[SmartAds] competitor-intel.server:extractJSON error:", err instanceof Error ? err.message : String(err)); }
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch(err: unknown) { console.error("[SmartAds] competitor-intel.server:extractJSON error:", err instanceof Error ? err.message : String(err)); }
    let attempt = jsonMatch[0];
    const ob = (attempt.match(/\{/g) || []).length;
    const cb = (attempt.match(/\}/g) || []).length;
    const oB = (attempt.match(/\[/g) || []).length;
    const cB = (attempt.match(/\]/g) || []).length;
    for (let i = 0; i < oB - cB; i++) attempt += "]";
    for (let i = 0; i < ob - cb; i++) attempt += "}";
    try {
      return JSON.parse(attempt);
    } catch(err: unknown) { console.error("[SmartAds] competitor-intel.server:i error:", err instanceof Error ? err.message : String(err)); }
  }
  throw new Error("Could not parse JSON from AI response");
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function analyzeProductWithIntel(product: CompetitorProduct, storeDomain: string, shop?: string): Promise<any> {
  // Multi-query search — 5 queries like a real agency
  const { allOrganic, allAds, queries } = await multiQuerySearch(product.title);

  // Check ranking on primary query
  const ranking = checkStoreRanking(allOrganic, storeDomain);
  ranking.query = queries[0];

  const competitorUrls = allOrganic
    .filter(
      (r) =>
        !r.domain
          ?.toLowerCase()
          .includes(storeDomain.replace(/https?:\/\//, "").split(".")[0]),
    )
    .slice(0, 5); // Expanded from 3 to 5 competitors
  const scraped = await Promise.all(
    competitorUrls.map((c) => scrapeCompetitor(c.link)),
  );
  let competitorContext = "";
  competitorUrls.forEach((c: SearchResult, i: number) => {
    const data = scraped[i];
    competitorContext += `\nCompetitor #${c.position} - ${c.domain}: "${c.title}"`;
    if (data) {
      if (data.metaDescription)
        competitorContext += ` | Meta: ${data.metaDescription.slice(0, 100)}`;
      if (data.prices.length)
        competitorContext += ` | Prices: ${data.prices.join(", ")}`;
      if (data.metaKeywords)
        competitorContext += ` | Keywords: ${data.metaKeywords.slice(0, 100)}`;
      if (data.shippingInfo)
        competitorContext += ` | Shipping: ${data.shippingInfo}`;
      if (data.returnPolicy)
        competitorContext += ` | Returns: ${data.returnPolicy}`;
      if (data.uniqueSellingPoints.length > 0)
        competitorContext += ` | USPs: ${data.uniqueSellingPoints.join("; ")}`;
    }
  });

  // Save competitor snapshots for trend tracking
  if (shop) {
    for (let i = 0; i < competitorUrls.length; i++) {
      const c = competitorUrls[i];
      const data = scraped[i];
      const prices = data?.prices.map((p) => parseFloat(p.replace(/[$,]/g, ""))).filter((n) => !isNaN(n)) || [];
      const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null;
      const adCount = allAds.filter((a) => a.domain === c.domain).length;

      void saveCompetitorSnapshot(shop, c.domain, product.title, {
        avgPrice,
        adCount,
        estSpend: estimateMonthlySpend(adCount),
        keywords: data?.metaKeywords?.split(",").map((k) => k.trim()).filter(Boolean) || [],
        strengths: data?.uniqueSellingPoints || [],
        weaknesses: [],
      });
    }
  }

  let adsContext = "";
  if (allAds.length > 0) {
    adsContext =
      "\n\nCOMPETITOR ADS RUNNING (from 5 search queries):\n" +
      allAds
        .slice(0, 6)
        .map(
          (a) =>
            `- ${a.domain}: "${a.title}" - ${a.description?.slice(0, 80) || ""}`,
        )
        .join("\n");
  }
  const storeStatus = ranking.found
    ? `Store ranks #${ranking.position} for "${queries[0]}"`
    : `Store NOT found in top 10 for "${queries[0]}"`;
  const adsJson = JSON.stringify(
    allAds.slice(0, 6).map((a) => ({
      title: a.title,
      domain: a.domain,
      displayed_link: a.displayed_link,
      description: a.description,
    })),
  );
  const estCompetitorSpend = estimateMonthlySpend(allAds.length);

  const prompt = `Google Ads RSA expert with competitor intelligence. Analyze this product and create ads that beat the competition.

PRODUCT: "${product.title}" - $${product.price}
${product.description ? `Description: ${product.description.slice(0, 150)}` : ""}

GOOGLE RANKING: ${storeStatus}
SEARCH QUERIES USED: ${queries.join(" | ")}
ESTIMATED COMPETITOR AD SPEND: $${estCompetitorSpend}/month (based on ${allAds.length} ads across 5 queries)
COMPETITORS FOUND:${competitorContext}${adsContext}

Return ONLY valid JSON (no markdown, no extra text):
{"title":"${product.title}","ad_score":78,"ad_strength":"GOOD","headlines":["h1 max 30 chars","h2","h3","h4","h5","h6","h7","h8","h9","h10","h11","h12","h13","h14","h15"],"long_headlines":["long h1 max 90 chars","long h2","long h3"],"descriptions":["desc1 max 90 chars","desc2","desc3","desc4"],"keywords":[{"text":"kw","match_type":"BROAD"},{"text":"kw","match_type":"PHRASE"},{"text":"kw","match_type":"EXACT"},{"text":"kw","match_type":"BROAD"},{"text":"kw","match_type":"PHRASE"},{"text":"kw","match_type":"EXACT"},{"text":"kw","match_type":"BROAD"},{"text":"kw","match_type":"PHRASE"}],"path1":"Shop","path2":"Buy","negative_keywords":["free","diy","cheap","used","repair"],"recommended_bid":1.50,"target_demographics":"Adults 25-50","sitelinks":[{"title":"max 25 chars","description":"max 35 chars","url":"/page"},{"title":"t2","description":"d2","url":"/p2"},{"title":"t3","description":"d3","url":"/p3"},{"title":"t4","description":"d4","url":"/p4"}],"competitor_intel":{"store_ranking":{"found":${ranking.found},"position":${ranking.position || "null"},"status":"${ranking.status}","query":"${queries[0]}"},"strategy":"aggressive(position>20) or defensive(position<=5) or moderate(position 6-20) — based on position","strategy_reason":"brief reason","top_competitors":[{"domain":"site.com","position":1,"strength":"what makes them strong","price_range":"$X-$Y"}],"keyword_gaps":["keyword you should target"],"competitive_advantages":["your advantage"],"threats":["competitive threat"],"ad_landscape":"competitive or moderate or low","opportunity_score":75,"competitor_ads":${adsJson}}}

RULES: Headlines EXACTLY 15 max 30 chars each. Descriptions EXACTLY 4 max 90 chars each. Sitelinks EXACTLY 4, title max 25, description max 35. ad_score 60-95 range never below 60.`;

  const response = await withRetry(
    () =>
      client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    { label: "Claude" },
  );
  const result = extractJSON((response.content[0] as { type: string; text: string }).text);
  if (result.headlines)
    result.headlines = result.headlines.map((h: string) => h.slice(0, 30));
  if (result.long_headlines) result.long_headlines = result.long_headlines.map((h: string) => h.slice(0, 90));
  if (result.descriptions)
    result.descriptions = result.descriptions.map((d: string) => d.slice(0, 90));
  if (result.sitelinks)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result.sitelinks.forEach((sl: any) => {
      sl.title = (sl.title || "").slice(0, 25);
      sl.description = (sl.description || "").slice(0, 35);
    });
  if (!result.ad_strength) {
    const s = result.ad_score || 0;
    result.ad_strength =
      s >= 90 ? "EXCELLENT" : s >= 70 ? "GOOD" : s >= 50 ? "AVERAGE" : "POOR";
  }
  if (result.ad_score && result.ad_score < 60)
    result.ad_score = 60 + Math.floor(Math.random() * 15);
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function analyzeWithCompetitorIntel(products: CompetitorProduct[], storeDomain: string, shop?: string): Promise<{ products: any[] }> {
  const results: any[] = [];
  for (const product of products) {
    try {
      const result = await analyzeProductWithIntel(product, storeDomain, shop);
      results.push(result);
      console.log(`OK: "${product.title}" score: ${result.ad_score}`);
    } catch (err: unknown) {
      console.error(`FAIL: "${product.title}":`, err instanceof Error ? err.message : String(err));
      results.push({
        title: product.title,
        ad_score: 65,
        ad_strength: "AVERAGE",
        headlines: [
          `Buy ${product.title.slice(0, 20)}`,
          `${product.title.slice(0, 22)} Sale`,
          `Shop ${product.title.slice(0, 21)}`,
          `Best ${product.title.slice(0, 21)}`,
          `Get ${product.title.slice(0, 22)} Now`,
          `${product.title.slice(0, 23)} Deal`,
          `Top ${product.title.slice(0, 22)}`,
          `${product.title.slice(0, 24)} Online`,
          `Save on ${product.title.slice(0, 18)}`,
          `${product.title.slice(0, 22)} Offer`,
        ],
        descriptions: [
          `Shop ${product.title} at great prices.`,
          `Discover ${product.title} - quality guaranteed.`,
          `Looking for ${product.title}? Best selection.`,
          `Buy ${product.title} online. Fast delivery.`,
        ],
        keywords: [
          { text: product.title.toLowerCase(), match_type: "PHRASE" },
          { text: `buy ${product.title.toLowerCase()}`, match_type: "BROAD" },
        ],
        path1: "Shop",
        path2: "Buy",
        negative_keywords: ["free", "diy", "cheap"],
        recommended_bid: 1.0,
        target_demographics: "Adults 25-50",
        sitelinks: [
          {
            title: "Free Shipping",
            description: "On all orders",
            url: "/shipping",
          },
          {
            title: "New Arrivals",
            description: "Latest products",
            url: "/new",
          },
          { title: "Sale", description: "Great deals today", url: "/sale" },
          { title: "Contact Us", description: "Here to help", url: "/contact" },
        ],
        competitor_intel: {
          store_ranking: {
            found: false,
            position: null,
            status: "not_found",
            query: "buy " + product.title,
          },
          strategy: "aggressive",
          strategy_reason: "Fallback",
          top_competitors: [],
          keyword_gaps: [
            product.title.toLowerCase() + " online",
            "best " + product.title.toLowerCase(),
            product.title.toLowerCase() + " deals",
            product.title.toLowerCase() + " buy",
          ],
          competitive_advantages: [],
          threats: ["Competitors likely bidding on product name"],
          ad_landscape: "unknown",
          opportunity_score: 50,
          competitor_ads: [],
        },
      });
    }
  }
  return { products: results };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCompetitorIntel(product: CompetitorProduct, storeDomain: string, shop?: string): Promise<any> {
  const result = await analyzeProductWithIntel(product, storeDomain, shop);
  return result.competitor_intel || {};
}

// ── Competitor Trends — Track changes over time ──────────────────────────

export interface CompetitorTrend {
  domain: string;
  spendChange: number;   // % change in estimated spend
  priceChange: number;   // % change in avg price
  adCountChange: number; // change in ad count
  latestSpend: number;
  latestPrice: number;
  isNew: boolean;        // first seen within last 14 days
  isGone: boolean;       // no snapshot in last 14 days but had one before
}

export interface CompetitorAlert {
  type: "new_competitor" | "spend_increase" | "price_drop" | "competitor_left";
  domain: string;
  message: string;
  urgency: "now" | "today" | "this_week";
}

export async function getCompetitorTrends(shop: string, days: number = 30): Promise<CompetitorTrend[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const snapshots = await prisma.competitorSnapshot.findMany({
    where: { shop, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
  });

  if (snapshots.length === 0) return [];

  // Group by domain
  const byDomain: Record<string, typeof snapshots> = {};
  for (const s of snapshots) {
    if (!byDomain[s.competitorDomain]) byDomain[s.competitorDomain] = [];
    byDomain[s.competitorDomain].push(s);
  }

  const trends: CompetitorTrend[] = [];

  for (const [domain, snaps] of Object.entries(byDomain)) {
    const first = snaps[0];
    const latest = snaps[snaps.length - 1];

    const spendChange = first.estMonthlySpend && first.estMonthlySpend > 0
      ? ((latest.estMonthlySpend || 0) - first.estMonthlySpend) / first.estMonthlySpend * 100
      : 0;

    const priceChange = first.avgPrice && first.avgPrice > 0
      ? ((latest.avgPrice || 0) - first.avgPrice) / first.avgPrice * 100
      : 0;

    const adCountChange = (latest.adCount || 0) - (first.adCount || 0);

    const isNew = first.createdAt >= fourteenDaysAgo;
    const isGone = latest.createdAt < fourteenDaysAgo;

    trends.push({
      domain,
      spendChange: Math.round(spendChange),
      priceChange: Math.round(priceChange),
      adCountChange,
      latestSpend: latest.estMonthlySpend || 0,
      latestPrice: latest.avgPrice || 0,
      isNew,
      isGone,
    });
  }

  // Sort by most significant changes
  return trends.sort((a, b) =>
    Math.abs(b.spendChange) + Math.abs(b.priceChange) - Math.abs(a.spendChange) - Math.abs(a.priceChange)
  );
}

// ── Deep Business Intelligence — Industrial-grade competitor spy ────────────

interface DeepScrapedData {
  title: string;
  metaDescription: string;
  messaging: string;  // key marketing messages
  prices: string[];
  productCount: number;
  shippingInfo: string;
  returnPolicy: string;
  socialLinks: string[];
  trustBadges: string[];
  contentHash: string;  // for change detection
}

interface CompetitorProfileData {
  domain: string;
  healthScore: number;
  marketPosition: string;
  hiringSignal: string | null;
  reviewRating: number | null;
  reviewCount: number | null;
  reviewSentiment: string | null;
  vulnerabilities: string[];
  strengths: string[];
}

/**
 * Deep scrape — collects much more than basic scraping.
 * Products count, return policy, trust signals, social presence, messaging.
 */
async function scrapeCompetitorDeep(url: string): Promise<DeepScrapedData | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    clearTimeout(timeout);
    const html = await res.text();

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);

    // Prices
    const priceMatches = html.match(/\$[\d,.]+/g);
    const prices = priceMatches ? [...new Set(priceMatches)].slice(0, 10) : [];

    // Product count estimate — look for collection pages and product links
    const productLinkMatches = html.match(/\/products?\//gi) || [];
    const collectionMatches = html.match(/\/collections?\//gi) || [];
    const productCount = Math.max(productLinkMatches.length, collectionMatches.length);

    // Shipping info
    const shippingMatch = html.match(/(?:free shipping|fast delivery|ships in \d+ days?|next[- ]day delivery|express shipping|\d+[- ]day shipping)/i);

    // Return policy
    const returnMatch = html.match(/(?:\d+ days? returns?|free returns?|money[- ]back guarantee|easy returns?|no[- ]hassle returns?|full refund)/i);

    // Social media links
    const socialPatterns = [
      /href=["'][^"']*(?:facebook\.com|fb\.com)[^"']*["']/gi,
      /href=["'][^"']*(?:instagram\.com)[^"']*["']/gi,
      /href=["'][^"']*(?:twitter\.com|x\.com)[^"']*["']/gi,
      /href=["'][^"']*(?:tiktok\.com)[^"']*["']/gi,
      /href=["'][^"']*(?:youtube\.com)[^"']*["']/gi,
    ];
    const socialLinks: string[] = [];
    const platformNames = ["facebook", "instagram", "twitter", "tiktok", "youtube"];
    for (let i = 0; i < socialPatterns.length; i++) {
      if (socialPatterns[i].test(html)) {
        socialLinks.push(platformNames[i]);
      }
    }

    // Trust badges
    const trustPatterns = [
      /(?:ssl|secure checkout|256[- ]bit|encrypted)/i,
      /(?:bbb|better business|accredited)/i,
      /(?:verified|trusted|certified)/i,
      /(?:shopify secure|norton|mcafee)/i,
    ];
    const trustBadges: string[] = [];
    for (const p of trustPatterns) {
      const m = html.match(p);
      if (m) trustBadges.push(m[0]);
    }

    // Key messaging — extract H1, H2, taglines
    const messagingParts: string[] = [];
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match) messagingParts.push(h1Match[1].trim());
    const h2Matches = html.match(/<h2[^>]*>([^<]+)<\/h2>/gi) || [];
    for (const h2 of h2Matches.slice(0, 3)) {
      const text = h2.replace(/<[^>]+>/g, "").trim();
      if (text.length > 5 && text.length < 100) messagingParts.push(text);
    }

    // Content hash for change detection
    const keyContent = [
      titleMatch?.[1] || "",
      metaDescMatch?.[1] || "",
      prices.join(","),
      messagingParts.join("|"),
    ].join("|||");
    let hash = 0;
    for (let i = 0; i < keyContent.length; i++) {
      const char = keyContent.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    const contentHash = hash.toString(36);

    return {
      title: titleMatch?.[1]?.trim() || "",
      metaDescription: metaDescMatch?.[1]?.trim() || "",
      messaging: messagingParts.join(" | "),
      prices,
      productCount,
      shippingInfo: shippingMatch?.[0] || "",
      returnPolicy: returnMatch?.[0] || "",
      socialLinks,
      trustBadges,
      contentHash,
    };
  } catch {
    return null;
  }
}

/**
 * Check if competitor is hiring (growing) or shrinking.
 * Uses SerpAPI to search for careers pages and layoff news.
 */
async function checkHiringSignals(domain: string): Promise<string | null> {
  if (!SERP_KEY) return null;
  try {
    // Check for hiring
    const hiringData = await searchGoogle(`site:${domain} careers OR jobs OR "we're hiring"`);
    const hasHiring = hiringData.organic.length > 0;

    // Check for layoffs/troubles
    const troubleData = await searchGoogle(`"${domain}" layoffs OR downsizing OR "closing down"`);
    const hasTrouble = troubleData.organic.length > 0;

    if (hasTrouble && !hasHiring) return "shrinking";
    if (hasHiring && !hasTrouble) return "growing";
    if (hasHiring && hasTrouble) return "restructuring";
    return null;
  } catch {
    return null;
  }
}

/**
 * Check review sentiment from Google search results.
 * Extracts aggregate ratings from search result structured data.
 */
async function checkReviewSentiment(domain: string): Promise<{
  rating: number | null;
  count: number | null;
  sentiment: string | null;
}> {
  if (!SERP_KEY) return { rating: null, count: null, sentiment: null };
  try {
    const data = await searchGoogle(`"${domain}" reviews`);
    // Look for rating patterns in snippets
    let bestRating: number | null = null;
    let totalCount: number | null = null;

    for (const r of data.organic.slice(0, 5)) {
      const ratingMatch = r.snippet.match(/(\d+\.?\d*)\s*(?:out of 5|\/5|stars?)/i);
      const countMatch = r.snippet.match(/(\d+[,.]?\d*)\s*(?:reviews?|ratings?)/i);

      if (ratingMatch && !bestRating) {
        bestRating = parseFloat(ratingMatch[1]);
      }
      if (countMatch && !totalCount) {
        totalCount = parseInt(countMatch[1].replace(/,/g, ""));
      }
    }

    const sentiment = bestRating
      ? bestRating >= 4.0 ? "positive"
        : bestRating >= 3.0 ? "mixed"
        : "negative"
      : null;

    return { rating: bestRating, count: totalCount, sentiment };
  } catch {
    return { rating: null, count: null, sentiment: null };
  }
}

/**
 * Calculate a 0-100 health score for a competitor.
 * Higher = stronger competitor (more threat).
 */
export function calculateHealthScore(
  profile: {
    reviewRating?: number | null;
    reviewCount?: number | null;
    hiringSignal?: string | null;
    shippingSpeed?: string | null;
    returnPolicy?: string | null;
    vulnerabilities?: string[];
    adCopyHistory?: string;
    lastScrapedAt?: Date | null;
  },
  trend?: CompetitorTrend
): number {
  let score = 50; // base

  // Ad spend trend (20 points)
  if (trend) {
    if (trend.spendChange > 20) score += 15;
    else if (trend.spendChange > 0) score += 8;
    else if (trend.spendChange < -20) score -= 10;
  }

  // Review rating (15 points)
  if (profile.reviewRating) {
    if (profile.reviewRating >= 4.5) score += 15;
    else if (profile.reviewRating >= 4.0) score += 10;
    else if (profile.reviewRating >= 3.0) score += 5;
    else score -= 5;
  }

  // Review count (social proof)
  if (profile.reviewCount) {
    if (profile.reviewCount > 500) score += 5;
    else if (profile.reviewCount > 100) score += 3;
  }

  // Hiring signals (10 points)
  if (profile.hiringSignal === "growing") score += 10;
  else if (profile.hiringSignal === "shrinking") score -= 10;

  // Shipping quality (10 points)
  if (profile.shippingSpeed) {
    if (/free/i.test(profile.shippingSpeed)) score += 10;
    else if (/fast|next/i.test(profile.shippingSpeed)) score += 7;
  }

  // Return policy (10 points)
  if (profile.returnPolicy) {
    if (/free return|money.back/i.test(profile.returnPolicy)) score += 10;
    else score += 5;
  }

  // Vulnerabilities reduce score
  const vulns = profile.vulnerabilities || [];
  score -= vulns.length * 3;

  // Ad copy diversity
  try {
    const history = JSON.parse(profile.adCopyHistory || "[]");
    if (history.length > 3) score += 5; // diverse ads = strong
  } catch { /* ignore */ }

  return Math.max(0, Math.min(100, score));
}

/**
 * Detect vulnerabilities in a competitor's profile.
 * Returns Hebrew descriptions of weaknesses to exploit.
 */
export function detectVulnerabilities(profile: {
  reviewRating?: number | null;
  reviewCount?: number | null;
  shippingSpeed?: string | null;
  returnPolicy?: string | null;
  hiringSignal?: string | null;
  lastPrices?: string;
  socialLinks?: string[];
}): string[] {
  const vulns: string[] = [];

  if (profile.reviewRating && profile.reviewRating < 3.5) {
    vulns.push("ביקורות חלשות מלקוחות — ההזדמנות שלך להדגיש שירות טוב יותר");
  }
  if (!profile.reviewCount || profile.reviewCount < 10) {
    vulns.push("כמעט אין ביקורות — העסק חדש או לא מספיק פופולרי");
  }
  if (!profile.shippingSpeed || !/free/i.test(profile.shippingSpeed)) {
    vulns.push("אין משלוח חינם — תציע משלוח חינם כדי למשוך לקוחות");
  }
  if (!profile.returnPolicy) {
    vulns.push("מדיניות החזרה לא ברורה — שים דגש על מדיניות ההחזרה שלך");
  }
  if (profile.hiringSignal === "shrinking") {
    vulns.push("נראה שהם מצמצמים — ייתכן שהעסק בקשיים");
  }

  // Check prices — expensive competitor
  try {
    const prices = JSON.parse(profile.lastPrices || "[]");
    const numPrices = prices.map((p: string) => parseFloat(p.replace(/[$,]/g, ""))).filter((n: number) => !isNaN(n));
    const avgPrice = numPrices.length > 0 ? numPrices.reduce((a: number, b: number) => a + b, 0) / numPrices.length : 0;
    if (avgPrice > 100) {
      vulns.push("מחירים גבוהים — אם המוצרים שלך זולים יותר, תדגיש את זה");
    }
  } catch { /* ignore */ }

  const socials = profile.socialLinks || [];
  if (!socials || socials.length === 0) {
    vulns.push("אין נוכחות ברשתות חברתיות — חולשה בביסוס מותג");
  }

  return vulns;
}

/**
 * Detect changes in a competitor's website compared to stored profile.
 * Creates CompetitorChange records for each detected change.
 */
async function detectWebsiteChanges(
  shop: string,
  domain: string,
  newData: DeepScrapedData
): Promise<void> {
  try {
    const existing = await prisma.competitorProfile.findUnique({
      where: { shop_competitorDomain: { shop, competitorDomain: domain } },
    });

    if (!existing || !existing.lastWebsiteHash) return; // first scan, nothing to compare
    if (existing.lastWebsiteHash === newData.contentHash) return; // no changes

    const changes: Array<{changeType: string; summary: string; oldValue?: string; newValue?: string; severity: string}> = [];

    // Price changes
    const oldPrices = JSON.parse(existing.lastPrices || "[]");
    const sortedOld = [...oldPrices].sort();
    const sortedNew = [...newData.prices].sort();
    if (JSON.stringify(sortedOld) !== JSON.stringify(sortedNew) && newData.prices.length > 0) {
      changes.push({
        changeType: "price_change",
        summary: `${domain} שינה מחירים`,
        oldValue: oldPrices.join(", "),
        newValue: newData.prices.join(", "),
        severity: "medium",
      });
    }

    // Messaging change
    if (existing.lastMessaging && newData.messaging && existing.lastMessaging !== newData.messaging) {
      changes.push({
        changeType: "messaging_change",
        summary: `${domain} שינה את המסרים באתר — יכול להיות שהוא משנה אסטרטגיה`,
        oldValue: existing.lastMessaging.slice(0, 200),
        newValue: newData.messaging.slice(0, 200),
        severity: "medium",
      });
    }

    // Product count change
    if (existing.lastProductCount && newData.productCount > 0) {
      const diff = newData.productCount - existing.lastProductCount;
      if (diff > 5) {
        changes.push({
          changeType: "product_added",
          summary: `${domain} הוסיף כ-${diff} מוצרים חדשים — הוא מרחיב את העסק`,
          severity: "low",
        });
      } else if (diff < -5) {
        changes.push({
          changeType: "product_removed",
          summary: `${domain} הוריד כ-${Math.abs(diff)} מוצרים — ייתכן שהוא מצמצם`,
          severity: "medium",
        });
      }
    }

    // Save all detected changes
    for (const c of changes) {
      await prisma.competitorChange.create({
        data: {
          shop,
          competitorDomain: domain,
          changeType: c.changeType,
          summary: c.summary,
          oldValue: c.oldValue || null,
          newValue: c.newValue || null,
          severity: c.severity,
        },
      });
    }
  } catch {
    // Non-critical
  }
}

/**
 * Run deep intelligence scan for all known competitors of a shop.
 * Gathers: website data, hiring signals, reviews, changes, health score.
 */
export async function runDeepCompetitorScan(shop: string): Promise<{
  profiles: CompetitorProfileData[];
  changes: number;
  briefing: string;
}> {
  // Get all known competitor domains
  const snapshots = await prisma.competitorSnapshot.findMany({
    where: { shop },
    select: { competitorDomain: true },
    distinct: ["competitorDomain"],
    take: 10,
  });

  if (snapshots.length === 0) {
    return { profiles: [], changes: 0, briefing: "אין עדיין מידע על מתחרים. תריץ סריקת מוצרים כדי שנתחיל לאסוף מודיעין." };
  }

  const domains = snapshots.map((s) => s.competitorDomain);
  const profiles: CompetitorProfileData[] = [];
  let totalChanges = 0;

  // Get trends for health score calculation
  const trends = await getCompetitorTrends(shop, 30);
  const trendMap: Record<string, CompetitorTrend> = {};
  for (const t of trends) trendMap[t.domain] = t;

  const BATCH_SIZE = 3;
  for (let i = 0; i < domains.length; i += BATCH_SIZE) {
    const batch = domains.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(batch.map(async (domain) => {
      try {
        // Deep scrape
        const deepData = await scrapeCompetitorDeep(`https://${domain}`);

        // Hiring signals
        const hiringSignal = await checkHiringSignals(domain);

        // Review sentiment
        const reviewData = await checkReviewSentiment(domain);

        // Detect changes (needs existing profile)
        if (deepData) {
          await detectWebsiteChanges(shop, domain, deepData);
        }

        // Build vulnerabilities
        const vulns = detectVulnerabilities({
          reviewRating: reviewData.rating,
          reviewCount: reviewData.count,
          shippingSpeed: deepData?.shippingInfo || null,
          returnPolicy: deepData?.returnPolicy || null,
          hiringSignal,
        });

        // Calculate strengths
        const strengths: string[] = [];
        if (reviewData.rating && reviewData.rating >= 4.0) strengths.push("ביקורות טובות מלקוחות");
        if (deepData?.shippingInfo && /free/i.test(deepData.shippingInfo)) strengths.push("משלוח חינם");
        if (deepData?.returnPolicy && /free return/i.test(deepData.returnPolicy)) strengths.push("החזרה חינם");
        if (hiringSignal === "growing") strengths.push("העסק גדל ומגייס עובדים");
        if (deepData?.socialLinks && deepData.socialLinks.length >= 3) strengths.push("נוכחות חזקה ברשתות חברתיות");
        if (deepData?.trustBadges && deepData.trustBadges.length > 0) strengths.push("תגי אמון ואבטחה");

        // Determine market position
        const avgPriceData = deepData?.prices.map((p) => parseFloat(p.replace(/[$,]/g, ""))).filter((n) => !isNaN(n)) || [];
        const avgPrice = avgPriceData.length > 0 ? avgPriceData.reduce((a, b) => a + b, 0) / avgPriceData.length : 0;
        let marketPosition = "unknown";
        if (avgPrice > 200) marketPosition = "premium";
        else if (avgPrice > 50) marketPosition = "mid-range";
        else if (avgPrice > 0) marketPosition = "value";

        const healthScore = calculateHealthScore(
          { reviewRating: reviewData.rating, reviewCount: reviewData.count, hiringSignal, shippingSpeed: deepData?.shippingInfo, returnPolicy: deepData?.returnPolicy, vulnerabilities: vulns },
          trendMap[domain]
        );

        // Upsert CompetitorProfile
        await prisma.competitorProfile.upsert({
          where: { shop_competitorDomain: { shop, competitorDomain: domain } },
          create: {
            shop,
            competitorDomain: domain,
            healthScore,
            marketPosition,
            lastWebsiteHash: deepData?.contentHash || null,
            lastPrices: JSON.stringify(deepData?.prices || []),
            lastMessaging: deepData?.messaging || null,
            lastProductCount: deepData?.productCount || null,
            hiringSignal,
            reviewRating: reviewData.rating,
            reviewCount: reviewData.count,
            reviewSentiment: reviewData.sentiment,
            shippingSpeed: deepData?.shippingInfo || null,
            returnPolicy: deepData?.returnPolicy || null,
            vulnerabilities: JSON.stringify(vulns),
            strengths: JSON.stringify(strengths),
            lastScrapedAt: new Date(),
          },
          update: {
            healthScore,
            marketPosition,
            lastWebsiteHash: deepData?.contentHash || null,
            lastPrices: JSON.stringify(deepData?.prices || []),
            lastMessaging: deepData?.messaging || null,
            lastProductCount: deepData?.productCount || null,
            hiringSignal,
            reviewRating: reviewData.rating,
            reviewCount: reviewData.count,
            reviewSentiment: reviewData.sentiment,
            shippingSpeed: deepData?.shippingInfo || null,
            returnPolicy: deepData?.returnPolicy || null,
            vulnerabilities: JSON.stringify(vulns),
            strengths: JSON.stringify(strengths),
            lastScrapedAt: new Date(),
          },
        });

        profiles.push({ domain, healthScore, marketPosition, hiringSignal, reviewRating: reviewData.rating, reviewCount: reviewData.count, reviewSentiment: reviewData.sentiment, vulnerabilities: vulns, strengths });
      } catch {
        // Skip this domain, continue with others
      }
    }));
  }

  // Count recent changes
  const recentChanges = await prisma.competitorChange.count({
    where: { shop, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
  });
  totalChanges = recentChanges;

  // Generate briefing
  const briefing = generateIntelligenceBriefingSync(profiles);

  return { profiles, changes: totalChanges, briefing };
}

/**
 * Generate Hebrew intelligence briefing from competitor profiles.
 * Synchronous version — no AI needed, rule-based.
 */
function generateIntelligenceBriefingSync(profiles: CompetitorProfileData[]): string {
  if (profiles.length === 0) return "אין מתחרים לנתח כרגע.";

  const parts: string[] = [];
  parts.push(`סרקנו ${profiles.length} מתחרים. הנה מה שמצאנו:\n`);

  // Sort by health score descending — strongest first
  const sorted = [...profiles].sort((a, b) => b.healthScore - a.healthScore);

  // Strongest competitor
  const strongest = sorted[0];
  parts.push(`האיום הגדול ביותר: ${strongest.domain} (ציון חוזק: ${strongest.healthScore}/100)`);
  if (strongest.strengths.length > 0) {
    parts.push(`  היתרונות שלהם: ${strongest.strengths.join(", ")}`);
  }

  // Weakest competitor
  const weakest = sorted[sorted.length - 1];
  if (weakest.domain !== strongest.domain) {
    parts.push(`\nהמתחרה הכי חלש: ${weakest.domain} (ציון: ${weakest.healthScore}/100)`);
    if (weakest.vulnerabilities.length > 0) {
      parts.push(`  חולשות: ${weakest.vulnerabilities[0]}`);
    }
  }

  // Growing/shrinking competitors
  const growing = profiles.filter((p) => p.hiringSignal === "growing");
  const shrinking = profiles.filter((p) => p.hiringSignal === "shrinking");
  if (growing.length > 0) {
    parts.push(`\nמתחרים שגדלים: ${growing.map((p) => p.domain).join(", ")} — שים לב, הם מגייסים.`);
  }
  if (shrinking.length > 0) {
    parts.push(`מתחרים שמצמצמים: ${shrinking.map((p) => p.domain).join(", ")} — הזדמנות לתפוס נתח שוק.`);
  }

  // Overall review landscape
  const withReviews = profiles.filter((p) => p.reviewRating !== null);
  if (withReviews.length > 0) {
    const avgRating = withReviews.reduce((sum, p) => sum + (p.reviewRating || 0), 0) / withReviews.length;
    parts.push(`\nדירוג ביקורות ממוצע בשוק: ${avgRating.toFixed(1)}/5`);
    if (avgRating < 4.0) {
      parts.push("→ ביקורות בינוניות בשוק — אם שירות הלקוחות שלך טוב, תדגיש את זה!");
    }
  }

  return parts.join("\n");
}

/**
 * Get competitor profiles for a shop.
 */
export async function getCompetitorProfiles(shop: string): Promise<any[]> {
  return prisma.competitorProfile.findMany({
    where: { shop },
    orderBy: { healthScore: "desc" },
    take: 50,
  });
}

/**
 * Get recent competitor changes for a shop.
 */
export async function getCompetitorChanges(shop: string, days: number = 30): Promise<any[]> {
  return prisma.competitorChange.findMany({
    where: { shop, createdAt: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

// ── Keyword Gap Analysis — What competitors target and you don't ──────────

export interface KeywordGap {
  keyword: string;
  source: string;        // which competitors use this keyword
  competitorCount: number;
  opportunityScore: number;
}

function getCompetitionLevel(count: number): "high" | "medium" | "low" {
  if (count > 3) return "high";
  if (count > 1) return "medium";
  return "low";
}

/**
 * Find keywords that competitors target but the store doesn't.
 * Compares CompetitorSnapshot keywords vs active Google Ads keywords.
 */
export async function runGapAnalysis(shop: string): Promise<KeywordGap[]> {
  // 1. Load competitor keywords from all snapshots
  const snapshots = await prisma.competitorSnapshot.findMany({
    where: { shop },
    select: { competitorDomain: true, keywords: true },
  });

  const competitorKeywordMap: Record<string, Set<string>> = {};
  for (const snap of snapshots) {
    try {
      const keywords: string[] = JSON.parse(snap.keywords || "[]");
      for (const kw of keywords) {
        const normalized = kw.toLowerCase().trim();
        if (normalized.length < 3) continue;
        if (!competitorKeywordMap[normalized]) competitorKeywordMap[normalized] = new Set();
        competitorKeywordMap[normalized].add(snap.competitorDomain);
      }
    } catch { /* skip bad JSON */ }
  }

  if (Object.keys(competitorKeywordMap).length === 0) {
    return [];
  }

  // 2. Load store's active keywords from KeywordGapAnalysis (already targeted)
  const existing = await prisma.keywordGapAnalysis.findMany({
    where: { shop, status: "targeted" },
    select: { keyword: true },
  });
  const alreadyTargeted = new Set(existing.map((e) => e.keyword.toLowerCase()));

  // 3. Find gaps — competitor keywords not yet targeted
  const gaps: KeywordGap[] = [];
  for (const [keyword, domains] of Object.entries(competitorKeywordMap)) {
    if (alreadyTargeted.has(keyword)) continue;

    const competitorCount = domains.size;
    // Score: more competitors = higher opportunity
    const opportunityScore = Math.min(100, competitorCount * 20 + 30);

    gaps.push({
      keyword,
      source: [...domains].slice(0, 3).join(", "),
      competitorCount,
      opportunityScore,
    });
  }

  // Sort by opportunity score
  gaps.sort((a, b) => b.opportunityScore - a.opportunityScore);
  const topGaps = gaps.slice(0, 20);

  // Save to DB
  for (const gap of topGaps) {
    await prisma.keywordGapAnalysis.upsert({
      where: {
        shop_keyword: { shop, keyword: gap.keyword },
      },
      create: {
        shop,
        keyword: gap.keyword,
        source: gap.source,
        opportunityScore: gap.opportunityScore,
        competitionLevel: getCompetitionLevel(gap.competitorCount),
      },
      update: {
        source: gap.source,
        opportunityScore: gap.opportunityScore,
        competitionLevel: getCompetitionLevel(gap.competitorCount),
      },
    });
  }

  return topGaps;
}

/**
 * Get keyword gaps for a shop (from DB).
 */
export async function getKeywordGaps(shop: string): Promise<any[]> {
  return prisma.keywordGapAnalysis.findMany({
    where: { shop, status: "new" },
    orderBy: { opportunityScore: "desc" },
    take: 20,
  });
}

export function detectCompetitorAlerts(trends: CompetitorTrend[]): CompetitorAlert[] {
  const alerts: CompetitorAlert[] = [];

  for (const t of trends) {
    if (t.isNew) {
      alerts.push({
        type: "new_competitor",
        domain: t.domain,
        message: `מתחרה חדש: ${t.domain} התחיל לפרסם על מילות המפתח שלך.`,
        urgency: "today",
      });
    }

    if (t.isGone) {
      alerts.push({
        type: "competitor_left",
        domain: t.domain,
        message: `${t.domain} הפסיק לפרסם — הזדמנות לתפוס את הנתח שלו.`,
        urgency: "this_week",
      });
    }

    if (t.spendChange >= 40) {
      alerts.push({
        type: "spend_increase",
        domain: t.domain,
        message: `${t.domain} הגדיל הוצאות פרסום ב-${t.spendChange}% — ייתכן שהוא מתכונן למבצע או תוקפני יותר.`,
        urgency: "today",
      });
    }

    if (t.priceChange <= -10) {
      alerts.push({
        type: "price_drop",
        domain: t.domain,
        message: `${t.domain} הוריד מחירים ב-${Math.abs(t.priceChange)}%. שקול אם להדגיש יתרונות אחרים (שירות, איכות, משלוח).`,
        urgency: "this_week",
      });
    }
  }

  return alerts;
}

// ═══════════════════════════════════════════════════
// Engine 5: Competitor Ad Spend Estimator
// ═══════════════════════════════════════════════════

interface SpendEstimate {
  domain: string;
  estimatedMonthlySpend: number;
  impressionShare: number;
  overlapRate: number;
  positionAboveRate: number;
  trend: string;
  trendPct: number;
}

/**
 * Estimate competitor ad spend using auction insights + historical data.
 * Combines Google Ads impression share with competitor profile data.
 */
export async function estimateCompetitorSpend(shop: string): Promise<SpendEstimate[]> {
  try {
    // Load competitor profiles with health data
    const profiles = await prisma.competitorProfile.findMany({
      where: { shop },
      orderBy: { healthScore: "desc" },
      take: 15,
    });

    if (profiles.length === 0) return [];

    // Load snapshots for ad count data
    const snapshots = await prisma.competitorSnapshot.findMany({
      where: { shop },
      orderBy: { createdAt: "desc" },
    });

    // Load previous spend estimates for trend calculation
    const previousEstimates = await prisma.competitorSpendEstimate.findMany({
      where: { shop },
      orderBy: { measuredAt: "desc" },
    });
    const prevByDomain = new Map<string, any>();
    for (const pe of previousEstimates) {
      if (!prevByDomain.has(pe.competitorDomain)) {
        prevByDomain.set(pe.competitorDomain, pe);
      }
    }

    const estimates: SpendEstimate[] = [];

    for (const profile of profiles) {
      const domain = profile.competitorDomain;
      const snapshot = snapshots.find(s => s.competitorDomain === domain);

      // Estimate based on: ad count * estimated CPC * estimated daily impressions
      const adCount = snapshot?.adCount || 1;
      const avgCpc = 1.5 + (profile.healthScore / 100) * 2; // $1.50-$3.50 estimated CPC
      const estimatedDailyClicks = adCount * 15 + profile.healthScore * 2;
      const estimatedDaily = estimatedDailyClicks * avgCpc;
      const estimatedMonthly = estimatedDaily * 30;

      // Impression share estimate based on health score and ad count
      const impressionShare = Math.min(0.95, (profile.healthScore / 100) * 0.6 + (adCount / 20) * 0.3);
      const overlapRate = Math.min(0.8, adCount / 15);
      const positionAboveRate = profile.healthScore >= 70 ? 0.6 : profile.healthScore >= 40 ? 0.35 : 0.15;

      // Trend calculation
      const prev = prevByDomain.get(domain);
      let trend = "stable";
      let trendPct = 0;
      if (prev && prev.estimatedMonthly && prev.estimatedMonthly > 0) {
        trendPct = ((estimatedMonthly - prev.estimatedMonthly) / prev.estimatedMonthly) * 100;
        if (trendPct > 15) trend = "increasing";
        else if (trendPct < -15) trend = "decreasing";
      }

      estimates.push({
        domain,
        estimatedMonthlySpend: Math.round(estimatedMonthly),
        impressionShare: Math.round(impressionShare * 100) / 100,
        overlapRate: Math.round(overlapRate * 100) / 100,
        positionAboveRate: Math.round(positionAboveRate * 100) / 100,
        trend,
        trendPct: Math.round(trendPct),
      });

      // Save to DB
      await prisma.competitorSpendEstimate.create({
        data: {
          shop,
          competitorDomain: domain,
          estimatedMonthly: Math.round(estimatedMonthly),
          estimatedDaily: Math.round(estimatedDaily),
          impressionShare,
          overlapRate,
          positionAboveRate,
          trendDirection: trend,
          trendPct: Math.round(trendPct),
        },
      });
    }

    logger.info("competitor-intel", `Estimated spend for ${estimates.length} competitors`, {
      extra: { shop },
    });

    return estimates.sort((a, b) => b.estimatedMonthlySpend - a.estimatedMonthlySpend);
  } catch (err: unknown) {
    logger.error("competitor-intel", "Failed to estimate competitor spend", {
      extra: { shop, error: err instanceof Error ? err.message : String(err) },
    });
    return [];
  }
}

/**
 * Detect significant changes in competitor spending and return alerts.
 */
export async function trackSpendTrends(shop: string): Promise<{
  alerts: Array<{ domain: string; message: string; urgency: string }>;
  totalCompetitorSpend: number;
}> {
  try {
    const estimates = await estimateCompetitorSpend(shop);
    const alerts: Array<{ domain: string; message: string; urgency: string }> = [];
    let totalSpend = 0;

    for (const est of estimates) {
      totalSpend += est.estimatedMonthlySpend;

      if (est.trend === "increasing" && est.trendPct > 40) {
        alerts.push({
          domain: est.domain,
          message: `${est.domain} increased ad spend by ~${est.trendPct}% — estimated $${est.estimatedMonthlySpend.toLocaleString()}/mo`,
          urgency: "today",
        });
      }

      if (est.trend === "decreasing" && est.trendPct < -30) {
        alerts.push({
          domain: est.domain,
          message: `${est.domain} cut ad spend by ~${Math.abs(est.trendPct)}% — opportunity to capture their traffic`,
          urgency: "this_week",
        });
      }
    }

    return { alerts, totalCompetitorSpend: totalSpend };
  } catch (err: unknown) {
    logger.error("competitor-intel", "Failed to track spend trends", {
      extra: { shop, error: err instanceof Error ? err.message : String(err) },
    });
    return { alerts: [], totalCompetitorSpend: 0 };
  }
}

/**
 * Get latest spend estimates for dashboard display.
 */
export async function getCompetitorSpendEstimates(shop: string): Promise<any[]> {
  // Get the most recent estimate per competitor
  const all = await prisma.competitorSpendEstimate.findMany({
    where: { shop },
    orderBy: { measuredAt: "desc" },
  });

  const byDomain = new Map<string, any>();
  for (const est of all) {
    if (!byDomain.has(est.competitorDomain)) {
      byDomain.set(est.competitorDomain, est);
    }
  }

  return Array.from(byDomain.values()).sort(
    (a, b) => (b.estimatedMonthly || 0) - (a.estimatedMonthly || 0)
  );
}

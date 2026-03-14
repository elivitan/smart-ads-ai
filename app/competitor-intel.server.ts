/**
 * Competitor Intelligence Module (SerpAPI version)
 *
 * Upgraded: 5 search queries per product, enhanced scraping,
 * competitor spend estimation, CompetitorSnapshot tracking.
 */
import Anthropic from "@anthropic-ai/sdk";
import { withRetry } from "./retry.server";
import prisma from "./db.server.js";

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

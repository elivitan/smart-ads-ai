import Anthropic from "@anthropic-ai/sdk";
import { isCostLimitReached } from "./utils/api-cost-tracker.js";
import { withRetry } from "./retry.server.js";
import { analyzeWithCompetitorIntel } from "./competitor-intel.server.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Analyze a batch of products with competitor intelligence.
 * Flow: Google search → scrape competitors → check store ranking → Claude AI analysis
 */
export async function analyzeBatch(products, storeDomain = "") {
  // Cost guard — block if daily Anthropic limit reached
  if (isCostLimitReached("anthropic")) {
    console.warn("[AI] Daily Anthropic cost limit reached — blocking scan");
    return { products: [], error: "Daily AI processing limit reached. Try again tomorrow." };
  }
  console.log(
    "ANALYZE_BATCH storeDomain:",
    storeDomain,
    "products:",
    products.length,
  );
  // If we have a store domain, use competitor intelligence
  if (storeDomain) {
    try {
      return await analyzeWithCompetitorIntel(products, storeDomain);
    } catch (err) {
      console.error(
        "Competitor intel failed, falling back to basic analysis:",
        err.message,
      );
      // Fall back to basic analysis
      return await analyzeBatchBasic(products);
    }
  }
  return await analyzeBatchBasic(products);
}

/**
 * Basic analysis without competitor data (fallback)
 */
async function analyzeBatchBasic(products) {
  const productList = products
    .map(
      (p, i) =>
        `${i + 1}. "${p.title}" $${p.price} — ${(p.description || "").slice(0, 100)}`,
    )
    .join("\n");

  const response = await withRetry(
    () =>
      client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: `Google Ads RSA expert. Analyze these ${products.length} products. Return ONLY valid JSON, no markdown.

PRODUCTS:
${productList}

Rules: EXACTLY 15 headlines max 30 chars each. EXACTLY 3 long_headlines max 90 chars. EXACTLY 4 descriptions max 90 chars. ad_score measures ad-readiness (60-95 range, never below 60).

Return:
{
  "products": [
    {
      "title": "exact product title",
      "ad_score": 82,
      "ad_strength": "GOOD",
      "headlines": ["h1","h2","h3","h4","h5","h6","h7","h8","h9","h10","h11","h12","h13","h14","h15"],
      "long_headlines": ["long headline 1 max 90 chars","long headline 2","long headline 3"],
      "descriptions": ["description 1 max 90 chars","desc 2","desc 3","desc 4"],
      "keywords": [
        {"text":"keyword","match_type":"BROAD"},
        {"text":"keyword phrase","match_type":"PHRASE"},
        {"text":"exact keyword","match_type":"EXACT"},
        {"text":"another keyword","match_type":"BROAD"},
        {"text":"more keywords","match_type":"PHRASE"},
        {"text":"specific term","match_type":"EXACT"},
        {"text":"broad term","match_type":"BROAD"},
        {"text":"phrase match","match_type":"PHRASE"}
      ],
      "path1": "Shop",
      "path2": "Sale",
      "negative_keywords": ["free","diy","cheap"],
      "recommended_bid": 1.20, "target_demographics": "Adults 25-45", "sitelinks": [{"title":"Free Shipping","description":"On orders over $50","url":"/shipping"},{"title":"Sale Items","description":"Up to 50% off","url":"/sale"},{"title":"New Arrivals","description":"Latest products","url":"/new"},{"title":"Contact Us","description":"Get in touch","url":"/contact"}]

    }
  ]
}`,
          },
        ],
      }),
    { label: "Claude" },
  );

  const text = response.content[0].text.trim();
  const cleaned = text.startsWith("```")
    ? text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
    : text;

  const parsed = JSON.parse(cleaned);

  if (parsed.products) {
    parsed.products.forEach((p) => {
      if (p.headlines)
        p.headlines = p.headlines.map((h) => h.trim().slice(0, 30));
      if (p.descriptions)
        p.descriptions = p.descriptions.map((d) => d.trim().slice(0, 90));
      if (!p.ad_strength) {
        const s = p.ad_score || 0;
        p.ad_strength =
          s >= 90
            ? "EXCELLENT"
            : s >= 70
              ? "GOOD"
              : s >= 50
                ? "AVERAGE"
                : "POOR";
        if (p.ad_score < 60) p.ad_score = 60 + Math.floor(Math.random() * 15);
      }
    });
  }

  return parsed;
}

// Legacy export
export async function analyzeProducts(products) {
  return analyzeBatch(products.slice(0, 3));
}

/**
 * Smart product selection for large stores (50+ products).
 */
export async function selectBestProducts(products, maxProducts = 20) {
  if (products.length <= maxProducts) return products;

  const productList = products
    .map((p, i) => `${i}. "${p.title}" $${p.price}`)
    .join("\n");

  const response = await withRetry(
    () =>
      client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: `Google Ads expert. Select the ${maxProducts} products with highest advertising potential (price point, name clarity, market demand).

PRODUCTS:
${productList}

Return ONLY JSON array of selected indices (0-based):
{"selected": [0, 3, 7, 12]}`,
          },
        ],
      }),
    { label: "Claude" },
  );

  const text = response.content[0].text.trim();
  const cleaned = text.startsWith("```")
    ? text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
    : text;

  const parsed = JSON.parse(cleaned);
  return (parsed.selected || []).map((i) => products[i]).filter(Boolean);
}

/**
 * Campaign strategy for the whole store.
 */
export async function decideCampaignStrategy(products, storeInfo = {}) {
  const productList = products
    .map((p, i) => `${i + 1}. "${p.title}" $${p.price}`)
    .join("\n");
  const avgPrice =
    products.reduce((a, p) => a + parseFloat(p.price || 0), 0) /
    (products.length || 1);

  const response = await withRetry(
    () =>
      client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: `Google Ads strategist. Store: ${storeInfo.url || "shopify"} | ${products.length} products | Avg: $${avgPrice.toFixed(2)}

PRODUCTS:
${productList}

Return ONLY JSON:
{"strategy":{"campaign_type":"pmax","campaign_type_reason":"reason","bidding":"max_conversions","bidding_reason":"reason","daily_budget_recommended":30,"daily_budget_min":15,"daily_budget_aggressive":60,"budget_reason":"reason","locations":["US"],"languages":["en"],"estimated_monthly_results":{"impressions":5000,"clicks":200,"ctr_pct":4.0,"conversions":8,"cost":600,"roas":3.5},"confidence_score":85,"warnings":["warning"],"quick_wins":["tip"]}}`,
          },
        ],
      }),
    { label: "Claude" },
  );

  const text = response.content[0].text.trim();
  const cleaned = text.startsWith("```")
    ? text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
    : text;

  const parsed = JSON.parse(cleaned);
  const strategy = parsed.strategy;
  strategy.labels = {
    campaign_type:
      {
        pmax: "Maximum Reach",
        search: "Google Search Only",
        shopping: "Google Shopping",
      }[strategy.campaign_type] || strategy.campaign_type,
    bidding:
      {
        max_conversions: "Maximize sales",
        max_conv_value: "Maximize revenue",
        max_clicks: "Maximize traffic",
      }[strategy.bidding] || strategy.bidding,
  };
  return parsed;
}

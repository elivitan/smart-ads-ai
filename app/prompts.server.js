/**
 * prompts.server.js
 *
 * All AI prompts in one place.
 * Change prompts here without touching business logic.
 *
 * Usage:
 *   import { PROMPTS } from "./prompts.server.js";
 *   const prompt = PROMPTS.analyzeBatch(products);
 */

export const PROMPTS = {
  /**
   * Analyze a batch of products for Google Ads potential.
   * Used by: ai.server.js → analyzeBatch()
   */
  analyzeBatch: (products) =>
    `Google Ads RSA expert. Analyze these ${products.length} products. Return JSON only, no markdown.
For each product return: { "products": [{ "id", "ad_score" (0-100), "headlines" (5 unique, max 30 chars each), "descriptions" (3 unique, max 90 chars), "keywords" (10 high-intent search terms), "recommended_bid" (USD), "target_audience", "ad_strength" }] }

Products:
${products.map((p, i) => `${i + 1}. "${p.title}" - $${p.price} - ${(p.description || "").slice(0, 120)}`).join("\n")}

Rules:
- Headlines must be ≤30 chars, unique, include product name or key benefit
- Descriptions must be ≤90 chars, include call-to-action
- Keywords should be buyer-intent (not informational)
- ad_score: 90+ = excellent for ads, 70-89 = good, 50-69 = needs work, <50 = poor fit
- Respond ONLY with valid JSON, no explanation`,

  /**
   * Select best products from a larger catalog.
   * Used by: ai.server.js → selectBestProducts()
   */
  selectBest: (products, maxProducts) =>
    `Google Ads expert. Select the ${maxProducts} products with highest ad potential from this list. Return JSON only.
Return: { "selected": [indices of best products, 0-based] }

Products:
${products.map((p, i) => `${i}. "${p.title}" - $${p.price}`).join("\n")}

Criteria: high margin potential, clear search intent, competitive pricing, broad appeal.
Respond ONLY with valid JSON.`,

  /**
   * Decide campaign strategy based on store + product data.
   * Used by: ai.server.js → decideCampaignStrategy()
   */
  campaignStrategy: (storeInfo, productSummary) =>
    `Google Ads strategist. Store: ${storeInfo.url || "shopify"} | ${productSummary}

Decide the optimal campaign setup. Return JSON only:
{"strategy":{"campaign_type":"pmax","campaign_type_reason":"reason","bidding":"max_conversions","bidding_reason":"reason","daily_budget_recommended":30,"daily_budget_min":15,"daily_budget_aggressive":60,"budget_reason":"reason","locations":["US"],"languages":["en"],"estimated_monthly_results":{"impressions":5000,"clicks":200,"ctr_pct":4.0,"conversions":8,"cost":600,"roas":3.5},"confidence_score":85,"warnings":["warning"],"quick_wins":["tip"]}}

Rules:
- campaign_type: "pmax" for most stores, "search" for niche/small budget
- bidding: "max_conversions" default, "max_clicks" for new stores
- budget_min: minimum viable daily spend
- budget_aggressive: for fast growth
- Be realistic with estimates
Respond ONLY with valid JSON.`,

  /**
   * Competitor intelligence analysis.
   * Used by: competitor-intel.server.js → analyzeWithCompetitorIntel()
   */
  competitorAnalysis: (product, competitors) =>
    `Google Ads competitor analyst. Analyze this product vs competitors and create winning ad copy.

Product: "${product.title}" - $${product.price}
${product.description ? `Description: ${product.description.slice(0, 200)}` : ""}

Competitor landscape:
${competitors.map((c, i) => `${i + 1}. ${c.domain}: "${c.title}" ${c.snippet ? `- ${c.snippet.slice(0, 100)}` : ""}`).join("\n")}

Return JSON only:
{"headlines": ["5 unique headlines, max 30 chars, differentiated from competitors"], "descriptions": ["3 unique, max 90 chars, with competitive advantages"], "keywords": ["15 high-intent keywords including competitor gaps"], "competitor_insights": "brief analysis", "recommended_bid": 1.50, "ad_score": 85, "keyword_gaps": ["keywords competitors use that this product should target"]}

Rules:
- Headlines must highlight unique selling points vs competitors
- Include at least 2 price-competitive or value-focused headlines
- Keywords should include competitor brand alternatives
Respond ONLY with valid JSON.`,

  /**
   * Keyword research from a seed topic.
   * Used by: keyword-research.server.js
   */
  keywordResearch: (topic, context) =>
    `SEO and Google Ads keyword expert. Generate comprehensive keyword research for: "${topic}"
${context ? `Context: ${context}` : ""}

Return JSON only:
{"keywords": [{"keyword": "string", "search_volume": number, "competition": "low|medium|high", "cpc_estimate": number, "intent": "commercial|informational|navigational|transactional", "match_type": "broad|phrase|exact"}]}

Rules:
- Include 20-30 keywords
- Mix of head terms and long-tail
- Focus on commercial and transactional intent
- Include negative keyword suggestions
Respond ONLY with valid JSON.`,

  /**
   * Keyword expansion from existing keywords.
   * Used by: keyword-research.server.js → expandKeywords()
   */
  keywordExpansion: (seedKeywords, productTitle) =>
    `Google Ads keyword expert. Expand these seed keywords for "${productTitle}":
${seedKeywords.join(", ")}

Return JSON only:
{"expanded": [{"keyword": "string", "match_type": "broad|phrase|exact", "estimated_cpc": number, "relevance_score": number}]}

Rules:
- Generate 15-25 expanded keywords
- Include long-tail variations
- Include buyer-intent modifiers (buy, best, cheap, near me, review)
- Maintain relevance to original product
Respond ONLY with valid JSON.`,
};

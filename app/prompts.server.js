/**
 * prompts.server.js
 * 
 * All AI prompts — aligned with Google Ads requirements.
 * RSA: up to 15 headlines (30 chars), 4 descriptions (90 chars)
 * PMax: + long headlines (90 chars), business name (25 chars)
 * 
 * Usage:
 *   import { PROMPTS } from "./prompts.server.js";
 */

export const PROMPTS = {

  /**
   * Analyze a batch of products for Google Ads.
   * Generates assets for BOTH RSA and PMax campaigns.
   */
  analyzeBatch: (products) =>
    `You are a Google Ads expert. Analyze these ${products.length} products and generate campaign-ready assets.

PRODUCTS:
${products.map((p, i) => `${i + 1}. "${p.title}" - $${p.price} - ${(p.description || "").slice(0, 150)}`).join("\n")}

Return ONLY valid JSON (no markdown, no backticks):
{
  "products": [
    {
      "title": "exact product title",
      "ad_score": 82,
      "ad_strength": "GOOD",
      "headlines": ["15 unique headlines, EACH max 30 characters"],
      "long_headlines": ["3 unique long headlines, EACH max 90 characters"],
      "descriptions": ["4 unique descriptions, EACH max 90 characters"],
      "keywords": [
        {"text": "keyword", "match_type": "BROAD"},
        {"text": "keyword phrase", "match_type": "PHRASE"},
        {"text": "exact keyword", "match_type": "EXACT"}
      ],
      "negative_keywords": ["free", "diy", "cheap", "used", "repair", "how to", "tutorial"],
      "path1": "Shop",
      "path2": "BestDeals",
      "recommended_bid": 1.50,
      "target_demographics": "Adults 25-45",
      "sitelinks": [
        {"title": "max 25 chars", "description": "max 35 chars", "url": "/page"}
      ]
    }
  ]
}

STRICT RULES:
- headlines: EXACTLY 15 unique headlines. Each MUST be ≤30 characters. Include product name, benefits, CTAs, urgency, price points.
- long_headlines: EXACTLY 3. Each MUST be ≤90 characters. More descriptive, include value proposition.
- descriptions: EXACTLY 4 unique descriptions. Each MUST be ≤90 characters. Include CTA, benefits, social proof.
- keywords: 15-20 high-intent keywords. Mix of BROAD, PHRASE, EXACT match types. Focus on buyer intent.
- negative_keywords: 7-10 keywords to exclude (informational, DIY, free, etc.)
- sitelinks: EXACTLY 4. Title max 25 chars, description max 35 chars.
- path1/path2: max 15 characters each, relevant to product category.
- ad_score: 60-95 range. 90+=excellent, 70-89=good, 50-69=average.
- ad_strength: EXCELLENT/GOOD/AVERAGE/POOR based on asset quality and variety.`,

  /**
   * Select best products for advertising.
   */
  selectBest: (products, maxProducts) =>
    `Google Ads expert. Select the ${maxProducts} products with highest ad potential from this list. Return JSON only.
Return: { "selected": [indices of best products, 0-based] }

Products:
${products.map((p, i) => `${i}. "${p.title}" - $${p.price}`).join("\n")}

Criteria: high margin potential, clear search intent, competitive pricing, broad appeal.
Respond ONLY with valid JSON.`,

  /**
   * Campaign strategy.
   */
  campaignStrategy: (storeInfo, productSummary) =>
    `Google Ads strategist. Store: ${storeInfo.url || "shopify"} | ${productSummary}

Decide the optimal campaign setup. Return JSON only:
{"strategy":{"campaign_type":"pmax","campaign_type_reason":"reason","bidding":"max_conversions","bidding_reason":"reason","daily_budget_recommended":30,"daily_budget_min":15,"daily_budget_aggressive":60,"budget_reason":"reason","locations":["US"],"languages":["en"],"estimated_monthly_results":{"impressions":5000,"clicks":200,"ctr_pct":4.0,"conversions":8,"cost":600,"roas":3.5},"confidence_score":85,"warnings":["warning"],"quick_wins":["tip"]}}

Rules:
- campaign_type: "pmax" for most stores, "search" for niche/small budget
- bidding: "max_conversions" default, "max_clicks" for new stores
- Be realistic with estimates
Respond ONLY with valid JSON.`,

  /**
   * Competitor analysis with full Google Ads asset generation.
   */
  competitorAnalysis: (product, competitors) =>
    `Google Ads competitor analyst. Create winning ad assets for this product based on competitive landscape.

Product: "${product.title}" - $${product.price}
${product.description ? `Description: ${product.description.slice(0, 200)}` : ""}

Competitor landscape:
${competitors.map((c, i) => `${i + 1}. ${c.domain}: "${c.title}" ${c.snippet ? `- ${c.snippet.slice(0, 100)}` : ""}`).join("\n")}

Return ONLY valid JSON:
{
  "headlines": ["15 unique headlines max 30 chars each, differentiated from competitors"],
  "long_headlines": ["3 long headlines max 90 chars each"],
  "descriptions": ["4 descriptions max 90 chars each with competitive advantages"],
  "keywords": [{"text":"keyword","match_type":"BROAD|PHRASE|EXACT"}],
  "negative_keywords": ["7-10 exclusion keywords"],
  "competitor_insights": "brief analysis",
  "recommended_bid": 1.50,
  "ad_score": 85,
  "keyword_gaps": ["keywords competitors use that this product should target"]
}

RULES:
- headlines: EXACTLY 15, each ≤30 chars. Include USPs vs competitors, price advantages, urgency.
- long_headlines: EXACTLY 3, each ≤90 chars. Compelling value propositions.
- descriptions: EXACTLY 4, each ≤90 chars. Highlight competitive advantages.
- keywords: 15-20 with mix of BROAD/PHRASE/EXACT. Include competitor alternative terms.
- negative_keywords: 7-10 to avoid wasted spend.
Respond ONLY with valid JSON.`,

  /**
   * Keyword research.
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

  keywordExpansion: (seedKeywords, productTitle) =>
    `Google Ads keyword expert. Expand these seed keywords for "${productTitle}":
${seedKeywords.join(", ")}

Return JSON only:
{"expanded": [{"keyword": "string", "match_type": "broad|phrase|exact", "estimated_cpc": number, "relevance_score": number}]}

Rules:
- Generate 15-25 expanded keywords
- Include long-tail variations
- Include buyer-intent modifiers (buy, best, cheap, near me, review)
Respond ONLY with valid JSON.`,
};

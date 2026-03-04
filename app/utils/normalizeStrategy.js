/**
 * normalizeStrategy.js
 *
 * Decoupling layer between AI raw output and UI components.
 * The Wizard never touches AI internals directly — only this DTO.
 *
 * If AI format changes, fix HERE only. Wizard stays untouched.
 */

const GOAL_LABELS = {
  sales: "Get More Sales",
  leads: "Get Leads & Signups",
  traffic: "More Store Visitors",
  awareness: "Get Your Brand Known",
};

const CAMPAIGN_TYPE_LABELS = {
  pmax: "Maximum Reach (Performance Max)",
  search: "Google Search Only",
  shopping: "Product Shopping Ads",
  display: "Banner Ads on Websites",
  video: "YouTube Video Ads",
};

const BIDDING_LABELS = {
  max_conversions: "Most Sales for My Budget",
  max_conv_value: "Highest Revenue",
  max_clicks: "Most Visitors",
  target_cpa: "Set a Cost Per Sale",
  target_roas: "Set a Return Target",
};

/**
 * Normalize raw AI strategy into a clean DTO for the Wizard.
 * @param {object|null} raw - Raw AI strategy from decideCampaignStrategy()
 * @returns {object|null} Normalized strategy DTO
 */
export function normalizeStrategy(raw) {
  if (!raw) return null;

  // Support both { strategy: {...} } and direct {...}
  const s = raw.strategy || raw;

  return {
    // ── Goal ──
    goal: s.goal || s.campaign_goal || "sales",
    goalLabel: GOAL_LABELS[s.goal] || s.goal || "Sales",
    goalReason: s.goal_reason || s.goalReason || "",

    // ── Campaign Type ──
    campaignType: s.campaign_type || s.campaignType || "pmax",
    campaignTypeLabel:
      CAMPAIGN_TYPE_LABELS[s.campaign_type] ||
      s.campaign_type ||
      "Performance Max",
    campaignTypeReason: s.campaign_type_reason || s.campaignTypeReason || "",

    // ── Bidding ──
    bidding: s.bidding || s.bidding_strategy || "max_conversions",
    biddingLabel:
      BIDDING_LABELS[s.bidding] || s.bidding || "Maximize Conversions",
    biddingReason: s.bidding_reason || s.biddingReason || "",
    biddingTarget: s.bidding_target || s.target_value || null,

    // ── Budget ──
    budget: {
      min: s.daily_budget_min || s.budgetMin || 10,
      recommended: s.daily_budget_recommended || s.budgetRecommended || 30,
      aggressive: s.daily_budget_aggressive || s.budgetAggressive || 60,
      reason: s.budget_reason || s.budgetReason || "",
    },

    // ── Audience ──
    locations: s.locations || ["US"],
    locationsReason: s.locations_reason || s.locationsReason || "",
    languages: s.languages || ["en"],
    audienceDescription: s.audience_description || s.audienceDescription || "",

    // ── Projections ──
    projections: {
      impressions: s.estimated_monthly_results?.impressions || 0,
      clicks: s.estimated_monthly_results?.clicks || 0,
      ctr: s.estimated_monthly_results?.ctr_pct || 0,
      conversions: s.estimated_monthly_results?.conversions || 0,
      cost: s.estimated_monthly_results?.cost || 0,
      roas: s.estimated_monthly_results?.roas || 0,
    },

    // ── Confidence ──
    confidence: s.confidence_score || s.confidence || 0,
    confidenceReason: s.confidence_reason || s.confidenceReason || "",

    // ── Extras ──
    warnings: s.warnings || [],
    quickWins: s.quick_wins || s.quickWins || [],
  };
}

/**
 * Create a minimal strategy from product AI data (when full strategy is unavailable).
 * @param {object} aiData - Product-level AI analysis
 * @returns {object} Minimal strategy DTO
 */
export function strategyFromProduct(aiData) {
  if (!aiData) return null;

  return normalizeStrategy({
    goal: "sales",
    campaign_type: "pmax",
    bidding: "max_conversions",
    daily_budget_recommended: aiData.recommended_bid
      ? Math.round(aiData.recommended_bid * 30)
      : 30,
    daily_budget_min: 10,
    daily_budget_aggressive: 60,
    locations: ["US"],
    languages: ["en"],
    estimated_monthly_results: aiData.estimated_metrics || {},
  });
}

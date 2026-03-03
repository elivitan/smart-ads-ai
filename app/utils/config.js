/**
 * config.js
 * Central configuration for Smart Ads AI.
 * All tunable values in one place.
 */
export const CONFIG = {
  ai: {
    models: {
      fast: "claude-haiku-4-5-20251001",
      smart: "claude-sonnet-4-20250514",
    },
    maxRetries: 3,
    retryDelays: [1000, 2000, 4000],
    batchSize: 10,
    maxTokens: 4096,
    temperature: 0.3,
  },
  healthScore: {
    weights: { adQuality: 0.35, productCoverage: 0.25, competitorIntel: 0.20, budgetEfficiency: 0.20 },
    curve: { power: 0.85 },
    decay: {
      fresh: { days: 1, factor: 1.0 }, recent: { days: 7, factor: 0.95 },
      week: { days: 14, factor: 0.9 }, month: { days: 30, factor: 0.8 },
      stale: { days: 60, factor: 0.6 }, veryStale: { days: 90, factor: 0.4 },
    },
    confidence: {
      veryLow: { products: 2, factor: 0.5 }, low: { products: 5, factor: 0.7 },
      medium: { products: 10, factor: 0.85 }, high: { products: 20, factor: 0.95 },
      full: { products: 21, factor: 1.0 },
    },
    criticalPenaltyPerIssue: 8, maxCriticalPenalty: 30, industryBaseline: 62,
    grades: {
      A: { min: 85, color: "#22c55e", label: "Excellent" },
      B: { min: 70, color: "#84cc16", label: "Good" },
      C: { min: 55, color: "#f59e0b", label: "Average" },
      D: { min: 40, color: "#f97316", label: "Needs Work" },
      F: { min: 0, color: "#ef4444", label: "Critical" },
    },
  },
  livePulse: {
    targetFps: 24, defaultCpc: 0.44,
    pollIntervalLive: 30000, pollIntervalDemo: 2800,
  },
  launch: {
    pollInterval: 2000, pollMaxAttempts: 30,
    submitTimeout: 15000, fetchTimeout: 60000,
    maxRetries: 3, retryDelays: [2000, 5000, 10000],
  },
  campaignControl: {
    verifyDelay: 3000, verifyMaxAttempts: 5,
    maxRetries: 3, retryDelays: [2000, 5000, 10000],
  },
  googleAds: {
    maxHeadlines: 15, maxDescriptions: 4,
    headlineMaxChars: 30, descriptionMaxChars: 90,
    maxImagesPerPMax: 5, maxVideosPerPMax: 3,
    budgetMin: 1, budgetMax: 10000, defaultBudget: 50,
    supportedCampaignTypes: ["search", "pmax", "shopping", "display", "video"],
    supportedBidding: ["max_conversions", "max_clicks", "target_cpa", "target_roas", "max_conv_value"],
  },
  competitor: {
    maxCompetitors: 10, maxKeywordGaps: 50,
    serpApiMaxResults: 10, scrapeTimeout: 8000,
  },
  credits: {
    plans: {
      free: { scanCredits: 3, aiCredits: 5, campaignsPerDay: 1 },
      starter: { scanCredits: 20, aiCredits: 50, campaignsPerDay: 5 },
      pro: { scanCredits: 100, aiCredits: 200, campaignsPerDay: 20 },
      premium: { scanCredits: -1, aiCredits: -1, campaignsPerDay: -1 },
    },
    trialDays: 7,
  },
  rateLimits: {
    aiCallsPerMinute: 10, googleAdsCallsPerMinute: 30,
    serpApiCallsPerDay: 100, campaignCreationsPerHour: 5,
  },
  features: {
    enablePMaxImages: true, enablePMaxVideos: false,
    enableCompetitorScraping: true, enableLaunchPolling: true,
    enableHealthDecay: true, enableNonLinearScoring: true,
    showConfidenceInHealthScore: true, showIndustryBaseline: true,
  },
};

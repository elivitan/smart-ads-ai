// scale-config.js — Centralized configuration for scale settings
// All thresholds, limits, and feature flags in one place

export const SCALE = {
  // Database
  DB_POOL_MIN: parseInt(process.env.DB_POOL_MIN || "2"),
  DB_POOL_MAX: parseInt(process.env.DB_POOL_MAX || "10"),
  DB_TIMEOUT_MS: parseInt(process.env.DB_TIMEOUT_MS || "10000"),

  // Rate limits (requests per minute per shop)
  RATE_LIMIT: {
    scan: 10,
    ai: 20,
    campaign: 20,
    state: 60,
    polling: 60,
    subscription: 20,
  },

  // API cost thresholds (daily USD)
  COST_ALERTS: {
    ANTHROPIC_DAILY_MAX: parseFloat(process.env.ANTHROPIC_DAILY_MAX || "50"),
    SERPER_DAILY_MAX: parseFloat(process.env.SERPER_DAILY_MAX || "25"),
    GOOGLE_ADS_DAILY_MAX: parseFloat(process.env.GOOGLE_ADS_DAILY_MAX || "100"),
  },

  // Cache TTLs (seconds)
  CACHE: {
    SCAN_RESULT: 24 * 3600,
    AI_ANALYSIS: 48 * 3600,
    KEYWORD_DATA: 12 * 3600,
    COMPETITOR_DATA: 24 * 3600,
  },

  // Feature flags
  FEATURES: {
    USE_REDIS: process.env.USE_REDIS === "true",
    USE_QUEUES: process.env.USE_QUEUES === "true",
    USE_CACHE: process.env.USE_CACHE === "true",
  },

  // Deployment
  MAX_INSTANCES: parseInt(process.env.MAX_INSTANCES || "3"),
  HEALTH_CHECK_INTERVAL_MS: 30000,
};

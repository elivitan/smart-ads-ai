// scale-config.ts — Centralized configuration for scale settings
// All thresholds, limits, and feature flags in one place

export interface RateLimitConfig {
  scan: number;
  ai: number;
  campaign: number;
  state: number;
  polling: number;
  subscription: number;
}

export interface CostAlertConfig {
  ANTHROPIC_DAILY_MAX: number;
  SERPER_DAILY_MAX: number;
  GOOGLE_ADS_DAILY_MAX: number;
}

export interface CacheTTLConfig {
  SCAN_RESULT: number;
  AI_ANALYSIS: number;
  KEYWORD_DATA: number;
  COMPETITOR_DATA: number;
}

export interface FeatureFlagConfig {
  USE_REDIS: boolean;
  USE_QUEUES: boolean;
  USE_CACHE: boolean;
}

export interface ScaleConfig {
  DB_POOL_MIN: number;
  DB_POOL_MAX: number;
  DB_TIMEOUT_MS: number;
  RATE_LIMIT: RateLimitConfig;
  COST_ALERTS: CostAlertConfig;
  CACHE: CacheTTLConfig;
  FEATURES: FeatureFlagConfig;
  MAX_INSTANCES: number;
  HEALTH_CHECK_INTERVAL_MS: number;
}

export const SCALE: ScaleConfig = {
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

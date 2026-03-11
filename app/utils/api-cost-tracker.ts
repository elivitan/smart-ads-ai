// api-cost-tracker.ts — Track API costs in real-time
// Critical for scale: prevents runaway API costs from sinking the business
// Integrates with SCALE.COST_ALERTS thresholds

import { logger } from "./logger.js";
import { SCALE } from "./scale-config.js";

export type ApiService = "anthropic" | "serper" | "google_ads";

export interface CostResult {
  totalToday: number;
  limitReached: boolean;
}

export interface ServiceCostInfo {
  spent: string;
  limit: number | null;
}

export type CostSummary = Record<string, ServiceCostInfo>;

// In-memory cost tracking (resets on restart — use Redis for persistence)
const dailyCosts = new Map<string, number>();

function todayKey(service: ApiService): string {
  return new Date().toISOString().split("T")[0] + ":" + service;
}

/**
 * Record an API cost.
 */
export function recordCost(service: ApiService, costUsd: number): CostResult {
  const key = todayKey(service);
  const current = dailyCosts.get(key) || 0;
  const newTotal = current + costUsd;
  dailyCosts.set(key, newTotal);

  const limits: Record<ApiService, number> = {
    anthropic: SCALE.COST_ALERTS.ANTHROPIC_DAILY_MAX,
    serper: SCALE.COST_ALERTS.SERPER_DAILY_MAX,
    google_ads: SCALE.COST_ALERTS.GOOGLE_ADS_DAILY_MAX,
  };

  const limit = limits[service] || 100;
  const limitReached = newTotal >= limit;

  if (limitReached) {
    logger.error("cost.alert", `${service} daily cost $${newTotal.toFixed(2)} exceeded limit $${limit}`);
  } else if (newTotal >= limit * 0.8) {
    logger.warn("cost.warning", `${service} at $${newTotal.toFixed(2)} / $${limit} (80% threshold)`);
  }

  return { totalToday: newTotal, limitReached };
}

/**
 * Check if a service has reached its daily cost limit.
 * Use before making expensive API calls.
 */
export function isCostLimitReached(service: ApiService): boolean {
  const key = todayKey(service);
  const current = dailyCosts.get(key) || 0;
  const limits: Record<ApiService, number> = {
    anthropic: SCALE.COST_ALERTS.ANTHROPIC_DAILY_MAX,
    serper: SCALE.COST_ALERTS.SERPER_DAILY_MAX,
    google_ads: SCALE.COST_ALERTS.GOOGLE_ADS_DAILY_MAX,
  };
  return current >= (limits[service] || 100);
}

/**
 * Get cost summary for health endpoint / dashboard.
 */
export function getCostSummary(): CostSummary {
  const today = new Date().toISOString().split("T")[0];
  const summary: CostSummary = {};
  for (const [key, val] of dailyCosts) {
    if (key.startsWith(today)) {
      const service = key.split(":")[1];
      summary[service] = { spent: val.toFixed(2), limit: null };
    }
  }
  // Add limits
  summary.anthropic = { ...(summary.anthropic || { spent: "0.00" }), limit: SCALE.COST_ALERTS.ANTHROPIC_DAILY_MAX };
  summary.serper = { ...(summary.serper || { spent: "0.00" }), limit: SCALE.COST_ALERTS.SERPER_DAILY_MAX };
  summary.google_ads = { ...(summary.google_ads || { spent: "0.00" }), limit: SCALE.COST_ALERTS.GOOGLE_ADS_DAILY_MAX };
  return summary;
}

// Auto-cleanup old entries daily
setInterval(() => {
  const today = new Date().toISOString().split("T")[0];
  for (const key of dailyCosts.keys()) {
    if (!key.startsWith(today)) dailyCosts.delete(key);
  }
}, 60 * 60 * 1000); // Every hour

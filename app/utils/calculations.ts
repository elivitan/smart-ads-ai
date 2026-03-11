/**
 * calculations.ts
 * Pure utility functions — no React, no side effects.
 * Easy to unit test.
 */

export interface BudgetProjections {
  cpc: number;
  dailyClicks: number;
  dailyOrders: number;
  dailyRevenue: number;
  dailyProfit: number;
  roas: number;
  breakEvenDays: number | null;
}

export interface HealthScoreInput {
  analyzedCount: number;
  totalProducts: number;
  avgScore: number;
  competitorCount: number;
  keywordGapCount: number;
}

export interface Product {
  handle?: string;
  title?: string;
  [key: string]: unknown;
}

export function calcROAS(revenue: number, spend: number): number {
  if (!spend || spend === 0) return 0;
  return parseFloat((revenue / spend).toFixed(1));
}

export function calcBudgetProjections(
  dailyBudget: number,
  avgOrderValue: number,
  convRate: number,
  avgScore: number,
): BudgetProjections {
  const cpc = Math.max(0.25, 1.2 - avgScore * 0.006);
  const dailyClicks = Math.round(dailyBudget / cpc);
  const dailyOrders = (dailyClicks * convRate) / 100;
  const dailyRevenue = dailyOrders * avgOrderValue;
  const dailyProfit = dailyRevenue - dailyBudget;
  const roas = dailyBudget > 0 ? parseFloat((dailyRevenue / dailyBudget).toFixed(1)) : 0;
  const breakEvenDays =
    dailyProfit > 0 ? Math.ceil((dailyBudget * 30) / dailyProfit) : null;
  return {
    cpc,
    dailyClicks,
    dailyOrders,
    dailyRevenue,
    dailyProfit,
    roas,
    breakEvenDays,
  };
}

export function calcHealthScore({
  analyzedCount,
  totalProducts,
  avgScore,
  competitorCount,
  keywordGapCount,
}: HealthScoreInput): number {
  if (analyzedCount === 0) return 0;
  const coverage = totalProducts > 0 ? (analyzedCount / totalProducts) * 25 : 0;
  const scoreComp = avgScore * 0.4;
  const competitorComp = Math.min(competitorCount * 5, 20);
  const keywordComp = Math.min(keywordGapCount * 1.5, 15);
  return Math.min(
    Math.round(coverage + scoreComp + competitorComp + keywordComp),
    100,
  );
}

export function getProductUrl(product: Product | null | undefined, storeUrl?: string): string {
  if (!storeUrl) storeUrl = "https://your-store.myshopify.com";
  if (product?.handle) return `${storeUrl}/products/${product.handle}`;
  if (product?.title) {
    const handle = product.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return `${storeUrl}/products/${handle}`;
  }
  return storeUrl;
}

export function formatCurrency(amount: number): string {
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`;
  return `$${Math.round(amount).toLocaleString()}`;
}

export function getRoasColor(roas: number): string {
  if (roas >= 4) return "#22c55e";
  if (roas >= 2) return "#f59e0b";
  return "#ef4444";
}

export function getRoasLabel(roas: number): string {
  if (roas >= 4) return "Excellent";
  if (roas >= 2) return "Good";
  return "Low";
}

export function getScoreColor(score: number): string {
  if (score >= 70) return "#22c55e";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

export function getStrategyLabel(score: number): string {
  if (score >= 75) return "Dominate";
  if (score >= 55) return "Aggressive";
  if (score >= 40) return "Defensive";
  return "Build First";
}

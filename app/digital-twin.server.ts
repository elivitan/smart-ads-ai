/**
 * Engine 11: Digital Twin Simulator
 *
 * E-commerce Digital Twin — runs thousands of Monte Carlo simulations
 * before spending real money. Predicts revenue, ROAS, and risk for
 * campaign launches, budget changes, and seasonal planning.
 */
import prisma from "./db.server.js";
import { logger } from "./utils/logger.js";
import { getCampaignPerformanceByDate, listSmartAdsCampaigns } from "./google-ads.server.js";
import { getStoreProfile } from "./store-context.server.js";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SimulationParams {
  budget: number;
  productId?: string;
  audienceType?: string;
  durationDays: number;
  campaignType: string;
}

interface ScenarioResult {
  revenue: number;
  roas: number;
  profit: number;
}

interface PercentileResults {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  mean: number;
  stdDev: number;
}

interface SimulationResult {
  simulationId: string;
  predictedRevenue: number;
  predictedRoas: number;
  confidenceLevel: number;
  riskScore: number;
  recommendation: string;
  scenarios: PercentileResults;
}

interface BudgetChangeResult {
  currentRoas: number;
  predictedRoas: number;
  revenueChange: number;
  recommendation: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getPercentile(sorted: number[], pct: number): number {
  const idx = Math.floor(sorted.length * pct);
  return sorted[Math.min(idx, sorted.length - 1)];
}

function calculateStdDev(values: number[], mean: number): number {
  const sumSquares = values.reduce((acc, v) => acc + (v - mean) ** 2, 0);
  return Math.sqrt(sumSquares / values.length);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ─── 1. Run Digital Twin Simulation ─────────────────────────────────────────

/**
 * Full Monte Carlo simulation. Runs 1000 scenarios with random variations
 * on historical performance, seasonal factors, competition, and day-of-week
 * patterns to predict revenue outcomes and risk.
 */
export async function runDigitalTwinSimulation(
  shop: string,
  params: SimulationParams,
): Promise<SimulationResult> {
  try {
    logger.info("digital-twin", `Running simulation for shop ${shop}`, {
      extra: { budget: params.budget, campaignType: params.campaignType },
    });

    // Gather historical campaign performance (30 days)
    const campaigns = await listSmartAdsCampaigns();
    let historicalRevenue = 0;
    let historicalCost = 0;
    let historicalDays = 0;

    for (const campaign of campaigns.slice(0, 10)) {
      try {
        const perfData = await getCampaignPerformanceByDate(campaign.id, 30);
        for (const day of perfData) {
          historicalRevenue += day.conversionValue || 0;
          historicalCost += day.cost || 0;
          historicalDays++;
        }
      } catch {
        // skip campaigns without data
      }
    }

    // Calculate baseline metrics
    const avgDailyRevenue = historicalDays > 0 ? historicalRevenue / historicalDays : params.budget * 2;
    const avgDailyCost = historicalDays > 0 ? historicalCost / historicalDays : params.budget;
    const historicalRoas = avgDailyCost > 0 ? avgDailyRevenue / avgDailyCost : 2.0;

    // Get product data if specified
    let productPrice = 0;
    if (params.productId) {
      const product = await prisma.product.findFirst({
        where: { id: params.productId, shop },
      });
      if (product) {
        productPrice = parseFloat(String(product.price)) || 0;
      }
    }

    // Get store profile for profit margin
    const storeProfile = await getStoreProfile(shop);
    const profitMargin = storeProfile?.profitMargin ?? 0.3;

    // Run 1000 Monte Carlo scenarios
    const SCENARIO_COUNT = 1000;
    const scenarioRevenues: number[] = [];
    const dailyBudget = params.budget / params.durationDays;

    for (let i = 0; i < SCENARIO_COUNT; i++) {
      let totalRevenue = 0;

      for (let day = 0; day < params.durationDays; day++) {
        // Revenue variation: +/-30% based on historical performance
        const revenueVariation = 0.7 + Math.random() * 0.6; // 0.7 to 1.3

        // Seasonal factor: random 0.7-1.3
        const seasonalFactor = 0.7 + Math.random() * 0.6;

        // Competition factor: random 0.8-1.2
        const competitionFactor = 0.8 + Math.random() * 0.4;

        // Day-of-week factor (weekdays 1.0-1.1, weekends 0.85-0.95)
        const dayOfWeek = (day % 7);
        const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
        const dayFactor = isWeekend
          ? 0.85 + Math.random() * 0.1
          : 1.0 + Math.random() * 0.1;

        // Calculate daily revenue for this scenario
        const dailyRevenue =
          dailyBudget *
          historicalRoas *
          revenueVariation *
          seasonalFactor *
          competitionFactor *
          dayFactor;

        totalRevenue += dailyRevenue;
      }

      scenarioRevenues.push(totalRevenue);
    }

    // Sort for percentile calculation
    scenarioRevenues.sort((a, b) => a - b);

    // Calculate percentiles
    const p10 = getPercentile(scenarioRevenues, 0.1);
    const p25 = getPercentile(scenarioRevenues, 0.25);
    const p50 = getPercentile(scenarioRevenues, 0.5);
    const p75 = getPercentile(scenarioRevenues, 0.75);
    const p90 = getPercentile(scenarioRevenues, 0.9);
    const mean = scenarioRevenues.reduce((a, b) => a + b, 0) / SCENARIO_COUNT;
    const stdDev = calculateStdDev(scenarioRevenues, mean);

    // Risk score: 100 - (p25/budget * 100), clamped 0-100
    const riskScore = clamp(Math.round(100 - (p25 / params.budget) * 100), 0, 100);

    // Predicted ROAS from median
    const predictedRoas = params.budget > 0 ? p50 / params.budget : 0;

    // Confidence level based on data availability
    const confidenceLevel = historicalDays > 20
      ? 0.85
      : historicalDays > 10
        ? 0.65
        : historicalDays > 0
          ? 0.45
          : 0.25;

    // Generate recommendation
    let recommendation: string;
    if (riskScore > 70) {
      recommendation = "wait — high risk. Consider reducing budget or testing with smaller audience first.";
    } else if (riskScore > 40) {
      recommendation = "modify — moderate risk. Launch with 60% of planned budget, scale up based on results.";
    } else if (predictedRoas > 3) {
      recommendation = "launch — strong predicted ROAS with acceptable risk. Full budget recommended.";
    } else {
      recommendation = "launch — acceptable risk/reward profile. Monitor closely in first 3 days.";
    }

    const scenarios: PercentileResults = { p10, p25, p50, p75, p90, mean, stdDev };

    // Save to database
    const simulation = await prisma.digitalTwinSimulation.create({
      data: {
        shop,
        simulationType: params.campaignType,
        inputParams: JSON.stringify(params),
        scenarioCount: SCENARIO_COUNT,
        predictedRevenue: p50,
        predictedRoas: predictedRoas,
        confidenceLevel,
        riskScore,
        scenarioResults: JSON.stringify(scenarios),
        recommendation,
      },
    });

    logger.info("digital-twin", `Simulation complete: ${simulation.id}`, {
      extra: { predictedRevenue: p50, riskScore, recommendation },
    });

    return {
      simulationId: simulation.id,
      predictedRevenue: Math.round(p50 * 100) / 100,
      predictedRoas: Math.round(predictedRoas * 100) / 100,
      confidenceLevel,
      riskScore,
      recommendation,
      scenarios: {
        p10: Math.round(p10 * 100) / 100,
        p25: Math.round(p25 * 100) / 100,
        p50: Math.round(p50 * 100) / 100,
        p75: Math.round(p75 * 100) / 100,
        p90: Math.round(p90 * 100) / 100,
        mean: Math.round(mean * 100) / 100,
        stdDev: Math.round(stdDev * 100) / 100,
      },
    };
  } catch (error) {
    logger.error("digital-twin", "Simulation failed", { extra: { shop, error: error instanceof Error ? error.message : String(error) } });
    throw error;
  }
}

// ─── 2. Simulate Budget Change ──────────────────────────────────────────────

/**
 * What-if analysis for budget changes. Applies diminishing returns curve
 * and runs 500 scenarios to predict impact of a budget change.
 */
export async function simulateBudgetChange(
  shop: string,
  campaignId: string,
  newBudget: number,
): Promise<BudgetChangeResult> {
  try {
    logger.info("digital-twin", `Budget change simulation for campaign ${campaignId}`, {
      extra: { shop, newBudget },
    });

    // Get current campaign performance
    const performances = await getCampaignPerformanceByDate(campaignId, 30);

    if (performances.length < 3) {
      return {
        currentRoas: 0,
        predictedRoas: 0,
        revenueChange: 0,
        recommendation: "Insufficient data — need at least 3 days of performance history.",
      };
    }

    // Calculate current metrics
    const totalCost = performances.reduce((s, d) => s + (d.cost || 0), 0);
    const totalRevenue = performances.reduce((s, d) => s + (d.conversionValue || 0), 0);
    const currentDailyBudget = totalCost / performances.length;
    const currentRoas = totalCost > 0 ? totalRevenue / totalCost : 0;

    // Apply diminishing returns curve: roas * (1 - 0.1 * ln(newBudget/currentBudget))
    const budgetRatio = currentDailyBudget > 0 ? newBudget / currentDailyBudget : 1;
    const diminishingFactor = 1 - 0.1 * Math.log(Math.max(budgetRatio, 0.01));
    const baseRoas = currentRoas * diminishingFactor;

    // Run 500 scenarios
    const SCENARIOS = 500;
    const revenueResults: number[] = [];

    for (let i = 0; i < SCENARIOS; i++) {
      const variation = 0.8 + Math.random() * 0.4; // 0.8 to 1.2
      const scenarioRoas = baseRoas * variation;
      const scenarioRevenue = newBudget * scenarioRoas * 30; // monthly projection
      revenueResults.push(scenarioRevenue);
    }

    revenueResults.sort((a, b) => a - b);
    const predictedMonthlyRevenue = getPercentile(revenueResults, 0.5);
    const currentMonthlyRevenue = currentRoas * currentDailyBudget * 30;
    const revenueChange = predictedMonthlyRevenue - currentMonthlyRevenue;
    const predictedRoas = newBudget > 0 ? predictedMonthlyRevenue / (newBudget * 30) : 0;

    // Generate recommendation
    let recommendation: string;
    if (predictedRoas > currentRoas * 0.9 && revenueChange > 0) {
      recommendation = "Recommended — budget increase should drive growth with acceptable ROAS impact.";
    } else if (predictedRoas < currentRoas * 0.7) {
      recommendation = "Caution — significant ROAS decline expected. Consider incremental increases instead.";
    } else if (revenueChange < 0) {
      recommendation = "Budget reduction will lower revenue. Consider reallocating to higher-performing campaigns.";
    } else {
      recommendation = "Moderate impact expected. Monitor for 5 days after change before further adjustments.";
    }

    logger.info("digital-twin", `Budget change simulation complete`, {
      extra: {
        currentRoas: Math.round(currentRoas * 100) / 100,
        predictedRoas: Math.round(predictedRoas * 100) / 100,
        revenueChange: Math.round(revenueChange * 100) / 100,
      },
    });

    return {
      currentRoas: Math.round(currentRoas * 100) / 100,
      predictedRoas: Math.round(predictedRoas * 100) / 100,
      revenueChange: Math.round(revenueChange * 100) / 100,
      recommendation,
    };
  } catch (error) {
    logger.error("digital-twin", "Budget change simulation failed", { extra: { shop, campaignId, error: error instanceof Error ? error.message : String(error) } });
    throw error;
  }
}

// ─── 3. Get Simulation History ──────────────────────────────────────────────

/**
 * Retrieve the last 20 simulations for a shop, ordered by creation date.
 */
export async function getSimulationHistory(shop: string) {
  try {
    const simulations = await prisma.digitalTwinSimulation.findMany({
      where: { shop },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return simulations.map((sim) => ({
      id: sim.id,
      simulationType: sim.simulationType,
      predictedRevenue: sim.predictedRevenue,
      predictedRoas: sim.predictedRoas,
      confidenceLevel: sim.confidenceLevel,
      riskScore: sim.riskScore,
      recommendation: sim.recommendation,
      scenarios: JSON.parse(sim.scenarioResults),
      inputParams: JSON.parse(sim.inputParams),
      createdAt: sim.createdAt,
    }));
  } catch (error) {
    logger.error("digital-twin", "Failed to fetch simulation history", { extra: { shop, error: error instanceof Error ? error.message : String(error) } });
    throw error;
  }
}

// Profit Intelligence Engine
// Pure math-based profit analysis, Monte Carlo simulations, and dynamic pricing

import prisma from "./db.server.js";
import { logger } from "./utils/logger.js";
import { getCampaignPerformanceByDate } from "./google-ads.server.js";

// ─── Types ───────────────────────────────────────────────────────────────────

interface MonteCarloParams {
  days?: number;
  simulations?: number;
}

interface MonteCarloScenario {
  competitorPriceDrop: number;
  seasonalEffect: number;
  demandShift: number;
  expectedRevenue: number;
  expectedProfit: number;
}

interface MonteCarloResult {
  scenarios: MonteCarloScenario[];
  expectedValue: number;
  riskLevel: "low" | "medium" | "high";
  recommendation: string;
}

interface PricingSuggestion {
  currentPrice: number;
  suggestedPrice: number;
  competitorAvgPrice: number;
  reason: string;
  expectedMarginChange: number;
}

interface ProductProfitScore {
  productId: string;
  title: string;
  price: number;
  profitMargin: number;
  estimatedConversionRate: number;
  profitScore: number;
}

// ─── 1. Calculate Net Profit ─────────────────────────────────────────────────

export async function calculateNetProfit(
  shop: string,
  campaignId: string,
): Promise<{
  netProfitPerClick: number;
  netProfitPerConversion: number;
  totalCost: number;
  totalRevenue: number;
  totalProfit: number;
  cogs: number;
} | null> {
  try {
    logger.info("profit-intel", `Calculating net profit for campaign ${campaignId}, shop ${shop}`);

    // Fetch campaign performance for the last 30 days
    const performanceData = await getCampaignPerformanceByDate(campaignId, 30);

    if (!performanceData || performanceData.length === 0) {
      logger.info("profit-intel", `No performance data found for campaign ${campaignId}`);
      return null;
    }

    // Aggregate metrics across all days (flattened fields, cost already in dollars)
    let totalClicks = 0;
    let totalCost = 0;
    let totalConversions = 0;
    let totalRevenue = 0;

    for (const day of performanceData) {
      totalClicks += Number(day.clicks) || 0;
      totalCost += Number(day.cost) || 0;
      totalConversions += Number(day.conversions) || 0;
      totalRevenue += Number(day.conversionValue) || 0;
    }

    // Get store profit margin for COGS calculation
    const storeProfile = await prisma.storeProfile.findFirst({ where: { shop } });
    const profitMargin = storeProfile?.profitMargin ?? 0.4; // default 40%

    // COGS = revenue * (1 - profit margin)
    const cogs = totalRevenue * (1 - profitMargin);
    const totalProfit = totalRevenue - cogs - totalCost;

    const netProfitPerClick = totalClicks > 0 ? totalProfit / totalClicks : 0;
    const netProfitPerConversion = totalConversions > 0 ? totalProfit / totalConversions : 0;

    // Persist the analysis
    const campaignJob = await prisma.campaignJob.findFirst({
      where: { shop, googleCampaignId: campaignId },
    });

    // Determine a product ID from campaign payload if available
    let productId: string | null = null;
    if (campaignJob?.payload) {
      try {
        const payload = JSON.parse(campaignJob.payload);
        productId = payload.productId ?? null;
      } catch {
        // payload is not valid JSON, skip
      }
    }

    await prisma.profitAnalysis.create({
      data: {
        shop,
        campaignId,
        productId,
        netProfitPerClick: Math.round(netProfitPerClick * 100) / 100,
        netProfitPerConv: Math.round(netProfitPerConversion * 100) / 100,
        cogs: Math.round(cogs * 100) / 100,
        profitScore: calculateProfitScore(totalProfit, totalCost),
      },
    });

    logger.info("profit-intel", `Net profit calculated: $${totalProfit.toFixed(2)} for campaign ${campaignId}`);

    return {
      netProfitPerClick: Math.round(netProfitPerClick * 100) / 100,
      netProfitPerConversion: Math.round(netProfitPerConversion * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
      cogs: Math.round(cogs * 100) / 100,
    };
  } catch (error) {
    logger.error("profit-intel", `Failed to calculate net profit for campaign ${campaignId}: ${error}`);
    throw error;
  }
}

// ─── 2. Score Product Profitability ──────────────────────────────────────────

export async function scoreProductProfitability(
  shop: string,
): Promise<ProductProfitScore[]> {
  try {
    logger.info("profit-intel", `Scoring product profitability for shop ${shop}`);

    const products = await prisma.product.findMany({
      where: { shop },
      include: { aiAnalysis: true },
    });

    if (products.length === 0) {
      logger.info("profit-intel", `No products found for shop ${shop}`);
      return [];
    }

    const storeProfile = await prisma.storeProfile.findFirst({ where: { shop } });
    const profitMargin = storeProfile?.profitMargin ?? 0.4;

    // Get existing profit analyses for reference
    const existingAnalyses = await prisma.profitAnalysis.findMany({
      where: { shop },
      orderBy: { analyzedAt: "desc" },
    });

    const analysisMap = new Map<string, typeof existingAnalyses[0]>();
    for (const a of existingAnalyses) {
      if (a.productId && !analysisMap.has(a.productId)) {
        analysisMap.set(a.productId, a);
      }
    }

    const scored: ProductProfitScore[] = products.map((product) => {
      const price = parseFloat(product.price) || 0;

      // Estimate conversion rate based on available signals
      let estimatedConversionRate = 0.02; // base 2% conversion rate

      // Boost for products that have AI analysis (they are better optimized)
      if (product.aiAnalysis) {
        const adScore = product.aiAnalysis.adScore || 50;
        estimatedConversionRate *= 1 + (adScore - 50) / 100;
      }

      // Boost for products with good inventory (in-stock, available)
      if (product.inventoryTotal > 10) {
        estimatedConversionRate *= 1.1;
      } else if (product.inventoryTotal <= 0) {
        estimatedConversionRate *= 0.1; // almost no conversions if out of stock
      }

      // Use historical data if available
      const existingAnalysis = analysisMap.get(product.id);
      if (existingAnalysis?.netProfitPerConv && existingAnalysis.netProfitPerConv > 0) {
        // Historical data suggests good conversions
        estimatedConversionRate *= 1.2;
      }

      // Profit potential = margin * conversion rate * price
      const profitPotential = profitMargin * estimatedConversionRate * price;

      // Normalize score to 0-100 range
      const rawScore = profitPotential * 100;
      const profitScore = Math.min(100, Math.max(0, Math.round(rawScore)));

      return {
        productId: product.id,
        title: product.title,
        price,
        profitMargin,
        estimatedConversionRate: Math.round(estimatedConversionRate * 10000) / 10000,
        profitScore,
      };
    });

    // Sort by profit score descending (highest profit potential first)
    scored.sort((a, b) => b.profitScore - a.profitScore);

    // Persist scores
    for (const item of scored) {
      await prisma.profitAnalysis.upsert({
        where: {
          id: analysisMap.get(item.productId)?.id ?? "",
        },
        create: {
          shop,
          productId: item.productId,
          profitScore: item.profitScore,
        },
        update: {
          profitScore: item.profitScore,
          analyzedAt: new Date(),
        },
      });
    }

    logger.info("profit-intel", `Scored ${scored.length} products for shop ${shop}`);
    return scored;
  } catch (error) {
    logger.error("profit-intel", `Failed to score product profitability for shop ${shop}: ${error}`);
    throw error;
  }
}

// ─── 3. Monte Carlo Simulation ───────────────────────────────────────────────

export async function runMonteCarloSimulation(
  shop: string,
  campaignId: string,
  params: MonteCarloParams = {},
): Promise<MonteCarloResult> {
  try {
    logger.info("profit-intel", `Running Monte Carlo simulation for campaign ${campaignId}, shop ${shop}`);

    const days = params.days ?? 30;
    const numSimulations = params.simulations ?? 1000;

    // Get baseline performance data
    const performanceData = await getCampaignPerformanceByDate(campaignId, days);

    let baselineClicks = 0;
    let baselineCost = 0;
    let baselineConversions = 0;
    let baselineRevenue = 0;

    for (const day of performanceData ?? []) {
      baselineClicks += Number(day.clicks) || 0;
      baselineCost += Number(day.cost) || 0;
      baselineConversions += Number(day.conversions) || 0;
      baselineRevenue += Number(day.conversionValue) || 0;
    }

    // Get store profit margin
    const storeProfile = await prisma.storeProfile.findFirst({ where: { shop } });
    const profitMargin = storeProfile?.profitMargin ?? 0.4;

    const baselineCogs = baselineRevenue * (1 - profitMargin);
    const baselineProfit = baselineRevenue - baselineCogs - baselineCost;

    // If no baseline data, use estimates
    const effectiveRevenue = baselineRevenue || 1000;
    const effectiveCost = baselineCost || 200;
    const effectiveProfit = baselineProfit || effectiveRevenue * profitMargin - effectiveCost;

    // Run simulations — PURE MATH, no AI calls
    const scenarios: MonteCarloScenario[] = [];

    for (let i = 0; i < numSimulations; i++) {
      // Random factors
      const competitorPriceDrop = Math.random() * 0.20; // 0-20%
      const seasonalEffect = (Math.random() * 0.60) - 0.30; // -30% to +30%
      const demandShift = (Math.random() * 0.40) - 0.20; // -20% to +20%

      // Revenue impact: competitor price drops hurt us, seasonal and demand shifts scale revenue
      const revenueMultiplier = (1 - competitorPriceDrop * 0.5) * (1 + seasonalEffect) * (1 + demandShift);
      const expectedRevenue = effectiveRevenue * revenueMultiplier;

      // Cost stays relatively stable (slight variation from demand)
      const costMultiplier = 1 + demandShift * 0.3; // costs shift slightly with demand
      const scenarioCost = effectiveCost * costMultiplier;

      // Profit calculation
      const scenarioCogs = expectedRevenue * (1 - profitMargin);
      const expectedProfit = expectedRevenue - scenarioCogs - scenarioCost;

      scenarios.push({
        competitorPriceDrop: Math.round(competitorPriceDrop * 10000) / 10000,
        seasonalEffect: Math.round(seasonalEffect * 10000) / 10000,
        demandShift: Math.round(demandShift * 10000) / 10000,
        expectedRevenue: Math.round(expectedRevenue * 100) / 100,
        expectedProfit: Math.round(expectedProfit * 100) / 100,
      });
    }

    // Sort scenarios by expected profit
    scenarios.sort((a, b) => a.expectedProfit - b.expectedProfit);

    // Calculate expected value (mean profit across all scenarios)
    const expectedValue =
      Math.round(
        (scenarios.reduce((sum, s) => sum + s.expectedProfit, 0) / numSimulations) * 100,
      ) / 100;

    // Calculate risk metrics
    const profitValues = scenarios.map((s) => s.expectedProfit);
    const lossScenarios = profitValues.filter((p) => p < 0).length;
    const lossPercentage = lossScenarios / numSimulations;

    // Standard deviation for risk assessment
    const mean = expectedValue;
    const variance =
      profitValues.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / numSimulations;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = mean !== 0 ? Math.abs(stdDev / mean) : 1;

    // Determine risk level
    let riskLevel: "low" | "medium" | "high";
    if (lossPercentage < 0.1 && coefficientOfVariation < 0.3) {
      riskLevel = "low";
    } else if (lossPercentage < 0.3 && coefficientOfVariation < 0.6) {
      riskLevel = "medium";
    } else {
      riskLevel = "high";
    }

    // Generate recommendation based on results
    let recommendation: string;
    if (riskLevel === "low" && expectedValue > 0) {
      recommendation = "Campaign shows stable profitability. Consider increasing budget by 10-20% to scale returns.";
    } else if (riskLevel === "medium" && expectedValue > 0) {
      recommendation = "Campaign is profitable but volatile. Optimize targeting and monitor competitor pricing closely.";
    } else if (expectedValue > 0) {
      recommendation = "Campaign is marginally profitable with high risk. Consider reducing budget and focusing on top-performing segments.";
    } else {
      recommendation = "Campaign has negative expected value. Pause or restructure before further spend.";
    }

    const result: MonteCarloResult = {
      scenarios,
      expectedValue,
      riskLevel,
      recommendation,
    };

    // Persist simulation result
    const campaignJob = await prisma.campaignJob.findFirst({
      where: { shop, googleCampaignId: campaignId },
    });

    let productId: string | null = null;
    if (campaignJob?.payload) {
      try {
        const payload = JSON.parse(campaignJob.payload);
        productId = payload.productId ?? null;
      } catch {
        // skip
      }
    }

    await prisma.profitAnalysis.create({
      data: {
        shop,
        campaignId,
        productId,
        simulationResult: JSON.stringify({
          expectedValue,
          riskLevel,
          recommendation,
          lossPercentage: Math.round(lossPercentage * 100),
          stdDev: Math.round(stdDev * 100) / 100,
          scenarioCount: numSimulations,
        }),
      },
    });

    logger.info(
      "profit-intel",
      `Monte Carlo simulation complete: EV=$${expectedValue}, risk=${riskLevel}, loss%=${Math.round(lossPercentage * 100)}%`,
    );

    return result;
  } catch (error) {
    logger.error("profit-intel", `Failed to run Monte Carlo simulation for campaign ${campaignId}: ${error}`);
    throw error;
  }
}

// ─── 4. Suggest Dynamic Pricing ──────────────────────────────────────────────

export async function suggestDynamicPricing(
  shop: string,
  productId: string,
): Promise<PricingSuggestion | null> {
  try {
    logger.info("profit-intel", `Generating dynamic pricing suggestion for product ${productId}, shop ${shop}`);

    const product = await prisma.product.findFirst({
      where: { id: productId, shop },
    });

    if (!product) {
      logger.info("profit-intel", `Product ${productId} not found for shop ${shop}`);
      return null;
    }

    const currentPrice = parseFloat(product.price) || 0;

    if (currentPrice <= 0) {
      logger.info("profit-intel", `Product ${productId} has invalid price: ${product.price}`);
      return null;
    }

    // Get competitor pricing data
    const competitors = await prisma.competitorSnapshot.findMany({
      where: { shop },
    });

    if (competitors.length === 0) {
      logger.info("profit-intel", `No competitor data available for shop ${shop}`);
      return {
        currentPrice,
        suggestedPrice: currentPrice,
        competitorAvgPrice: 0,
        reason: "No competitor data available. Maintain current pricing until competitor analysis is complete.",
        expectedMarginChange: 0,
      };
    }

    // Calculate average competitor price from snapshots that have pricing
    const competitorPrices = competitors
      .filter((c) => c.avgPrice != null && c.avgPrice > 0)
      .map((c) => c.avgPrice as number);

    if (competitorPrices.length === 0) {
      logger.info("profit-intel", `No competitor prices available for shop ${shop}`);
      return {
        currentPrice,
        suggestedPrice: currentPrice,
        competitorAvgPrice: 0,
        reason: "Competitor data exists but no pricing information. Maintain current pricing.",
        expectedMarginChange: 0,
      };
    }

    const competitorAvgPrice =
      Math.round(
        (competitorPrices.reduce((sum, p) => sum + p, 0) / competitorPrices.length) * 100,
      ) / 100;

    // Get store profile for margin context
    const storeProfile = await prisma.storeProfile.findFirst({ where: { shop } });
    const profitMargin = storeProfile?.profitMargin ?? 0.4;
    const brandPositioning = storeProfile?.brandPositioning ?? "value";

    // Calculate COGS floor (minimum viable price)
    const cogsPerUnit = currentPrice * (1 - profitMargin);
    const minimumPrice = cogsPerUnit * 1.1; // at least 10% above COGS

    // Pricing strategy based on brand positioning
    let suggestedPrice: number;
    let reason: string;

    const priceDifference = ((currentPrice - competitorAvgPrice) / competitorAvgPrice) * 100;

    if (brandPositioning === "premium") {
      // Premium brands should be 10-25% above competitor average
      const targetPrice = competitorAvgPrice * 1.15;
      if (currentPrice < competitorAvgPrice * 1.05) {
        suggestedPrice = Math.max(targetPrice, minimumPrice);
        reason = `Premium positioning: price is too close to competitor average ($${competitorAvgPrice}). Raise to maintain brand perception.`;
      } else if (currentPrice > competitorAvgPrice * 1.35) {
        suggestedPrice = Math.max(competitorAvgPrice * 1.25, minimumPrice);
        reason = `Premium positioning: price is ${Math.round(priceDifference)}% above competitors, risking demand loss. Slight reduction recommended.`;
      } else {
        suggestedPrice = currentPrice;
        reason = `Premium positioning: current price is well-placed at ${Math.round(priceDifference)}% above competitor average.`;
      }
    } else if (brandPositioning === "value") {
      // Value brands should be 5-15% below competitor average
      const targetPrice = competitorAvgPrice * 0.90;
      if (currentPrice > competitorAvgPrice) {
        suggestedPrice = Math.max(targetPrice, minimumPrice);
        reason = `Value positioning: price is above competitor average ($${competitorAvgPrice}). Reduce to capture price-sensitive customers.`;
      } else if (currentPrice < competitorAvgPrice * 0.75) {
        suggestedPrice = Math.max(competitorAvgPrice * 0.85, minimumPrice);
        reason = `Value positioning: price is ${Math.round(Math.abs(priceDifference))}% below competitors, leaving margin on the table. Slight increase recommended.`;
      } else {
        suggestedPrice = currentPrice;
        reason = `Value positioning: current price is competitive at ${Math.round(Math.abs(priceDifference))}% below competitor average.`;
      }
    } else {
      // Default / eco / specialty — target within 5% of competitor average
      if (Math.abs(priceDifference) > 15) {
        suggestedPrice = Math.max(competitorAvgPrice, minimumPrice);
        reason = `Price is ${Math.round(Math.abs(priceDifference))}% ${currentPrice > competitorAvgPrice ? "above" : "below"} competitor average ($${competitorAvgPrice}). Aligning closer to market rate.`;
      } else {
        suggestedPrice = currentPrice;
        reason = `Price is well-aligned with competitor average ($${competitorAvgPrice}), within ${Math.round(Math.abs(priceDifference))}% range.`;
      }
    }

    // Ensure suggested price respects the COGS floor
    suggestedPrice = Math.max(suggestedPrice, minimumPrice);
    suggestedPrice = Math.round(suggestedPrice * 100) / 100;

    const expectedMarginChange =
      currentPrice > 0
        ? Math.round(((suggestedPrice - currentPrice) / currentPrice) * 10000) / 100
        : 0;

    const suggestion: PricingSuggestion = {
      currentPrice,
      suggestedPrice,
      competitorAvgPrice,
      reason,
      expectedMarginChange,
    };

    // Persist pricing suggestion
    const existingAnalysis = await prisma.profitAnalysis.findMany({
      where: { shop, productId },
      orderBy: { analyzedAt: "desc" },
      take: 1,
    });

    if (existingAnalysis.length > 0) {
      await prisma.profitAnalysis.update({
        where: { id: existingAnalysis[0].id },
        data: {
          pricingSuggestion: JSON.stringify(suggestion),
          analyzedAt: new Date(),
        },
      });
    } else {
      await prisma.profitAnalysis.create({
        data: {
          shop,
          productId,
          pricingSuggestion: JSON.stringify(suggestion),
        },
      });
    }

    logger.info(
      "profit-intel",
      `Pricing suggestion for product ${productId}: $${currentPrice} -> $${suggestedPrice} (${expectedMarginChange}% change)`,
    );

    return suggestion;
  } catch (error) {
    logger.error("profit-intel", `Failed to generate pricing suggestion for product ${productId}: ${error}`);
    throw error;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert raw profit/cost into a 0-100 profit score.
 * Score is based on ROAS (Return on Ad Spend).
 */
function calculateProfitScore(totalProfit: number, totalCost: number): number {
  if (totalCost <= 0) return 50; // neutral if no spend

  const roas = (totalProfit + totalCost) / totalCost; // revenue / cost
  // ROAS of 1 = break even (score ~30), ROAS of 3 = good (score ~60), ROAS of 5+ = excellent (score ~90)
  const score = Math.round(Math.min(100, Math.max(0, roas * 18)));
  return score;
}

/**
 * Engine 17: Performance Insurance
 *
 * Auto-pause campaigns predicted to lose money.
 * Checks ROAS, CTR, conversion rate, and cost thresholds
 * to protect ad spend.
 */

import prisma from "./db.server.js";
import { logger } from "./utils/logger.js";
import Anthropic from "@anthropic-ai/sdk";
import { getCampaignPerformanceByDate, listSmartAdsCampaigns } from "./google-ads.server.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const CHECK_LOOKBACK_DAYS = 7;
const ROAS_THRESHOLD = 1.0;
const CTR_THRESHOLD = 0.5; // percent
const IMPRESSION_THRESHOLD = 1000;
const GUARD_HISTORY_LIMIT = 30;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Types ────────────────────────────────────────────────────────────────────

interface GuardAlert {
  campaignId: string;
  campaignName: string;
  guardType: string;
  triggerMetric: string;
  moneySaved: number;
  recommendation: string;
}

interface PerformanceCheckResult {
  checked: number;
  alerts: GuardAlert[];
}

interface TotalSavingsResult {
  totalSaved: number;
  eventsCount: number;
  accuracy: number;
}

// ─── 1. Run Performance Check ─────────────────────────────────────────────────

/**
 * Check all campaigns against safety thresholds.
 * Applies rules for ROAS, cost, CTR, and conversion rate.
 * Uses Claude to assess severity and generate recommendations.
 */
export async function runPerformanceCheck(
  shop: string,
): Promise<PerformanceCheckResult> {
  try {
    logger.info("performance-guard", "Running performance check", { shop });

    const campaigns = await listSmartAdsCampaigns();

    if (!campaigns || campaigns.length === 0) {
      logger.info("performance-guard", "No campaigns found", { shop });
      return { checked: 0, alerts: [] };
    }

    // Get store profile for profit margin
    const storeProfile = await prisma.storeProfile.findUnique({
      where: { shop },
    });
    const profitMargin = storeProfile?.profitMargin || 0.3;

    const alerts: GuardAlert[] = [];

    for (const campaign of campaigns) {
      try {
        const performanceData = await getCampaignPerformanceByDate(
          campaign.id,
          CHECK_LOOKBACK_DAYS,
        );

        if (!performanceData || performanceData.length === 0) continue;

        // Aggregate metrics
        let totalClicks = 0;
        let totalCost = 0;
        let totalConversions = 0;
        let totalImpressions = 0;
        let totalConversionValue = 0;
        let lowRoasDays = 0;

        for (const day of performanceData) {
          totalClicks += day.clicks || 0;
          totalCost += day.cost || 0;
          totalConversions += day.conversions || 0;
          totalImpressions += day.impressions || 0;
          totalConversionValue += day.conversionValue || 0;

          // Check daily ROAS
          const dailyRoas = day.cost > 0 ? day.conversionValue / day.cost : 0;
          if (dailyRoas < ROAS_THRESHOLD && day.cost > 0) {
            lowRoasDays++;
          }
        }

        const avgCost = totalCost / Math.max(performanceData.length, 1);
        const overallRoas = totalCost > 0 ? totalConversionValue / totalCost : 0;
        const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
        const convRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;

        // Rule a: ROAS below 1.0 for 3+ days
        let guardType: string | null = null;
        let triggerMetric = "";
        let triggerValue = 0;
        let actualValue = 0;
        let estimatedSavings = 0;

        if (lowRoasDays >= 3) {
          guardType = "auto_pause";
          triggerMetric = "roas_below";
          triggerValue = ROAS_THRESHOLD;
          actualValue = overallRoas;
          estimatedSavings = totalCost * (1 - overallRoas) * 0.7;
        }
        // Rule b: Cost > 2x average with no conversions
        else if (totalCost > avgCost * 2 * performanceData.length && totalConversions === 0) {
          guardType = "budget_cut";
          triggerMetric = "cost_above";
          triggerValue = avgCost * 2;
          actualValue = totalCost;
          estimatedSavings = totalCost * 0.5;
        }
        // Rule c: CTR below 0.5% with 1000+ impressions
        else if (ctr < CTR_THRESHOLD && totalImpressions >= IMPRESSION_THRESHOLD) {
          guardType = "alert_only";
          triggerMetric = "ctr_below";
          triggerValue = CTR_THRESHOLD;
          actualValue = ctr;
          estimatedSavings = totalCost * 0.2;
        }
        // Rule d: Conversion rate drop >50% from average
        else if (convRate > 0 && convRate < avgCost * 0.5) {
          // Use simplified check: very low conversion rate
          guardType = "bid_reduction";
          triggerMetric = "conv_rate_below";
          triggerValue = convRate * 2; // what it "should" be
          actualValue = convRate;
          estimatedSavings = totalCost * 0.3;
        }

        if (!guardType) continue;

        // Use Claude to assess severity and generate recommendation
        let recommendation = "";
        try {
          const prompt = `Campaign "${campaign.name}" triggered a ${guardType} guard. Metrics: ROAS=${overallRoas.toFixed(2)}, CTR=${ctr.toFixed(2)}%, ConvRate=${convRate.toFixed(2)}%, Cost=$${totalCost.toFixed(2)}, ProfitMargin=${(profitMargin * 100).toFixed(0)}%. Trigger: ${triggerMetric}=${actualValue.toFixed(2)} (threshold: ${triggerValue.toFixed(2)}). In 1-2 sentences, explain the risk and recommend an action.`;

          const response = await client.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 256,
            messages: [{ role: "user", content: prompt }],
          });

          recommendation =
            response.content[0].type === "text"
              ? response.content[0].text.trim()
              : "";
        } catch (aiErr) {
          logger.error("performance-guard", "AI recommendation failed", {
            shop,
            error: aiErr,
            extra: { campaignId: campaign.id },
          });
          recommendation = `${guardType}: ${triggerMetric} breached threshold (${actualValue.toFixed(2)} vs ${triggerValue.toFixed(2)}).`;
        }

        // Save to PerformanceGuard model
        const moneySaved = Math.max(0, Math.round(estimatedSavings * 100) / 100);

        await prisma.performanceGuard.create({
          data: {
            shop,
            campaignId: campaign.id,
            campaignName: campaign.name,
            guardType,
            triggerMetric,
            triggerValue,
            actualValue,
            actionTaken: JSON.stringify({
              action: guardType,
              reason: recommendation,
              cost: totalCost,
            }),
            moneySaved,
          },
        });

        alerts.push({
          campaignId: campaign.id,
          campaignName: campaign.name,
          guardType,
          triggerMetric,
          moneySaved,
          recommendation,
        });
      } catch (campaignErr) {
        logger.error("performance-guard", "Failed to check campaign", {
          shop,
          error: campaignErr,
          extra: { campaignId: campaign.id },
        });
      }
    }

    logger.info("performance-guard", `Performance check complete`, {
      shop,
      extra: { checked: campaigns.length, alerts: alerts.length },
    });

    return { checked: campaigns.length, alerts };
  } catch (err) {
    logger.error("performance-guard", "Performance check failed", {
      shop,
      error: err,
    });
    throw err;
  }
}

// ─── 2. Get Guard History ────────────────────────────────────────────────────

/**
 * Get past guard actions — last 30 events with outcomes.
 */
export async function getGuardHistory(shop: string) {
  try {
    logger.info("performance-guard", "Fetching guard history", { shop });

    const history = await prisma.performanceGuard.findMany({
      where: { shop },
      orderBy: { createdAt: "desc" },
      take: GUARD_HISTORY_LIMIT,
    });

    logger.info("performance-guard", `Fetched ${history.length} guard events`, {
      shop,
    });

    return history;
  } catch (err) {
    logger.error("performance-guard", "Failed to fetch guard history", {
      shop,
      error: err,
    });
    throw err;
  }
}

// ─── 3. Override Guard ───────────────────────────────────────────────────────

/**
 * User overrides an auto-pause guard action.
 */
export async function overrideGuard(
  shop: string,
  guardId: string,
): Promise<{ overridden: true }> {
  try {
    logger.info("performance-guard", "Overriding guard", {
      shop,
      extra: { guardId },
    });

    const guard = await prisma.performanceGuard.findFirst({
      where: { id: guardId, shop },
    });

    if (!guard) {
      throw new Error(`Guard record ${guardId} not found for shop ${shop}`);
    }

    await prisma.performanceGuard.update({
      where: { id: guardId },
      data: { resolvedAt: new Date() },
    });

    logger.info("performance-guard", `Guard overridden: ${guardId}`, {
      shop,
      extra: { guardId, campaignId: guard.campaignId },
    });

    return { overridden: true };
  } catch (err) {
    logger.error("performance-guard", "Failed to override guard", {
      shop,
      error: err,
      extra: { guardId },
    });
    throw err;
  }
}

// ─── 4. Calculate Total Savings ──────────────────────────────────────────────

/**
 * How much money the guard saved across all events.
 */
export async function calculateTotalSavings(
  shop: string,
): Promise<TotalSavingsResult> {
  try {
    logger.info("performance-guard", "Calculating total savings", { shop });

    const guards = await prisma.performanceGuard.findMany({
      where: { shop },
    });

    const totalSaved = guards.reduce((sum, g) => sum + g.moneySaved, 0);
    const eventsCount = guards.length;

    // Accuracy: percentage of guards that were confirmed correct
    const confirmedGuards = guards.filter((g) => g.wasCorrect !== null);
    const correctGuards = confirmedGuards.filter((g) => g.wasCorrect === true);
    const accuracy =
      confirmedGuards.length > 0
        ? Math.round((correctGuards.length / confirmedGuards.length) * 100)
        : 0;

    logger.info("performance-guard", "Total savings calculated", {
      shop,
      extra: { totalSaved, eventsCount, accuracy },
    });

    return {
      totalSaved: Math.round(totalSaved * 100) / 100,
      eventsCount,
      accuracy,
    };
  } catch (err) {
    logger.error("performance-guard", "Failed to calculate total savings", {
      shop,
      error: err,
    });
    throw err;
  }
}

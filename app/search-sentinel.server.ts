/**
 * Engine 16: Silent Profit Sentinel
 *
 * Hourly search term scanning — auto-block waste keywords,
 * identify irrelevant traffic, and protect ad spend.
 */

import prisma from "./db.server.js";
import { logger } from "./utils/logger.js";
import { extractJsonFromText } from "./utils/ai-safety.server.js";
import Anthropic from "@anthropic-ai/sdk";
import { getCampaignPerformanceByDate, listSmartAdsCampaigns } from "./google-ads.server.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const SCAN_LOOKBACK_DAYS = 7;
const RECENT_FINDINGS_LIMIT = 50;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Types ────────────────────────────────────────────────────────────────────

interface WasteTerm {
  term: string;
  estimatedWaste: number;
  reason: string;
  suggestedAction: "negative_exact" | "negative_phrase" | "monitor";
}

interface ScanResult {
  termsAnalyzed: number;
  wasteDetected: number;
  estimatedSavings: number;
}

interface WasteReport {
  totalBlocked: number;
  totalSaved: number;
  topWasteCategories: Array<{ category: string; count: number; totalWaste: number }>;
}

// ─── 1. Scan Search Terms ─────────────────────────────────────────────────────

/**
 * Analyze recent search terms for wasted spend.
 * Gets campaign performance data, uses Claude to identify waste patterns,
 * and saves findings to SearchTermSentinel.
 */
export async function scanSearchTerms(shop: string): Promise<ScanResult> {
  try {
    logger.info("search-sentinel", "Starting search term scan", { shop });

    // Get all campaigns
    const campaigns = await listSmartAdsCampaigns();

    if (!campaigns || campaigns.length === 0) {
      logger.info("search-sentinel", "No campaigns found", { shop });
      return { termsAnalyzed: 0, wasteDetected: 0, estimatedSavings: 0 };
    }

    let totalTermsAnalyzed = 0;
    let totalWasteDetected = 0;
    let totalEstimatedSavings = 0;

    for (const campaign of campaigns) {
      try {
        // Get performance data for the campaign
        const performanceData = await getCampaignPerformanceByDate(
          campaign.id,
          SCAN_LOOKBACK_DAYS,
        );

        if (!performanceData || performanceData.length === 0) continue;

        // Aggregate metrics for this campaign
        let totalClicks = 0;
        let totalCost = 0;
        let totalConversions = 0;
        let totalImpressions = 0;

        for (const day of performanceData) {
          totalClicks += day.clicks || 0;
          totalCost += day.cost || 0;
          totalConversions += day.conversions || 0;
          totalImpressions += day.impressions || 0;
        }

        const roas =
          totalCost > 0
            ? parseFloat(campaign.conversionValue) / totalCost
            : 0;

        // Use Claude to identify waste patterns
        const prompt = `Given these campaign metrics: {campaignName: "${campaign.name}", clicks: ${totalClicks}, cost: $${totalCost.toFixed(2)}, conversions: ${totalConversions.toFixed(1)}, ROAS: ${roas.toFixed(2)}}. Identify the top 5 likely wasted search term patterns (irrelevant, too broad, competitor brand). Return JSON: {wasteTerms: [{term, estimatedWaste, reason, suggestedAction: "negative_exact"|"negative_phrase"|"monitor"}]}`;

        let wasteTerms: WasteTerm[] = [];

        try {
          const response = await client.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 1024,
            messages: [{ role: "user", content: prompt }],
          });

          const text =
            response.content[0].type === "text"
              ? response.content[0].text
              : "";
          const match = extractJsonFromText(text);
          if (match) {
            const parsed = JSON.parse(match);
            wasteTerms = parsed.wasteTerms || [];
          }
        } catch (aiErr) {
          logger.error("search-sentinel", "AI analysis failed for campaign", {
            shop,
            error: aiErr,
            extra: { campaignId: campaign.id },
          });
          continue;
        }

        // Save each waste term to SearchTermSentinel
        for (const wasteTerm of wasteTerms) {
          try {
            await prisma.searchTermSentinel.create({
              data: {
                shop,
                campaignId: campaign.id,
                searchTerm: wasteTerm.term,
                impressions: totalImpressions,
                clicks: totalClicks,
                cost: wasteTerm.estimatedWaste || 0,
                conversions: 0,
                wasteScore: Math.min(
                  100,
                  Math.round((wasteTerm.estimatedWaste / Math.max(totalCost, 1)) * 100),
                ),
                actionTaken: "flagged",
                savedAmount: wasteTerm.estimatedWaste || 0,
              },
            });

            totalWasteDetected++;
            totalEstimatedSavings += wasteTerm.estimatedWaste || 0;
          } catch (saveErr) {
            logger.error("search-sentinel", "Failed to save sentinel finding", {
              shop,
              error: saveErr,
              extra: { term: wasteTerm.term },
            });
          }
        }

        totalTermsAnalyzed += wasteTerms.length;
      } catch (campaignErr) {
        logger.error("search-sentinel", "Failed to analyze campaign", {
          shop,
          error: campaignErr,
          extra: { campaignId: campaign.id },
        });
      }
    }

    logger.info("search-sentinel", "Search term scan complete", {
      shop,
      extra: {
        termsAnalyzed: totalTermsAnalyzed,
        wasteDetected: totalWasteDetected,
        estimatedSavings: totalEstimatedSavings,
      },
    });

    return {
      termsAnalyzed: totalTermsAnalyzed,
      wasteDetected: totalWasteDetected,
      estimatedSavings: Math.round(totalEstimatedSavings * 100) / 100,
    };
  } catch (err) {
    logger.error("search-sentinel", "Search term scan failed", {
      shop,
      error: err,
    });
    throw err;
  }
}

// ─── 2. Get Waste Report ──────────────────────────────────────────────────────

/**
 * Summary of blocked/flagged terms aggregated by campaign.
 */
export async function getWasteReport(shop: string): Promise<WasteReport> {
  try {
    logger.info("search-sentinel", "Generating waste report", { shop });

    const sentinelRecords = await prisma.searchTermSentinel.findMany({
      where: { shop },
      orderBy: { createdAt: "desc" },
    });

    const totalBlocked = sentinelRecords.filter(
      (r) => r.actionTaken === "negative_exact" || r.actionTaken === "negative_phrase",
    ).length;

    const totalSaved = sentinelRecords.reduce(
      (sum, r) => sum + (r.savedAmount || 0),
      0,
    );

    // Group by campaign to find top waste categories
    const campaignWaste = new Map<string, { count: number; totalWaste: number }>();
    for (const record of sentinelRecords) {
      const existing = campaignWaste.get(record.campaignId) || {
        count: 0,
        totalWaste: 0,
      };
      existing.count++;
      existing.totalWaste += record.savedAmount || 0;
      campaignWaste.set(record.campaignId, existing);
    }

    const topWasteCategories = Array.from(campaignWaste.entries())
      .map(([category, data]) => ({
        category,
        count: data.count,
        totalWaste: Math.round(data.totalWaste * 100) / 100,
      }))
      .sort((a, b) => b.totalWaste - a.totalWaste)
      .slice(0, 10);

    logger.info("search-sentinel", "Waste report generated", {
      shop,
      extra: { totalBlocked, totalSaved },
    });

    return {
      totalBlocked,
      totalSaved: Math.round(totalSaved * 100) / 100,
      topWasteCategories,
    };
  } catch (err) {
    logger.error("search-sentinel", "Failed to generate waste report", {
      shop,
      error: err,
    });
    throw err;
  }
}

// ─── 3. Approve Negative Keyword ──────────────────────────────────────────────

/**
 * Mark a suggested negative keyword as approved and set action to negative_exact.
 */
export async function approveNegativeKeyword(
  shop: string,
  sentinelId: string,
): Promise<{ approved: boolean }> {
  try {
    logger.info("search-sentinel", "Approving negative keyword", {
      shop,
      extra: { sentinelId },
    });

    const record = await prisma.searchTermSentinel.findFirst({
      where: { id: sentinelId, shop },
    });

    if (!record) {
      throw new Error(`Sentinel record ${sentinelId} not found for shop ${shop}`);
    }

    await prisma.searchTermSentinel.update({
      where: { id: sentinelId },
      data: { actionTaken: "negative_exact" },
    });

    logger.info("search-sentinel", `Negative keyword approved: "${record.searchTerm}"`, {
      shop,
      extra: { sentinelId, searchTerm: record.searchTerm },
    });

    return { approved: true };
  } catch (err) {
    logger.error("search-sentinel", "Failed to approve negative keyword", {
      shop,
      error: err,
      extra: { sentinelId },
    });
    throw err;
  }
}

// ─── 4. Get Recent Findings ──────────────────────────────────────────────────

/**
 * Return the last 50 sentinel findings for the shop.
 */
export async function getRecentFindings(shop: string) {
  try {
    logger.info("search-sentinel", "Fetching recent findings", { shop });

    const findings = await prisma.searchTermSentinel.findMany({
      where: { shop },
      orderBy: { createdAt: "desc" },
      take: RECENT_FINDINGS_LIMIT,
    });

    logger.info("search-sentinel", `Fetched ${findings.length} recent findings`, {
      shop,
    });

    return findings;
  } catch (err) {
    logger.error("search-sentinel", "Failed to fetch recent findings", {
      shop,
      error: err,
    });
    throw err;
  }
}

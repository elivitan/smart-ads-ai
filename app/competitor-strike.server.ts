/**
 * Engine 19: Predatory Competitor Strike
 *
 * Analyzes competitor weaknesses from existing intel data and plans
 * targeted strikes to exploit gaps in their ad coverage, pricing,
 * and keyword strategy.
 */
import Anthropic from "@anthropic-ai/sdk";
import prisma from "./db.server.js";
import { logger } from "./utils/logger.js";
import { sanitizeForPrompt, safeParseAiJson } from "./utils/ai-safety.server.js";
import {
  getCampaignPerformanceByDate,
  getKeywordPerformance,
  listSmartAdsCampaigns,
} from "./google-ads.server.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const AI_MODEL = "claude-haiku-4-5-20251001";

// ── Types ────────────────────────────────────────────────────────────────

interface CompetitorWeakness {
  competitorDomain: string;
  weaknessType: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  opportunityScore: number;
  suggestedKeywords: string[];
}

interface StrikePlan {
  id: string;
  competitorDomain: string;
  strikeType: string;
  targetKeywords: string[];
  estimatedImpact: Record<string, unknown>;
  status: string;
}

interface StrikeResult {
  id: string;
  status: string;
  resultMetrics: Record<string, unknown>;
}

// ── 1. Analyze Competitor Weaknesses ─────────────────────────────────────

/**
 * Queries existing CompetitorIntel, CompetitorSnapshot, and KeywordGapAnalysis
 * data and uses AI to identify competitor weak spots: keywords where competitors
 * rank poorly, price gaps, and low-quality ads.
 */
export async function analyzeCompetitorWeaknesses(
  shop: string,
): Promise<CompetitorWeakness[]> {
  logger.info("competitor-strike", "Analyzing competitor weaknesses", {
    extra: { shop },
  });

  // Gather existing competitor intelligence
  const [competitorIntel, snapshots, keywordGaps] = await Promise.all([
    prisma.competitorSnapshot.findMany({
      where: { shop },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.competitorSnapshot.findMany({
      where: { shop },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.keywordGapAnalysis.findMany({
      where: { shop },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  if (
    competitorIntel.length === 0 &&
    snapshots.length === 0 &&
    keywordGaps.length === 0
  ) {
    logger.info("competitor-strike", "No competitor data found for analysis", {
      extra: { shop },
    });
    return [];
  }

  const intelSummary = competitorIntel.map((c) => ({
    domain: c.competitorDomain,
    estimatedSpend: c.estMonthlySpend,
    strengths: c.strengths,
    weaknesses: c.weaknesses,
    adCount: c.adCount,
  }));

  const gapSummary = keywordGaps.map((g) => ({
    keyword: g.keyword,
    source: g.source,
    opportunityScore: g.opportunityScore,
    competitionLevel: g.competitionLevel,
  }));

  const snapshotSummary = snapshots.slice(0, 20).map((s) => ({
    domain: s.competitorDomain,
    avgPrice: s.avgPrice,
    adCount: s.adCount,
    keywords: s.keywords,
  }));

  const prompt = `You are a competitive intelligence analyst for Google Ads.

Analyze the following competitor data and identify weaknesses we can exploit.

COMPETITOR INTEL:
${sanitizeForPrompt(JSON.stringify(intelSummary, null, 2))}

KEYWORD GAPS:
${sanitizeForPrompt(JSON.stringify(gapSummary, null, 2))}

COMPETITOR SNAPSHOTS:
${sanitizeForPrompt(JSON.stringify(snapshotSummary, null, 2))}

For each weakness found, determine:
- competitorDomain: which competitor
- weaknessType: one of "keyword_gap", "price_vulnerability", "ad_quality_issue", "coverage_gap", "budget_weakness"
- description: brief explanation
- severity: "low", "medium", "high", or "critical"
- opportunityScore: 0-100 (how exploitable is this)
- suggestedKeywords: keywords to target

Return JSON array of weaknesses, sorted by opportunityScore descending. Maximum 15 weaknesses.
Return ONLY valid JSON array, no markdown.`;

  try {
    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (response.content[0] as { type: string; text: string }).text.trim();
    const { data, error } = safeParseAiJson<CompetitorWeakness[]>(text);

    if (!data) {
      logger.error("competitor-strike", "Failed to parse AI weakness analysis", {
        extra: { error },
      });
      return [];
    }

    logger.info("competitor-strike", "Weakness analysis complete", {
      extra: { shop, weaknessCount: data.length },
    });

    return data;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("competitor-strike", "AI analysis failed", {
      extra: { shop, error: message },
    });
    return [];
  }
}

// ── 2. Plan Strike ───────────────────────────────────────────────────────

/**
 * Creates a CompetitorStrike record with "planned" status. Uses AI to generate
 * target keywords and estimated impact based on competitor weakness data.
 *
 * @param strikeType - One of: "undercut_bid", "gap_exploit", "weakness_attack", "budget_drain"
 */
export async function planStrike(
  shop: string,
  competitorDomain: string,
  strikeType: string,
): Promise<StrikePlan> {
  const validStrikeTypes = [
    "undercut_bid",
    "gap_exploit",
    "weakness_attack",
    "budget_drain",
  ];

  if (!validStrikeTypes.includes(strikeType)) {
    throw new Error(
      `Invalid strikeType "${strikeType}". Must be one of: ${validStrikeTypes.join(", ")}`,
    );
  }

  logger.info("competitor-strike", "Planning strike", {
    extra: { shop, competitorDomain, strikeType },
  });

  // Fetch relevant competitor data for this domain
  const [intel, gaps] = await Promise.all([
    prisma.competitorSnapshot.findMany({
      where: { shop, competitorDomain },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.keywordGapAnalysis.findMany({
      where: { shop, source: { contains: competitorDomain } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const prompt = `You are a Google Ads strategist planning a competitive strike.

STRIKE TYPE: ${strikeType}
COMPETITOR: ${sanitizeForPrompt(competitorDomain)}

Strike type definitions:
- undercut_bid: Target keywords where competitor pays high CPCs with lower bids + better ads
- gap_exploit: Target keywords the competitor is missing entirely
- weakness_attack: Target areas where competitor has low quality scores or poor ads
- budget_drain: Target competitor's expensive keywords to force them to spend more

COMPETITOR INTEL:
${sanitizeForPrompt(JSON.stringify(intel.map((i) => ({ weaknesses: i.weaknesses, spend: i.estMonthlySpend, adCount: i.adCount })), null, 2))}

KEYWORD GAPS:
${sanitizeForPrompt(JSON.stringify(gaps.map((g) => ({ keyword: g.keyword, source: g.source, opportunityScore: g.opportunityScore, competitionLevel: g.competitionLevel })), null, 2))}

Generate a strike plan with:
- targetKeywords: array of 5-15 keywords to target
- estimatedImpact: { additionalClicks: number, estimatedCostSaving: number, projectedRoasLift: number, competitorImpact: string }

Return ONLY valid JSON object with "targetKeywords" and "estimatedImpact" fields, no markdown.`;

  try {
    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (response.content[0] as { type: string; text: string }).text.trim();
    const { data, error } = safeParseAiJson<{
      targetKeywords: string[];
      estimatedImpact: Record<string, unknown>;
    }>(text);

    if (!data) {
      logger.error("competitor-strike", "Failed to parse AI strike plan", {
        extra: { error },
      });
      throw new Error(`AI strike plan parse failed: ${error}`);
    }

    const strike = await prisma.competitorStrike.create({
      data: {
        shop,
        competitorDomain,
        strikeType,
        targetKeywords: JSON.stringify(data.targetKeywords),
        estimatedImpact: JSON.stringify(data.estimatedImpact),
        status: "planned",
      },
    });

    logger.info("competitor-strike", "Strike planned successfully", {
      extra: { shop, strikeId: strike.id, keywordCount: data.targetKeywords.length },
    });

    return {
      id: strike.id,
      competitorDomain: strike.competitorDomain,
      strikeType: strike.strikeType,
      targetKeywords: data.targetKeywords,
      estimatedImpact: data.estimatedImpact,
      status: strike.status,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("competitor-strike", "Strike planning failed", {
      extra: { shop, competitorDomain, strikeType, error: message },
    });
    throw err;
  }
}

// ── 3. Execute Strike ────────────────────────────────────────────────────

/**
 * Finds the strike record, updates status to "active", and logs the action.
 * In production this would create/modify Google Ads campaigns; for now it
 * updates the record with a launchedAt timestamp.
 */
export async function executeStrike(
  shop: string,
  strikeId: string,
): Promise<{ id: string; status: string; launchedAt: Date }> {
  logger.info("competitor-strike", "Executing strike", {
    extra: { shop, strikeId },
  });

  const strike = await prisma.competitorStrike.findFirst({
    where: { id: strikeId, shop },
  });

  if (!strike) {
    throw new Error(`Strike ${strikeId} not found for shop ${shop}`);
  }

  if (strike.status !== "planned") {
    throw new Error(
      `Strike ${strikeId} cannot be executed — current status is "${strike.status}"`,
    );
  }

  const now = new Date();

  const updated = await prisma.competitorStrike.update({
    where: { id: strikeId },
    data: {
      status: "active",
      launchedAt: now,
    },
  });

  logger.info("competitor-strike", "Strike launched", {
    extra: {
      shop,
      strikeId,
      competitorDomain: updated.competitorDomain,
      strikeType: updated.strikeType,
      launchedAt: now.toISOString(),
    },
  });

  return {
    id: updated.id,
    status: updated.status,
    launchedAt: now,
  };
}

// ── 4. Measure Strike Results ────────────────────────────────────────────

/**
 * Fetches the strike, gets campaign performance data for related keywords,
 * calculates impact metrics, and updates the strike with resultMetrics
 * and status "completed".
 */
export async function measureStrikeResults(
  shop: string,
  strikeId: string,
): Promise<StrikeResult> {
  logger.info("competitor-strike", "Measuring strike results", {
    extra: { shop, strikeId },
  });

  const strike = await prisma.competitorStrike.findFirst({
    where: { id: strikeId, shop },
  });

  if (!strike) {
    throw new Error(`Strike ${strikeId} not found for shop ${shop}`);
  }

  if (strike.status !== "active") {
    throw new Error(
      `Strike ${strikeId} is not active — current status is "${strike.status}"`,
    );
  }

  let targetKeywords: string[] = [];
  try {
    targetKeywords = JSON.parse(strike.targetKeywords);
  } catch {
    logger.error("competitor-strike", "Failed to parse target keywords", {
      extra: { strikeId },
    });
  }

  // Gather campaign performance for impact measurement
  let totalClicks = 0;
  let totalCost = 0;
  let totalConversions = 0;
  let totalConversionValue = 0;
  let totalImpressions = 0;

  try {
    const campaigns = await listSmartAdsCampaigns();

    for (const campaign of campaigns) {
      try {
        const daysSinceLaunch = strike.launchedAt
          ? Math.ceil((Date.now() - strike.launchedAt.getTime()) / 86400000)
          : 7;
        const perf = await getCampaignPerformanceByDate(
          campaign.id,
          Math.max(1, Math.min(daysSinceLaunch, 90)),
        );

        if (Array.isArray(perf)) {
          for (const day of perf) {
            totalClicks += day.clicks || 0;
            totalCost += day.cost || 0;
            totalConversions += day.conversions || 0;
            totalConversionValue += day.conversionValue || 0;
            totalImpressions += day.impressions || 0;
          }
        }

        // Check keyword performance for target keywords
        const kwPerf = await getKeywordPerformance(campaign.id);
        for (const kw of kwPerf) {
          const kwText = (kw.keyword || "").toLowerCase();
          if (targetKeywords.some((tk) => kwText.includes(tk.toLowerCase()))) {
            totalClicks += kw.clicks || 0;
            totalCost += kw.cost || 0;
            totalConversions += kw.conversions || 0;
          }
        }
      } catch (campaignErr: unknown) {
        const msg =
          campaignErr instanceof Error ? campaignErr.message : String(campaignErr);
        logger.warn("competitor-strike", "Campaign perf fetch failed", {
          extra: { campaignId: campaign.id, error: msg },
        });
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("competitor-strike", "Failed to fetch campaign data", {
      extra: { error: message },
    });
  }

  const resultMetrics = {
    totalClicks,
    totalCost: Math.round(totalCost * 100) / 100,
    totalConversions,
    totalConversionValue: Math.round(totalConversionValue * 100) / 100,
    totalImpressions,
    roas:
      totalCost > 0
        ? Math.round((totalConversionValue / totalCost) * 100) / 100
        : 0,
    ctr:
      totalImpressions > 0
        ? Math.round((totalClicks / totalImpressions) * 10000) / 100
        : 0,
    keywordsTargeted: targetKeywords.length,
    measurementDate: new Date().toISOString(),
  };

  const updated = await prisma.competitorStrike.update({
    where: { id: strikeId },
    data: {
      status: "completed",
      resultMetrics: JSON.stringify(resultMetrics),
    },
  });

  logger.info("competitor-strike", "Strike results measured", {
    extra: {
      shop,
      strikeId,
      roas: resultMetrics.roas,
      totalConversions: resultMetrics.totalConversions,
    },
  });

  return {
    id: updated.id,
    status: updated.status,
    resultMetrics,
  };
}

/**
 * Engine 20: Ghost Campaign / Product Discovery
 *
 * Discovers hidden keyword opportunities from search term reports —
 * micro-niches, seasonal trends, and competitor-abandoned keywords.
 * Creates low-risk test campaigns to validate opportunities before
 * scaling budget.
 */
import Anthropic from "@anthropic-ai/sdk";
import prisma from "./db.server.js";
import { logger } from "./utils/logger.js";
import { sanitizeForPrompt, safeParseAiJson } from "./utils/ai-safety.server.js";
import {
  getSearchTermReport,
  listSmartAdsCampaigns,
  getCampaignPerformanceByDate,
} from "./google-ads.server.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const AI_MODEL = "claude-haiku-4-5-20251001";

// ── Types ────────────────────────────────────────────────────────────────

interface GhostOpportunity {
  keyword: string;
  discoveryType: string;
  searchVolume: number | null;
  competition: string | null;
  opportunityScore: number;
  estimatedCpc: number | null;
  estimatedRoas: number | null;
  reasoning: string;
}

interface GhostRecord {
  id: string;
  shop: string;
  discoveryType: string;
  keyword: string;
  searchVolume: number | null;
  competition: string | null;
  opportunityScore: number;
  estimatedCpc: number | null;
  estimatedRoas: number | null;
  status: string;
  campaignId: string | null;
  createdAt: Date;
}

// ── 1. Discover Ghost Opportunities ──────────────────────────────────────

/**
 * Queries search term reports from Google Ads across all campaigns, finds
 * keywords with impressions but low/no clicks, and uses AI to identify
 * micro-niches, seasonal opportunities, and competitor-abandoned keywords.
 * Creates GhostCampaign records for the top opportunities scored 0-100.
 */
export async function discoverGhostOpportunities(
  shop: string,
): Promise<GhostRecord[]> {
  logger.info("ghost-campaign", "Starting ghost opportunity discovery", {
    extra: { shop },
  });

  // Collect search terms across all campaigns
  let allSearchTerms: Array<{
    searchTerm: string;
    impressions: number;
    clicks: number;
    cost: number;
    conversions: number;
    campaignId: string;
  }> = [];

  try {
    const campaigns = await listSmartAdsCampaigns();

    for (const campaign of campaigns) {
      try {
        const terms = await getSearchTermReport(campaign.id);
        const mapped = terms.map(
          (t: {
            searchTerm?: string;
            search_term?: string;
            impressions?: number;
            clicks?: number;
            cost?: number;
            conversions?: number;
          }) => ({
            searchTerm: t.searchTerm || t.search_term || "",
            impressions: t.impressions || 0,
            clicks: t.clicks || 0,
            cost: t.cost || 0,
            conversions: t.conversions || 0,
            campaignId: campaign.id,
          }),
        );
        allSearchTerms = allSearchTerms.concat(mapped);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn("ghost-campaign", "Search term fetch failed for campaign", {
          extra: { campaignId: campaign.id, error: msg },
        });
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("ghost-campaign", "Failed to list campaigns", {
      extra: { error: message },
    });
    return [];
  }

  if (allSearchTerms.length === 0) {
    logger.info("ghost-campaign", "No search terms found", { extra: { shop } });
    return [];
  }

  // Filter: impressions but low/no clicks — potential ghost keywords
  const ghostCandidates = allSearchTerms.filter(
    (t) => t.impressions >= 5 && t.clicks <= 2,
  );

  // Deduplicate by search term, summing metrics
  const termMap = new Map<
    string,
    { impressions: number; clicks: number; cost: number; conversions: number }
  >();
  for (const t of ghostCandidates) {
    const key = t.searchTerm.toLowerCase().trim();
    if (!key) continue;
    const existing = termMap.get(key) || {
      impressions: 0,
      clicks: 0,
      cost: 0,
      conversions: 0,
    };
    termMap.set(key, {
      impressions: existing.impressions + t.impressions,
      clicks: existing.clicks + t.clicks,
      cost: existing.cost + t.cost,
      conversions: existing.conversions + t.conversions,
    });
  }

  const uniqueTerms = Array.from(termMap.entries())
    .map(([keyword, metrics]) => ({ keyword, ...metrics }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 100);

  if (uniqueTerms.length === 0) {
    logger.info("ghost-campaign", "No ghost candidates found", {
      extra: { shop },
    });
    return [];
  }

  // Fetch store products for relevance matching
  let shopProducts: string[] = [];
  try {
    const products = await prisma.product.findMany({
      where: { shop },
      select: { title: true },
      take: 50,
    });
    shopProducts = products.map((p) => p.title);
  } catch {
    logger.warn("ghost-campaign", "Could not fetch shop products", {
      extra: { shop },
    });
  }

  // Use AI to identify opportunities
  const prompt = `You are a Google Ads keyword discovery specialist.

Analyze these search terms that have impressions but very low clicks — they represent untapped opportunities.

SEARCH TERMS (impressions but low clicks):
${sanitizeForPrompt(JSON.stringify(uniqueTerms.slice(0, 60), null, 2))}

STORE PRODUCTS:
${sanitizeForPrompt(JSON.stringify(shopProducts, null, 2))}

For each promising opportunity, determine:
- keyword: the search term
- discoveryType: one of "micro_niche", "seasonal", "competitor_abandoned", "long_tail", "emerging_trend"
- searchVolume: estimated monthly search volume (number or null)
- competition: "low", "medium", or "high"
- opportunityScore: 0-100 (high search volume + low competition + relevant to store products = high score)
- estimatedCpc: estimated cost per click in USD (number or null)
- estimatedRoas: estimated return on ad spend (number or null)
- reasoning: brief explanation of why this is an opportunity

Return the top 20 opportunities as a JSON array sorted by opportunityScore descending.
Return ONLY valid JSON array, no markdown.`;

  let opportunities: GhostOpportunity[] = [];
  try {
    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (response.content[0] as { type: string; text: string }).text.trim();
    const { data, error } = safeParseAiJson<GhostOpportunity[]>(text);

    if (!data) {
      logger.error("ghost-campaign", "Failed to parse AI opportunities", {
        extra: { error },
      });
      return [];
    }

    opportunities = data;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("ghost-campaign", "AI discovery analysis failed", {
      extra: { shop, error: message },
    });
    return [];
  }

  // Create GhostCampaign records for top opportunities
  const created: GhostRecord[] = [];
  for (const opp of opportunities) {
    try {
      // Skip duplicates — don't recreate if keyword already tracked
      const existing = await prisma.ghostCampaign.findFirst({
        where: { shop, keyword: opp.keyword },
      });
      if (existing) continue;

      const record = await prisma.ghostCampaign.create({
        data: {
          shop,
          discoveryType: opp.discoveryType || "long_tail",
          keyword: opp.keyword,
          searchVolume: opp.searchVolume ?? null,
          competition: opp.competition ?? null,
          opportunityScore: Math.min(100, Math.max(0, Math.round(opp.opportunityScore))),
          estimatedCpc: opp.estimatedCpc ?? null,
          estimatedRoas: opp.estimatedRoas ?? null,
          status: "discovered",
        },
      });
      created.push(record as GhostRecord);
    } catch (createErr: unknown) {
      const msg = createErr instanceof Error ? createErr.message : String(createErr);
      logger.warn("ghost-campaign", "Failed to create ghost record", {
        extra: { keyword: opp.keyword, error: msg },
      });
    }
  }

  logger.info("ghost-campaign", "Ghost discovery complete", {
    extra: { shop, candidatesFound: uniqueTerms.length, opportunitiesCreated: created.length },
  });

  return created;
}

// ── 2. Score Opportunity ─────────────────────────────────────────────────

/**
 * Pure scoring function: high search volume + low competition + relevant
 * to store products = high score. Returns 0-100.
 */
export function scoreOpportunity(
  keyword: string,
  searchVolume: number | null,
  competition: string | null,
  shopProducts: string[],
): number {
  let score = 50; // Base score

  // Search volume factor (0-30 points)
  if (searchVolume !== null) {
    if (searchVolume >= 10000) score += 30;
    else if (searchVolume >= 5000) score += 25;
    else if (searchVolume >= 1000) score += 20;
    else if (searchVolume >= 500) score += 15;
    else if (searchVolume >= 100) score += 10;
    else score += 5;
  }

  // Competition factor (0-30 points)
  const comp = (competition || "").toLowerCase();
  if (comp === "low") score += 30;
  else if (comp === "medium") score += 15;
  else if (comp === "high") score += 5;

  // Relevance factor (0-20 points)
  const kwLower = keyword.toLowerCase();
  let relevanceBonus = 0;
  for (const product of shopProducts) {
    const productLower = product.toLowerCase();
    const productWords = productLower.split(/\s+/);

    // Exact product name match
    if (kwLower.includes(productLower) || productLower.includes(kwLower)) {
      relevanceBonus = 20;
      break;
    }

    // Partial word match
    const matchingWords = productWords.filter(
      (w) => w.length > 3 && kwLower.includes(w),
    );
    const partialScore = Math.min(15, matchingWords.length * 5);
    relevanceBonus = Math.max(relevanceBonus, partialScore);
  }
  score += relevanceBonus;

  // Penalty for very generic single-word keywords
  if (keyword.split(/\s+/).length === 1) {
    score -= 10;
  }

  return Math.min(100, Math.max(0, score));
}

// ── 3. Launch Test Campaign ──────────────────────────────────────────────

/**
 * Finds the GhostCampaign record and updates status to "testing".
 * Logs that a micro-budget test would be created. Does not actually
 * create a Google Ads campaign — simulates the workflow.
 */
export async function launchTestCampaign(
  shop: string,
  ghostId: string,
): Promise<GhostRecord> {
  logger.info("ghost-campaign", "Launching test campaign", {
    extra: { shop, ghostId },
  });

  const ghost = await prisma.ghostCampaign.findFirst({
    where: { id: ghostId, shop },
  });

  if (!ghost) {
    throw new Error(`Ghost campaign ${ghostId} not found for shop ${shop}`);
  }

  if (ghost.status !== "discovered") {
    throw new Error(
      `Ghost campaign ${ghostId} cannot be launched — current status is "${ghost.status}"`,
    );
  }

  const updated = await prisma.ghostCampaign.update({
    where: { id: ghostId },
    data: { status: "testing" },
  });

  logger.info("ghost-campaign", "Test campaign launched (simulated)", {
    extra: {
      shop,
      ghostId,
      keyword: updated.keyword,
      opportunityScore: updated.opportunityScore,
      note: "Micro-budget test campaign would be created in production",
    },
  });

  return updated as GhostRecord;
}

// ── 4. Validate Ghost Results ────────────────────────────────────────────

/**
 * Finds all GhostCampaigns with status "testing". For each, checks if
 * campaign performance meets thresholds (ROAS > 2, CTR > 1%).
 * Marks as "validated" or "rejected" based on results.
 */
export async function validateGhostResults(
  shop: string,
): Promise<{ validated: number; rejected: number; total: number }> {
  logger.info("ghost-campaign", "Validating ghost campaign results", {
    extra: { shop },
  });

  const testingGhosts = await prisma.ghostCampaign.findMany({
    where: { shop, status: "testing" },
  });

  if (testingGhosts.length === 0) {
    logger.info("ghost-campaign", "No testing ghost campaigns to validate", {
      extra: { shop },
    });
    return { validated: 0, rejected: 0, total: 0 };
  }

  // Fetch performance data for validation
  let campaignPerformance: Array<{
    campaignId: string;
    clicks: number;
    impressions: number;
    cost: number;
    conversions: number;
    conversionValue: number;
    roas: number;
  }> = [];

  try {
    const campaigns = await listSmartAdsCampaigns();
    const weekAgo = new Date(Date.now() - 7 * 86400000)
      .toISOString()
      .split("T")[0];
    const today = new Date().toISOString().split("T")[0];

    for (const campaign of campaigns) {
      try {
        const perf = await getCampaignPerformanceByDate(
          campaign.id,
          7,
        );
        if (Array.isArray(perf)) {
          campaignPerformance = campaignPerformance.concat(
            perf.map((p) => ({
              campaignId: campaign.id,
              clicks: p.clicks || 0,
              impressions: p.impressions || 0,
              cost: p.cost || 0,
              conversions: p.conversions || 0,
              conversionValue: p.conversionValue || 0,
              roas: p.roas || 0,
            })),
          );
        }
      } catch {
        // Skip campaigns with fetch errors
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("ghost-campaign", "Failed to fetch performance for validation", {
      extra: { error: message },
    });
  }

  // Group performance by campaignId for per-ghost evaluation
  const perfByCampaign = new Map<string, { clicks: number; impressions: number; cost: number; conversionValue: number }>();
  for (const p of campaignPerformance) {
    const existing = perfByCampaign.get(p.campaignId);
    if (existing) {
      existing.clicks += p.clicks;
      existing.impressions += p.impressions;
      existing.cost += p.cost;
      existing.conversionValue += p.conversionValue;
    } else {
      perfByCampaign.set(p.campaignId, {
        clicks: p.clicks,
        impressions: p.impressions,
        cost: p.cost,
        conversionValue: p.conversionValue,
      });
    }
  }

  // Fallback overall metrics for ghosts without linked campaigns
  const totalCost = campaignPerformance.reduce((sum, p) => sum + p.cost, 0);
  const totalConversionValue = campaignPerformance.reduce((sum, p) => sum + p.conversionValue, 0);
  const totalClicks = campaignPerformance.reduce((sum, p) => sum + p.clicks, 0);
  const totalImpressions = campaignPerformance.reduce((sum, p) => sum + p.impressions, 0);
  const fallbackRoas = totalCost > 0 ? totalConversionValue / totalCost : 0;
  const fallbackCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  let validated = 0;
  let rejected = 0;

  for (const ghost of testingGhosts) {
    // Use per-campaign metrics if ghost has a linked campaign, otherwise fallback
    let ghostRoas = fallbackRoas;
    let ghostCtr = fallbackCtr;

    if (ghost.campaignId && perfByCampaign.has(ghost.campaignId)) {
      const cp = perfByCampaign.get(ghost.campaignId)!;
      ghostRoas = cp.cost > 0 ? cp.conversionValue / cp.cost : 0;
      ghostCtr = cp.impressions > 0 ? (cp.clicks / cp.impressions) * 100 : 0;
    }

    const meetsRoas = ghostRoas > 2;
    const meetsCtr = ghostCtr > 1;

    const newStatus = meetsRoas && meetsCtr ? "validated" : "rejected";

    try {
      await prisma.ghostCampaign.update({
        where: { id: ghost.id },
        data: { status: newStatus },
      });

      if (newStatus === "validated") validated++;
      else rejected++;

      logger.info("ghost-campaign", `Ghost campaign ${newStatus}`, {
        extra: {
          ghostId: ghost.id,
          keyword: ghost.keyword,
          roas: Math.round(ghostRoas * 100) / 100,
          ctr: Math.round(ghostCtr * 100) / 100,
        },
      });
    } catch (updateErr: unknown) {
      const msg = updateErr instanceof Error ? updateErr.message : String(updateErr);
      logger.error("ghost-campaign", "Failed to update ghost status", {
        extra: { ghostId: ghost.id, error: msg },
      });
    }
  }

  logger.info("ghost-campaign", "Validation complete", {
    extra: { shop, validated, rejected, total: testingGhosts.length },
  });

  return { validated, rejected, total: testingGhosts.length };
}

// ── 5. Get Ghost Opportunities ───────────────────────────────────────────

/**
 * Simple query to list all ghost campaign opportunities for a shop,
 * ordered by opportunity score descending.
 */
export async function getGhostOpportunities(
  shop: string,
): Promise<GhostRecord[]> {
  const records = await prisma.ghostCampaign.findMany({
    where: { shop },
    orderBy: { opportunityScore: "desc" },
  });
  return records as GhostRecord[];
}

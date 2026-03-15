/**
 * Engine 21: Life Moment Targeting
 *
 * Detects life moments (wedding, baby, moving, etc.) relevant to the store's
 * products and generates emotionally resonant ad copy for each moment.
 */
import prisma from "./db.server.js";
import { logger } from "./utils/logger.js";
import Anthropic from "@anthropic-ai/sdk";
import { safeParseAiJson } from "./utils/ai-safety.server.js";

// ─── Types ───────────────────────────────────────────────────────────────────

type MomentType =
  | "wedding"
  | "baby"
  | "moving"
  | "graduation"
  | "holiday"
  | "back_to_school"
  | "new_job"
  | "retirement";

interface MomentDetection {
  momentType: MomentType;
  products: Array<{ id: string; title: string }>;
  relevanceScore: number;
}

interface MomentCopyResult {
  headlines: string[];
  descriptions: string[];
  emotionalAngle: string;
}

interface UpcomingMoment {
  momentType: MomentType;
  label: string;
  months: number[];
  startsInDays: number;
  isActive: boolean;
  hasCampaign: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MOMENT_SEASONS: Record<MomentType, { months: number[]; label: string }> = {
  wedding: { months: [3, 4, 5, 6], label: "Wedding Season" },
  baby: { months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], label: "New Baby (Year-round)" },
  moving: { months: [5, 6, 7, 8], label: "Moving Season" },
  graduation: { months: [4, 5, 6], label: "Graduation Season" },
  holiday: { months: [11, 12], label: "Holiday Season" },
  back_to_school: { months: [7, 8, 9], label: "Back to School" },
  new_job: { months: [1, 2, 3, 9, 10], label: "New Job Season" },
  retirement: { months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], label: "Retirement (Year-round)" },
};

const AI_MODEL = "claude-haiku-4-5-20251001";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── 1. Detect Life Moments ─────────────────────────────────────────────────

/**
 * Query products from the store and use AI to map each product category
 * to relevant life moments with relevance scores.
 */
export async function detectLifeMoments(shop: string): Promise<MomentDetection[]> {
  try {
    logger.info("life-moment", "Detecting life moments", { extra: { shop } });

    const products = await prisma.product.findMany({
      where: { shop },
      select: { id: true, title: true, productType: true, tags: true },
      take: 200,
    });

    if (products.length === 0) {
      logger.info("life-moment", "No products found for shop", { extra: { shop } });
      return [];
    }

    const productSummary = products.map((p) => ({
      id: p.id,
      title: p.title,
      type: p.productType || "unknown",
      tags: p.tags || "",
    }));

    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `You are a marketing analyst. Analyze these products and determine which life moments they are relevant to.

Life moment types: wedding, baby, moving, graduation, holiday, back_to_school, new_job, retirement

Products:
${JSON.stringify(productSummary, null, 2)}

Return a JSON array of objects with:
- momentType: one of the life moment types above
- productIds: array of product IDs relevant to this moment
- relevanceScore: 0-100 how relevant the products are to this moment

Only include moments with at least one relevant product and relevanceScore >= 30.
Return ONLY valid JSON, no markdown or explanation.`,
        },
      ],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : "";
    const { data, error } = safeParseAiJson<
      Array<{ momentType: MomentType; productIds: string[]; relevanceScore: number }>
    >(text);

    if (error || !data) {
      logger.error("life-moment", "Failed to parse AI response", { extra: { error } });
      return [];
    }

    // Map product IDs back to product objects
    const productMap = new Map(products.map((p) => [p.id, p]));
    const results: MomentDetection[] = data
      .filter((item) => MOMENT_SEASONS[item.momentType])
      .map((item) => ({
        momentType: item.momentType,
        products: item.productIds
          .map((id) => {
            const p = productMap.get(id);
            return p ? { id: p.id, title: p.title } : null;
          })
          .filter((p): p is { id: string; title: string } => p !== null),
        relevanceScore: item.relevanceScore,
      }))
      .filter((r) => r.products.length > 0);

    logger.info("life-moment", `Detected ${results.length} life moments`, { extra: { shop } });
    return results;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("life-moment", "Error detecting life moments", { extra: { shop, error: message } });
    throw err;
  }
}

// ─── 2. Generate Moment Campaign ────────────────────────────────────────────

/**
 * Use AI to generate moment-specific ad copy that emotionally resonates
 * with the life event. Creates a LifeMomentCampaign record with status "draft".
 */
export async function generateMomentCampaign(
  shop: string,
  momentType: string,
  productIds: string[],
): Promise<Record<string, unknown>> {
  try {
    logger.info("life-moment", "Generating moment campaign", { extra: { shop, momentType } });

    const season = MOMENT_SEASONS[momentType as MomentType];
    if (!season) {
      throw new Error(`Unknown moment type: ${momentType}`);
    }

    // Fetch product details
    const products = await prisma.product.findMany({
      where: { shop, id: { in: productIds } },
      select: { id: true, title: true, productType: true, description: true },
    });

    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `You are an expert ad copywriter specializing in life-moment marketing.

Life Moment: ${season.label} (${momentType})
Products:
${JSON.stringify(products.map((p) => ({ title: p.title, type: p.productType, description: p.description })), null, 2)}

Generate emotionally resonant Google Ads copy for this life moment.

Return JSON with:
- headlines: array of 5 headlines (max 30 chars each) that connect the product to the emotional journey of the life moment
- descriptions: array of 3 descriptions (max 90 chars each) that empathize with the customer's situation
- targetAudience: description of the ideal audience for this moment
- emotionalAngle: the core emotional hook being used

Return ONLY valid JSON, no markdown or explanation.`,
        },
      ],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : "";
    const { data: adCopy, error } = safeParseAiJson<MomentCopyResult & { targetAudience?: string }>(text);

    if (error || !adCopy) {
      logger.error("life-moment", "Failed to parse AI ad copy", { extra: { error } });
      throw new Error("Failed to generate ad copy");
    }

    // Calculate season start/end dates
    // Handle non-contiguous month lists (e.g. new_job: [1,2,3,9,10])
    // by finding the nearest upcoming contiguous block
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const sortedMonths = [...season.months].sort((a, b) => a - b);

    // Find the next active month block relative to current date
    let blockStart = sortedMonths[0];
    let blockEnd = sortedMonths[sortedMonths.length - 1];

    // Try to find a contiguous block that includes or follows the current month
    const blocks: Array<{ start: number; end: number }> = [];
    let bStart = sortedMonths[0];
    for (let i = 1; i < sortedMonths.length; i++) {
      if (sortedMonths[i] !== sortedMonths[i - 1] + 1) {
        blocks.push({ start: bStart, end: sortedMonths[i - 1] });
        bStart = sortedMonths[i];
      }
    }
    blocks.push({ start: bStart, end: sortedMonths[sortedMonths.length - 1] });

    // Pick nearest upcoming block
    const upcomingBlock = blocks.find(b => b.end >= currentMonth) || blocks[0];
    blockStart = upcomingBlock.start;
    blockEnd = upcomingBlock.end;

    let seasonYear = currentYear;
    if (currentMonth > blockEnd) {
      seasonYear = currentYear + 1;
    }

    const seasonStart = new Date(seasonYear, blockStart - 1, 1);
    const seasonEnd = new Date(seasonYear, blockEnd, 0); // last day of end month

    const campaign = await prisma.lifeMomentCampaign.create({
      data: {
        shop,
        momentType,
        targetAudience: JSON.stringify(adCopy.targetAudience || ""),
        productIds: JSON.stringify(productIds),
        adCopy: JSON.stringify(adCopy),
        status: "draft",
        seasonStart,
        seasonEnd,
      },
    });

    logger.info("life-moment", `Created moment campaign ${campaign.id}`, { extra: { shop, momentType } });

    return {
      id: campaign.id,
      momentType,
      adCopy,
      seasonStart: seasonStart.toISOString(),
      seasonEnd: seasonEnd.toISOString(),
      status: "draft",
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("life-moment", "Error generating moment campaign", {
      extra: { shop, momentType, error: message },
    });
    throw err;
  }
}

// ─── 3. Get Upcoming Moments ────────────────────────────────────────────────

/**
 * Return life moments calendar: which moments are coming up in the next 30-60 days.
 * Includes both seasonal moments and evergreen ones. Checks which have campaigns.
 */
export async function getUpcomingMoments(shop: string): Promise<UpcomingMoment[]> {
  try {
    logger.info("life-moment", "Fetching upcoming moments", { extra: { shop } });

    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12

    // Fetch existing campaigns to mark which moments are covered
    const existingCampaigns = await prisma.lifeMomentCampaign.findMany({
      where: { shop },
      select: { momentType: true, status: true },
    });

    const campaignedMoments = new Set(existingCampaigns.map((c) => c.momentType));

    const results: UpcomingMoment[] = [];

    for (const [momentType, season] of Object.entries(MOMENT_SEASONS)) {
      const { months, label } = season;

      // Check if the moment is currently active
      const isActive = months.includes(currentMonth);

      // Calculate how many days until the moment starts
      let startsInDays = 0;
      if (!isActive) {
        const firstMonth = Math.min(...months);
        let targetMonth = firstMonth;
        let targetYear = now.getFullYear();

        if (firstMonth <= currentMonth) {
          // Season already started/passed, look at next year
          targetYear += 1;
        }

        const targetDate = new Date(targetYear, targetMonth - 1, 1);
        startsInDays = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }

      // Include if active or starting within 60 days
      if (isActive || startsInDays <= 60) {
        results.push({
          momentType: momentType as MomentType,
          label,
          months,
          startsInDays,
          isActive,
          hasCampaign: campaignedMoments.has(momentType),
        });
      }
    }

    // Sort: active first, then by days until start
    results.sort((a, b) => {
      if (a.isActive && !b.isActive) return -1;
      if (!a.isActive && b.isActive) return 1;
      return a.startsInDays - b.startsInDays;
    });

    logger.info("life-moment", `Found ${results.length} upcoming moments`, { extra: { shop } });
    return results;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("life-moment", "Error fetching upcoming moments", { extra: { shop, error: message } });
    throw err;
  }
}

// ─── 4. Optimize Moment Copy ────────────────────────────────────────────────

/**
 * Fetch a LifeMomentCampaign, analyze current performance if available,
 * and use AI to generate improved copy variations.
 */
export async function optimizeMomentCopy(
  shop: string,
  momentId: string,
): Promise<Record<string, unknown>> {
  try {
    logger.info("life-moment", "Optimizing moment copy", { extra: { shop, momentId } });

    const campaign = await prisma.lifeMomentCampaign.findFirst({
      where: { id: momentId, shop },
    });

    if (!campaign) {
      throw new Error(`Life moment campaign not found: ${momentId}`);
    }

    const currentCopy = campaign.adCopy ? JSON.parse(campaign.adCopy as string) : null;
    const performance = campaign.performance ? JSON.parse(campaign.performance as string) : null;

    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `You are an expert ad copy optimizer specializing in life-moment marketing.

Moment Type: ${campaign.momentType}
Season: ${MOMENT_SEASONS[campaign.momentType as MomentType]?.label || campaign.momentType}

Current Ad Copy:
${JSON.stringify(currentCopy, null, 2)}

${performance ? `Current Performance:\n${JSON.stringify(performance, null, 2)}` : "No performance data available yet."}

Generate improved ad copy variations. If performance data is available, analyze what's working and what isn't, then optimize accordingly. If no performance data, create alternative angles.

Return JSON with:
- headlines: array of 5 new headline variations (max 30 chars each)
- descriptions: array of 3 new description variations (max 90 chars each)
- emotionalAngle: the new emotional hook
- optimizationNotes: brief explanation of what was changed and why

Return ONLY valid JSON, no markdown or explanation.`,
        },
      ],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : "";
    const { data: optimizedCopy, error } = safeParseAiJson<
      MomentCopyResult & { optimizationNotes?: string }
    >(text);

    if (error || !optimizedCopy) {
      logger.error("life-moment", "Failed to parse optimized copy", { extra: { error } });
      throw new Error("Failed to generate optimized copy");
    }

    // Update the campaign with new copy
    await prisma.lifeMomentCampaign.update({
      where: { id: momentId },
      data: { adCopy: JSON.stringify(optimizedCopy) },
    });

    logger.info("life-moment", `Optimized copy for campaign ${momentId}`, { extra: { shop } });

    return {
      id: momentId,
      momentType: campaign.momentType,
      previousCopy: currentCopy,
      optimizedCopy,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("life-moment", "Error optimizing moment copy", {
      extra: { shop, momentId, error: message },
    });
    throw err;
  }
}

// ─── 5. Get Life Moment Campaigns ───────────────────────────────────────────

/**
 * Simple findMany ordered by createdAt desc.
 */
export async function getLifeMomentCampaigns(shop: string) {
  try {
    const campaigns = await prisma.lifeMomentCampaign.findMany({
      where: { shop },
      orderBy: { createdAt: "desc" },
    });

    return campaigns.map((c) => ({
      ...c,
      targetAudience: c.targetAudience ? JSON.parse(c.targetAudience as string) : null,
      productIds: c.productIds ? JSON.parse(c.productIds as string) : [],
      adCopy: c.adCopy ? JSON.parse(c.adCopy as string) : null,
      performance: c.performance ? JSON.parse(c.performance as string) : null,
    }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("life-moment", "Error fetching campaigns", { extra: { shop, error: message } });
    throw err;
  }
}

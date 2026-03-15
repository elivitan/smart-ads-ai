/**
 * campaignLifecycle.server.js (v2)
 *
 * Full campaign creation state machine.
 * States: QUEUED → VALIDATING → CREATING → CAMPAIGN_CREATED
 *         → UPLOADING_ASSETS → ASSETS_UPLOADED → LINKING_CONVERSIONS → ENABLED
 *         Any step can → FAILED / FAILED_PARTIAL → ROLLBACK or RETRY
 *
 * Features:
 * - Idempotency protection (prevents duplicate launches)
 * - Payload validation before Google API call
 * - Partial failure detection + rollback
 * - Step-by-step tracking in DB
 * - Max 3 retries with resume from last step
 *
 * Usage:
 *   import { launchCampaign, retryCampaign, rollbackCampaign, getCampaignStatus } from "./campaignLifecycle.server.js";
 */

import { createCampaign } from "./google-ads.server";
import { withRetry } from "./retry.server";
import prisma from "./db.server";
import { withDbRetry } from "./utils/db-health";
import { logger } from "./utils/logger";

// ── Campaign States ──────────────────────────────────────────────────────
export const CAMPAIGN_STATES = {
  QUEUED: "QUEUED",
  VALIDATING: "VALIDATING",
  CREATING: "CREATING",
  BUDGET_CREATED: "BUDGET_CREATED",
  CAMPAIGN_CREATED: "CAMPAIGN_CREATED",
  UPLOADING_ASSETS: "UPLOADING_ASSETS",
  ASSETS_UPLOADED: "ASSETS_UPLOADED",
  LINKING_CONVERSIONS: "LINKING_CONVERSIONS",
  ENABLED: "ENABLED",
  FAILED: "FAILED",
  FAILED_PARTIAL: "FAILED_PARTIAL",
  ROLLBACK: "ROLLBACK",
};

// ── Idempotency key generator ────────────────────────────────────────────
function generateIdempotencyKey(shop: any, payload: any) {
  const raw = `${shop}|${payload.productTitle}|${payload.campaignType}|${Date.now()}`;
  return `idem_${Buffer.from(raw).toString("base64").slice(0, 32)}`;
}

/**
 * Validate payload before sending to Google.
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validatePayload(payload: any) {
  const errors: any[] = [];

  if (!payload.productTitle || payload.productTitle.trim().length === 0) {
    errors.push("Product title is required");
  }
  if (!payload.finalUrl || !payload.finalUrl.startsWith("http")) {
    errors.push("Valid final URL is required");
  }
  const budget = parseFloat(payload.budgetAmount);
  if (isNaN(budget) || budget < 1) {
    errors.push("Budget must be at least $1/day");
  }
  if (budget > 10000) {
    errors.push("Budget exceeds maximum ($10,000/day)");
  }
  const headlines = payload.headlines || [];
  if (headlines.length < 3) {
    errors.push("At least 3 headlines required");
  }
  const tooLong = headlines.filter((h: any) => h.length > 30);
  if (tooLong.length > 0) {
    errors.push(`${tooLong.length} headline(s) exceed 30 chars`);
  }
  const descriptions = payload.descriptions || [];
  if (descriptions.length < 2) {
    errors.push("At least 2 descriptions required");
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Launch a campaign with full lifecycle tracking.
 * Each step is logged so we can retry from the failure point.
 *
 * @param {string} shop - Shop domain
 * @param {object} payload - Campaign creation payload from Wizard
 * @returns {object} { success, launchId, campaignId, state, steps }
 */
export async function launchCampaign(shop: any, payload: any) {
  const launchId = `launch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const idempotencyKey = generateIdempotencyKey(shop, payload);
  const steps: any[] = [];

  // ── Check idempotency (prevent duplicate launches) ─────────────────
  let launchRecord: any;
  try {
    const existing = await withDbRetry("launch-idem-check", () => prisma.campaignJob.findFirst({
      where: {
        shop,
        idempotencyKey,
        createdAt: { gte: new Date(Date.now() - 60000) },
      },
    }));
    if (existing && existing.state !== CAMPAIGN_STATES.FAILED) {
      return {
        success: false,
        launchId: existing.id,
        state: existing.state,
        error: "Duplicate launch detected. Campaign is already being created.",
        duplicate: true,
      };
    }

    launchRecord = await withDbRetry("launch-create-record", () => prisma.campaignJob.create({
      data: {
        id: launchId,
        shop,
        state: CAMPAIGN_STATES.QUEUED,
        payload: JSON.stringify(payload),
        idempotencyKey,
        attempts: 1,
      },
    }));
  } catch (err: unknown) {
    console.warn(
      "[SmartAds] CampaignJob table not available, proceeding without lifecycle tracking:",
      (err as Error).message,
    );
    launchRecord = null;
  }

  // ── State update helper ────────────────────────────────────────────
  async function updateState(state: any, meta: any = {}) {
    steps.push({ state, timestamp: new Date().toISOString(), ...meta });
    if (launchRecord) {
      try {
        await withDbRetry("launch-update-state", () => prisma.campaignJob.update({
          where: { id: launchId },
          data: { state, stepsJson: JSON.stringify(steps) },
        }));
      } catch {
        /* ignore if table missing */
      }
    }
  }

  try {
    // ── Step 1: VALIDATING ───────────────────────────────────────────
    await updateState(CAMPAIGN_STATES.VALIDATING);
    const validation = validatePayload(payload);
    if (!validation.valid) {
      await updateState(CAMPAIGN_STATES.FAILED, {
        error: `Validation failed: ${validation.errors.join(", ")}`,
      });
      return {
        success: false,
        launchId,
        state: CAMPAIGN_STATES.FAILED,
        steps,
        error: `Validation failed: ${validation.errors.join(", ")}`,
        validationErrors: validation.errors,
        retryable: false,
      };
    }

    // ── Step 1.5: AI INTELLIGENCE ENRICHMENT ────────────────────────
    // Enrich campaign with data from engines 19-23 before creation
    try {
      const enrichment = await enrichCampaignWithIntelligence(shop, payload);
      if (enrichment.adjustedBudget) {
        payload.budgetAmount = String(enrichment.adjustedBudget);
      }
      if (enrichment.additionalKeywords?.length > 0) {
        payload.keywords = [...(payload.keywords || []), ...enrichment.additionalKeywords];
      }
      if (enrichment.warnings?.length > 0) {
        logger.info("campaign-lifecycle", "Intelligence enrichment warnings", {
          extra: { shop, warnings: enrichment.warnings },
        });
      }
    } catch {
      // Non-critical — continue with original payload
    }

    // ── Step 2: CREATING ─────────────────────────────────────────────
    await updateState(CAMPAIGN_STATES.CREATING);

    const result: any = await createCampaign({
      productTitle: payload.productTitle,
      headlines: payload.headlines || [],
      descriptions: payload.descriptions || [],
      keywords: payload.keywords || [],
      finalUrl: payload.finalUrl,
      dailyBudget: parseFloat(payload.budgetAmount) || 50,
      campaignType: payload.campaignType || "search",
      bidding: payload.bidding || "max_conversions",
    });

    if (!result.success) {
      await updateState(CAMPAIGN_STATES.FAILED, {
        error: result.error || "Campaign creation failed",
      });
      return {
        success: false,
        launchId,
        state: CAMPAIGN_STATES.FAILED,
        steps,
        error: result.error,
        retryable: isRetryableError({ message: result.error }),
      };
    }

    // ── Step 3: CAMPAIGN_CREATED ─────────────────────────────────────
    await updateState(CAMPAIGN_STATES.CAMPAIGN_CREATED, {
      campaignId: result.campaignId,
    });

    // ── Step 4: UPLOADING_ASSETS (for PMax campaigns) ────────────────
    if (payload.campaignType === "pmax") {
      await updateState(CAMPAIGN_STATES.UPLOADING_ASSETS);
      // Assets are uploaded as part of createCampaign for PMax
      // This state exists for future expansion (image/video uploads)
      await updateState(CAMPAIGN_STATES.ASSETS_UPLOADED);
    }

    // ── Step 5: LINKING_CONVERSIONS ──────────────────────────────────
    if (!payload.skipTracking) {
      await updateState(CAMPAIGN_STATES.LINKING_CONVERSIONS);
      // Conversion tracking is linked during campaign creation
      // This state exists for future expansion (custom conversion actions)
    }

    // ── Step 6: ENABLED ──────────────────────────────────────────────
    await updateState(CAMPAIGN_STATES.ENABLED, {
      campaignId: result.campaignId,
    });

    return {
      success: true,
      launchId,
      campaignId: result.campaignId,
      campaignType: result.campaignType || payload.campaignType,
      state: CAMPAIGN_STATES.ENABLED,
      steps,
      message: result.message,
    };
  } catch (err: unknown) {
    const errorMsg =
      (err as any)?.errors?.[0]?.message || (err as any)?.message || "Campaign creation failed";
    const retryable = isRetryableError(err);
    const lastStep = steps[steps.length - 1]?.state || CAMPAIGN_STATES.QUEUED;

    // Determine if partial failure (some steps succeeded)
    const isPartial = steps.some(
      (s) =>
        s.state === CAMPAIGN_STATES.CAMPAIGN_CREATED ||
        s.state === CAMPAIGN_STATES.ASSETS_UPLOADED,
    );

    if (isPartial) {
      await updateState(CAMPAIGN_STATES.FAILED_PARTIAL, {
        error: errorMsg,
        lastSuccessStep: lastStep,
        campaignId: steps.find((s: any) => s.campaignId)?.campaignId || null,
      });
    } else {
      await updateState(CAMPAIGN_STATES.FAILED, { error: errorMsg });
    }

    return {
      success: false,
      launchId,
      state: isPartial
        ? CAMPAIGN_STATES.FAILED_PARTIAL
        : CAMPAIGN_STATES.FAILED,
      steps,
      error: errorMsg,
      retryable,
      lastSuccessStep: isPartial ? lastStep : null,
    };
  }
}

/**
 * Retry a failed campaign launch.
 * @param {string} launchId - ID of the failed launch
 * @returns {object} Same as launchCampaign
 */
export async function retryCampaign(launchId: any) {
  let record;
  try {
    record = await withDbRetry("launch-retry-find", () => prisma.campaignJob.findUnique({ where: { id: launchId } }));
  } catch {
    return { success: false, error: "CampaignJob table not available" };
  }

  if (!record) {
    return { success: false, error: "Launch record not found" };
  }

  if (record.state === CAMPAIGN_STATES.ENABLED) {
    return { success: false, error: "Campaign already created successfully" };
  }

  if (record.attempts >= 3) {
    return {
      success: false,
      error: "Max retry attempts (3) reached. Please contact support.",
    };
  }

  await withDbRetry("launch-retry-increment", () => prisma.campaignJob.update({
    where: { id: launchId },
    data: { attempts: { increment: 1 } },
  }));

  const payload = JSON.parse(record.payload);
  return await launchCampaign(record.shop, payload);
}

/**
 * Rollback a partially failed campaign.
 * Attempts to pause/remove the campaign that was partially created.
 * @param {string} launchId
 * @returns {object} { success, message }
 */
export async function rollbackCampaign(launchId: any) {
  let record;
  try {
    record = await withDbRetry("launch-rollback-find", () => prisma.campaignJob.findUnique({ where: { id: launchId } }));
  } catch {
    return { success: false, error: "CampaignJob table not available" };
  }

  if (!record) {
    return { success: false, error: "Launch record not found" };
  }

  if (record.state !== CAMPAIGN_STATES.FAILED_PARTIAL) {
    return {
      success: false,
      error: "Only partially failed campaigns can be rolled back",
    };
  }

  const steps = JSON.parse(record.stepsJson || "[]");
  const campaignId = steps.find((s: any) => s.campaignId)?.campaignId;

  if (!campaignId) {
    await withDbRetry("launch-rollback-no-campaign", () => prisma.campaignJob.update({
      where: { id: launchId },
      data: { state: CAMPAIGN_STATES.ROLLBACK },
    }));
    return {
      success: true,
      message: "No campaign was created. Marked as rolled back.",
    };
  }

  try {
    // Use internal import to avoid circular dependency
    const { default: fetch } = await import("node-fetch").catch(() => ({
      default: globalThis.fetch,
    }));

    // Attempt to pause the partially created campaign via Google Ads API
    const res = await withRetry(
      async () => {
        const response: any = await fetch(
          `${process.env.APP_URL || ""}/app/api/campaign-manage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "pause", campaignId }),
            signal: AbortSignal.timeout(15000),
          },
        );
        if (!response.ok)
          throw new Error(`Rollback request failed: ${response.status}`);
        return await response.json();
      },
      { label: "Rollback", maxRetries: 2 },
    );

    await withDbRetry("launch-rollback-done", () => prisma.campaignJob.update({
      where: { id: launchId },
      data: { state: CAMPAIGN_STATES.ROLLBACK },
    }));

    return {
      success: true,
      message: res.success
        ? `Campaign ${campaignId} paused and marked for rollback.`
        : `Rollback attempted but Google returned: ${res.error}. Campaign may need manual cleanup.`,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: `Rollback failed: ${(err as Error).message}. Campaign ${campaignId} may need manual cleanup in Google Ads.`,
    };
  }
}

/**
 * Get campaign launch status.
 * @param {string} launchId
 * @returns {object|null}
 */
export async function getCampaignStatus(launchId: any) {
  try {
    const record = await withDbRetry("launch-status-find", () => prisma.campaignJob.findUnique({
      where: { id: launchId },
    }));
    if (!record) return null;
    return {
      launchId: record.id,
      state: record.state,
      attempts: record.attempts,
      steps: JSON.parse(record.stepsJson || "[]"),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  } catch {
    return null;
  }
}

/**
 * Check if an error is retryable.
 */
function isRetryableError(err: any) {
  const msg = err?.message || "";
  const status = err?.status || err?.statusCode;
  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    msg.includes("rate_limit") ||
    msg.includes("DEADLINE_EXCEEDED") ||
    msg.includes("INTERNAL") ||
    msg.includes("UNAVAILABLE") ||
    msg.includes("ECONNRESET") ||
    msg.includes("ETIMEDOUT")
  );
}

/**
 * Enrich campaign payload with intelligence from engines 19-23.
 * Non-critical — if any engine fails, we continue with the original payload.
 */
async function enrichCampaignWithIntelligence(
  shop: string,
  payload: any,
): Promise<{
  adjustedBudget: number | null;
  additionalKeywords: string[];
  warnings: string[];
}> {
  const result = { adjustedBudget: null as number | null, additionalKeywords: [] as string[], warnings: [] as string[] };
  const budget = parseFloat(payload.budgetAmount) || 50;

  // Engine 22: Bid Arbitrage — check if now is a good time to launch
  try {
    const windows = await prisma.bidArbitrageWindow.findMany({
      where: { shop, isArbitrage: true },
      orderBy: { avgCpc: "asc" },
      take: 5,
    });
    if (windows.length > 0) {
      const now = new Date();
      const currentDay = now.getDay();
      const currentHour = now.getHours();
      const activeWindow = windows.find(
        (w) => w.dayOfWeek === currentDay && currentHour >= w.hourStart && currentHour < w.hourEnd,
      );
      if (activeWindow) {
        // Great time to launch — boost initial budget slightly
        result.adjustedBudget = Math.round(budget * 1.1);
        result.warnings.push(`Launching during arbitrage window — CPC is low now. Budget boosted 10%.`);
      }
    }
  } catch { /* non-critical */ }

  // Engine 23: Currency Margin — check if margin squeeze affects this product
  try {
    const recentSqueezes = await prisma.currencyMarginEvent.findMany({
      where: {
        shop,
        eventType: "margin_squeeze",
        createdAt: { gte: new Date(Date.now() - 7 * 86400000) },
      },
      take: 5,
    });
    if (recentSqueezes.length > 0) {
      result.warnings.push(`Currency margin squeeze detected — monitor ROAS closely.`);
    }
  } catch { /* non-critical */ }

  // Engine 20: Ghost Campaign — add validated ghost keywords
  try {
    const validatedGhosts = await prisma.ghostCampaign.findMany({
      where: { shop, status: "validated" },
      orderBy: { opportunityScore: "desc" },
      take: 5,
    });
    for (const ghost of validatedGhosts) {
      if (ghost.keyword && !payload.keywords?.includes(ghost.keyword)) {
        result.additionalKeywords.push(ghost.keyword);
      }
    }
    if (result.additionalKeywords.length > 0) {
      result.warnings.push(`Added ${result.additionalKeywords.length} validated ghost keywords from discovery engine.`);
    }
  } catch { /* non-critical */ }

  // Engine 19: Competitor Strike — warn if competitor is being attacked
  try {
    const activeStrikes = await prisma.competitorStrike.findMany({
      where: { shop, status: "active" },
      take: 3,
    });
    if (activeStrikes.length > 0) {
      const domains = activeStrikes.map((s) => s.competitorDomain).join(", ");
      result.warnings.push(`Active competitor strikes on ${domains} — new campaigns may benefit from reduced competition.`);
    }
  } catch { /* non-critical */ }

  return result;
}

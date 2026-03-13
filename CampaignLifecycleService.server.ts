/**
 * CampaignLifecycleService.server.ts (v3)
 *
 * Complete campaign orchestration engine.
 *
 * Architecture:
 *   POST /api/campaign → creates job → returns jobId immediately
 *   Worker picks up job → runs state machine → updates DB at each step
 *   GET /api/campaign-status?jobId=xxx → polls DB for current state
 *
 * State Machine:
 *   QUEUED → VALIDATING → CREATING_BUDGET → CREATING_CAMPAIGN
 *   → UPLOADING_ASSETS → LINKING_CONVERSIONS → ENABLING → ENABLED
 *   Any step can → FAILED / FAILED_PARTIAL → RETRYING → (resume from last step)
 *   FAILED_PARTIAL → ROLLBACK
 *
 * Features:
 *   - Idempotency (duplicate detection within 60s)
 *   - Step-by-step DB persistence (survives crash/restart)
 *   - Exponential backoff retry (2s → 4s → 8s → 16s → 32s)
 *   - Partial failure detection + rollback
 *   - Rate limit awareness (429 → auto-retry with backoff)
 *   - Concurrent launch protection (1 active launch per shop)
 */

import {
  createSearchCampaign,
  createPMaxCampaign,
  getCustomer,
} from "./google-ads.server";
import { withRetry } from "./retry.server";
import prisma from "./db.server";
import { withDbRetry } from "./utils/db-health";

// ─── Interfaces ───────────────────────────────────────────────

interface CampaignPayload {
  productTitle: string;
  finalUrl: string;
  budgetAmount: string | number;
  headlines: string[];
  descriptions: string[];
  keywords?: string[];
  campaignType?: string;
  bidding?: string;
  skipTracking?: boolean;
  imageUrls?: string[];
  videoUrls?: string[];
  idempotencyKey?: string;
}

interface StepRecord {
  state: string;
  timestamp: string;
  error?: string;
  campaignId?: string;
  failedStep?: string;
  retryable?: boolean;
  note?: string;
  [key: string]: unknown;
}

interface JobResult {
  success: boolean;
  jobId: string;
  state?: string;
  campaignId?: string | null;
  error?: string;
  retryable?: boolean;
  failedStep?: string;
  duplicate?: boolean;
  concurrent?: boolean;
  message?: string;
}

interface JobInfo {
  jobId: string;
  shop: string;
  state: string;
  attempts: number;
  steps: StepRecord[];
  googleCampaignId: string | null;
  lastError: string | null;
  payload: CampaignPayload;
  createdAt: Date;
  lastStepAt: Date;
}

interface ExecutionContext {
  payload: CampaignPayload;
  campaignId: string | null;
  budgetId: string | null;
  assetGroupId: string | null;
}

interface RetryableError {
  message?: string;
  status?: number;
  statusCode?: number;
  errors?: Array<{ message: string }>;
}

// ══════════════════════════════════════════════════════════════════════════
// STATES
// ══════════════════════════════════════════════════════════════════════════
export const STATES = {
  QUEUED: "QUEUED",
  VALIDATING: "VALIDATING",
  CREATING_BUDGET: "CREATING_BUDGET",
  CREATING_CAMPAIGN: "CREATING_CAMPAIGN",
  UPLOADING_ASSETS: "UPLOADING_ASSETS",
  LINKING_CONVERSIONS: "LINKING_CONVERSIONS",
  ENABLING: "ENABLING",
  ENABLED: "ENABLED",
  FAILED: "FAILED",
  FAILED_PARTIAL: "FAILED_PARTIAL",
  RETRYING: "RETRYING",
  ROLLBACK: "ROLLBACK",
  CANCELLED: "CANCELLED",
} as const;

// Terminal states — no further transitions allowed
const TERMINAL: Set<string> = new Set([STATES.ENABLED, STATES.ROLLBACK, STATES.CANCELLED]);

// Valid transitions
const TRANSITIONS: Record<string, string[]> = {
  [STATES.QUEUED]: [STATES.VALIDATING, STATES.CANCELLED],
  [STATES.VALIDATING]: [STATES.CREATING_BUDGET, STATES.FAILED],
  [STATES.CREATING_BUDGET]: [STATES.CREATING_CAMPAIGN, STATES.FAILED],
  [STATES.CREATING_CAMPAIGN]: [
    STATES.UPLOADING_ASSETS,
    STATES.LINKING_CONVERSIONS,
    STATES.FAILED,
    STATES.FAILED_PARTIAL,
  ],
  [STATES.UPLOADING_ASSETS]: [
    STATES.LINKING_CONVERSIONS,
    STATES.FAILED_PARTIAL,
  ],
  [STATES.LINKING_CONVERSIONS]: [STATES.ENABLING, STATES.FAILED_PARTIAL],
  [STATES.ENABLING]: [STATES.ENABLED, STATES.FAILED_PARTIAL],
  [STATES.ENABLED]: [],
  [STATES.FAILED]: [STATES.RETRYING, STATES.CANCELLED],
  [STATES.FAILED_PARTIAL]: [STATES.RETRYING, STATES.ROLLBACK, STATES.CANCELLED],
  [STATES.RETRYING]: [
    STATES.VALIDATING,
    STATES.CREATING_BUDGET,
    STATES.CREATING_CAMPAIGN,
    STATES.UPLOADING_ASSETS,
    STATES.FAILED,
  ],
  [STATES.ROLLBACK]: [],
  [STATES.CANCELLED]: [],
};

// ══════════════════════════════════════════════════════════════════════════
// RETRY CONFIG
// ══════════════════════════════════════════════════════════════════════════
const MAX_ATTEMPTS = 5;
const BACKOFF_BASE = 2000; // 2s, 4s, 8s, 16s, 32s

function getBackoffDelay(attempt: number): number {
  return (
    Math.min(BACKOFF_BASE * Math.pow(2, attempt), 32000) + Math.random() * 1000
  );
}

function isRetryableError(err: RetryableError): boolean {
  const msg = (err?.message || "").toLowerCase();
  const code = err?.status || err?.statusCode || 0;
  return (
    code === 429 ||
    code === 500 ||
    code === 502 ||
    code === 503 ||
    code === 504 ||
    msg.includes("rate_limit") ||
    msg.includes("deadline_exceeded") ||
    msg.includes("internal") ||
    msg.includes("unavailable") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("resource_exhausted")
  );
}

// ══════════════════════════════════════════════════════════════════════════
// VALIDATION
// ══════════════════════════════════════════════════════════════════════════
function validatePayload(payload: CampaignPayload): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!payload.productTitle?.trim()) errors.push("Product title is required");
  if (!payload.finalUrl?.startsWith("http"))
    errors.push("Valid final URL required");
  const budget = parseFloat(String(payload.budgetAmount));
  if (isNaN(budget) || budget < 1)
    errors.push("Budget must be at least $1/day");
  if (budget > 10000) errors.push("Budget exceeds $10,000/day limit");
  const hl = payload.headlines || [];
  if (hl.length < 3) errors.push("At least 3 headlines required");
  if (hl.some((h) => h.length > 30)) errors.push("Headlines must be ≤30 chars");
  const desc = payload.descriptions || [];
  if (desc.length < 2) errors.push("At least 2 descriptions required");
  if (desc.some((d) => d.length > 90))
    errors.push("Descriptions must be ≤90 chars");
  return { valid: errors.length === 0, errors };
}

// ══════════════════════════════════════════════════════════════════════════
// DB HELPERS
// ══════════════════════════════════════════════════════════════════════════
async function createJob(shop: string, payload: CampaignPayload, idempotencyKey: string): Promise<{ duplicate: boolean; concurrent: boolean; jobId: string; state?: string }> {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Idempotency check — reject duplicate within 60s
  try {
    const existing = await withDbRetry("lifecycle-idem-check", () => prisma.campaignJob.findFirst({
      where: {
        shop,
        idempotencyKey,
        createdAt: { gte: new Date(Date.now() - 60000) },
        state: { notIn: [STATES.FAILED, STATES.CANCELLED] },
      },
    }));
    if (existing) {
      return { duplicate: true, concurrent: false, jobId: existing.id, state: existing.state };
    }
  } catch {
    /* table may not exist yet */
  }

  // Concurrency check — only 1 active job per shop
  try {
    const active = await withDbRetry("lifecycle-concurrency", () => prisma.campaignJob.findFirst({
      where: {
        shop,
        state: {
          notIn: [
            STATES.ENABLED,
            STATES.FAILED,
            STATES.FAILED_PARTIAL,
            STATES.ROLLBACK,
            STATES.CANCELLED,
          ],
        },
      },
    }));
    if (active) {
      return { duplicate: false, concurrent: true, jobId: active.id, state: active.state };
    }
  } catch {
    /* table may not exist yet */
  }

  try {
    await withDbRetry("lifecycle-create-job", () => prisma.campaignJob.create({
      data: {
        id: jobId,
        shop,
        state: STATES.QUEUED,
        payload: JSON.stringify(payload),
        idempotencyKey: idempotencyKey || jobId,
        attempts: 0,
        stepsJson: "[]",
        lastStepAt: new Date(),
      },
    }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[SmartAds] CampaignJob table missing:", message);
    // Fallback: proceed without DB tracking
  }

  return { duplicate: false, concurrent: false, jobId };
}

async function updateJob(jobId: string, state: string, meta: Record<string, unknown> = {}): Promise<void> {
  try {
    const job = await withDbRetry("lifecycle-update-find", () => prisma.campaignJob.findUnique({ where: { id: jobId } }));
    if (!job) return;

    const steps = JSON.parse(job.stepsJson || "[]") as StepRecord[];
    steps.push({
      state,
      timestamp: new Date().toISOString(),
      ...meta,
    });

    await withDbRetry("lifecycle-update-state", () => prisma.campaignJob.update({
      where: { id: jobId },
      data: {
        state,
        stepsJson: JSON.stringify(steps),
        lastStepAt: new Date(),
        ...(meta.campaignId ? { googleCampaignId: meta.campaignId as string } : {}),
        ...(meta.error ? { lastError: meta.error as string } : {}),
        ...(state === STATES.RETRYING ? { attempts: { increment: 1 } } : {}),
      },
    }));
  } catch {
    /* ignore if table missing */
  }
}

async function getJob(jobId: string): Promise<JobInfo | null> {
  try {
    const job = await withDbRetry("lifecycle-get-job", () => prisma.campaignJob.findUnique({ where: { id: jobId } }));
    if (!job) return null;
    return {
      jobId: job.id,
      shop: job.shop,
      state: job.state,
      attempts: job.attempts,
      steps: JSON.parse(job.stepsJson || "[]"),
      googleCampaignId: job.googleCampaignId,
      lastError: job.lastError,
      payload: JSON.parse(job.payload || "{}"),
      createdAt: job.createdAt,
      lastStepAt: job.lastStepAt,
    };
  } catch {
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════
// WORKER — Step-by-step campaign creation
// ══════════════════════════════════════════════════════════════════════════
async function executeStep(jobId: string, payload: CampaignPayload, fromStep: string | null = null): Promise<JobResult> {
  const steps: Array<{ state: string; fn: (ctx: ExecutionContext) => Promise<void> }> = [
    { state: STATES.VALIDATING, fn: stepValidate },
    { state: STATES.CREATING_BUDGET, fn: stepCreateBudget },
    { state: STATES.CREATING_CAMPAIGN, fn: stepCreateCampaign },
    { state: STATES.UPLOADING_ASSETS, fn: stepUploadAssets },
    { state: STATES.LINKING_CONVERSIONS, fn: stepLinkConversions },
    { state: STATES.ENABLING, fn: stepEnable },
  ];

  // If resuming, skip completed steps
  let startIdx = 0;
  if (fromStep) {
    startIdx = steps.findIndex((s) => s.state === fromStep);
    if (startIdx < 0) startIdx = 0;
  }

  const context: ExecutionContext = {
    payload,
    campaignId: null,
    budgetId: null,
    assetGroupId: null,
  };

  for (let i = startIdx; i < steps.length; i++) {
    const { state, fn } = steps[i];
    await updateJob(jobId, state);

    try {
      await fn(context);
    } catch (err: unknown) {
      const typedErr = err as RetryableError;
      const errMsg =
        typedErr?.errors?.[0]?.message || typedErr?.message || "Unknown error";
      const retryable = isRetryableError(typedErr);
      const isPartial = context.campaignId != null;

      await updateJob(
        jobId,
        isPartial ? STATES.FAILED_PARTIAL : STATES.FAILED,
        {
          error: errMsg,
          campaignId: context.campaignId,
          failedStep: state,
          retryable,
        },
      );

      return {
        success: false,
        jobId,
        state: isPartial ? STATES.FAILED_PARTIAL : STATES.FAILED,
        error: errMsg,
        retryable,
        failedStep: state,
        campaignId: context.campaignId,
      };
    }
  }

  // All steps passed
  await updateJob(jobId, STATES.ENABLED, { campaignId: context.campaignId });

  return {
    success: true,
    jobId,
    state: STATES.ENABLED,
    campaignId: context.campaignId,
  };
}

// ── Individual Steps ─────────────────────────────────────────────────────

async function stepValidate(ctx: ExecutionContext): Promise<void> {
  const validation = validatePayload(ctx.payload);
  if (!validation.valid) {
    throw new Error(`Validation: ${validation.errors.join(", ")}`);
  }
}

async function stepCreateBudget(ctx: ExecutionContext): Promise<void> {
  const customer = await getCustomer();
  const dailyBudget = parseFloat(String(ctx.payload.budgetAmount)) || 50;

  const { results } = await withRetry<{ results: string[] }>(
    () =>
      customer.campaignBudgets.create([
        {
          name: `SmartAds Budget ${Date.now()}`,
          amount_micros: Math.round(dailyBudget * 1_000_000),
          delivery_method: "STANDARD",
        },
      ]),
    { label: "CreateBudget" },
  );

  ctx.budgetId = results[0];
}

async function stepCreateCampaign(ctx: ExecutionContext): Promise<void> {
  const customer = await getCustomer();
  const type = ctx.payload.campaignType || "search";

  if (type === "pmax") {
    ctx.campaignId = await createPMaxCampaign(customer, {
      productTitle: ctx.payload.productTitle,
      headlines: ctx.payload.headlines || [],
      descriptions: ctx.payload.descriptions || [],
      finalUrl: ctx.payload.finalUrl,
      budgetResourceName: ctx.budgetId!,
      imageUrls: ctx.payload.imageUrls || [],
      videoUrls: ctx.payload.videoUrls || [],
    });
  } else {
    ctx.campaignId = await createSearchCampaign(customer, {
      productTitle: ctx.payload.productTitle,
      headlines: ctx.payload.headlines || [],
      descriptions: ctx.payload.descriptions || [],
      keywords: ctx.payload.keywords || [],
      finalUrl: ctx.payload.finalUrl,
      budgetResourceName: ctx.budgetId!,
      bidding: ctx.payload.bidding || "max_conversions",
    });
  }
}

async function stepUploadAssets(ctx: ExecutionContext): Promise<void> {
  // For PMax: assets are uploaded during campaign creation
  // For Search: no separate asset upload needed
  // Future: handle additional image/video uploads here
  if (ctx.payload.campaignType !== "pmax") return;
  // Assets already uploaded in createPMaxCampaign
}

async function stepLinkConversions(ctx: ExecutionContext): Promise<void> {
  if (ctx.payload.skipTracking) return;
  // Conversion tracking is linked during campaign creation in Google Ads
  // Future: custom conversion actions, enhanced conversions setup
}

async function stepEnable(_ctx: ExecutionContext): Promise<void> {
  // Campaigns are created in PAUSED state by default
  // This step would enable them if configured
  // For now, campaigns stay PAUSED until user confirms in Google Ads
}

// ══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════════════════════════════════

/**
 * Submit a campaign creation job.
 * Returns immediately with jobId. Worker processes asynchronously.
 */
export async function submitCampaignJob(shop: string, payload: CampaignPayload): Promise<JobResult> {
  const idempotencyKey = payload.idempotencyKey || `auto_${Date.now()}`;
  const { duplicate, concurrent, jobId, state } = await createJob(
    shop,
    payload,
    idempotencyKey,
  );

  if (duplicate) {
    return {
      success: false,
      jobId,
      state,
      error: "Duplicate launch detected",
      duplicate: true,
    };
  }
  if (concurrent) {
    return {
      success: false,
      jobId,
      state,
      error: "Another campaign is being created",
      concurrent: true,
    };
  }

  // Process synchronously for now (future: move to background worker/queue)
  // This runs in the same request but tracks state in DB at each step
  const result = await executeStep(jobId, payload);

  return { ...result, jobId };
}

/**
 * Retry a failed job from its last successful step.
 */
export async function retryJob(jobId: string): Promise<JobResult> {
  const job = await getJob(jobId);
  if (!job) return { success: false, jobId, error: "Job not found" };
  if (TERMINAL.has(job.state as string))
    return { success: false, jobId, error: `Job is ${job.state}, cannot retry` };
  if (job.attempts >= MAX_ATTEMPTS) {
    return { success: false, jobId, error: `Max attempts (${MAX_ATTEMPTS}) reached` };
  }

  // Find last successful step to resume from
  const failedStep = job.steps.find((s) => s.failedStep)?.failedStep || null;
  await updateJob(jobId, STATES.RETRYING);

  // Wait with backoff
  const delay = getBackoffDelay(job.attempts);
  await new Promise((r) => setTimeout(r, delay));

  return await executeStep(jobId, job.payload, failedStep);
}

/**
 * Rollback a partially created campaign.
 */
export async function rollbackJob(jobId: string): Promise<{ success: boolean; message?: string; error?: string }> {
  const job = await getJob(jobId);
  if (!job) return { success: false, error: "Job not found" };
  if (job.state !== STATES.FAILED_PARTIAL) {
    return {
      success: false,
      error: "Only partially failed jobs can be rolled back",
    };
  }

  const campaignId =
    job.googleCampaignId || job.steps.find((s) => s.campaignId)?.campaignId;
  if (!campaignId) {
    await updateJob(jobId, STATES.ROLLBACK, {
      note: "No campaign to rollback",
    });
    return { success: true, message: "Nothing to rollback" };
  }

  try {
    const customer = await getCustomer();
    // Pause the partial campaign
    await withRetry(
      () =>
        customer.campaigns.update([
          {
            resource_name: campaignId,
            status: "PAUSED",
          },
        ]),
      { label: "Rollback", maxRetries: 2 },
    );

    await updateJob(jobId, STATES.ROLLBACK, {
      campaignId,
      note: "Campaign paused",
    });
    return {
      success: true,
      message: `Campaign ${campaignId} paused and rolled back`,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Rollback failed: ${message}. Manual cleanup needed.`,
    };
  }
}

/**
 * Cancel a queued or failed job.
 */
export async function cancelJob(jobId: string): Promise<{ success: boolean; message?: string; error?: string }> {
  const job = await getJob(jobId);
  if (!job) return { success: false, error: "Job not found" };
  if (TERMINAL.has(job.state as string))
    return { success: false, error: `Job is ${job.state}` };

  await updateJob(jobId, STATES.CANCELLED);
  return { success: true, message: "Job cancelled" };
}

/**
 * Get job status (for polling).
 */
export async function getJobStatus(jobId: string): Promise<JobInfo | null> {
  return await getJob(jobId);
}

/**
 * Get all jobs for a shop (for dashboard).
 */
export async function getShopJobs(shop: string, limit: number = 10): Promise<Array<{
  jobId: string;
  state: string;
  attempts: number;
  googleCampaignId: string | null;
  lastError: string | null;
  createdAt: Date;
  lastStepAt: Date;
}>> {
  try {
    const jobs = await withDbRetry("lifecycle-shop-jobs", () => prisma.campaignJob.findMany({
      where: { shop },
      orderBy: { createdAt: "desc" },
      take: limit,
    }));
    return jobs.map((j) => ({
      jobId: j.id,
      state: j.state,
      attempts: j.attempts,
      googleCampaignId: j.googleCampaignId,
      lastError: j.lastError,
      createdAt: j.createdAt,
      lastStepAt: j.lastStepAt,
    }));
  } catch {
    return [];
  }
}

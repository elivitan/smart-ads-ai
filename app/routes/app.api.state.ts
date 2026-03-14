// app/routes/app.api.state.js
// ════════════════════════════════════════════
// Persistent user state API (replaces sessionStorage)
// GET  → Load user state from DB
// POST → Save user state to DB (validated with Zod)
// ════════════════════════════════════════════
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { z } from "zod";
import { logger } from "../utils/logger";
import { rateLimit, rateLimitResponse } from "../utils/rate-limiter";
import { withDbRetry } from "../utils/db-health";
import { withRequestLogging } from "../utils/request-logger";
import { withSentryMonitoring } from "../utils/sentry-wrapper.server";

// ── Types ──
interface RouteHandlerArgs {
  request: Request;
  params?: Record<string, string>;
  context?: unknown;
}


// Zod schema — only these fields are allowed
const StateUpdateSchema = z.object({
  selectedPlan: z.string().max(50).optional(),
  scanCredits: z.number().int().min(0).max(999).optional(),
  aiCredits: z.number().int().min(0).max(999).optional(),
  campaignId: z.string().max(200).nullable().optional(),
  campaignIntent: z.string().max(200).nullable().optional(),
  lastScanProducts: z.any().optional(),
  lastAiResults: z.any().optional(),
  autoScanMode: z.string().max(50).nullable().optional(),
  showDashboard: z.boolean().optional(),
  justSubscribed: z.boolean().optional(),
}).strict(); // reject unknown fields

// GET: Load state
const _loader = async ({ request }: RouteHandlerArgs): Promise<Response> => {
  let session;
  try {
    ({ session } = await authenticate.admin(request));
  } catch (authErr: unknown) {
    return Response.json({ success: false, error: "Authentication failed" }, { status: 401 });
  }

  try {
    const shop = session.shop;

    // Rate limit check
    const rl = await rateLimit.state(shop);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds || 60);

    const state = await withDbRetry("state-load", () => prisma.userState.findUnique({ where: { shop } }));
    if (!state) {
      return Response.json({ success: true, state: null });
    }

    return Response.json({
      success: true,
      state: {
        selectedPlan: state.selectedPlan,
        scanCredits: state.scanCredits,
        aiCredits: state.aiCredits,
        campaignId: state.campaignId,
        campaignIntent: (state as any).campaignIntent,
        lastScanProducts: state.lastScanProducts ? JSON.parse(state.lastScanProducts) : null,
        lastAiResults: state.lastAiResults ? JSON.parse(state.lastAiResults) : null,
        autoScanMode: state.autoScanMode,
        showDashboard: state.showDashboard,
        justSubscribed: (state as any).justSubscribed,
      },
    });
  } catch (err: unknown) {
    logger.error("state.GET", "Failed to load state", { error: (err as Error).message });
    return Response.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
};

// POST: Save state (partial update — only saves fields that are sent)
const _action = async ({ request }: RouteHandlerArgs): Promise<Response> => {
  let session;
  try {
    ({ session } = await authenticate.admin(request));
  } catch (authErr: unknown) {
    return Response.json({ success: false, error: "Authentication failed" }, { status: 401 });
  }

  try {
    const shop = session.shop;

    // Rate limit check
    const rl = await rateLimit.state(shop);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds || 60);

    // Request size check (100KB limit)
    const contentLength = parseInt(request.headers.get("content-length") || "0", 10);
    if (contentLength > 102400) {
      logger.warn("state.POST", "Request too large", { shop, extra: { size: contentLength } });
      return Response.json({ success: false, error: "Request body too large (max 100KB)" }, { status: 413 });
    }

    const rawBody = await request.json();

    // Zod validation
    const parsed = StateUpdateSchema.safeParse(rawBody);
    if (!parsed.success) {
      const issues = parsed.error.issues.map(i => i.path.join(".") + ": " + i.message).join("; ");
      logger.warn("state.POST", "Validation failed", { shop, extra: { issues } });
      return Response.json({ success: false, error: "Invalid input: " + issues }, { status: 400 });
    }
    const body = parsed.data;

    // Build update data — only include fields that were sent
    const data: any = {};
    if (body.selectedPlan !== undefined) data.selectedPlan = body.selectedPlan;
    if (body.scanCredits !== undefined) data.scanCredits = Number(body.scanCredits) || 0;
    if (body.aiCredits !== undefined) data.aiCredits = Number(body.aiCredits) || 0;
    if (body.campaignId !== undefined) data.campaignId = body.campaignId;
    if (body.campaignIntent !== undefined) data.campaignIntent = body.campaignIntent;
    if (body.lastScanProducts !== undefined) data.lastScanProducts = JSON.stringify(body.lastScanProducts);
    if (body.lastAiResults !== undefined) data.lastAiResults = JSON.stringify(body.lastAiResults);
    if (body.autoScanMode !== undefined) data.autoScanMode = body.autoScanMode;
    if (body.showDashboard !== undefined) data.showDashboard = Boolean(body.showDashboard);
    if (body.justSubscribed !== undefined) data.justSubscribed = Boolean(body.justSubscribed);

    await withDbRetry("state-save", () => prisma.userState.upsert({
      where: { shop },
      create: { shop, ...data },
      update: data,
    }));

    logger.info("state.POST", "State saved", { shop, extra: { fields: Object.keys(data) } });
    return Response.json({ success: true });
  } catch (err: unknown) {
    logger.error("state.POST", "Failed to save state", { error: (err as Error).message });
    return Response.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
};


// ── Middleware wrappers (Session 56) ──
export const loader = withSentryMonitoring("api.state", withRequestLogging("api.state", _loader));
export const action = withSentryMonitoring("api.state", withRequestLogging("api.state", _action));
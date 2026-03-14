/**
 * app.api.campaign-status.js
 * 
 * Polling endpoint for campaign launch status.
 * Called by useCampaignLaunch hook every 2s.
 * 
 * GET /app/api/campaign-status?launchId=launch_xxx
 */

import { getCampaignStatus } from "../campaignLifecycle.server.js";
import { z } from "zod";
import { logger } from "../utils/logger";
import { rateLimit, rateLimitResponse } from "../utils/rate-limiter";
import { authenticate } from "../shopify.server";
import { withRequestLogging } from "../utils/request-logger";
import { withSentryMonitoring } from "../utils/sentry-wrapper.server";

// ── Types ──
interface RouteHandlerArgs {
  request: Request;
  params?: Record<string, string>;
  context?: unknown;
}


const statusSchema = z.object({
  launchId: z.string().min(1, "Missing launchId"),
});

async function _loader({ request }: RouteHandlerArgs): Promise<Response> {
  let session;
  try {
    ({ session } = await authenticate.admin(request));
  } catch (authErr: unknown) {
    logger.error("[campaign-status] Auth failed:", (authErr as Error).message);
    return Response.json(
      { success: false, error: "Authentication failed" },
      { status: 401 }
    );
  }

  try {
    const shop = session.shop;

    // Rate limiting — polling is frequent, allow 60/min
    const limit = await rateLimit.campaignStatus(shop);
    if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds ?? 0);

    const url = new URL(request.url);
    const parsed = statusSchema.safeParse({
      launchId: url.searchParams.get("launchId"),
    });

    if (!parsed.success) {
      return Response.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const status = await getCampaignStatus(parsed.data.launchId);

    if (!status) {
      return Response.json(
        { success: false, error: "Launch not found" },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      launchId: status.launchId,
      state: status.state,
      steps: status.steps,
      attempts: status.attempts,
      campaignId: status.steps?.find(s => s.campaignId)?.campaignId || null,
      error: status.steps?.find(s => s.error)?.error || null,
      createdAt: status.createdAt,
      updatedAt: status.updatedAt,
    });
  } catch (error: unknown) {
    logger.error("[campaign-status] Error:", (error as Error).message);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}


// ── Middleware wrappers (Session 56) ──
export const loader = withSentryMonitoring("api.campaign-status", withRequestLogging("api.campaign-status", _loader));
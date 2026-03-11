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
import { logger } from "../utils/logger.js";

export async function loader({ request }) {
  const url = new URL(request.url);
  const launchId = url.searchParams.get("launchId");

  if (!launchId) {
    return Response.json({ success: false, error: "Missing launchId" }, { status: 400 });
  }

  const status = await getCampaignStatus(launchId);

  if (!status) {
    return Response.json({ success: false, error: "Launch not found" }, { status: 404 });
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
}

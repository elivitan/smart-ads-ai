import { authenticate } from "../shopify.server";
import { logger } from "../utils/logger";
import { rateLimit, rateLimitResponse } from "../utils/rate-limiter";
import { withRequestLogging } from "../utils/request-logger";
import { withSentryMonitoring } from "../utils/sentry-wrapper.server";
import {
  listSmartAdsCampaigns,
  updateCampaignStatus,
  diagnoseCampaigns,
} from "../google-ads.server.js";

// ── Types ──
interface RouteHandlerArgs {
  request: Request;
  params?: Record<string, string>;
  context?: unknown;
}

/**
 * Campaign Management API
 * Actions: list, pause, enable, remove, diagnose (auto-error detection)
 */

const _action = async ({ request }: RouteHandlerArgs): Promise<Response> => {
  let session;
  try { ({ session } = await authenticate.admin(request)); } catch { return Response.json({ success: false, error: "Auth failed" }, { status: 401 }); }
  const shop = session.shop;

  // Rate limit check
  const rl = await rateLimit.campaignManage(shop);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds || 60);

  const formData = await request.formData();
  const action = formData.get("action") as string;

  if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN || !process.env.GOOGLE_ADS_REFRESH_TOKEN) {
    return Response.json(getSimulatedResponse(action, formData));
  }

  try {
    switch (action) {
      case "list": {
        const campaigns = await listSmartAdsCampaigns();
        return Response.json({ success: true, campaigns });
      }
      case "pause":
      case "enable":
      case "remove": {
        const campaignId = formData.get("campaignId") as string;
        if (!campaignId) return Response.json({ success: false, error: "Campaign ID required" }, { status: 400 });
        const statusMap = { pause: "PAUSED" as const, enable: "ENABLED" as const, remove: "REMOVED" as const };
        const result = await updateCampaignStatus(campaignId, statusMap[action]);
        const label = action === "pause" ? "paused" : action === "enable" ? "enabled" : "removed";
        return Response.json({ success: true, message: `Campaign ${label} successfully`, ...result });
      }
      case "diagnose": {
        const diagnosis = await diagnoseCampaigns();
        return Response.json({ success: true, diagnosis });
      }
      default:
        return Response.json({ success: false, error: "Unknown action" }, { status: 400 });
    }
  } catch (error: unknown) {
    logger.error("campaign-manage.action", "Campaign management error (falling back to simulated)", { error: (error as Error).message });
    return Response.json(getSimulatedResponse(action, formData));
  }
};

/**
 * Simulated responses when Google Ads is not connected
 */
function getSimulatedResponse(action: string, formData: FormData) {
  switch (action) {
    case "list":
      return {
        success: true, simulated: true,
        campaigns: [
          { id: "sim_001", name: "Smart Ads - Gift Card - 2026-02-26", status: "ENABLED", type: "PERFORMANCE_MAX", biddingStrategy: "MAXIMIZE_CONVERSIONS", dailyBudget: "43.87", impressions: 470, clicks: 23, cost: "8.50", conversions: "0.0", conversionValue: "0.00", ctr: "4.45", avgCpc: "0.36" },
          { id: "sim_002", name: "Smart Ads - Bedding Set - 2026-02-25", status: "PAUSED", type: "SEARCH", biddingStrategy: "MAXIMIZE_CLICKS", dailyBudget: "30.00", impressions: 1250, clicks: 45, cost: "22.50", conversions: "2.0", conversionValue: "156.00", ctr: "3.60", avgCpc: "0.50" },
        ],
      };
    case "pause":
    case "enable":
    case "remove":
      return { success: true, simulated: true, message: `Campaign ${action}d successfully (simulated)`, campaignId: formData.get("campaignId") as string, newStatus: action === "pause" ? "PAUSED" : action === "enable" ? "ENABLED" : "REMOVED" };
    case "diagnose":
      return {
        success: true, simulated: true,
        diagnosis: {
          totalIssues: 2, highSeverity: 0, mediumSeverity: 1, lowSeverity: 1,
          issues: [
            { severity: "MEDIUM", type: "KEYWORD_SUGGESTION", message: "3 keyword recommendations available", autoFixable: true },
            { severity: "LOW", type: "AD_TEXT_SUGGESTION", message: "Consider adding more headline variations", autoFixable: true },
          ],
          autoFixableCount: 2, lastChecked: new Date().toISOString(),
        },
      };
    default:
      return { success: false, error: "Unknown action" };
  }
}

// ── Middleware wrappers ──
export const action = withSentryMonitoring("api.campaign-manage", withRequestLogging("api.campaign-manage", _action));

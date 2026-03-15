// app/routes/app.api.competitor-deep.ts
// Deep Competitor Intelligence API — industrial-grade business spy
import { authenticate } from "../shopify.server";
import {
  runDeepCompetitorScan,
  getCompetitorProfiles,
  getCompetitorChanges,
  runGapAnalysis,
  getKeywordGaps,
} from "../competitor-intel.server.js";
import { logger } from "../utils/logger";

interface RouteHandlerArgs {
  request: Request;
  params?: Record<string, string>;
  context?: unknown;
}

export async function action({ request }: RouteHandlerArgs) {
  let session;
  try {
    ({ session } = await authenticate.admin(request));
  } catch {
    return Response.json({ success: false, error: "Authentication failed" }, { status: 401 });
  }

  const shop = session.shop;

  try {
    const formData = await request.formData();
    const actionType = (formData.get("action") as string) || "get_profiles";

    switch (actionType) {
      case "deep_scan": {
        const result = await runDeepCompetitorScan(shop);
        return Response.json({
          success: true,
          profiles: result.profiles,
          changes: result.changes,
          briefing: result.briefing,
        });
      }

      case "get_profiles": {
        const profiles = await getCompetitorProfiles(shop);
        return Response.json({ success: true, profiles });
      }

      case "get_changes": {
        const days = parseInt((formData.get("days") as string) || "30");
        const changes = await getCompetitorChanges(shop, days);
        return Response.json({ success: true, changes });
      }

      case "gap_analysis": {
        const gaps = await runGapAnalysis(shop);
        return Response.json({ success: true, gaps });
      }

      case "get_gaps": {
        const gaps = await getKeywordGaps(shop);
        return Response.json({ success: true, gaps });
      }

      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("competitor-deep", "Deep intel failed", { extra: { error: message } });
    return Response.json({ error: message }, { status: 500 });
  }
}

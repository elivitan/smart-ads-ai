// app/routes/app.api.predict.ts
// Revenue Prediction API — "What happens if I change my budget?"
import { authenticate } from "../shopify.server";
import { predictRevenue } from "../ai-brain.server.js";
import { getCampaignPerformanceByDate } from "../google-ads.server.js";
import { getStoreProfile } from "../store-context.server.js";
import { logger } from "../utils/logger";

interface RouteHandlerArgs {
  request: Request;
  params?: Record<string, string>;
  context?: unknown;
}

export async function action({ request }: RouteHandlerArgs) {
  try {
    const { session } = await authenticate.admin(request);
    const shop = session.shop;

    const body = await request.json();
    const { campaignId, currentDailyBudget } = body;

    if (!campaignId || !currentDailyBudget) {
      return Response.json({ error: "Missing campaignId or currentDailyBudget" }, { status: 400 });
    }

    // Get 30 days of daily performance data
    const dailyData = await getCampaignPerformanceByDate(campaignId, 30);

    // Get store profile for margin
    const storeProfile = await getStoreProfile(shop);
    const profitMargin = storeProfile?.profitMargin ?? null;
    const avgOrderValue = storeProfile?.avgOrderValue ?? null;

    const prediction = await predictRevenue(
      dailyData.map((d) => ({
        cost: d.cost,
        conversions: d.conversions,
        conversionValue: d.conversionValue || 0,
      })),
      parseFloat(currentDailyBudget),
      profitMargin,
      avgOrderValue,
    );

    return Response.json({ success: true, prediction });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("predict", "Revenue prediction failed", { extra: { error: message } });
    return Response.json({ error: message }, { status: 500 });
  }
}

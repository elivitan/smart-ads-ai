// app/routes/app.api.forecast.ts
// Predictive Engine API — sales forecasting, what-if scenarios, product lifecycle
import { authenticate } from "../shopify.server";
import { logger } from "../utils/logger";

interface RouteHandlerArgs {
  request: Request;
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
    const actionType = (formData.get("action") as string) || "sales";

    const { forecastSales, forecastCampaignWhatIf, detectProductLifecycle } = await import("../ai-brain.server.js");

    switch (actionType) {
      case "sales": {
        const period = (formData.get("period") as string) || "week";
        const result = await forecastSales(shop, period as "week" | "month");
        return Response.json({ success: true, result });
      }

      case "what_if": {
        const campaignId = formData.get("campaignId") as string;
        const budgetChangePct = parseFloat((formData.get("budgetChangePct") as string) || "0");
        if (!campaignId) return Response.json({ error: "campaignId required" }, { status: 400 });
        if (!Number.isFinite(budgetChangePct)) return Response.json({ error: "budgetChangePct must be a number" }, { status: 400 });
        const result = await forecastCampaignWhatIf(shop, campaignId, budgetChangePct);
        return Response.json({ success: true, result });
      }

      case "lifecycle": {
        const result = await detectProductLifecycle(shop);
        return Response.json({ success: true, result });
      }

      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("forecast", "API error", { extra: { error: message } });
    return Response.json({ error: message }, { status: 500 });
  }
}

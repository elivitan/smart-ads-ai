// app/routes/app.api.profit-intel.ts
// Profit Intelligence API — net profit tracking, Monte Carlo simulation, dynamic pricing
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
    const actionType = (formData.get("action") as string) || "scores";

    // Lazy import to avoid circular dependencies
    const { calculateNetProfit, scoreProductProfitability, runMonteCarloSimulation, suggestDynamicPricing } = await import("../profit-intel.server.js");

    switch (actionType) {
      case "scores": {
        const scores = await scoreProductProfitability(shop);
        return Response.json({ success: true, scores });
      }

      case "net_profit": {
        const campaignId = formData.get("campaignId") as string;
        if (!campaignId) return Response.json({ error: "campaignId required" }, { status: 400 });
        const result = await calculateNetProfit(shop, campaignId);
        return Response.json({ success: true, result });
      }

      case "simulate": {
        const campaignId = formData.get("campaignId") as string;
        if (!campaignId) return Response.json({ error: "campaignId required" }, { status: 400 });
        const days = parseInt((formData.get("days") as string) || "30", 10);
        const simulations = parseInt((formData.get("simulations") as string) || "1000", 10);
        const result = await runMonteCarloSimulation(shop, campaignId, { days, simulations });
        return Response.json({ success: true, result });
      }

      case "pricing": {
        const productId = formData.get("productId") as string;
        if (!productId) return Response.json({ error: "productId required" }, { status: 400 });
        const result = await suggestDynamicPricing(shop, productId);
        return Response.json({ success: true, result });
      }

      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("profit-intel", "API error", { extra: { error: message } });
    return Response.json({ error: message }, { status: 500 });
  }
}

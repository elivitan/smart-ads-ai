// app/routes/app.api.inventory.ts
// Inventory-Aware Ads API — stock monitoring, campaign throttling/boosting
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
    const actionType = (formData.get("action") as string) || "status";

    const { scanInventoryLevels, throttleLowStockCampaigns, boostOverstockedCampaigns, predictStockoutDate } = await import("../inventory-ads.server.js");

    switch (actionType) {
      case "status": {
        const result = await scanInventoryLevels(shop);
        return Response.json({ success: true, ...result });
      }

      case "scan": {
        const levels = await scanInventoryLevels(shop);
        const throttled = await throttleLowStockCampaigns(shop);
        const boosted = await boostOverstockedCampaigns(shop);
        return Response.json({ success: true, levels, throttled, boosted });
      }

      case "predict": {
        const productId = formData.get("productId") as string;
        if (!productId) return Response.json({ error: "productId required" }, { status: 400 });
        const result = await predictStockoutDate(shop, productId);
        return Response.json({ success: true, result });
      }

      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("inventory", "API error", { extra: { error: message } });
    return Response.json({ error: message }, { status: 500 });
  }
}

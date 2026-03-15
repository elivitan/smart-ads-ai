// app/routes/app.api.currency-margin.ts
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
    const actionType = (formData.get("action") as string) || "";

    switch (actionType) {
      case "rates": {
        const { checkExchangeRates } = await import("../currency-margin.server.js");
        const result = await checkExchangeRates(shop);
        return Response.json({ success: true, result });
      }
      case "impact": {
        const { calculateMarginImpact } = await import("../currency-margin.server.js");
        const result = await calculateMarginImpact(shop);
        return Response.json({ success: true, result });
      }
      case "suggest": {
        const { suggestPriceAdjustments } = await import("../currency-margin.server.js");
        const result = await suggestPriceAdjustments(shop);
        return Response.json({ success: true, result });
      }
      case "arbitrage": {
        const { detectArbitrageOpportunity } = await import("../currency-margin.server.js");
        const result = await detectArbitrageOpportunity(shop);
        return Response.json({ success: true, result });
      }
      case "list": {
        const { getCurrencyEvents } = await import("../currency-margin.server.js");
        const result = await getCurrencyEvents(shop);
        return Response.json({ success: true, result });
      }
      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("currency-margin", "API error", { extra: { error: message } });
    return Response.json({ error: message }, { status: 500 });
  }
}

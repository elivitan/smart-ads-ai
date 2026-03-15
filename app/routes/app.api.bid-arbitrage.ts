// app/routes/app.api.bid-arbitrage.ts
// Bid Time Arbitrage API — hourly analysis, arbitrage detection, bid scheduling
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
    const actionType = (formData.get("action") as string) || "list";

    const {
      analyzeHourlyPerformance,
      detectArbitrageWindows,
      applyBidSchedule,
      trackArbitrageROI,
      getArbitrageWindows,
    } = await import("../bid-arbitrage.server.js");

    switch (actionType) {
      case "analyze": {
        const result = await analyzeHourlyPerformance(shop);
        return Response.json({ success: true, result });
      }

      case "detect": {
        const result = await detectArbitrageWindows(shop);
        return Response.json({ success: true, result });
      }

      case "apply": {
        const result = await applyBidSchedule(shop);
        return Response.json({ success: true, result });
      }

      case "roi": {
        const result = await trackArbitrageROI(shop);
        return Response.json({ success: true, result });
      }

      case "list": {
        const result = await getArbitrageWindows(shop);
        return Response.json({ success: true, result });
      }

      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("bid-arbitrage", "API error", { extra: { error: message } });
    return Response.json({ error: message }, { status: 500 });
  }
}

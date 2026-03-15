// app/routes/app.api.competitor-spend.ts
// Competitor Ad Spend Estimator API
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
    const actionType = (formData.get("action") as string) || "get";

    const { estimateCompetitorSpend, trackSpendTrends, getCompetitorSpendEstimates } = await import("../competitor-intel.server.js");

    switch (actionType) {
      case "get": {
        const estimates = await getCompetitorSpendEstimates(shop);
        return Response.json({ success: true, estimates });
      }

      case "refresh": {
        const estimates = await estimateCompetitorSpend(shop);
        return Response.json({ success: true, estimates });
      }

      case "trends": {
        const result = await trackSpendTrends(shop);
        return Response.json({ success: true, ...result });
      }

      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("competitor-spend", "API error", { extra: { error: message } });
    return Response.json({ error: message }, { status: 500 });
  }
}

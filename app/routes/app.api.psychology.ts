// app/routes/app.api.psychology.ts
// Buyer Psychology Engine API — emotional triggers and psychology-optimized ad copy
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
    const actionType = (formData.get("action") as string) || "analyze";

    switch (actionType) {
      case "analyze": {
        const productId = formData.get("productId") as string;
        if (!productId) return Response.json({ error: "productId required" }, { status: 400 });
        const { analyzeEmotionalTriggers } = await import("../buyer-psychology.server.js");
        const result = await analyzeEmotionalTriggers(shop, productId);
        return Response.json({ success: true, result });
      }

      case "generate": {
        const productId = formData.get("productId") as string;
        if (!productId) return Response.json({ error: "productId required" }, { status: 400 });
        const { generatePsychologyOptimizedCopy } = await import("../buyer-psychology.server.js");
        const result = await generatePsychologyOptimizedCopy(shop, productId);
        return Response.json({ success: true, result });
      }

      case "match": {
        const { matchBuyerMotivation } = await import("../buyer-psychology.server.js");
        const result = await matchBuyerMotivation(shop);
        return Response.json({ success: true, result });
      }

      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("psychology", "API error", { extra: { error: message } });
    return Response.json({ error: message }, { status: 500 });
  }
}

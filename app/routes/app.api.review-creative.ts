// app/routes/app.api.review-creative.ts
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
    const actionType = (formData.get("action") as string) || "extract";

    switch (actionType) {
      case "extract": {
        const { extractReviewInsights } = await import("../review-creative.server.js");
        const result = await extractReviewInsights(shop);
        return Response.json({ success: true, result });
      }
      case "generate": {
        const productId = formData.get("productId") as string;
        const { generateReviewBasedCopy } = await import("../review-creative.server.js");
        const result = await generateReviewBasedCopy(shop, productId);
        return Response.json({ success: true, result });
      }
      case "top_phrases": {
        const { getTopReviewPhrases } = await import("../review-creative.server.js");
        const result = await getTopReviewPhrases(shop);
        return Response.json({ success: true, result });
      }
      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("review-creative", "API error", { extra: { error: message } });
    return Response.json({ error: message }, { status: 500 });
  }
}

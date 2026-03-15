// app/routes/app.api.benchmarks.ts
// Cross-Store Intelligence API — industry benchmarks & trends
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
    const actionType = (formData.get("action") as string) || "benchmarks";

    const { aggregateCrossStoreData, getIndustryBenchmarks, detectCrossStoreTrends } = await import("../cross-store.server.js");

    switch (actionType) {
      case "benchmarks": {
        const result = await getIndustryBenchmarks(shop);
        return Response.json({ success: true, result });
      }

      case "aggregate": {
        const result = await aggregateCrossStoreData(shop);
        return Response.json({ success: true, result });
      }

      case "trends": {
        const category = (formData.get("category") as string) || "";
        const result = await detectCrossStoreTrends(category);
        return Response.json({ success: true, result });
      }

      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("benchmarks", "API error", { extra: { error: message } });
    return Response.json({ error: message }, { status: 500 });
  }
}

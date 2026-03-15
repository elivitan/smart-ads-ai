// app/routes/app.api.search-sentinel.ts
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
    const actionType = (formData.get("action") as string) || "scan";

    switch (actionType) {
      case "scan": {
        const { scanSearchTerms } = await import("../search-sentinel.server.js");
        const result = await scanSearchTerms(shop);
        return Response.json({ success: true, result });
      }
      case "report": {
        const { getWasteReport } = await import("../search-sentinel.server.js");
        const result = await getWasteReport(shop);
        return Response.json({ success: true, result });
      }
      case "approve": {
        const sentinelId = formData.get("sentinelId") as string;
        const { approveNegativeKeyword } = await import("../search-sentinel.server.js");
        const result = await approveNegativeKeyword(shop, sentinelId);
        return Response.json({ success: true, result });
      }
      case "recent": {
        const { getRecentFindings } = await import("../search-sentinel.server.js");
        const result = await getRecentFindings(shop);
        return Response.json({ success: true, result });
      }
      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("search-sentinel", "API error", { extra: { error: message } });
    return Response.json({ error: message }, { status: 500 });
  }
}

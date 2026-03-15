// app/routes/app.api.performance-guard.ts
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
    const actionType = (formData.get("action") as string) || "check";

    switch (actionType) {
      case "check": {
        const { runPerformanceCheck } = await import("../performance-guard.server.js");
        const result = await runPerformanceCheck(shop);
        return Response.json({ success: true, result });
      }
      case "history": {
        const { getGuardHistory } = await import("../performance-guard.server.js");
        const result = await getGuardHistory(shop);
        return Response.json({ success: true, result });
      }
      case "override": {
        const guardId = formData.get("guardId") as string;
        const { overrideGuard } = await import("../performance-guard.server.js");
        const result = await overrideGuard(shop, guardId);
        return Response.json({ success: true, result });
      }
      case "savings": {
        const { calculateTotalSavings } = await import("../performance-guard.server.js");
        const result = await calculateTotalSavings(shop);
        return Response.json({ success: true, result });
      }
      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("performance-guard", "API error", { extra: { error: message } });
    return Response.json({ error: message }, { status: 500 });
  }
}

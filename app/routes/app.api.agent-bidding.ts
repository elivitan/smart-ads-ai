// app/routes/app.api.agent-bidding.ts
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
    const actionType = (formData.get("action") as string) || "run";

    switch (actionType) {
      case "run": {
        const campaignId = formData.get("campaignId") as string | null;
        const { runBiddingSession } = await import("../agent-bidding.server.js");
        const result = await runBiddingSession(shop, campaignId || undefined);
        return Response.json({ success: true, result });
      }
      case "history": {
        const { getRecentSessions } = await import("../agent-bidding.server.js");
        const result = await getRecentSessions(shop);
        return Response.json({ success: true, result });
      }
      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("agent-bidding", "API error", { extra: { error: message } });
    return Response.json({ error: message }, { status: 500 });
  }
}

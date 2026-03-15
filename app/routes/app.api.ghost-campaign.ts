// app/routes/app.api.ghost-campaign.ts
// Engine 20: Ghost Campaign / Product Discovery API
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
    return Response.json(
      { success: false, error: "Authentication failed" },
      { status: 401 },
    );
  }

  const shop = session.shop;

  try {
    const formData = await request.formData();
    const actionType = (formData.get("action") as string) || "";

    switch (actionType) {
      case "discover": {
        const { discoverGhostOpportunities } = await import(
          "../ghost-campaign.server.js"
        );
        const opportunities = await discoverGhostOpportunities(shop);
        return Response.json({ success: true, opportunities });
      }

      case "launch": {
        const ghostId = formData.get("ghostId") as string;

        if (!ghostId) {
          return Response.json(
            { success: false, error: "Missing required field: ghostId" },
            { status: 400 },
          );
        }

        const { launchTestCampaign } = await import(
          "../ghost-campaign.server.js"
        );
        const result = await launchTestCampaign(shop, ghostId);
        return Response.json({ success: true, result });
      }

      case "validate": {
        const { validateGhostResults } = await import(
          "../ghost-campaign.server.js"
        );
        const result = await validateGhostResults(shop);
        return Response.json({ success: true, result });
      }

      case "list": {
        const { getGhostOpportunities } = await import(
          "../ghost-campaign.server.js"
        );
        const opportunities = await getGhostOpportunities(shop);
        return Response.json({ success: true, opportunities });
      }

      default:
        return Response.json(
          { success: false, error: "Unknown action" },
          { status: 400 },
        );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("ghost-campaign", "API error", {
      extra: { shop, error: message },
    });
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}

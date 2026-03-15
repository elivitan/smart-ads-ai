// app/routes/app.api.life-moment.ts
// Life Moment Targeting API — detect moments, generate campaigns, optimize copy
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
      detectLifeMoments,
      generateMomentCampaign,
      getUpcomingMoments,
      optimizeMomentCopy,
      getLifeMomentCampaigns,
    } = await import("../life-moment.server.js");

    switch (actionType) {
      case "detect": {
        const result = await detectLifeMoments(shop);
        return Response.json({ success: true, result });
      }

      case "generate": {
        const momentType = formData.get("momentType") as string | null;
        const productIdsRaw = formData.get("productIds") as string | null;

        if (!momentType) {
          return Response.json({ error: "momentType is required" }, { status: 400 });
        }
        if (!productIdsRaw) {
          return Response.json({ error: "productIds is required" }, { status: 400 });
        }

        let productIds: string[];
        try {
          productIds = JSON.parse(productIdsRaw);
        } catch {
          return Response.json({ error: "productIds must be valid JSON array" }, { status: 400 });
        }

        if (!Array.isArray(productIds) || productIds.length === 0) {
          return Response.json({ error: "productIds must be a non-empty array" }, { status: 400 });
        }

        const result = await generateMomentCampaign(shop, momentType, productIds);
        return Response.json({ success: true, result });
      }

      case "upcoming": {
        const result = await getUpcomingMoments(shop);
        return Response.json({ success: true, result });
      }

      case "optimize": {
        const momentId = formData.get("momentId") as string | null;
        if (!momentId) {
          return Response.json({ error: "momentId is required" }, { status: 400 });
        }
        const result = await optimizeMomentCopy(shop, momentId);
        return Response.json({ success: true, result });
      }

      case "list": {
        const result = await getLifeMomentCampaigns(shop);
        return Response.json({ success: true, result });
      }

      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("life-moment", "API error", { extra: { error: message } });
    return Response.json({ error: message }, { status: 500 });
  }
}

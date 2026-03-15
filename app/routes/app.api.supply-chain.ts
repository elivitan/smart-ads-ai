// app/routes/app.api.supply-chain.ts
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
    const actionType = (formData.get("action") as string) || "check_status";

    switch (actionType) {
      case "register": {
        const productId = formData.get("productId") as string;
        const quantity = formData.get("quantity") as string;
        const estimatedArrival = formData.get("estimatedArrival") as string;
        const source = formData.get("source") as string | null;
        const { registerShipment } = await import("../supply-chain.server.js");
        const result = await registerShipment(shop, {
          productId,
          quantity: Number(quantity),
          estimatedArrival: new Date(estimatedArrival as string),
          source: source || undefined,
        });
        return Response.json({ success: true, result });
      }
      case "check_status": {
        const { checkShipmentStatus } = await import("../supply-chain.server.js");
        const result = await checkShipmentStatus(shop);
        return Response.json({ success: true, result });
      }
      case "pre_warm": {
        const { getPreWarmCandidates } = await import("../supply-chain.server.js");
        const result = await getPreWarmCandidates(shop);
        return Response.json({ success: true, result });
      }
      case "active": {
        const { getActiveShipments } = await import("../supply-chain.server.js");
        const result = await getActiveShipments(shop);
        return Response.json({ success: true, result });
      }
      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("supply-chain", "API error", { extra: { error: message } });
    return Response.json({ error: message }, { status: 500 });
  }
}

// app/routes/app.api.flash-sale.ts
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
    const actionType = (formData.get("action") as string) || "candidates";

    switch (actionType) {
      case "candidates": {
        const { detectFlashSaleCandidates } = await import("../flash-sale.server.js");
        const result = await detectFlashSaleCandidates(shop);
        return Response.json({ success: true, result });
      }
      case "create": {
        const productId = formData.get("productId") as string;
        const discountPct = formData.get("discountPct") as string;
        const durationHours = formData.get("durationHours") as string;
        const { createFlashSale } = await import("../flash-sale.server.js");
        const result = await createFlashSale(shop, productId, Number(discountPct), Number(durationHours));
        return Response.json({ success: true, result });
      }
      case "check_expired": {
        const { checkExpiredFlashSales } = await import("../flash-sale.server.js");
        const result = await checkExpiredFlashSales(shop);
        return Response.json({ success: true, result });
      }
      case "active": {
        const { getActiveFlashSales } = await import("../flash-sale.server.js");
        const result = await getActiveFlashSales(shop);
        return Response.json({ success: true, result });
      }
      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("flash-sale", "API error", { extra: { error: message } });
    return Response.json({ error: message }, { status: 500 });
  }
}

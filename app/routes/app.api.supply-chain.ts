// app/routes/app.api.supply-chain.ts
import { createRouteAction } from "../utils/route-handler.server";

export const action = createRouteAction("supply-chain", "check_status", {
  async register(shop, formData) {
    const productId = formData.get("productId") as string;
    const quantity = formData.get("quantity") as string;
    const estimatedArrival = formData.get("estimatedArrival") as string;
    const source = formData.get("source") as string | null;
    const { registerShipment } = await import("../supply-chain.server.js");
    return registerShipment(shop, {
      productId,
      quantity: Number(quantity),
      estimatedArrival: new Date(estimatedArrival),
      source: source || undefined,
    });
  },
  async check_status(shop) {
    const { checkShipmentStatus } = await import("../supply-chain.server.js");
    return checkShipmentStatus(shop);
  },
  async pre_warm(shop) {
    const { getPreWarmCandidates } = await import("../supply-chain.server.js");
    return getPreWarmCandidates(shop);
  },
  async active(shop) {
    const { getActiveShipments } = await import("../supply-chain.server.js");
    return getActiveShipments(shop);
  },
});

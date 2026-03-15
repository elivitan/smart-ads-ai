// app/routes/app.api.life-moment.ts
// Life Moment Targeting API — detect moments, generate campaigns, optimize copy
import { createRouteAction } from "../utils/route-handler.server";

export const action = createRouteAction("life-moment", "list", {
  async detect(shop) {
    const { detectLifeMoments } = await import("../life-moment.server.js");
    return detectLifeMoments(shop);
  },
  async generate(shop, formData) {
    const momentType = formData.get("momentType") as string | null;
    const productIdsRaw = formData.get("productIds") as string | null;
    if (!momentType) throw new Error("momentType is required");
    if (!productIdsRaw) throw new Error("productIds is required");
    let productIds: string[];
    try { productIds = JSON.parse(productIdsRaw); } catch { throw new Error("productIds must be valid JSON array"); }
    if (!Array.isArray(productIds) || productIds.length === 0) throw new Error("productIds must be a non-empty array");
    const { generateMomentCampaign } = await import("../life-moment.server.js");
    return generateMomentCampaign(shop, momentType, productIds);
  },
  async upcoming(shop) {
    const { getUpcomingMoments } = await import("../life-moment.server.js");
    return getUpcomingMoments(shop);
  },
  async optimize(shop, formData) {
    const momentId = formData.get("momentId") as string | null;
    if (!momentId) throw new Error("momentId is required");
    const { optimizeMomentCopy } = await import("../life-moment.server.js");
    return optimizeMomentCopy(shop, momentId);
  },
  async list(shop) {
    const { getLifeMomentCampaigns } = await import("../life-moment.server.js");
    return getLifeMomentCampaigns(shop);
  },
});

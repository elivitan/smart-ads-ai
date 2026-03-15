// app/routes/app.api.ghost-campaign.ts
// Engine 20: Ghost Campaign / Product Discovery API
import { createRouteAction } from "../utils/route-handler.server";

export const action = createRouteAction("ghost-campaign", "list", {
  async discover(shop) {
    const { discoverGhostOpportunities } = await import("../ghost-campaign.server.js");
    return discoverGhostOpportunities(shop);
  },
  async launch(shop, formData) {
    const ghostId = formData.get("ghostId") as string;
    if (!ghostId) throw new Error("Missing required field: ghostId");
    const { launchTestCampaign } = await import("../ghost-campaign.server.js");
    return launchTestCampaign(shop, ghostId);
  },
  async validate(shop) {
    const { validateGhostResults } = await import("../ghost-campaign.server.js");
    return validateGhostResults(shop);
  },
  async list(shop) {
    const { getGhostOpportunities } = await import("../ghost-campaign.server.js");
    return getGhostOpportunities(shop);
  },
});

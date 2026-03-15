// app/routes/app.api.bid-arbitrage.ts
// Bid Time Arbitrage API — hourly analysis, arbitrage detection, bid scheduling
import { createRouteAction } from "../utils/route-handler.server";

export const action = createRouteAction("bid-arbitrage", "list", {
  async analyze(shop) {
    const { analyzeHourlyPerformance } = await import("../bid-arbitrage.server.js");
    return analyzeHourlyPerformance(shop);
  },
  async detect(shop) {
    const { detectArbitrageWindows } = await import("../bid-arbitrage.server.js");
    return detectArbitrageWindows(shop);
  },
  async apply(shop) {
    const { applyBidSchedule } = await import("../bid-arbitrage.server.js");
    return applyBidSchedule(shop);
  },
  async roi(shop) {
    const { trackArbitrageROI } = await import("../bid-arbitrage.server.js");
    return trackArbitrageROI(shop);
  },
  async list(shop) {
    const { getArbitrageWindows } = await import("../bid-arbitrage.server.js");
    return getArbitrageWindows(shop);
  },
});

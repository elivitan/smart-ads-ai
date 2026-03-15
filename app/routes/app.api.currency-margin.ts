// app/routes/app.api.currency-margin.ts
import { createRouteAction } from "../utils/route-handler.server";

export const action = createRouteAction("currency-margin", "list", {
  async rates(shop) {
    const { checkExchangeRates } = await import("../currency-margin.server.js");
    return checkExchangeRates(shop);
  },
  async impact(shop) {
    const { calculateMarginImpact } = await import("../currency-margin.server.js");
    return calculateMarginImpact(shop);
  },
  async suggest(shop) {
    const { suggestPriceAdjustments } = await import("../currency-margin.server.js");
    return suggestPriceAdjustments(shop);
  },
  async arbitrage(shop) {
    const { detectArbitrageOpportunity } = await import("../currency-margin.server.js");
    return detectArbitrageOpportunity(shop);
  },
  async list(shop) {
    const { getCurrencyEvents } = await import("../currency-margin.server.js");
    return getCurrencyEvents(shop);
  },
});

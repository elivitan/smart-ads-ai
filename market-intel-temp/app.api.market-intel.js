// app/routes/app.api.market-intel.js
// ══════════════════════════════════════════════
// Market Intelligence API endpoint
// Returns market conditions, holiday alerts, and ad recommendations
// ══════════════════════════════════════════════

import { authenticate } from "../shopify.server";
import { getMarketIntelligence, getQuickMarketSignal } from "../market-intel.server.js";

export const action = async ({ request }) => {
  let session;
  try {
    ({ session } = await authenticate.admin(request));
  } catch (authErr) {
    console.error("[MarketIntel] Auth failed:", authErr.message);
    return Response.json({ success: false, error: "Authentication failed" }, { status: 401 });
  }

  const shop = session.shop;

  try {
    const formData = await request.formData();
    const mode = formData.get("mode") || "full"; // "full" or "quick"
    const regionsStr = formData.get("regions") || "US";
    const productCategory = formData.get("productCategory") || "general";
    const topKeywordsStr = formData.get("topKeywords") || "";

    const regions = regionsStr.split(",").map(r => r.trim().toUpperCase()).filter(Boolean);
    const topKeywords = topKeywordsStr ? topKeywordsStr.split(",").map(k => k.trim()).filter(Boolean) : undefined;

    const storeInfo = {
      domain: shop,
      regions,
      productCategory,
      topKeywords,
    };

    let result;
    if (mode === "quick") {
      result = await getQuickMarketSignal(storeInfo);
    } else {
      result = await getMarketIntelligence(storeInfo);
    }

    return Response.json({ success: true, intel: result });
  } catch (err) {
    console.error("[MarketIntel] Error:", err.message);
    return Response.json(
      { success: false, error: "Market intelligence analysis failed" },
      { status: 500 }
    );
  }
};

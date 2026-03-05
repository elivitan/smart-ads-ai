// app/routes/app.api.store-analytics.js
// ══════════════════════════════════════════════
// Store Analytics API — pre-campaign intelligence
// Returns store performance data + AI readiness assessment
// ══════════════════════════════════════════════

import { authenticate } from "../shopify.server";
import { getShopifyAnalytics, analyzeCampaignReadiness } from "../store-analytics.server.js";

export const action = async ({ request }) => {
  let admin, session;
  try {
    ({ admin, session } = await authenticate.admin(request));
  } catch (authErr) {
    console.error("[StoreAnalytics] Auth failed:", authErr.message);
    return Response.json({ success: false, error: "Authentication failed" }, { status: 401 });
  }

  const shop = session.shop;

  try {
    const formData = await request.formData();
    const mode = formData.get("mode") || "full"; // "data" = just data, "full" = data + AI analysis

    // Fetch Shopify analytics
    const analytics = await getShopifyAnalytics(admin, shop);

    if (analytics.error) {
      return Response.json(
        { success: false, error: analytics.error },
        { status: 500 }
      );
    }

    let aiAnalysis = null;
    if (mode === "full") {
      aiAnalysis = await analyzeCampaignReadiness(analytics);
    }

    return Response.json({
      success: true,
      analytics,
      readiness: aiAnalysis,
    });
  } catch (err) {
    console.error("[StoreAnalytics] Error:", err.message);
    return Response.json(
      { success: false, error: "Store analytics failed: " + err.message },
      { status: 500 }
    );
  }
};

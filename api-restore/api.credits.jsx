import { authenticate } from "../shopify.server";
import { getShopCredits } from "../sync.server.js";

/**
 * GET /app/api/credits
 * Returns real credit balances from DB.
 * Called by useSubscription on mount to fix cross-tab/device inconsistency.
 */
export const loader = async ({ request }) => {
  try {
    const { session } = await authenticate.admin(request);
    const credits = await getShopCredits(session.shop);
    return Response.json({
      scanCredits: credits.scanCredits,
      aiCredits:   credits.aiCredits,
    });
  } catch (err) {
    console.error("[SmartAds] /api/credits error:", err);
    return Response.json({ scanCredits: null, aiCredits: null });
  }
};

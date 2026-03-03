// app/routes/app.api.subscription.js
// ══════════════════════════════════════════════
// Handles plan selection — saves to DB
// ══════════════════════════════════════════════
import { authenticate } from "../shopify.server";
import { updatePlan, getSubscriptionInfo } from "../license.server.js";

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  try {
    const body = await request.json();
    const { plan } = body;

    if (!["free", "starter", "pro", "premium"].includes(plan)) {
      return Response.json({ success: false, error: "Invalid plan" }, { status: 400 });
    }

    await updatePlan(shop, plan);
    const info = await getSubscriptionInfo(shop);

    return Response.json({ success: true, subscription: info });
  } catch (err) {
    console.error("[SmartAds] Subscription error:", err);
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
};

// GET — return current subscription info
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  try {
    const info = await getSubscriptionInfo(shop);
    return Response.json({ success: true, subscription: info });
  } catch (err) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
};

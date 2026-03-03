// app/routes/app.api.campaign.js
// ══════════════════════════════════════════════
// PROTECTED: Requires paid plan (canPublish)
// ══════════════════════════════════════════════
import { authenticate } from "../shopify.server";
import { launchCampaign } from "../campaignLifecycle.server.js";
import { checkLicense } from "../license.server.js";

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // ✅ LICENSE CHECK — must have paid plan
  const license = await checkLicense(shop, "campaign");
  if (!license.allowed) {
    return Response.json(
      { success: false, error: license.reason },
      { status: 403 }
    );
  }

  const formData = await request.formData();
  const productTitle = formData.get("productTitle");
  const headlines = JSON.parse(formData.get("headlines") || "[]");
  const descriptions = JSON.parse(formData.get("descriptions") || "[]");
  const keywords = JSON.parse(formData.get("keywords") || "[]");
  const finalUrl = formData.get("finalUrl") || "https://your-store.myshopify.com";
  const dailyBudget = Number(formData.get("dailyBudget")) || 50;
  const campaignType = formData.get("campaignType") || "search";
  const bidding = formData.get("bidding") || "max_conversions";

  const result = await launchCampaign(shop, {
    productTitle,
    headlines,
    descriptions,
    keywords,
    finalUrl,
    budgetAmount: String(dailyBudget),
    campaignType,
    bidding,
  });
  return Response.json(result, { status: result.success ? 200 : 500 });
};



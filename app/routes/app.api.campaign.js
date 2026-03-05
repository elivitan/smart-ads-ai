// app/routes/app.api.campaign.js
// ══════════════════════════════════════════════
// PROTECTED: Requires paid plan (canPublish)
// ══════════════════════════════════════════════
import { authenticate } from "../shopify.server";
import { launchCampaign } from "../campaignLifecycle.server.js";
import { checkLicense } from "../license.server.js";
import { checkGoogleAdsLimit } from "../rateLimit.server.js";

export const action = async ({ request }) => {
  let session;
  try {
    ({ session } = await authenticate.admin(request));
  } catch (authErr) {
    console.error("[SmartAds] Auth failed:", authErr.message);
    return Response.json({ success: false, error: "Authentication failed" }, { status: 401 });
  }
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
  // Budget validation (server-side safety)
  let dailyBudget = Number(formData.get("dailyBudget"));
  if (isNaN(dailyBudget) || dailyBudget <= 0) dailyBudget = 30;
  dailyBudget = Math.max(1, Math.min(500, dailyBudget)); // $1-$500 safety cap
  const campaignType = formData.get("campaignType") || "search";
  const bidding = formData.get("bidding") || "max_conversions";

  // Input validation
  if (!productTitle || !productTitle.trim()) {
    return Response.json({ success: false, error: "Product title required." }, { status: 400 });
  }
  if (!finalUrl || !finalUrl.startsWith("http")) {
    return Response.json({ success: false, error: "Valid product URL required." }, { status: 400 });
  }
  if (headlines.length < 3) {
    return Response.json({ success: false, error: "At least 3 headlines required." }, { status: 400 });
  }
  if (descriptions.length < 2) {
    return Response.json({ success: false, error: "At least 2 descriptions required." }, { status: 400 });
  }

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



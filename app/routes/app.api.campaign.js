// app/routes/app.api.campaign.js
// ══════════════════════════════════════════════
// PROTECTED: Requires paid plan (canPublish)
// ══════════════════════════════════════════════
import { authenticate } from "../shopify.server";
import { launchCampaign } from "../campaignLifecycle.server.js";
import { checkLicense } from "../license.server.js";
import { checkGoogleAdsLimit } from "../rateLimit.server.js";
import { z } from "zod";
import { logger } from "../utils/logger";
import { rateLimit, rateLimitResponse } from "../utils/rate-limiter";

// Zod schemas
const CampaignSchema = z.object({
  productTitle: z.string().min(1).max(500),
  headlines: z.array(z.string().max(30)).min(3).max(15),
  descriptions: z.array(z.string().max(90)).min(2).max(5),
  keywords: z.array(z.string().max(200)).max(100).optional(),
  finalUrl: z.string().url().max(2000),
  dailyBudget: z.coerce.number().min(1).max(10000).optional(),
  campaignType: z.enum(["search", "shopping", "display", "pmax"]).optional(),
  bidding: z.enum(["max_conversions", "max_clicks", "target_cpa", "target_roas"]).optional(),
});

export const action = async ({ request }) => {
  let session;
  try {
    ({ session } = await authenticate.admin(request));
  } catch (authErr) {
    logger.error("campaign.action", "Auth failed", { error: authErr.message });
    return Response.json({ success: false, error: "Authentication failed" }, { status: 401 });
  }
  const shop = session.shop;

  // Rate limit check
  const rl = rateLimit.campaign(shop);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);

  // ✅ LICENSE CHECK — must have paid plan
  const license = await checkLicense(shop, "campaign");
  if (!license.allowed) {
    return Response.json(
      { success: false, error: license.reason },
      { status: 403 }
    );
  }

  const formData = await request.formData();

  // Parse and validate with Zod
  let parsed;
  try {
    const rawData = {
      productTitle: formData.get("productTitle") || "",
      headlines: JSON.parse(formData.get("headlines") || "[]"),
      descriptions: JSON.parse(formData.get("descriptions") || "[]"),
      keywords: JSON.parse(formData.get("keywords") || "[]"),
      finalUrl: formData.get("finalUrl") || "https://your-store.myshopify.com",
      dailyBudget: formData.get("dailyBudget"),
      campaignType: formData.get("campaignType") || "search",
      bidding: formData.get("bidding") || "max_conversions",
    };
    parsed = CampaignSchema.safeParse(rawData);
  } catch (parseErr) {
    logger.warn("campaign.action", "Failed to parse form data", { shop, error: parseErr.message });
    return Response.json({ success: false, error: "Invalid form data" }, { status: 400 });
  }

  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => i.path.join(".") + ": " + i.message).join("; ");
    logger.warn("campaign.action", "Validation failed", { shop, extra: { issues } });
    return Response.json({ success: false, error: "Invalid input: " + issues }, { status: 400 });
  }

  const { productTitle, headlines, descriptions, keywords, finalUrl, campaignType, bidding } = parsed.data;
  let dailyBudget = parsed.data.dailyBudget || 30;
  dailyBudget = Math.max(1, Math.min(500, dailyBudget)); // $1-$500 safety cap

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



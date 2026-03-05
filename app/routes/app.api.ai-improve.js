// app/routes/app.api.ai-improve.js
// ══════════════════════════════════════════════
// PROTECTED: Requires AI credits
// ══════════════════════════════════════════════
import { authenticate } from "../shopify.server";
import Anthropic from "@anthropic-ai/sdk";
import { checkLicense, useAiCredit } from "../license.server.js";
import { checkAnthropicLimit } from "../rateLimit.server.js";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const action = async ({ request }) => {
  let session;
  try {
    ({ session } = await authenticate.admin(request));
  } catch (authErr) {
    console.error("[SmartAds] Auth failed:", authErr.message);
    return Response.json({ success: false, error: "Authentication failed" }, { status: 401 });
  }
  const shop = session.shop;

  // ✅ LICENSE CHECK — must have AI credits
  const license = await checkLicense(shop, "ai-improve");
  if (!license.allowed) {
    return Response.json(
      { success: false, error: license.reason, creditsRemaining: 0 },
      { status: 403 }
    );
  }
  // Double-check credits from DB
  if (license.sub.aiCredits <= 0) {
    return Response.json(
      { success: false, error: "No AI credits remaining.", creditsRemaining: 0 },
      { status: 403 }
    );
  }

  const formData = await request.formData();
  const text = formData.get("text");
  const type = formData.get("type"); // "headline" or "description"
  const productTitle = formData.get("productTitle") || "";
  const maxChars = type === "headline" ? 30 : 90;

  if (!text) {
    return Response.json({ success: false, error: "No text provided" }, { status: 400 });
  }

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      messages: [{
        role: "user",
        content: `You are a Google Ads copywriting expert. Improve this ${type} for a product called "${productTitle}".

Current ${type}: "${text}"

Rules:
- MUST be ${maxChars} characters or fewer (this is critical!)
- Make it more compelling, action-oriented, and click-worthy
- Use power words that drive conversions
- Keep it relevant to the product
- Return ONLY the improved text, nothing else. No quotes, no explanation.`
      }]
    });

    const improved = response.content[0].text.trim().replace(/^["']|["']$/g, '');

    // ✅ DEDUCT CREDIT after successful improvement
    await useAiCredit(shop);

    if (improved.length > maxChars) {
      return Response.json({
        success: true,
        improved: improved.substring(0, maxChars),
        creditsRemaining: license.sub.aiCredits - 1,
      });
    }

    return Response.json({
      success: true,
      improved,
      creditsRemaining: license.sub.aiCredits - 1,
    });
  } catch (e) {
    console.error("AI improve error:", e);
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
};

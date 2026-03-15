// app/routes/app.api.landing-audit.ts
// Landing Page Optimizer API — ad-to-page alignment scoring
import { authenticate } from "../shopify.server";
import { logger } from "../utils/logger";

interface RouteHandlerArgs {
  request: Request;
}

export async function action({ request }: RouteHandlerArgs) {
  let session;
  try {
    ({ session } = await authenticate.admin(request));
  } catch {
    return Response.json({ success: false, error: "Authentication failed" }, { status: 401 });
  }

  const shop = session.shop;

  try {
    const formData = await request.formData();
    const actionType = (formData.get("action") as string) || "audit";

    const { scoreLandingPageAlignment } = await import("../ai-brain.server.js");

    switch (actionType) {
      case "audit": {
        const productId = formData.get("productId") as string | undefined;
        const result = await scoreLandingPageAlignment(shop, productId || undefined);
        return Response.json({ success: true, result });
      }

      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("landing-audit", "API error", { extra: { error: message } });
    return Response.json({ error: message }, { status: 500 });
  }
}

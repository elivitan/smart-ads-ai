// app/routes/app.api.subscription.js
// ══════════════════════════════════════════════
// Handles plan selection — validates and saves to DB.
//
// SECURITY NOTE: In production, plan changes should go through
// Shopify Billing API (AppSubscriptionCreate mutation) so Shopify
// handles payment. This endpoint should only be called AFTER
// Shopify confirms the subscription.
//
// TODO: Replace direct plan update with Shopify Billing flow:
//   1. Client calls this API with desired plan
//   2. Server creates AppSubscriptionCreate mutation
//   3. Shopify redirects user to payment confirmation
//   4. On confirmation webhook, update DB via updatePlan()
// ══════════════════════════════════════════════
import { authenticate } from "../shopify.server";
import { updatePlan, getSubscriptionInfo } from "../license.server";
import { z } from "zod";
import { logger } from "../utils/logger";
import { rateLimit, rateLimitResponse } from "../utils/rate-limiter";
import { withRequestLogging } from "../utils/request-logger";
import { withSentryMonitoring } from "../utils/sentry-wrapper.server";

// ── Types ──
interface RouteHandlerArgs {
  request: Request;
  params?: Record<string, string>;
  context?: unknown;
}


// Zod schemas
const SubscriptionSchema = z.object({
  plan: z.enum(["free", "starter", "pro", "premium"]),
});
const VALID_PLANS = ["free", "starter", "pro", "premium"];

const _action = async ({ request }: RouteHandlerArgs): Promise<Response> => {
  let session;
  try {
    ({ session } = await authenticate.admin(request));
  } catch (authErr: unknown) {
    logger.error("subscription.action", "Auth failed", { error: (authErr as Error).message });
    return Response.json({ success: false, error: "Authentication failed" }, { status: 401 });
  }
  const shop = session.shop;

  // Rate limit check
  const rl = await rateLimit.subscription(shop);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds || 60);

  try {
    const body = await request.json();
    // Zod validation
    const parsed = SubscriptionSchema.safeParse(body);
    if (!parsed.success) {
      const issues = parsed.error.issues.map(i => i.path.join(".") + ": " + i.message).join("; ");
      logger.warn("subscription.action", "Validation failed", { shop, extra: { issues } });
      return Response.json(
        { success: false, error: `Invalid plan. Must be one of: ${VALID_PLANS.join(", ")}` },
        { status: 400 }
      );
    }
    const { plan } = parsed.data;

    // TODO: For paid plans, validate through Shopify Billing API first
    // For now, directly update (development mode only)
    if (plan !== "free") {
      logger.warn("subscription.action", `Plan "${plan}" set without Shopify Billing verification`, { shop });
    }

    await updatePlan(shop, plan, {
      trial: plan !== "free",
      trialDays: 7,
    });

    const info = await getSubscriptionInfo(shop);
    return Response.json({ success: true, subscription: info });
  } catch (err: unknown) {
    logger.error("subscription.action", "Subscription error", { shop, error: (err as Error).message });
    return Response.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
};

// GET — return current subscription info
const _loader = async ({ request }: RouteHandlerArgs): Promise<Response> => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  try {
    const info = await getSubscriptionInfo(shop);
    return Response.json({ success: true, subscription: info });
  } catch (err: unknown) {
    return Response.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
};


// ── Middleware wrappers (Session 56) ──
export const action = withSentryMonitoring("api.subscription", withRequestLogging("api.subscription", _action));
export const loader = withSentryMonitoring("api.subscription", withRequestLogging("api.subscription", _loader));
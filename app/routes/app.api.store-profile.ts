/**
 * /app/api/store-profile — Store business profile API
 *
 * GET:  Returns current store profile
 * POST: Saves/updates store profile (onboarding questionnaire)
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server.js";
import { getStoreProfile, saveStoreProfile } from "../store-context.server.js";
import { logger } from "../utils/logger.js";

function json(data: unknown, init?: { status?: number }) {
  return new Response(JSON.stringify(data), {
    status: init?.status || 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  try {
    const profile = await getStoreProfile(shop);
    return json({ success: true, profile });
  } catch (err: unknown) {
    logger.error("api.store-profile", "Failed to load store profile", {
      extra: { shop, error: err instanceof Error ? err.message : String(err) },
    });
    return json({ success: false, error: "Failed to load profile" }, { status: 500 });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  try {
    const body = await request.json();

    const profile = await saveStoreProfile(shop, {
      profitMargin: body.profitMargin != null ? Number(body.profitMargin) : undefined,
      targetAgeMin: body.targetAgeMin != null ? Number(body.targetAgeMin) : undefined,
      targetAgeMax: body.targetAgeMax != null ? Number(body.targetAgeMax) : undefined,
      targetGender: body.targetGender || undefined,
      brandPositioning: body.brandPositioning || undefined,
      avgOrderValue: body.avgOrderValue != null ? Number(body.avgOrderValue) : undefined,
      shippingSpeed: body.shippingSpeed || undefined,
      uniqueSellingPoints: body.uniqueSellingPoints || undefined,
      competitiveEdge: body.competitiveEdge || undefined,
      businessGoal: body.businessGoal || undefined,
    });

    logger.info("api.store-profile", "Store profile saved", { extra: { shop } });
    return json({ success: true, profile });
  } catch (err: unknown) {
    logger.error("api.store-profile", "Failed to save store profile", {
      extra: { shop, error: err instanceof Error ? err.message : String(err) },
    });
    return json({ success: false, error: "Failed to save profile" }, { status: 500 });
  }
}

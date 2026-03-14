/**
 * /app/api/recommendations — Optimization recommendations API
 *
 * GET:  Returns pending recommendations for the shop
 * POST: action="approve" → Execute recommendation
 *       action="dismiss" → Dismiss recommendation
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server.js";
import {
  getPendingRecommendations,
  approveRecommendation,
  dismissRecommendation,
} from "../utils/optimizer.server.js";
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
    const recommendations = await getPendingRecommendations(shop);
    return json({ success: true, recommendations });
  } catch (err: unknown) {
    logger.error("api.recommendations", "Failed to load recommendations", {
      extra: { shop, error: err instanceof Error ? err.message : String(err) },
    });
    return json({ success: false, error: "Failed to load recommendations" }, { status: 500 });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  try {
    const body = await request.json();
    const actionType = body?.action;
    const recommendationId = body?.recommendationId;

    if (!recommendationId) {
      return json({ success: false, error: "Missing recommendationId" }, { status: 400 });
    }

    switch (actionType) {
      case "approve": {
        await approveRecommendation(recommendationId);
        logger.info("api.recommendations", "Recommendation approved", {
          extra: { shop, recommendationId },
        });
        return json({ success: true });
      }

      case "dismiss": {
        await dismissRecommendation(recommendationId);
        logger.info("api.recommendations", "Recommendation dismissed", {
          extra: { shop, recommendationId },
        });
        return json({ success: true });
      }

      default:
        return json(
          { success: false, error: `Unknown action: ${actionType}` },
          { status: 400 }
        );
    }
  } catch (err: unknown) {
    logger.error("api.recommendations", "Recommendation action failed", {
      extra: { shop, error: err instanceof Error ? err.message : String(err) },
    });
    return json(
      { success: false, error: err instanceof Error ? err.message : "Action failed" },
      { status: 500 }
    );
  }
}

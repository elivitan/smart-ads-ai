/**
 * /app/api/optimize — Auto-optimization API
 *
 * GET:  Returns optimization history + stats
 * POST: action="run"      → Trigger manual optimization
 *       action="history"   → Get optimization log
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";

function json(data: unknown, init?: { status?: number }) {
  return new Response(JSON.stringify(data), {
    status: init?.status || 200,
    headers: { "Content-Type": "application/json" },
  });
}
import { authenticate } from "../shopify.server.js";
import { runOptimization, getOptimizationHistory, getOptimizationStats } from "../utils/optimizer.server.js";
import { logger } from "../utils/logger.js";

// ── GET: Dashboard data ──────────────────────────────────────────────────

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  try {
    const [history, stats] = await Promise.all([
      getOptimizationHistory(shop, 20),
      getOptimizationStats(shop),
    ]);

    return json({
      success: true,
      history,
      stats,
    });
  } catch (err: unknown) {
    logger.error("api.optimize", "Failed to load optimization data", {
      extra: { shop, error: err instanceof Error ? err.message : String(err) },
    });
    return json({ success: false, error: "Failed to load optimization data" }, { status: 500 });
  }
}

// ── POST: Actions ────────────────────────────────────────────────────────

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  try {
    const body = await request.json();
    const actionType = body?.action;

    switch (actionType) {
      case "run": {
        logger.info("api.optimize", "Manual optimization triggered", { extra: { shop } });
        const result = await runOptimization(shop);
        return json({
          success: true,
          result: {
            totalCampaigns: result.totalCampaigns,
            actionsExecuted: result.actionsExecuted,
            actionsFailed: result.actionsFailed,
            aiGrade: result.aiGrade,
            duration: result.duration,
            actions: result.actions,
          },
        });
      }

      case "history": {
        const limit = Math.min(body?.limit || 50, 100);
        const history = await getOptimizationHistory(shop, limit);
        return json({ success: true, history });
      }

      default:
        return json(
          { success: false, error: `Unknown action: ${actionType}` },
          { status: 400 }
        );
    }
  } catch (err: unknown) {
    logger.error("api.optimize", "Optimization action failed", {
      extra: { shop, error: err instanceof Error ? err.message : String(err) },
    });
    return json(
      { success: false, error: err instanceof Error ? err.message : "Optimization failed" },
      { status: 500 }
    );
  }
}

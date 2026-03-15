// app/routes/app.api.funnel.ts
// Full Funnel Orchestrator API — campaign funnel creation & budget rebalancing
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
    const actionType = (formData.get("action") as string) || "queue";

    const { createFullFunnel, rebalanceBudgets, getCampaignPriorityQueue, autoAllocateBudget } = await import("../funnel-orchestrator.server.js");

    switch (actionType) {
      case "create": {
        const productId = formData.get("productId") as string | undefined;
        const funnelType = (formData.get("funnelType") as string) || "full_store";
        const totalDailyBudget = parseFloat((formData.get("totalDailyBudget") as string) || "50");
        const result = await createFullFunnel(shop, {
          productId: productId || undefined,
          funnelType: funnelType as "single_product" | "category" | "full_store",
          totalDailyBudget,
        });
        return Response.json({ success: true, result });
      }

      case "rebalance": {
        const result = await rebalanceBudgets(shop);
        return Response.json({ success: true, result });
      }

      case "queue": {
        const result = await getCampaignPriorityQueue(shop);
        return Response.json({ success: true, result });
      }

      case "auto_allocate": {
        const totalDailyBudget = parseFloat((formData.get("totalDailyBudget") as string) || "50");
        const result = await autoAllocateBudget(shop, totalDailyBudget);
        return Response.json({ success: true, result });
      }

      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("funnel", "API error", { extra: { error: message } });
    return Response.json({ error: message }, { status: 500 });
  }
}

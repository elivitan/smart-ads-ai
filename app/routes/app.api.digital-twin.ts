// app/routes/app.api.digital-twin.ts
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
    const actionType = (formData.get("action") as string) || "simulate";

    switch (actionType) {
      case "simulate": {
        const productId = (formData.get("productId") as string) || undefined;
        const budget = formData.get("budget") as string;
        const durationDays = formData.get("durationDays") as string;
        const campaignType = formData.get("campaignType") as string | null;
        const { runDigitalTwinSimulation } = await import("../digital-twin.server.js");
        const result = await runDigitalTwinSimulation(shop, {
          budget: Number(budget),
          productId,
          durationDays: Number(durationDays),
          campaignType: campaignType || "search",
        });
        return Response.json({ success: true, result });
      }
      case "budget_change": {
        const campaignId = formData.get("campaignId") as string;
        const newBudget = formData.get("newBudget") as string;
        const { simulateBudgetChange } = await import("../digital-twin.server.js");
        const result = await simulateBudgetChange(shop, campaignId, Number(newBudget));
        return Response.json({ success: true, result });
      }
      case "history": {
        const { getSimulationHistory } = await import("../digital-twin.server.js");
        const result = await getSimulationHistory(shop);
        return Response.json({ success: true, result });
      }
      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("digital-twin", "API error", { extra: { error: message } });
    return Response.json({ error: message }, { status: 500 });
  }
}

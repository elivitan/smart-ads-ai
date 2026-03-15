// app/routes/app.api.weekly-report.ts
// Weekly Intelligence Report API — automated agency-style reports
import { authenticate } from "../shopify.server";
import { generateWeeklyReport, getWeeklyReports } from "../ai-brain.server.js";
import { logger } from "../utils/logger";

interface RouteHandlerArgs {
  request: Request;
  params?: Record<string, string>;
  context?: unknown;
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
    const actionType = (formData.get("action") as string) || "list";

    switch (actionType) {
      case "generate": {
        const report = await generateWeeklyReport(shop);
        return Response.json({ success: true, report });
      }

      case "list": {
        const limit = parseInt((formData.get("limit") as string) || "12");
        const reports = await getWeeklyReports(shop, limit);
        return Response.json({ success: true, reports });
      }

      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("weekly-report", "Report generation failed", { extra: { error: message } });
    return Response.json({ error: message }, { status: 500 });
  }
}

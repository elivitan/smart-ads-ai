// app/routes/app.api.weekly-report.ts
// Weekly Intelligence Report API — automated agency-style reports
import { createRouteAction } from "../utils/route-handler.server";

export const action = createRouteAction("weekly-report", "list", {
  async generate(shop) {
    const { generateWeeklyReport } = await import("../ai-brain.server.js");
    return generateWeeklyReport(shop);
  },
  async list(shop, formData) {
    const limit = parseInt((formData.get("limit") as string) || "12");
    const { getWeeklyReports } = await import("../ai-brain.server.js");
    return getWeeklyReports(shop, limit);
  },
});

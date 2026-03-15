// app/routes/app.api.weather.ts
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
    const actionType = (formData.get("action") as string) || "check_weather";

    switch (actionType) {
      case "check_weather": {
        const { checkWeatherTriggers } = await import("../weather-arbitrage.server.js");
        const result = await checkWeatherTriggers(shop);
        return Response.json({ success: true, result });
      }
      case "check_holidays": {
        const { checkHolidayTriggers } = await import("../weather-arbitrage.server.js");
        const result = await checkHolidayTriggers(shop);
        return Response.json({ success: true, result });
      }
      case "active": {
        const { getActiveTriggers } = await import("../weather-arbitrage.server.js");
        const result = await getActiveTriggers(shop);
        return Response.json({ success: true, result });
      }
      default:
        return Response.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("weather", "API error", { extra: { error: message } });
    return Response.json({ error: message }, { status: 500 });
  }
}

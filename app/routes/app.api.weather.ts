// app/routes/app.api.weather.ts
import { createRouteAction } from "../utils/route-handler.server";

export const action = createRouteAction("weather", "check_weather", {
  async check_weather(shop) {
    const { checkWeatherTriggers } = await import("../weather-arbitrage.server.js");
    return checkWeatherTriggers(shop);
  },
  async check_holidays(shop) {
    const { checkHolidayTriggers } = await import("../weather-arbitrage.server.js");
    return checkHolidayTriggers(shop);
  },
  async active(shop) {
    const { getActiveTriggers } = await import("../weather-arbitrage.server.js");
    return getActiveTriggers(shop);
  },
});

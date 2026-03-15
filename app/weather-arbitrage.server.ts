/**
 * Engine 13: Weather & Event Arbitrage
 *
 * Real-time weather + holiday data triggers automatic campaign adjustments.
 * Matches weather conditions and upcoming holidays to relevant product
 * categories for timely ad spend optimization.
 */
import prisma from "./db.server.js";
import { logger } from "./utils/logger.js";
import { getStoreProfile } from "./store-context.server.js";

// ─── Types ───────────────────────────────────────────────────────────────────

interface WeatherData {
  city: string;
  latitude: number;
  longitude: number;
  temperature: number;
  weatherCode: number;
  condition: string;
}

interface WeatherTriggerResult {
  triggerType: string;
  location: string;
  condition: string;
  affectedProducts: Array<{ id: string; title: string; relevanceScore: number }>;
  suggestedAction: string;
}

interface HolidayTriggerResult {
  holiday: string;
  daysUntil: number;
  suggestedAction: string;
}

interface HolidayEntry {
  name: string;
  month: number;
  day: number;
  dynamicDate?: (year: number) => Date;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const US_CITIES = [
  { city: "New York", latitude: 40.71, longitude: -74.01 },
  { city: "Los Angeles", latitude: 34.05, longitude: -118.24 },
  { city: "Chicago", latitude: 41.88, longitude: -87.63 },
  { city: "Houston", latitude: 29.76, longitude: -95.37 },
  { city: "Phoenix", latitude: 33.45, longitude: -112.07 },
] as const;

// Weather code mapping (WMO standard)
function getWeatherCondition(code: number): string {
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 95 && code <= 99) return "thunderstorm";
  if (code >= 61 && code <= 67) return "rain";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code >= 80 && code <= 82) return "rain";
  if (code >= 0 && code <= 3) return "clear";
  if (code >= 45 && code <= 48) return "fog";
  return "other";
}

// Product category keywords for weather matching
const WEATHER_PRODUCT_KEYWORDS: Record<string, string[]> = {
  snow: ["blanket", "coat", "heater", "warm", "winter", "jacket", "gloves", "scarf", "boots", "thermal"],
  cold: ["blanket", "coat", "heater", "warm", "winter", "jacket", "sweater", "hoodie", "fleece"],
  heat: ["fan", "ac", "cooling", "cold", "light", "summer", "shorts", "tank", "sunscreen", "hat"],
  rain: ["umbrella", "waterproof", "rain", "indoor", "poncho", "boots", "jacket"],
  clear: ["outdoor", "garden", "patio", "sunglasses", "beach", "picnic"],
};

// US holidays with approximate dates
function getUSHolidays(year: number): Array<{ name: string; date: Date }> {
  return [
    { name: "New Year's Day", date: new Date(year, 0, 1) },
    { name: "Valentine's Day", date: new Date(year, 1, 14) },
    { name: "Easter", date: calculateEaster(year) },
    { name: "Mother's Day", date: getNthDayOfWeek(year, 4, 0, 2) }, // 2nd Sunday of May
    { name: "Father's Day", date: getNthDayOfWeek(year, 5, 0, 3) }, // 3rd Sunday of June
    { name: "Independence Day", date: new Date(year, 6, 4) },
    { name: "Labor Day", date: getNthDayOfWeek(year, 8, 1, 1) }, // 1st Monday of September
    { name: "Halloween", date: new Date(year, 9, 31) },
    { name: "Thanksgiving", date: getNthDayOfWeek(year, 10, 4, 4) }, // 4th Thursday of November
    { name: "Black Friday", date: new Date(getNthDayOfWeek(year, 10, 4, 4).getTime() + 86400000) },
    { name: "Christmas", date: new Date(year, 11, 25) },
  ];
}

// Helper: get nth occurrence of a weekday in a month
function getNthDayOfWeek(year: number, month: number, dayOfWeek: number, nth: number): Date {
  const first = new Date(year, month, 1);
  const firstDay = first.getDay();
  let date = 1 + ((dayOfWeek - firstDay + 7) % 7) + (nth - 1) * 7;
  return new Date(year, month, date);
}

// Simplified Easter calculation (Computus algorithm)
function calculateEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
}

// ─── 1. Check Weather Triggers ──────────────────────────────────────────────

/**
 * Fetch current weather for major US cities and match conditions to
 * relevant product categories. Returns triggers for weather-sensitive products.
 */
export async function checkWeatherTriggers(shop: string): Promise<WeatherTriggerResult[]> {
  try {
    logger.info("weather-arbitrage", `Checking weather triggers for shop ${shop}`);

    // Get store profile for context
    const storeProfile = await getStoreProfile(shop);

    // Fetch weather data for all cities
    const weatherResults: WeatherData[] = [];

    for (const loc of US_CITIES) {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max&timezone=auto`;
        const response = await fetch(url);

        if (!response.ok) {
          logger.warn("weather-arbitrage", `Weather API failed for ${loc.city}: ${response.status}`);
          continue;
        }

        const data = await response.json();
        const weatherCode = data?.current?.weather_code ?? 0;
        const temperature = data?.current?.temperature_2m ?? 20;

        weatherResults.push({
          city: loc.city,
          latitude: loc.latitude,
          longitude: loc.longitude,
          temperature,
          weatherCode,
          condition: getWeatherCondition(weatherCode),
        });
      } catch (err) {
        logger.warn("weather-arbitrage", `Failed to fetch weather for ${loc.city}`, { extra: { error: err instanceof Error ? err.message : String(err) } });
      }
    }

    if (weatherResults.length === 0) {
      logger.info("weather-arbitrage", "No weather data available");
      return [];
    }

    // Get all products for matching
    const products = await prisma.product.findMany({
      where: { shop, inStock: true },
      select: { id: true, title: true, description: true, productType: true, tags: true },
    });

    const triggers: WeatherTriggerResult[] = [];

    for (const weather of weatherResults) {
      // Determine which keyword set to use
      let conditionKey = weather.condition;
      if (weather.temperature < 5 && conditionKey !== "snow") {
        conditionKey = "cold";
      } else if (weather.temperature > 30) {
        conditionKey = "heat";
      }

      const keywords = WEATHER_PRODUCT_KEYWORDS[conditionKey];
      if (!keywords) continue;

      // Match products to weather keywords
      const matchedProducts: Array<{ id: string; title: string; relevanceScore: number }> = [];

      for (const product of products) {
        const searchText = `${product.title} ${product.description || ""} ${product.productType || ""} ${product.tags || ""}`.toLowerCase();
        let matchCount = 0;

        for (const keyword of keywords) {
          if (searchText.includes(keyword.toLowerCase())) {
            matchCount++;
          }
        }

        if (matchCount > 0) {
          matchedProducts.push({
            id: product.id,
            title: product.title,
            relevanceScore: Math.min(matchCount / 3, 1), // normalize to 0-1
          });
        }
      }

      if (matchedProducts.length === 0) continue;

      // Sort by relevance
      matchedProducts.sort((a, b) => b.relevanceScore - a.relevanceScore);

      // Generate suggested action
      let suggestedAction: string;
      if (conditionKey === "snow" || conditionKey === "cold") {
        suggestedAction = `Boost ads for cold-weather products in ${weather.city}. Temperature: ${weather.temperature}C. Increase bids by 20-30%.`;
      } else if (conditionKey === "heat") {
        suggestedAction = `Boost ads for summer/cooling products in ${weather.city}. Temperature: ${weather.temperature}C. Increase bids by 20-30%.`;
      } else if (conditionKey === "rain") {
        suggestedAction = `Boost ads for rain gear and indoor products in ${weather.city}. Increase bids by 15-25%.`;
      } else {
        suggestedAction = `Good weather in ${weather.city} — boost outdoor product ads. Increase bids by 10-20%.`;
      }

      const trigger: WeatherTriggerResult = {
        triggerType: "weather",
        location: weather.city,
        condition: `${conditionKey} (${weather.temperature}C, code: ${weather.weatherCode})`,
        affectedProducts: matchedProducts.slice(0, 10),
        suggestedAction,
      };

      triggers.push(trigger);

      // Save to database
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 12); // weather triggers expire in 12 hours

      await prisma.weatherEventTrigger.create({
        data: {
          shop,
          triggerType: "weather",
          triggerData: JSON.stringify({
            condition: conditionKey,
            location: weather.city,
            temperature: weather.temperature,
            weatherCode: weather.weatherCode,
          }),
          affectedProducts: JSON.stringify(matchedProducts.slice(0, 10)),
          region: weather.city,
          impactEstimate: matchedProducts.length * 0.1, // rough estimate
          expiresAt,
        },
      });
    }

    logger.info("weather-arbitrage", `Found ${triggers.length} weather triggers`, { extra: { shop } });
    return triggers;
  } catch (error) {
    logger.error("weather-arbitrage", "Weather trigger check failed", { extra: { shop, error: error instanceof Error ? error.message : String(error) } });
    throw error;
  }
}

// ─── 2. Check Holiday Triggers ──────────────────────────────────────────────

/**
 * Detect upcoming US holidays and generate campaign suggestions based on
 * proximity. Within 14 days = pre-campaign, within 3 days = bid boost.
 */
export async function checkHolidayTriggers(shop: string): Promise<HolidayTriggerResult[]> {
  try {
    logger.info("weather-arbitrage", `Checking holiday triggers for shop ${shop}`);

    const now = new Date();
    const currentYear = now.getFullYear();

    // Check holidays for current year and next year (for December → January)
    const holidays = [
      ...getUSHolidays(currentYear),
      ...getUSHolidays(currentYear + 1),
    ];

    const triggers: HolidayTriggerResult[] = [];

    for (const holiday of holidays) {
      const diffMs = holiday.date.getTime() - now.getTime();
      const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      // Only care about holidays within the next 14 days
      if (daysUntil < 0 || daysUntil > 14) continue;

      let suggestedAction: string;

      if (daysUntil <= 3) {
        suggestedAction = `${holiday.name} is in ${daysUntil} day(s)! Boost bids by 30-50% on relevant products. Enable time-sensitive ad copy.`;
      } else if (daysUntil <= 7) {
        suggestedAction = `${holiday.name} is in ${daysUntil} days. Increase budget by 20-30%. Launch holiday-themed ad creatives.`;
      } else {
        suggestedAction = `${holiday.name} is in ${daysUntil} days. Start pre-campaign: build audiences, prepare holiday ad copy, increase budget by 10-15%.`;
      }

      triggers.push({
        holiday: holiday.name,
        daysUntil,
        suggestedAction,
      });

      // Save to database
      const expiresAt = new Date(holiday.date.getTime() + 24 * 60 * 60 * 1000); // expire 1 day after holiday

      await prisma.weatherEventTrigger.create({
        data: {
          shop,
          triggerType: "holiday",
          triggerData: JSON.stringify({
            holiday: holiday.name,
            date: holiday.date.toISOString(),
            daysUntil,
          }),
          affectedProducts: JSON.stringify([]), // holiday triggers apply broadly
          region: "US",
          expiresAt,
        },
      });
    }

    logger.info("weather-arbitrage", `Found ${triggers.length} holiday triggers`, { extra: { shop } });
    return triggers;
  } catch (error) {
    logger.error("weather-arbitrage", "Holiday trigger check failed", { extra: { shop, error: error instanceof Error ? error.message : String(error) } });
    throw error;
  }
}

// ─── 3. Get Active Triggers ─────────────────────────────────────────────────

/**
 * Retrieve all active (non-expired) triggers for a shop.
 */
export async function getActiveTriggers(shop: string) {
  try {
    const now = new Date();

    const triggers = await prisma.weatherEventTrigger.findMany({
      where: {
        shop,
        OR: [
          { expiresAt: { gt: now } },
          { expiresAt: null },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    return triggers.map((t) => ({
      id: t.id,
      triggerType: t.triggerType,
      triggerData: JSON.parse(t.triggerData),
      affectedProducts: JSON.parse(t.affectedProducts),
      actionTaken: t.actionTaken ? JSON.parse(t.actionTaken) : null,
      region: t.region,
      impactEstimate: t.impactEstimate,
      actualImpact: t.actualImpact,
      expiresAt: t.expiresAt,
      createdAt: t.createdAt,
    }));
  } catch (error) {
    logger.error("weather-arbitrage", "Failed to fetch active triggers", { extra: { shop, error: error instanceof Error ? error.message : String(error) } });
    throw error;
  }
}

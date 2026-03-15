/**
 * Engine 22: Bid Time Arbitrage
 *
 * Analyzes hourly performance data to find windows where CPC is low
 * and conversion rates are high — "arbitrage windows" — and generates
 * bid adjustment recommendations.
 */
import prisma from "./db.server.js";
import { logger } from "./utils/logger.js";
import { getCustomer } from "./google-ads.server.js";

// ─── Types ───────────────────────────────────────────────────────────────────

interface HourlyBucket {
  dayOfWeek: number; // 0 (Sunday) - 6 (Saturday)
  hour: number; // 0-23
  totalClicks: number;
  totalImpressions: number;
  totalCostMicros: number;
  totalConversions: number;
  sampleCount: number;
}

interface ArbitrageWindowResult {
  dayOfWeek: number;
  hourStart: number;
  hourEnd: number;
  avgCpc: number;
  avgConvRate: number | null;
  avgRoas: number | null;
  isArbitrage: boolean;
  bidMultiplier: number;
  sampleSize: number;
}

interface BidRecommendation {
  dayOfWeek: number;
  hourStart: number;
  hourEnd: number;
  currentBidMultiplier: number;
  recommendedBidMultiplier: number;
  reason: string;
  estimatedImpact: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Google Ads day_of_week enum: MONDAY=2, TUESDAY=3, ..., SUNDAY=8
// (GAQL segments.day_of_week uses these string values)
const GOOGLE_DAY_TO_JS: Record<string, number> = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
  SUNDAY: 0,
};

// ─── 1. Analyze Hourly Performance ─────────────────────────────────────────

/**
 * For each campaign, query Google Ads with hourly segments.
 * Build a 7x24 matrix of avg CPC, conversion rate, ROAS per hour/day.
 */
export async function analyzeHourlyPerformance(shop: string): Promise<{ windowCount: number }> {
  try {
    logger.info("bid-arbitrage", "Analyzing hourly performance", { extra: { shop } });

    const customer = getCustomer();

    // Calculate date range: last 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const fromDate = thirtyDaysAgo.toISOString().split("T")[0];
    const toDate = now.toISOString().split("T")[0];

    const query = `
      SELECT
        campaign.id,
        segments.hour,
        segments.day_of_week,
        metrics.average_cpc,
        metrics.conversions,
        metrics.cost_micros,
        metrics.clicks,
        metrics.impressions
      FROM campaign
      WHERE segments.date BETWEEN '${fromDate}' AND '${toDate}'
        AND campaign.status = 'ENABLED'
        AND metrics.impressions > 0
    `;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows: any[] = await customer.query(query);

    if (rows.length === 0) {
      logger.info("bid-arbitrage", "No hourly data available", { extra: { shop } });
      return { windowCount: 0 };
    }

    // Build a 7x24 aggregation matrix
    const buckets = new Map<string, HourlyBucket>();

    for (const row of rows) {
      const dayStr = row.segments?.day_of_week as string;
      const hour = Number(row.segments?.hour ?? 0);
      const dayOfWeek = GOOGLE_DAY_TO_JS[dayStr] ?? 0;

      const key = `${dayOfWeek}-${hour}`;
      const existing = buckets.get(key) || {
        dayOfWeek,
        hour,
        totalClicks: 0,
        totalImpressions: 0,
        totalCostMicros: 0,
        totalConversions: 0,
        sampleCount: 0,
      };

      existing.totalClicks += Number(row.metrics?.clicks ?? 0);
      existing.totalImpressions += Number(row.metrics?.impressions ?? 0);
      existing.totalCostMicros += Number(row.metrics?.cost_micros ?? 0);
      existing.totalConversions += Number(row.metrics?.conversions ?? 0);
      existing.sampleCount += 1;

      buckets.set(key, existing);
    }

    // Convert buckets to window records
    const windows: ArbitrageWindowResult[] = [];

    for (const bucket of buckets.values()) {
      const avgCpc =
        bucket.totalClicks > 0
          ? bucket.totalCostMicros / bucket.totalClicks / 1_000_000
          : 0;

      const avgConvRate =
        bucket.totalClicks > 0
          ? (bucket.totalConversions / bucket.totalClicks) * 100
          : null;

      windows.push({
        dayOfWeek: bucket.dayOfWeek,
        hourStart: bucket.hour,
        hourEnd: bucket.hour === 23 ? 0 : bucket.hour + 1,
        avgCpc,
        avgConvRate,
        avgRoas: null, // Will be enriched later with conversion value data
        isArbitrage: false, // Will be determined in detectArbitrageWindows
        bidMultiplier: 1.0,
        sampleSize: bucket.sampleCount,
      });
    }

    // Upsert windows to database
    for (const w of windows) {
      await prisma.bidArbitrageWindow.upsert({
        where: {
          shop_dayOfWeek_hourStart: {
            shop,
            dayOfWeek: w.dayOfWeek,
            hourStart: w.hourStart,
          },
        },
        update: {
          hourEnd: w.hourEnd,
          avgCpc: w.avgCpc,
          avgConvRate: w.avgConvRate,
          avgRoas: w.avgRoas,
          sampleSize: w.sampleSize,
          updatedAt: new Date(),
        },
        create: {
          shop,
          dayOfWeek: w.dayOfWeek,
          hourStart: w.hourStart,
          hourEnd: w.hourEnd,
          avgCpc: w.avgCpc,
          avgConvRate: w.avgConvRate,
          avgRoas: w.avgRoas,
          sampleSize: w.sampleSize,
          isArbitrage: false,
          bidMultiplier: 1.0,
        },
      });
    }

    logger.info("bid-arbitrage", `Analyzed ${windows.length} hourly windows`, { extra: { shop } });
    return { windowCount: windows.length };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("bid-arbitrage", "Error analyzing hourly performance", {
      extra: { shop, error: message },
    });
    throw err;
  }
}

// ─── 2. Detect Arbitrage Windows ────────────────────────────────────────────

/**
 * Query BidArbitrageWindow records. Identify windows where CPC is below
 * median AND conversion rate is above median. Mark as arbitrage.
 * Return sorted list of best windows.
 */
export async function detectArbitrageWindows(
  shop: string,
): Promise<ArbitrageWindowResult[]> {
  try {
    logger.info("bid-arbitrage", "Detecting arbitrage windows", { extra: { shop } });

    const allWindows = await prisma.bidArbitrageWindow.findMany({
      where: { shop, sampleSize: { gt: 0 } },
    });

    if (allWindows.length === 0) {
      logger.info("bid-arbitrage", "No windows to analyze", { extra: { shop } });
      return [];
    }

    // Calculate medians
    const cpcs = allWindows
      .map((w) => w.avgCpc)
      .filter((v): v is number => v !== null && v > 0)
      .sort((a, b) => a - b);

    const convRates = allWindows
      .map((w) => w.avgConvRate)
      .filter((v): v is number => v !== null && v > 0)
      .sort((a, b) => a - b);

    const medianCpc = cpcs.length > 0 ? cpcs[Math.floor(cpcs.length / 2)] : 0;
    const medianConvRate = convRates.length > 0 ? convRates[Math.floor(convRates.length / 2)] : 0;

    logger.info("bid-arbitrage", `Medians — CPC: $${medianCpc.toFixed(2)}, ConvRate: ${medianConvRate.toFixed(2)}%`, {
      extra: { shop },
    });

    // Mark arbitrage windows and calculate bid multipliers
    const results: ArbitrageWindowResult[] = [];

    for (const w of allWindows) {
      const cpc = w.avgCpc ?? 0;
      const convRate = w.avgConvRate ?? 0;

      const isBelowMedianCpc = cpc > 0 && cpc < medianCpc;
      const isAboveMedianConv = convRate > 0 && convRate > medianConvRate;
      const isArbitrage = isBelowMedianCpc && isAboveMedianConv;

      // Calculate bid multiplier:
      // Arbitrage windows get increased bids (up to 1.5x)
      // Expensive/low-conv windows get decreased bids (down to 0.5x)
      let bidMultiplier = 1.0;
      if (isArbitrage) {
        const cpcRatio = medianCpc > 0 ? (medianCpc - cpc) / medianCpc : 0;
        const convRatio = medianConvRate > 0 ? (convRate - medianConvRate) / medianConvRate : 0;
        bidMultiplier = Math.min(1.5, 1.0 + (cpcRatio + convRatio) * 0.25);
      } else if (cpc > medianCpc * 1.5 && convRate < medianConvRate * 0.5) {
        // Expensive low-performer
        bidMultiplier = Math.max(0.5, 0.7);
      }

      bidMultiplier = Math.round(bidMultiplier * 100) / 100;

      await prisma.bidArbitrageWindow.update({
        where: { id: w.id },
        data: { isArbitrage, bidMultiplier, updatedAt: new Date() },
      });

      results.push({
        dayOfWeek: w.dayOfWeek,
        hourStart: w.hourStart,
        hourEnd: w.hourEnd,
        avgCpc: cpc,
        avgConvRate: convRate || null,
        avgRoas: w.avgRoas,
        isArbitrage,
        bidMultiplier,
        sampleSize: w.sampleSize,
      });
    }

    // Sort: arbitrage windows first, then by CPC ascending
    results.sort((a, b) => {
      if (a.isArbitrage && !b.isArbitrage) return -1;
      if (!a.isArbitrage && b.isArbitrage) return 1;
      return a.avgCpc - b.avgCpc;
    });

    const arbitrageCount = results.filter((r) => r.isArbitrage).length;
    logger.info("bid-arbitrage", `Found ${arbitrageCount} arbitrage windows out of ${results.length}`, {
      extra: { shop },
    });

    return results;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("bid-arbitrage", "Error detecting arbitrage windows", {
      extra: { shop, error: message },
    });
    throw err;
  }
}

// ─── 3. Apply Bid Schedule ──────────────────────────────────────────────────

/**
 * Read arbitrage windows, generate bid adjustment recommendations.
 * Store as JSON recommendations. Does NOT actually modify Google Ads campaigns.
 */
export async function applyBidSchedule(
  shop: string,
): Promise<{ recommendations: BidRecommendation[]; summary: string }> {
  try {
    logger.info("bid-arbitrage", "Generating bid schedule", { extra: { shop } });

    const windows = await prisma.bidArbitrageWindow.findMany({
      where: { shop, sampleSize: { gt: 0 } },
      orderBy: [{ isArbitrage: "desc" }, { avgCpc: "asc" }],
    });

    if (windows.length === 0) {
      return { recommendations: [], summary: "No windows available. Run hourly analysis first." };
    }

    const recommendations: BidRecommendation[] = [];

    for (const w of windows) {
      // Only generate recommendations for non-default multipliers
      if (Math.abs(w.bidMultiplier - 1.0) < 0.05) continue;

      const dayName = DAY_NAMES[w.dayOfWeek] || `Day ${w.dayOfWeek}`;
      const timeRange = `${w.hourStart}:00-${w.hourEnd}:00`;

      let reason: string;
      let estimatedImpact: string;

      if (w.isArbitrage) {
        reason = `Low CPC ($${w.avgCpc.toFixed(2)}) + high conversion rate (${(w.avgConvRate ?? 0).toFixed(1)}%) = arbitrage opportunity`;
        const extraSpend = ((w.bidMultiplier - 1.0) * 100).toFixed(0);
        estimatedImpact = `+${extraSpend}% bid increase could capture ${Math.round((w.avgConvRate ?? 0) * w.sampleSize / 100)} additional conversions`;
      } else {
        reason = `High CPC ($${w.avgCpc.toFixed(2)}) with low conversion rate (${(w.avgConvRate ?? 0).toFixed(1)}%) — reduce waste`;
        const savedSpend = ((1.0 - w.bidMultiplier) * 100).toFixed(0);
        estimatedImpact = `-${savedSpend}% bid decrease to reduce wasted spend`;
      }

      recommendations.push({
        dayOfWeek: w.dayOfWeek,
        hourStart: w.hourStart,
        hourEnd: w.hourEnd,
        currentBidMultiplier: 1.0,
        recommendedBidMultiplier: w.bidMultiplier,
        reason,
        estimatedImpact,
      });
    }

    const increaseCount = recommendations.filter((r) => r.recommendedBidMultiplier > 1.0).length;
    const decreaseCount = recommendations.filter((r) => r.recommendedBidMultiplier < 1.0).length;
    const summary = `Generated ${recommendations.length} bid recommendations: ${increaseCount} increases (arbitrage windows), ${decreaseCount} decreases (waste reduction). These are recommendations only — no changes have been applied to Google Ads.`;

    logger.info("bid-arbitrage", summary, { extra: { shop } });

    return { recommendations, summary };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("bid-arbitrage", "Error generating bid schedule", {
      extra: { shop, error: message },
    });
    throw err;
  }
}

// ─── 4. Track Arbitrage ROI ─────────────────────────────────────────────────

/**
 * Compare before/after performance for windows where bid adjustments
 * were applied. Calculate estimated savings.
 */
export async function trackArbitrageROI(
  shop: string,
): Promise<Record<string, unknown>> {
  try {
    logger.info("bid-arbitrage", "Tracking arbitrage ROI", { extra: { shop } });

    const windows = await prisma.bidArbitrageWindow.findMany({
      where: { shop, sampleSize: { gt: 0 } },
    });

    if (windows.length === 0) {
      return { message: "No windows available for ROI tracking." };
    }

    const arbitrageWindows = windows.filter((w) => w.isArbitrage);
    const wasteWindows = windows.filter(
      (w) => !w.isArbitrage && w.bidMultiplier < 1.0,
    );

    // Calculate potential savings from waste reduction
    let estimatedWasteSavings = 0;
    for (const w of wasteWindows) {
      const currentSpend = w.avgCpc * (w.sampleSize * 10); // rough estimate
      const reducedSpend = currentSpend * w.bidMultiplier;
      estimatedWasteSavings += currentSpend - reducedSpend;
    }

    // Calculate potential gains from arbitrage
    let estimatedArbitrageGain = 0;
    for (const w of arbitrageWindows) {
      const convRate = w.avgConvRate ?? 0;
      const additionalClicks = w.sampleSize * (w.bidMultiplier - 1.0) * 5; // rough estimate
      const additionalConversions = additionalClicks * (convRate / 100);
      estimatedArbitrageGain += additionalConversions;
    }

    const result = {
      totalWindows: windows.length,
      arbitrageWindows: arbitrageWindows.length,
      wasteWindows: wasteWindows.length,
      estimatedMonthlySavings: Math.round(estimatedWasteSavings * 100) / 100,
      estimatedAdditionalConversions: Math.round(estimatedArbitrageGain * 10) / 10,
      topArbitrageSlots: arbitrageWindows.slice(0, 5).map((w) => ({
        day: DAY_NAMES[w.dayOfWeek] || `Day ${w.dayOfWeek}`,
        hour: `${w.hourStart}:00-${w.hourEnd}:00`,
        cpc: w.avgCpc,
        convRate: w.avgConvRate,
        bidMultiplier: w.bidMultiplier,
      })),
      topWasteSlots: wasteWindows.slice(0, 5).map((w) => ({
        day: DAY_NAMES[w.dayOfWeek] || `Day ${w.dayOfWeek}`,
        hour: `${w.hourStart}:00-${w.hourEnd}:00`,
        cpc: w.avgCpc,
        convRate: w.avgConvRate,
        bidMultiplier: w.bidMultiplier,
      })),
    };

    logger.info("bid-arbitrage", "ROI tracking complete", {
      extra: { shop, savings: result.estimatedMonthlySavings },
    });

    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("bid-arbitrage", "Error tracking arbitrage ROI", {
      extra: { shop, error: message },
    });
    throw err;
  }
}

// ─── 5. Get Arbitrage Windows ───────────────────────────────────────────────

/**
 * Simple findMany ordered by isArbitrage desc, avgCpc asc.
 */
export async function getArbitrageWindows(shop: string) {
  try {
    const windows = await prisma.bidArbitrageWindow.findMany({
      where: { shop },
      orderBy: [{ isArbitrage: "desc" }, { avgCpc: "asc" }],
    });

    return windows.map((w) => ({
      ...w,
      dayName: DAY_NAMES[w.dayOfWeek] || `Day ${w.dayOfWeek}`,
    }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("bid-arbitrage", "Error fetching windows", { extra: { shop, error: message } });
    throw err;
  }
}

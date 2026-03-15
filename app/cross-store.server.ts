// Engine 8: Cross-Store Intelligence
// Anonymous industry benchmarks and cross-store trend detection

import prisma from "./db.server.js";
import { logger } from "./utils/logger.js";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ShopBenchmarkComparison {
  roas: { shop: number; industry: number; delta: number };
  ctr: { shop: number; industry: number; delta: number };
  cpc: { shop: number; industry: number; delta: number };
}

interface IndustryBenchmarkResult {
  category: string;
  avgRoas: number;
  avgCtr: number;
  avgCpc: number;
  topAdFormats: string[];
  sampleSize: number;
  shopVsBenchmark: ShopBenchmarkComparison;
}

interface CrossStoreTrend {
  trend: string;
  description: string;
  adoption: number; // percentage of stores using this
  impact: number;   // estimated impact score 0-100
}

// ─── 1. Aggregate Cross-Store Data ───────────────────────────────────────────

/**
 * Aggregate the current shop's performance into anonymous CrossStoreInsight
 * records. Calculates avg ROAS, avg CTR, avg CPC from OptimizationLog and
 * campaign data. Category comes from StoreProfile.productCategory or "general".
 */
export async function aggregateCrossStoreData(shop: string): Promise<void> {
  try {
    logger.info("cross-store", `Aggregating cross-store data for shop ${shop}`);

    // Get the shop's category from store profile
    const storeProfile = await prisma.storeProfile.findFirst({ where: { shop } });
    const category = storeProfile?.brandPositioning || "general";

    // Fetch optimization logs for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const optimizationLogs = await prisma.optimizationLog.findMany({
      where: {
        shop,
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    // Fetch campaign jobs with performance data
    const campaignJobs = await prisma.campaignJob.findMany({
      where: {
        shop,
        state: "DONE",
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    // Calculate metrics from available data
    let totalRoas = 0;
    let totalCtr = 0;
    let totalCpc = 0;
    let metricCount = 0;

    // Extract ROAS/CTR/CPC from optimization log entries that contain budget actions
    for (const log of optimizationLogs) {
      // Parse previous/new values for budget-related actions
      if (log.action === "adjust_budget" && log.previousValue && log.newValue) {
        // Budget adjustments indicate campaign activity; count as a data point
        metricCount++;
      }
    }

    // Extract metrics from campaign job payloads
    const adFormats = new Map<string, number>();

    for (const job of campaignJobs) {
      try {
        const payload = JSON.parse(job.payload || "{}");
        if (payload.roas) totalRoas += parseFloat(payload.roas) || 0;
        if (payload.ctr) totalCtr += parseFloat(payload.ctr) || 0;
        if (payload.cpc) totalCpc += parseFloat(payload.cpc) || 0;
        if (payload.roas || payload.ctr || payload.cpc) metricCount++;

        // Track ad formats used
        const format = payload.campaignType || "search";
        adFormats.set(format, (adFormats.get(format) || 0) + 1);
      } catch {
        // payload is not valid JSON, skip
      }
    }

    // Calculate averages
    const avgRoas = metricCount > 0 ? Math.round((totalRoas / metricCount) * 100) / 100 : 0;
    const avgCtr = metricCount > 0 ? Math.round((totalCtr / metricCount) * 10000) / 10000 : 0;
    const avgCpc = metricCount > 0 ? Math.round((totalCpc / metricCount) * 100) / 100 : 0;

    // Determine top ad formats
    const sortedFormats = [...adFormats.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([format]) => format);

    const now = new Date();
    const periodStart = thirtyDaysAgo;
    const periodEnd = now;

    // Upsert benchmark insights for this category
    await prisma.crossStoreInsight.create({
      data: {
        category,
        insightType: "benchmark",
        metric: "avg_roas",
        value: JSON.stringify({ avgRoas }),
        sampleSize: metricCount,
        confidence: metricCount > 10 ? 0.8 : metricCount > 3 ? 0.5 : 0.3,
        periodStart,
        periodEnd,
      },
    });

    await prisma.crossStoreInsight.create({
      data: {
        category,
        insightType: "benchmark",
        metric: "avg_ctr",
        value: JSON.stringify({ avgCtr }),
        sampleSize: metricCount,
        confidence: metricCount > 10 ? 0.8 : metricCount > 3 ? 0.5 : 0.3,
        periodStart,
        periodEnd,
      },
    });

    await prisma.crossStoreInsight.create({
      data: {
        category,
        insightType: "benchmark",
        metric: "avg_cpc",
        value: JSON.stringify({ avgCpc }),
        sampleSize: metricCount,
        confidence: metricCount > 10 ? 0.8 : metricCount > 3 ? 0.5 : 0.3,
        periodStart,
        periodEnd,
      },
    });

    if (sortedFormats.length > 0) {
      await prisma.crossStoreInsight.create({
        data: {
          category,
          insightType: "benchmark",
          metric: "top_ad_format",
          value: JSON.stringify({ topAdFormats: sortedFormats }),
          sampleSize: metricCount,
          confidence: metricCount > 5 ? 0.7 : 0.4,
          periodStart,
          periodEnd,
        },
      });
    }

    logger.info(
      "cross-store",
      `Aggregated cross-store data for shop ${shop}: category=${category}, avgRoas=${avgRoas}, avgCtr=${avgCtr}, avgCpc=${avgCpc}, samples=${metricCount}`,
    );
  } catch (error) {
    logger.error("cross-store", `Failed to aggregate cross-store data for shop ${shop}: ${error}`);
    throw error;
  }
}

// ─── 2. Get Industry Benchmarks ──────────────────────────────────────────────

/**
 * Load CrossStoreInsight records for the shop's category, compare the shop's
 * own metrics to the industry average, and return a benchmark comparison.
 */
export async function getIndustryBenchmarks(shop: string): Promise<IndustryBenchmarkResult> {
  try {
    logger.info("cross-store", `Fetching industry benchmarks for shop ${shop}`);

    const storeProfile = await prisma.storeProfile.findFirst({ where: { shop } });
    const category = storeProfile?.brandPositioning || "general";

    // Load the most recent benchmark insights for this category
    const insights = await prisma.crossStoreInsight.findMany({
      where: {
        category,
        insightType: "benchmark",
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Extract average metrics across all insight records
    let roasSum = 0;
    let roasCount = 0;
    let ctrSum = 0;
    let ctrCount = 0;
    let cpcSum = 0;
    let cpcCount = 0;
    let totalSampleSize = 0;
    const allFormats: string[] = [];

    for (const insight of insights) {
      try {
        const parsed = JSON.parse(insight.value);

        if (insight.metric === "avg_roas" && parsed.avgRoas) {
          roasSum += parsed.avgRoas;
          roasCount++;
        } else if (insight.metric === "avg_ctr" && parsed.avgCtr) {
          ctrSum += parsed.avgCtr;
          ctrCount++;
        } else if (insight.metric === "avg_cpc" && parsed.avgCpc) {
          cpcSum += parsed.avgCpc;
          cpcCount++;
        } else if (insight.metric === "top_ad_format" && parsed.topAdFormats) {
          allFormats.push(...parsed.topAdFormats);
        }

        totalSampleSize += insight.sampleSize;
      } catch {
        // skip invalid JSON
      }
    }

    const industryRoas = roasCount > 0 ? Math.round((roasSum / roasCount) * 100) / 100 : 0;
    const industryCtr = ctrCount > 0 ? Math.round((ctrSum / ctrCount) * 10000) / 10000 : 0;
    const industryCpc = cpcCount > 0 ? Math.round((cpcSum / cpcCount) * 100) / 100 : 0;

    // Deduplicate and rank ad formats
    const formatFrequency = new Map<string, number>();
    for (const f of allFormats) {
      formatFrequency.set(f, (formatFrequency.get(f) || 0) + 1);
    }
    const topAdFormats = [...formatFrequency.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([format]) => format);

    // Calculate the shop's own metrics for comparison
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const shopJobs = await prisma.campaignJob.findMany({
      where: {
        shop,
        state: "DONE",
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    let shopRoas = 0;
    let shopCtr = 0;
    let shopCpc = 0;
    let shopMetricCount = 0;

    for (const job of shopJobs) {
      try {
        const payload = JSON.parse(job.payload || "{}");
        if (payload.roas) shopRoas += parseFloat(payload.roas) || 0;
        if (payload.ctr) shopCtr += parseFloat(payload.ctr) || 0;
        if (payload.cpc) shopCpc += parseFloat(payload.cpc) || 0;
        if (payload.roas || payload.ctr || payload.cpc) shopMetricCount++;
      } catch {
        // skip
      }
    }

    const shopAvgRoas = shopMetricCount > 0 ? Math.round((shopRoas / shopMetricCount) * 100) / 100 : 0;
    const shopAvgCtr = shopMetricCount > 0 ? Math.round((shopCtr / shopMetricCount) * 10000) / 10000 : 0;
    const shopAvgCpc = shopMetricCount > 0 ? Math.round((shopCpc / shopMetricCount) * 100) / 100 : 0;

    const result: IndustryBenchmarkResult = {
      category,
      avgRoas: industryRoas,
      avgCtr: industryCtr,
      avgCpc: industryCpc,
      topAdFormats,
      sampleSize: totalSampleSize,
      shopVsBenchmark: {
        roas: {
          shop: shopAvgRoas,
          industry: industryRoas,
          delta: Math.round((shopAvgRoas - industryRoas) * 100) / 100,
        },
        ctr: {
          shop: shopAvgCtr,
          industry: industryCtr,
          delta: Math.round((shopAvgCtr - industryCtr) * 10000) / 10000,
        },
        cpc: {
          shop: shopAvgCpc,
          industry: industryCpc,
          delta: Math.round((shopAvgCpc - industryCpc) * 100) / 100,
        },
      },
    };

    logger.info(
      "cross-store",
      `Industry benchmarks for ${category}: ROAS=${industryRoas}, CTR=${industryCtr}, CPC=${industryCpc}, samples=${totalSampleSize}`,
    );

    return result;
  } catch (error) {
    logger.error("cross-store", `Failed to fetch industry benchmarks for shop ${shop}: ${error}`);
    throw error;
  }
}

// ─── 3. Detect Cross-Store Trends ────────────────────────────────────────────

/**
 * Find trends from CrossStoreInsight: what changed in the last 30 days
 * compared to the previous 30-day period.
 */
export async function detectCrossStoreTrends(category: string): Promise<CrossStoreTrend[]> {
  try {
    logger.info("cross-store", `Detecting cross-store trends for category ${category}`);

    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(now.getDate() - 60);

    // Current period insights
    const currentInsights = await prisma.crossStoreInsight.findMany({
      where: {
        category,
        createdAt: { gte: thirtyDaysAgo },
      },
      orderBy: { createdAt: "desc" },
    });

    // Previous period insights
    const previousInsights = await prisma.crossStoreInsight.findMany({
      where: {
        category,
        createdAt: {
          gte: sixtyDaysAgo,
          lt: thirtyDaysAgo,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Aggregate metrics for each period
    const currentMetrics = aggregateInsightMetrics(currentInsights);
    const previousMetrics = aggregateInsightMetrics(previousInsights);

    const trends: CrossStoreTrend[] = [];

    // Detect ROAS trend
    if (currentMetrics.avgRoas > 0 && previousMetrics.avgRoas > 0) {
      const roasChange = ((currentMetrics.avgRoas - previousMetrics.avgRoas) / previousMetrics.avgRoas) * 100;
      if (Math.abs(roasChange) > 5) {
        trends.push({
          trend: roasChange > 0 ? "roas_increasing" : "roas_decreasing",
          description: `Average ROAS ${roasChange > 0 ? "increased" : "decreased"} by ${Math.abs(Math.round(roasChange))}% in the ${category} category over the last 30 days`,
          adoption: currentMetrics.sampleSize,
          impact: Math.min(100, Math.abs(Math.round(roasChange * 1.5))),
        });
      }
    }

    // Detect CTR trend
    if (currentMetrics.avgCtr > 0 && previousMetrics.avgCtr > 0) {
      const ctrChange = ((currentMetrics.avgCtr - previousMetrics.avgCtr) / previousMetrics.avgCtr) * 100;
      if (Math.abs(ctrChange) > 5) {
        trends.push({
          trend: ctrChange > 0 ? "ctr_increasing" : "ctr_decreasing",
          description: `Average CTR ${ctrChange > 0 ? "increased" : "decreased"} by ${Math.abs(Math.round(ctrChange))}% in the ${category} category over the last 30 days`,
          adoption: currentMetrics.sampleSize,
          impact: Math.min(100, Math.abs(Math.round(ctrChange * 1.2))),
        });
      }
    }

    // Detect CPC trend
    if (currentMetrics.avgCpc > 0 && previousMetrics.avgCpc > 0) {
      const cpcChange = ((currentMetrics.avgCpc - previousMetrics.avgCpc) / previousMetrics.avgCpc) * 100;
      if (Math.abs(cpcChange) > 5) {
        trends.push({
          trend: cpcChange > 0 ? "cpc_rising" : "cpc_falling",
          description: `Average CPC ${cpcChange > 0 ? "rose" : "fell"} by ${Math.abs(Math.round(cpcChange))}% in the ${category} category — ${cpcChange > 0 ? "competition intensifying" : "opportunity for cheaper traffic"}`,
          adoption: currentMetrics.sampleSize,
          impact: Math.min(100, Math.abs(Math.round(cpcChange))),
        });
      }
    }

    // Detect ad format shifts
    if (currentMetrics.topFormats.length > 0 && previousMetrics.topFormats.length > 0) {
      const currentTop = currentMetrics.topFormats[0];
      const previousTop = previousMetrics.topFormats[0];
      if (currentTop !== previousTop) {
        trends.push({
          trend: "ad_format_shift",
          description: `Top ad format in ${category} shifted from "${previousTop}" to "${currentTop}" — consider testing the new format`,
          adoption: currentMetrics.sampleSize,
          impact: 60,
        });
      }
    }

    // Detect sample size growth (more stores advertising)
    if (currentMetrics.sampleSize > 0 && previousMetrics.sampleSize > 0) {
      const growthRate = ((currentMetrics.sampleSize - previousMetrics.sampleSize) / previousMetrics.sampleSize) * 100;
      if (growthRate > 20) {
        trends.push({
          trend: "competition_growing",
          description: `${Math.round(growthRate)}% more advertisers in the ${category} category — increased competition expected`,
          adoption: currentMetrics.sampleSize,
          impact: Math.min(80, Math.round(growthRate)),
        });
      }
    }

    logger.info(
      "cross-store",
      `Detected ${trends.length} trends for category ${category}`,
    );

    return trends;
  } catch (error) {
    logger.error("cross-store", `Failed to detect cross-store trends for category ${category}: ${error}`);
    throw error;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface AggregatedMetrics {
  avgRoas: number;
  avgCtr: number;
  avgCpc: number;
  topFormats: string[];
  sampleSize: number;
}

/**
 * Aggregate metrics from a set of CrossStoreInsight records into averages.
 */
function aggregateInsightMetrics(
  insights: Array<{ metric: string; value: string; sampleSize: number }>,
): AggregatedMetrics {
  let roasSum = 0;
  let roasCount = 0;
  let ctrSum = 0;
  let ctrCount = 0;
  let cpcSum = 0;
  let cpcCount = 0;
  let totalSampleSize = 0;
  const formats: string[] = [];

  for (const insight of insights) {
    try {
      const parsed = JSON.parse(insight.value);
      totalSampleSize += insight.sampleSize;

      if (insight.metric === "avg_roas" && parsed.avgRoas) {
        roasSum += parsed.avgRoas;
        roasCount++;
      } else if (insight.metric === "avg_ctr" && parsed.avgCtr) {
        ctrSum += parsed.avgCtr;
        ctrCount++;
      } else if (insight.metric === "avg_cpc" && parsed.avgCpc) {
        cpcSum += parsed.avgCpc;
        cpcCount++;
      } else if (insight.metric === "top_ad_format" && parsed.topAdFormats) {
        formats.push(...parsed.topAdFormats);
      }
    } catch {
      // skip invalid JSON
    }
  }

  // Deduplicate and rank formats
  const formatFrequency = new Map<string, number>();
  for (const f of formats) {
    formatFrequency.set(f, (formatFrequency.get(f) || 0) + 1);
  }
  const topFormats = [...formatFrequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([format]) => format);

  return {
    avgRoas: roasCount > 0 ? Math.round((roasSum / roasCount) * 100) / 100 : 0,
    avgCtr: ctrCount > 0 ? Math.round((ctrSum / ctrCount) * 10000) / 10000 : 0,
    avgCpc: cpcCount > 0 ? Math.round((cpcSum / cpcCount) * 100) / 100 : 0,
    topFormats,
    sampleSize: totalSampleSize,
  };
}

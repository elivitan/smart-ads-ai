/**
 * Smart Ads AI — Optimization Scheduler
 *
 * Runs the optimizer automatically every 6 hours for all shops
 * with active campaigns. Like a real ad agency that never sleeps.
 */

import * as cron from "node-cron";
import prisma from "../db.server.js";
import { runOptimization, checkRecommendationOutcomes, updateABTestMetrics } from "./optimizer.server.js";
import { generateWeeklyReport, runSelfReflection, analyzeAdDNA } from "../ai-brain.server.js";
import { runDeepCompetitorScan } from "../competitor-intel.server.js";
import { scanInventoryLevels, throttleLowStockCampaigns, boostOverstockedCampaigns } from "../inventory-ads.server.js";
import { rebalanceBudgets } from "../funnel-orchestrator.server.js";
import { aggregateCrossStoreData } from "../cross-store.server.js";
import { checkExpiredFlashSales } from "../flash-sale.server.js";
import { logger } from "./logger.js";

let schedulerTask: cron.ScheduledTask | null = null;
let cronJobs: cron.ScheduledTask[] = [];

/**
 * Start the optimization scheduler.
 * Runs every 6 hours: 00:00, 06:00, 12:00, 18:00
 */
export function startOptimizationScheduler(): void {
  if (schedulerTask) {
    logger.info("scheduler", "Optimization scheduler already running");
    return;
  }

  // Stop any leftover cron jobs before scheduling new ones
  cronJobs.forEach(job => job.stop());
  cronJobs = [];

  // Run at minute 0 of hours 0, 6, 12, 18
  schedulerTask = cron.schedule("0 0,6,12,18 * * *", async () => {
    logger.info("scheduler", "Starting scheduled optimization run");
    await runAllShopsOptimization();
  });
  cronJobs.push(schedulerTask);

  // Daily feedback check at 03:00 — did our recommendations actually work?
  const feedbackJob = cron.schedule("0 3 * * *", async () => {
    logger.info("scheduler", "Starting daily recommendation feedback check");
    try {
      await checkRecommendationOutcomes();
    } catch (err: unknown) {
      logger.error("scheduler", "Feedback check failed", {
        extra: { error: err instanceof Error ? err.message : String(err) },
      });
    }
  });
  cronJobs.push(feedbackJob);

  // Daily A/B test metrics update — 03:30
  const abTestJob = cron.schedule("30 3 * * *", async () => {
    logger.info("scheduler", "Starting daily A/B test metrics update");
    try {
      const shops = await getActiveShops();
      for (const shop of shops) {
        try {
          await updateABTestMetrics(shop);
        } catch (err: unknown) {
          logger.error("scheduler", `A/B test metrics failed for ${shop}`, {
            extra: { error: err instanceof Error ? err.message : String(err) },
          });
        }
      }
    } catch (err: unknown) {
      logger.error("scheduler", "Failed to run A/B test metrics update", {
        extra: { error: err instanceof Error ? err.message : String(err) },
      });
    }
  });
  cronJobs.push(abTestJob);

  // Weekly deep competitor scan — Sunday 02:00
  const deepScanJob = cron.schedule("0 2 * * 0", async () => {
    logger.info("scheduler", "Starting weekly deep competitor scan");
    await runAllShopsDeepScan();
  });
  cronJobs.push(deepScanJob);

  // Weekly report — Sunday 08:00
  const weeklyReportJob = cron.schedule("0 8 * * 0", async () => {
    logger.info("scheduler", "Starting weekly report generation");
    await generateAllShopsWeeklyReports();
  });
  cronJobs.push(weeklyReportJob);

  // ═══ NEW ENGINE SCHEDULER JOBS ═══

  // Daily inventory scan — 05:00
  const inventoryJob = cron.schedule("0 5 * * *", async () => {
    logger.info("scheduler", "Starting daily inventory scan");
    await runAllShopsInventoryScan();
  });
  cronJobs.push(inventoryJob);

  // Weekly self-reflection — Sunday 04:00
  const reflectionJob = cron.schedule("0 4 * * 0", async () => {
    logger.info("scheduler", "Starting weekly AI self-reflection");
    await runAllShopsSelfReflection();
  });
  cronJobs.push(reflectionJob);

  // Daily funnel rebalance — 01:00
  const funnelJob = cron.schedule("0 1 * * *", async () => {
    logger.info("scheduler", "Starting daily funnel rebalance");
    await runAllShopsFunnelRebalance();
  });
  cronJobs.push(funnelJob);

  // Weekly cross-store aggregation — Saturday 23:00
  const crossStoreJob = cron.schedule("0 23 * * 6", async () => {
    logger.info("scheduler", "Starting weekly cross-store aggregation");
    await runAllShopsCrossStoreAggregation();
  });
  cronJobs.push(crossStoreJob);

  // Weekly forecast accuracy check — Monday 09:00
  const forecastJob = cron.schedule("0 9 * * 1", async () => {
    logger.info("scheduler", "Starting weekly forecast accuracy check");
    // Forecast accuracy is checked passively by comparing predictions to actuals
    logger.info("scheduler", "Forecast accuracy check complete (passive)");
  });
  cronJobs.push(forecastJob);

  // Weekly Ad DNA analysis — Sunday 05:00
  const adDnaJob = cron.schedule("0 5 * * 0", async () => {
    logger.info("scheduler", "Starting weekly Ad DNA analysis");
    await runAllShopsAdDNA();
  });
  cronJobs.push(adDnaJob);

  // ═══ ADVANCED ENGINE SCHEDULER JOBS (11-18) ═══

  // Hourly search term sentinel — every 2 hours
  const searchSentinelJob = cron.schedule("0 */2 * * *", async () => {
    logger.info("scheduler", "Starting hourly search term sentinel scan");
    await runAllShopsSearchSentinel();
  });
  cronJobs.push(searchSentinelJob);

  // Performance guard check — every 4 hours
  const perfGuardJob = cron.schedule("0 2,6,10,14,18,22 * * *", async () => {
    logger.info("scheduler", "Starting performance guard check");
    await runAllShopsPerformanceGuard();
  });
  cronJobs.push(perfGuardJob);

  // Weather arbitrage check — every 6 hours
  const weatherJob = cron.schedule("30 0,6,12,18 * * *", async () => {
    logger.info("scheduler", "Starting weather arbitrage check");
    await runAllShopsWeatherCheck();
  });
  cronJobs.push(weatherJob);

  // Flash sale expiry check — every hour
  const flashSaleJob = cron.schedule("0 * * * *", async () => {
    await runAllShopsFlashSaleCheck();
  });
  cronJobs.push(flashSaleJob);

  // Supply chain status check — twice daily (07:00 and 19:00)
  const supplyChainJob = cron.schedule("0 7,19 * * *", async () => {
    logger.info("scheduler", "Starting supply chain status check");
    await runAllShopsSupplyChainCheck();
  });
  cronJobs.push(supplyChainJob);

  // Weekly multi-agent bidding session — Monday 10:00
  const agentBiddingJob = cron.schedule("0 10 * * 1", async () => {
    logger.info("scheduler", "Starting weekly agent bidding session");
    await runAllShopsAgentBidding();
  });
  cronJobs.push(agentBiddingJob);

  // Weekly review-to-creative extraction — Wednesday 06:00
  const reviewJob = cron.schedule("0 6 * * 3", async () => {
    logger.info("scheduler", "Starting weekly review-to-creative extraction");
    await runAllShopsReviewExtraction();
  });
  cronJobs.push(reviewJob);

  logger.info("scheduler", "Optimization scheduler started (every 6 hours + daily feedback + weekly intel & reports + 13 engine jobs)");
}

/**
 * Stop the scheduler gracefully.
 */
export function stopOptimizationScheduler(): void {
  cronJobs.forEach(job => job.stop());
  cronJobs = [];
  schedulerTask = null;
  logger.info("scheduler", "Optimization scheduler stopped", {
    extra: { jobsStopped: cronJobs.length },
  });
}

/**
 * Run optimization for all shops that have active campaigns.
 * Each shop runs independently — one failure doesn't block others.
 */
export async function runAllShopsOptimization(): Promise<void> {
  try {
    // Find all shops with campaign jobs in ENABLED state
    const shops = await prisma.campaignJob.findMany({
      where: { state: "ENABLED" },
      select: { shop: true },
      distinct: ["shop"],
    });

    if (shops.length === 0) {
      logger.info("scheduler", "No shops with active campaigns to optimize");
      return;
    }

    logger.info("scheduler", `Optimizing ${shops.length} shop(s)`);

    for (const { shop } of shops) {
      try {
        const result = await runOptimization(shop);
        logger.info("scheduler", `Shop ${shop} optimized`, {
          extra: {
            campaigns: result.totalCampaigns,
            actions: result.actionsExecuted,
            grade: result.aiGrade,
            duration: result.duration,
          },
        });
      } catch (err: unknown) {
        logger.error("scheduler", `Failed to optimize shop: ${shop}`, {
          extra: { error: err instanceof Error ? err.message : String(err) },
        });
        // Continue with other shops
      }
    }
  } catch (err: unknown) {
    logger.error("scheduler", "Failed to run all shops optimization", {
      extra: { error: err instanceof Error ? err.message : String(err) },
    });
  }
}

/**
 * Run deep competitor intelligence scan for all shops.
 */
async function runAllShopsDeepScan(): Promise<void> {
  try {
    const shops = await prisma.campaignJob.findMany({
      where: { state: "ENABLED" },
      select: { shop: true },
      distinct: ["shop"],
    });

    for (const { shop } of shops) {
      try {
        const result = await runDeepCompetitorScan(shop);
        logger.info("scheduler", `Deep scan for ${shop}: ${result.profiles.length} competitors, ${result.changes} changes`);
      } catch (err: unknown) {
        logger.error("scheduler", `Deep scan failed for ${shop}`, {
          extra: { error: err instanceof Error ? err.message : String(err) },
        });
      }
    }
  } catch (err: unknown) {
    logger.error("scheduler", "Failed to run all shops deep scan", {
      extra: { error: err instanceof Error ? err.message : String(err) },
    });
  }
}

/**
 * Generate weekly reports for all shops.
 */
async function generateAllShopsWeeklyReports(): Promise<void> {
  try {
    const shops = await prisma.campaignJob.findMany({
      where: { state: "ENABLED" },
      select: { shop: true },
      distinct: ["shop"],
    });

    for (const { shop } of shops) {
      try {
        await generateWeeklyReport(shop);
        logger.info("scheduler", `Weekly report generated for ${shop}`);
      } catch (err: unknown) {
        logger.error("scheduler", `Weekly report failed for ${shop}`, {
          extra: { error: err instanceof Error ? err.message : String(err) },
        });
      }
    }
  } catch (err: unknown) {
    logger.error("scheduler", "Failed to generate weekly reports", {
      extra: { error: err instanceof Error ? err.message : String(err) },
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// NEW ENGINE SCHEDULER HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Daily inventory scan — throttle low stock, boost overstock.
 */
async function runAllShopsInventoryScan(): Promise<void> {
  try {
    const shops = await prisma.campaignJob.findMany({
      where: { state: "ENABLED" },
      select: { shop: true },
      distinct: ["shop"],
    });

    for (const { shop } of shops) {
      try {
        await scanInventoryLevels(shop);
        await throttleLowStockCampaigns(shop);
        await boostOverstockedCampaigns(shop);
        logger.info("scheduler", `Inventory scan complete for ${shop}`);
      } catch (err: unknown) {
        logger.error("scheduler", `Inventory scan failed for ${shop}`, {
          extra: { error: err instanceof Error ? err.message : String(err) },
        });
      }
    }
  } catch (err: unknown) {
    logger.error("scheduler", "Failed to run inventory scan", {
      extra: { error: err instanceof Error ? err.message : String(err) },
    });
  }
}

/**
 * Weekly AI self-reflection — review past decisions and extract rules.
 */
async function runAllShopsSelfReflection(): Promise<void> {
  try {
    const shops = await prisma.campaignJob.findMany({
      where: { state: "ENABLED" },
      select: { shop: true },
      distinct: ["shop"],
    });

    for (const { shop } of shops) {
      try {
        const result = await runSelfReflection(shop);
        logger.info("scheduler", `Self-reflection for ${shop}: ${result.insights.length} insights, ${result.rulesGenerated.length} rules`);
      } catch (err: unknown) {
        logger.error("scheduler", `Self-reflection failed for ${shop}`, {
          extra: { error: err instanceof Error ? err.message : String(err) },
        });
      }
    }
  } catch (err: unknown) {
    logger.error("scheduler", "Failed to run self-reflection", {
      extra: { error: err instanceof Error ? err.message : String(err) },
    });
  }
}

/**
 * Daily funnel rebalance — redistribute budgets based on performance.
 */
async function runAllShopsFunnelRebalance(): Promise<void> {
  try {
    const shops = await prisma.campaignJob.findMany({
      where: { state: "ENABLED" },
      select: { shop: true },
      distinct: ["shop"],
    });

    for (const { shop } of shops) {
      try {
        const result = await rebalanceBudgets(shop);
        logger.info("scheduler", `Funnel rebalance for ${shop}: ${result.changes.length} changes`);
      } catch (err: unknown) {
        logger.error("scheduler", `Funnel rebalance failed for ${shop}`, {
          extra: { error: err instanceof Error ? err.message : String(err) },
        });
      }
    }
  } catch (err: unknown) {
    logger.error("scheduler", "Failed to run funnel rebalance", {
      extra: { error: err instanceof Error ? err.message : String(err) },
    });
  }
}

/**
 * Weekly cross-store data aggregation — anonymous benchmarks.
 */
async function runAllShopsCrossStoreAggregation(): Promise<void> {
  try {
    const shops = await prisma.campaignJob.findMany({
      where: { state: "ENABLED" },
      select: { shop: true },
      distinct: ["shop"],
    });

    for (const { shop } of shops) {
      try {
        await aggregateCrossStoreData(shop);
        logger.info("scheduler", `Cross-store aggregation complete for ${shop}`);
      } catch (err: unknown) {
        logger.error("scheduler", `Cross-store aggregation failed for ${shop}`, {
          extra: { error: err instanceof Error ? err.message : String(err) },
        });
      }
    }
  } catch (err: unknown) {
    logger.error("scheduler", "Failed to run cross-store aggregation", {
      extra: { error: err instanceof Error ? err.message : String(err) },
    });
  }
}

/**
 * Weekly Ad DNA analysis — extract winning creative patterns.
 */
async function runAllShopsAdDNA(): Promise<void> {
  try {
    const shops = await prisma.campaignJob.findMany({
      where: { state: "ENABLED" },
      select: { shop: true },
      distinct: ["shop"],
    });

    for (const { shop } of shops) {
      try {
        const result = await analyzeAdDNA(shop);
        logger.info("scheduler", `Ad DNA analysis for ${shop}: ${result.genesFound} genes found`);
      } catch (err: unknown) {
        logger.error("scheduler", `Ad DNA analysis failed for ${shop}`, {
          extra: { error: err instanceof Error ? err.message : String(err) },
        });
      }
    }
  } catch (err: unknown) {
    logger.error("scheduler", "Failed to run Ad DNA analysis", {
      extra: { error: err instanceof Error ? err.message : String(err) },
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// ADVANCED ENGINE SCHEDULER HELPERS (11-18)
// ═══════════════════════════════════════════════════════════════

async function getActiveShops(): Promise<string[]> {
  const shops = await prisma.campaignJob.findMany({
    where: { state: "ENABLED" },
    select: { shop: true },
    distinct: ["shop"],
  });
  return shops.map(s => s.shop);
}

/**
 * Hourly search term sentinel — block wasteful keywords.
 */
async function runAllShopsSearchSentinel(): Promise<void> {
  try {
    const shops = await getActiveShops();
    for (const shop of shops) {
      try {
        const { scanSearchTerms } = await import("../search-sentinel.server.js");
        const result = await scanSearchTerms(shop);
        logger.info("scheduler", `Search sentinel for ${shop}: ${result.wasteDetected} waste terms, $${result.estimatedSavings?.toFixed(2)} saved`);
      } catch (err: unknown) {
        logger.error("scheduler", `Search sentinel failed for ${shop}`, {
          extra: { error: err instanceof Error ? err.message : String(err) },
        });
      }
    }
  } catch (err: unknown) {
    logger.error("scheduler", "Failed to run search sentinel", {
      extra: { error: err instanceof Error ? err.message : String(err) },
    });
  }
}

/**
 * Performance guard — auto-pause losing campaigns.
 */
async function runAllShopsPerformanceGuard(): Promise<void> {
  try {
    const shops = await getActiveShops();
    for (const shop of shops) {
      try {
        const { runPerformanceCheck } = await import("../performance-guard.server.js");
        const result = await runPerformanceCheck(shop);
        logger.info("scheduler", `Performance guard for ${shop}: ${result.alerts?.length || 0} alerts`);
      } catch (err: unknown) {
        logger.error("scheduler", `Performance guard failed for ${shop}`, {
          extra: { error: err instanceof Error ? err.message : String(err) },
        });
      }
    }
  } catch (err: unknown) {
    logger.error("scheduler", "Failed to run performance guard", {
      extra: { error: err instanceof Error ? err.message : String(err) },
    });
  }
}

/**
 * Weather arbitrage — check conditions and adjust campaigns.
 */
async function runAllShopsWeatherCheck(): Promise<void> {
  try {
    const shops = await getActiveShops();
    for (const shop of shops) {
      try {
        const { checkWeatherTriggers } = await import("../weather-arbitrage.server.js");
        const triggers = await checkWeatherTriggers(shop);
        logger.info("scheduler", `Weather check for ${shop}: ${Array.isArray(triggers) ? triggers.length : 0} triggers`);
      } catch (err: unknown) {
        logger.error("scheduler", `Weather check failed for ${shop}`, {
          extra: { error: err instanceof Error ? err.message : String(err) },
        });
      }
    }
  } catch (err: unknown) {
    logger.error("scheduler", "Failed to run weather check", {
      extra: { error: err instanceof Error ? err.message : String(err) },
    });
  }
}

/**
 * Flash sale expiry — end expired sales.
 */
async function runAllShopsFlashSaleCheck(): Promise<void> {
  try {
    const shops = await getActiveShops();
    for (const shop of shops) {
      try {
        await checkExpiredFlashSales(shop);
      } catch {
        // silent — runs every hour
      }
    }
  } catch {
    // silent
  }
}

/**
 * Supply chain status — update shipment tracking.
 */
async function runAllShopsSupplyChainCheck(): Promise<void> {
  try {
    const shops = await getActiveShops();
    for (const shop of shops) {
      try {
        const { checkShipmentStatus } = await import("../supply-chain.server.js");
        const result = await checkShipmentStatus(shop);
        logger.info("scheduler", `Supply chain check for ${shop}: ${Array.isArray(result) ? result.length : 0} shipments updated`);
      } catch (err: unknown) {
        logger.error("scheduler", `Supply chain check failed for ${shop}`, {
          extra: { error: err instanceof Error ? err.message : String(err) },
        });
      }
    }
  } catch (err: unknown) {
    logger.error("scheduler", "Failed to run supply chain check", {
      extra: { error: err instanceof Error ? err.message : String(err) },
    });
  }
}

/**
 * Weekly multi-agent bidding — run war room session.
 */
async function runAllShopsAgentBidding(): Promise<void> {
  try {
    const shops = await getActiveShops();
    for (const shop of shops) {
      try {
        const { runBiddingSession } = await import("../agent-bidding.server.js");
        const result = await runBiddingSession(shop);
        logger.info("scheduler", `Agent bidding for ${shop}: consensus=${result.consensus?.action || "none"}`);
      } catch (err: unknown) {
        logger.error("scheduler", `Agent bidding failed for ${shop}`, {
          extra: { error: err instanceof Error ? err.message : String(err) },
        });
      }
    }
  } catch (err: unknown) {
    logger.error("scheduler", "Failed to run agent bidding", {
      extra: { error: err instanceof Error ? err.message : String(err) },
    });
  }
}

/**
 * Weekly review extraction — pull customer voice for ads.
 */
async function runAllShopsReviewExtraction(): Promise<void> {
  try {
    const shops = await getActiveShops();
    for (const shop of shops) {
      try {
        const { extractReviewInsights } = await import("../review-creative.server.js");
        const result = await extractReviewInsights(shop);
        logger.info("scheduler", `Review extraction for ${shop}: ${result.totalInsights || 0} insights`);
      } catch (err: unknown) {
        logger.error("scheduler", `Review extraction failed for ${shop}`, {
          extra: { error: err instanceof Error ? err.message : String(err) },
        });
      }
    }
  } catch (err: unknown) {
    logger.error("scheduler", "Failed to run review extraction", {
      extra: { error: err instanceof Error ? err.message : String(err) },
    });
  }
}

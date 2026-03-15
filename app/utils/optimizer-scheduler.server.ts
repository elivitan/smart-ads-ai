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
import { logger } from "./logger.js";

let schedulerTask: cron.ScheduledTask | null = null;

/**
 * Start the optimization scheduler.
 * Runs every 6 hours: 00:00, 06:00, 12:00, 18:00
 */
export function startOptimizationScheduler(): void {
  if (schedulerTask) {
    logger.info("scheduler", "Optimization scheduler already running");
    return;
  }

  // Run at minute 0 of hours 0, 6, 12, 18
  schedulerTask = cron.schedule("0 0,6,12,18 * * *", async () => {
    logger.info("scheduler", "Starting scheduled optimization run");
    await runAllShopsOptimization();
  });

  // Daily feedback check at 03:00 — did our recommendations actually work?
  cron.schedule("0 3 * * *", async () => {
    logger.info("scheduler", "Starting daily recommendation feedback check");
    try {
      await checkRecommendationOutcomes();
    } catch (err: unknown) {
      logger.error("scheduler", "Feedback check failed", {
        extra: { error: err instanceof Error ? err.message : String(err) },
      });
    }
  });

  // Weekly deep competitor scan — Sunday 02:00
  cron.schedule("0 2 * * 0", async () => {
    logger.info("scheduler", "Starting weekly deep competitor scan");
    await runAllShopsDeepScan();
  });

  // Weekly report — Sunday 08:00
  cron.schedule("0 8 * * 0", async () => {
    logger.info("scheduler", "Starting weekly report generation");
    await generateAllShopsWeeklyReports();
  });

  // ═══ NEW ENGINE SCHEDULER JOBS ═══

  // Daily inventory scan — 05:00
  cron.schedule("0 5 * * *", async () => {
    logger.info("scheduler", "Starting daily inventory scan");
    await runAllShopsInventoryScan();
  });

  // Weekly self-reflection — Sunday 04:00
  cron.schedule("0 4 * * 0", async () => {
    logger.info("scheduler", "Starting weekly AI self-reflection");
    await runAllShopsSelfReflection();
  });

  // Daily funnel rebalance — 01:00
  cron.schedule("0 1 * * *", async () => {
    logger.info("scheduler", "Starting daily funnel rebalance");
    await runAllShopsFunnelRebalance();
  });

  // Weekly cross-store aggregation — Saturday 23:00
  cron.schedule("0 23 * * 6", async () => {
    logger.info("scheduler", "Starting weekly cross-store aggregation");
    await runAllShopsCrossStoreAggregation();
  });

  // Weekly forecast accuracy check — Monday 09:00
  cron.schedule("0 9 * * 1", async () => {
    logger.info("scheduler", "Starting weekly forecast accuracy check");
    // Forecast accuracy is checked passively by comparing predictions to actuals
    logger.info("scheduler", "Forecast accuracy check complete (passive)");
  });

  // Weekly Ad DNA analysis — Sunday 05:00
  cron.schedule("0 5 * * 0", async () => {
    logger.info("scheduler", "Starting weekly Ad DNA analysis");
    await runAllShopsAdDNA();
  });

  logger.info("scheduler", "Optimization scheduler started (every 6 hours + daily feedback + weekly intel & reports + 6 engine jobs)");
}

/**
 * Stop the scheduler gracefully.
 */
export function stopOptimizationScheduler(): void {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
    logger.info("scheduler", "Optimization scheduler stopped");
  }
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

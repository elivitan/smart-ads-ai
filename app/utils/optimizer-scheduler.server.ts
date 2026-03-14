/**
 * Smart Ads AI — Optimization Scheduler
 *
 * Runs the optimizer automatically every 6 hours for all shops
 * with active campaigns. Like a real ad agency that never sleeps.
 */

import * as cron from "node-cron";
import prisma from "../db.server.js";
import { runOptimization, checkRecommendationOutcomes } from "./optimizer.server.js";
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

  logger.info("scheduler", "Optimization scheduler started (every 6 hours + daily feedback)");
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

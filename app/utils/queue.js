// queue.js — Job queue for background processing at scale
// Phase 3: Move scans, AI analysis, and campaigns to background jobs
// Install: npm install bullmq
//
// USAGE:
//   import { scanQueue, addScanJob } from "../utils/queue.js";
//   await addScanJob({ shop: "store.myshopify.com", products: [...] });
//
// WORKER (separate process):
//   import { scanQueue } from "../utils/queue.js";
//   scanQueue.process(async (job) => { ... });

import { logger } from "./logger.js";

let Queue = null;
let Worker = null;

try {
  const bullmq = require("bullmq");
  Queue = bullmq.Queue;
  Worker = bullmq.Worker;
} catch (e) {
  logger.warn("[Queue] bullmq not installed — jobs run synchronously. Run: npm install bullmq");
}

const REDIS_CONN = { host: process.env.REDIS_HOST || "localhost", port: process.env.REDIS_PORT || 6379 };

// Queue definitions
export const QUEUES = {
  SCAN: "smart-ads-scan",
  AI_ANALYSIS: "smart-ads-ai",
  CAMPAIGN: "smart-ads-campaign",
};

// Create queue (lazy — only if bullmq available)
function createQueue(name) {
  if (!Queue) return null;
  return new Queue(name, {
    connection: REDIS_CONN,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 24 * 3600 },
    },
  });
}

export const scanQueue = createQueue(QUEUES.SCAN);
export const aiQueue = createQueue(QUEUES.AI_ANALYSIS);
export const campaignQueue = createQueue(QUEUES.CAMPAIGN);

// Helper to add jobs (falls back to sync execution if no queue)
export async function addScanJob(data) {
  if (scanQueue) {
    const job = await scanQueue.add("scan", data, { priority: data.priority || 5 });
    logger.info("[Queue] Scan job added:", job.id);
    return { queued: true, jobId: job.id };
  }
  // Fallback: return null so caller knows to run synchronously
  return { queued: false };
}

export async function addCampaignJob(data) {
  if (campaignQueue) {
    const job = await campaignQueue.add("campaign", data, { priority: data.priority || 5 });
    logger.info("[Queue] Campaign job added:", job.id);
    return { queued: true, jobId: job.id };
  }
  return { queued: false };
}

// Status check for health endpoint
export async function getQueueHealth() {
  const result = {};
  for (const [name, queue] of Object.entries({ scan: scanQueue, ai: aiQueue, campaign: campaignQueue })) {
    if (!queue) { result[name] = "not_available"; continue; }
    try {
      const counts = await queue.getJobCounts();
      result[name] = { status: "ok", ...counts };
    } catch (e) { result[name] = { status: "error", message: e.message }; }
  }
  return result;
}

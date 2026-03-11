// queue.ts — Job queue for background processing at scale
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

// Types for BullMQ (avoids hard dependency on @types/bullmq)
interface BullMQJob {
  id: string;
  name: string;
  data: unknown;
}

interface BullMQQueue {
  add(name: string, data: unknown, opts?: Record<string, unknown>): Promise<BullMQJob>;
  getJobCounts(): Promise<Record<string, number>>;
}

interface BullMQConstructor {
  new (name: string, opts: Record<string, unknown>): BullMQQueue;
}

interface JobResult {
  queued: boolean;
  jobId?: string;
}

interface QueueHealthEntry {
  status: "ok" | "error" | "not_available";
  message?: string;
  [key: string]: unknown;
}

interface ScanJobData {
  shop: string;
  products?: unknown[];
  priority?: number;
}

interface CampaignJobData {
  shop: string;
  campaignConfig?: unknown;
  priority?: number;
}

let QueueClass: BullMQConstructor | null = null;

try {
  const bullmq = require("bullmq");
  QueueClass = bullmq.Queue as BullMQConstructor;
} catch (e) {
  logger.warn("[Queue]", "bullmq not installed — jobs run synchronously. Run: npm install bullmq");
}

const REDIS_CONN: { host: string; port: number } = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
};

// Queue name constants
export const QUEUES = {
  SCAN: "smart-ads-scan",
  AI_ANALYSIS: "smart-ads-ai",
  CAMPAIGN: "smart-ads-campaign",
} as const;

export type QueueName = typeof QUEUES[keyof typeof QUEUES];

// Create queue (lazy — only if bullmq available)
function createQueue(name: string): BullMQQueue | null {
  if (!QueueClass) return null;
  return new QueueClass(name, {
    connection: REDIS_CONN,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 24 * 3600 },
    },
  });
}

export const scanQueue: BullMQQueue | null = createQueue(QUEUES.SCAN);
export const aiQueue: BullMQQueue | null = createQueue(QUEUES.AI_ANALYSIS);
export const campaignQueue: BullMQQueue | null = createQueue(QUEUES.CAMPAIGN);

// Helper to add jobs (falls back to sync execution if no queue)
export async function addScanJob(data: ScanJobData): Promise<JobResult> {
  if (scanQueue) {
    const job = await scanQueue.add("scan", data, { priority: data.priority || 5 });
    logger.info("[Queue]", `Scan job added: ${job.id}`);
    return { queued: true, jobId: job.id };
  }
  // Fallback: return null so caller knows to run synchronously
  return { queued: false };
}

export async function addCampaignJob(data: CampaignJobData): Promise<JobResult> {
  if (campaignQueue) {
    const job = await campaignQueue.add("campaign", data, { priority: data.priority || 5 });
    logger.info("[Queue]", `Campaign job added: ${job.id}`);
    return { queued: true, jobId: job.id };
  }
  return { queued: false };
}

// Status check for health endpoint
export async function getQueueHealth(): Promise<Record<string, QueueHealthEntry>> {
  const result: Record<string, QueueHealthEntry> = {};
  const queues: Record<string, BullMQQueue | null> = { scan: scanQueue, ai: aiQueue, campaign: campaignQueue };

  for (const [name, queue] of Object.entries(queues)) {
    if (!queue) {
      result[name] = { status: "not_available" };
      continue;
    }
    try {
      const counts = await queue.getJobCounts();
      result[name] = { status: "ok", ...counts };
    } catch (e) {
      result[name] = { status: "error", message: (e as Error).message };
    }
  }
  return result;
}

// queue.ts — BullMQ job queue for background processing
// Scans and campaign creation run as background jobs.
// Worker runs in-process (entry.server) for simplicity.
// When load increases, move Worker to separate process.

import { logger } from "./logger.js";

// ── Types ──
interface BullMQJob {
  id: string;
  name: string;
  data: unknown;
  returnvalue?: unknown;
  failedReason?: string;
  progress: number | object;
  getState(): Promise<string>;
}

interface BullMQQueue {
  add(name: string, data: unknown, opts?: Record<string, unknown>): Promise<BullMQJob>;
  getJob(id: string): Promise<BullMQJob | null>;
  getJobCounts(): Promise<Record<string, number>>;
}

interface BullMQWorker {
  on(event: string, listener: (...args: unknown[]) => void): this;
  close(): Promise<void>;
}

interface BullMQConstructor {
  new (name: string, opts: Record<string, unknown>): BullMQQueue;
}

interface BullMQWorkerConstructor {
  new (name: string, processor: (job: BullMQJob) => Promise<unknown>, opts: Record<string, unknown>): BullMQWorker;
}

export interface JobResult {
  queued: boolean;
  jobId?: string;
}

export interface JobStatus {
  id: string;
  state: string;
  progress: number | object;
  result?: unknown;
  error?: string;
}

interface QueueHealthEntry {
  status: "ok" | "error" | "not_available";
  message?: string;
  [key: string]: unknown;
}

export interface ScanJobData {
  shop: string;
  products: unknown[];
  storeDomain: string;
}

export interface CampaignJobData {
  shop: string;
  productTitle: string;
  headlines: string[];
  descriptions: string[];
  keywords?: string[];
  finalUrl: string;
  dailyBudget: number;
  campaignType: string;
  bidding: string;
}

// ── Redis connection config ──
function getRedisConnection(): Record<string, unknown> {
  const url = process.env.REDIS_URL;
  if (url) {
    // Upstash uses rediss:// (TLS)
    const IORedis = require("ioredis");
    return new IORedis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      tls: url.startsWith("rediss://") ? {} : undefined,
    });
  }
  // Fallback to local Redis
  return {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
  };
}

// ── Queue setup ──
let QueueClass: BullMQConstructor | null = null;
let WorkerClass: BullMQWorkerConstructor | null = null;

try {
  const bullmq = require("bullmq");
  QueueClass = bullmq.Queue as BullMQConstructor;
  WorkerClass = bullmq.Worker as BullMQWorkerConstructor;
} catch (e) {
  logger.warn("[Queue]", "bullmq not installed — jobs run synchronously");
}

export const QUEUES = {
  SCAN: "smart-ads-scan",
  CAMPAIGN: "smart-ads-campaign",
} as const;

export type QueueName = typeof QUEUES[keyof typeof QUEUES];

function createQueue(name: string): BullMQQueue | null {
  if (!QueueClass) return null;
  try {
    return new QueueClass(name, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 24 * 3600 },
      },
    });
  } catch (err) {
    logger.error("[Queue]", `Failed to create queue ${name}: ${(err as Error).message}`);
    return null;
  }
}

export const scanQueue: BullMQQueue | null = createQueue(QUEUES.SCAN);
export const campaignQueue: BullMQQueue | null = createQueue(QUEUES.CAMPAIGN);

// ── Add job helpers ──
export async function addScanJob(data: ScanJobData): Promise<JobResult> {
  if (!scanQueue || process.env.USE_QUEUES !== "true") {
    return { queued: false };
  }
  try {
    const job = await scanQueue.add("scan", data, { priority: 5 });
    logger.info("[Queue]", `Scan job added: ${job.id}`);
    return { queued: true, jobId: job.id };
  } catch (err) {
    logger.error("[Queue]", `Failed to add scan job: ${(err as Error).message}`);
    return { queued: false };
  }
}

export async function addCampaignJob(data: CampaignJobData): Promise<JobResult> {
  if (!campaignQueue || process.env.USE_QUEUES !== "true") {
    return { queued: false };
  }
  try {
    const job = await campaignQueue.add("campaign", data, { priority: 5 });
    logger.info("[Queue]", `Campaign job added: ${job.id}`);
    return { queued: true, jobId: job.id };
  } catch (err) {
    logger.error("[Queue]", `Failed to add campaign job: ${(err as Error).message}`);
    return { queued: false };
  }
}

// ── Get job status ──
export async function getJobStatus(queueName: string, jobId: string): Promise<JobStatus | null> {
  const queue = queueName === QUEUES.SCAN ? scanQueue : campaignQueue;
  if (!queue) return null;
  try {
    const job = await queue.getJob(jobId);
    if (!job) return null;
    const state = await job.getState();
    return {
      id: job.id,
      state,
      progress: job.progress,
      result: state === "completed" ? job.returnvalue : undefined,
      error: state === "failed" ? job.failedReason : undefined,
    };
  } catch (err) {
    logger.error("[Queue]", `Failed to get job status: ${(err as Error).message}`);
    return null;
  }
}

// ── Start workers (called from entry.server) ──
export function startWorkers(): void {
  if (!WorkerClass || process.env.USE_QUEUES !== "true") {
    logger.info("[Queue]", "Workers not started (USE_QUEUES !== true or bullmq not available)");
    return;
  }

  const connection = getRedisConnection();

  // Scan Worker
  const scanWorker = new WorkerClass(
    QUEUES.SCAN,
    async (job: BullMQJob) => {
      const { shop, products, storeDomain } = job.data as ScanJobData;
      logger.info("[Worker:Scan]", `Processing scan for ${shop} (${(products as unknown[]).length} products)`);
      const { analyzeBatch } = require("../ai.server");
      const result = await analyzeBatch(products, storeDomain);
      logger.info("[Worker:Scan]", `Scan complete for ${shop}`);
      return result;
    },
    { connection, concurrency: 2 }
  );

  scanWorker.on("completed", (job: BullMQJob) => {
    logger.info("[Worker:Scan]", `Job ${job.id} completed`);
  });
  scanWorker.on("failed", (job: BullMQJob, err: Error) => {
    logger.error("[Worker:Scan]", `Job ${job?.id} failed: ${err.message}`);
  });

  // Campaign Worker
  const campaignWorker = new WorkerClass(
    QUEUES.CAMPAIGN,
    async (job: BullMQJob) => {
      const data = job.data as CampaignJobData;
      logger.info("[Worker:Campaign]", `Processing campaign for ${data.shop}`);
      const { launchCampaign } = require("../campaignLifecycle.server.js");
      const result = await launchCampaign(data.shop, {
        productTitle: data.productTitle,
        headlines: data.headlines,
        descriptions: data.descriptions,
        keywords: data.keywords,
        finalUrl: data.finalUrl,
        budgetAmount: String(data.dailyBudget),
        campaignType: data.campaignType,
        bidding: data.bidding,
      });
      logger.info("[Worker:Campaign]", `Campaign done for ${data.shop}: ${result.success}`);
      return result;
    },
    { connection, concurrency: 1 }
  );

  campaignWorker.on("completed", (job: BullMQJob) => {
    logger.info("[Worker:Campaign]", `Job ${job.id} completed`);
  });
  campaignWorker.on("failed", (job: BullMQJob, err: Error) => {
    logger.error("[Worker:Campaign]", `Job ${job?.id} failed: ${err.message}`);
  });

  logger.info("[Queue]", "Workers started (scan: concurrency=2, campaign: concurrency=1)");
}

// ── Queue health for health endpoint ──
export async function getQueueHealth(): Promise<Record<string, QueueHealthEntry>> {
  const result: Record<string, QueueHealthEntry> = {};
  const queues: Record<string, BullMQQueue | null> = { scan: scanQueue, campaign: campaignQueue };

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

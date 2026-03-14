// dead-letter.server.ts — Dead letter queue for failed jobs
// Jobs that fail all retries are stored for manual review / replay.

import { logger } from "./logger.js";
import { captureApiError } from "./sentry.server.js";
import { cache } from "./redis.js";

interface DeadLetterEntry {
  jobId: string;
  queue: string;
  data: unknown;
  error: string;
  failedAt: string;
  attempts: number;
}

const DLQ_KEY = "dlq:entries";
const DLQ_MAX_ENTRIES = 100;

// In-memory fallback when Redis is unavailable
const memoryDlq: DeadLetterEntry[] = [];

/**
 * Add a failed job to the dead letter queue.
 */
export async function addToDeadLetter(
  jobId: string,
  queue: string,
  data: unknown,
  error: string,
  attempts: number = 3
): Promise<void> {
  const entry: DeadLetterEntry = {
    jobId,
    queue,
    data,
    error,
    failedAt: new Date().toISOString(),
    attempts,
  };

  // Alert Sentry
  captureApiError(new Error(`Dead letter: ${queue}/${jobId} — ${error}`), {
    route: "dead-letter-queue",
    action: "job-failed-permanently",
  });

  // Try Redis first
  const existing = await cache.get<DeadLetterEntry[]>(DLQ_KEY);
  if (existing !== null) {
    const entries = [...existing, entry].slice(-DLQ_MAX_ENTRIES);
    await cache.set(DLQ_KEY, entries, 30 * 24 * 3600); // 30 days
  } else {
    // In-memory fallback
    memoryDlq.push(entry);
    if (memoryDlq.length > DLQ_MAX_ENTRIES) memoryDlq.shift();
  }

  logger.error("[DLQ]", `Job ${queue}/${jobId} moved to dead letter: ${error}`);
}

/**
 * Get all dead letter entries (for admin/debug).
 */
export async function getDeadLetterEntries(): Promise<DeadLetterEntry[]> {
  const redisEntries = await cache.get<DeadLetterEntry[]>(DLQ_KEY);
  return redisEntries || memoryDlq;
}

/**
 * Clear the dead letter queue.
 */
export async function clearDeadLetterQueue(): Promise<void> {
  await cache.del(DLQ_KEY);
  memoryDlq.length = 0;
  logger.info("[DLQ]", "Dead letter queue cleared");
}

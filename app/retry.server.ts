/**
 * retry.server.ts
 * Simple retry wrapper for external API calls (Claude, SerpAPI, Google Ads).
 * Handles 429 (rate limit), 500/502/503 (server errors), and network failures.
 */

interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryableStatuses?: number[];
  label?: string;
}

interface RetryDefaults {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableStatuses: number[];
}

const RETRY_DEFAULTS: RetryDefaults = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  retryableStatuses: [429, 500, 502, 503, 504],
};

/**
 * Execute an async function with automatic retries.
 *
 * Usage:
 *   import { withRetry } from "./retry.server";
 *   const result = await withRetry(() => client.messages.create({...}), { label: "Claude" });
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const { maxRetries, baseDelayMs, maxDelayMs, retryableStatuses } = {
    ...RETRY_DEFAULTS,
    ...opts,
  };
  const label = opts.label || "API";

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;

      // Check if this error is retryable
      const status = (err as Record<string, unknown>)?.status ??
        (err as Record<string, unknown>)?.statusCode ??
        ((err as Record<string, Record<string, unknown>>)?.error)?.status;
      const message = (err instanceof Error) ? err.message : "";
      const isRetryable =
        retryableStatuses.includes(status as number) ||
        message.includes("rate_limit") ||
        message.includes("overloaded") ||
        message.includes("ECONNRESET") ||
        message.includes("ETIMEDOUT") ||
        message.includes("fetch failed");

      if (!isRetryable || attempt === maxRetries) {
        throw err;
      }

      // Exponential backoff with jitter
      const delay = Math.min(
        baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 500,
        maxDelayMs,
      );

      console.warn(
        `[SmartAds] ${label} attempt ${attempt}/${maxRetries} failed (${status || (typeof message === "string" ? message.slice(0, 50) : "")}). Retrying in ${Math.round(delay)}ms...`,
      );

      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}

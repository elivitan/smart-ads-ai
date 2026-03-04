/**
 * retry.server.js
 * Simple retry wrapper for external API calls (Claude, SerpAPI, Google Ads).
 * Handles 429 (rate limit), 500/502/503 (server errors), and network failures.
 */

const RETRY_DEFAULTS = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  retryableStatuses: [429, 500, 502, 503, 504],
};

/**
 * Execute an async function with automatic retries.
 *
 * @param {Function} fn - Async function to execute
 * @param {object} opts - Retry options
 * @param {number} opts.maxRetries - Max attempts (default 3)
 * @param {number} opts.baseDelayMs - Initial delay between retries (default 1000ms)
 * @param {string} opts.label - Label for logging (e.g. "Claude AI")
 * @returns {Promise<any>} Result of fn()
 *
 * Usage:
 *   import { withRetry } from "./retry.server.js";
 *   const result = await withRetry(() => client.messages.create({...}), { label: "Claude" });
 */
export async function withRetry(fn, opts = {}) {
  const { maxRetries, baseDelayMs, maxDelayMs, retryableStatuses } = {
    ...RETRY_DEFAULTS,
    ...opts,
  };
  const label = opts.label || "API";

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      // Check if this error is retryable
      const status = err.status || err.statusCode || err.error?.status;
      const message = err.message || "";
      const isRetryable =
        retryableStatuses.includes(status) ||
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
        `[SmartAds] ${label} attempt ${attempt}/${maxRetries} failed (${status || message.slice(0, 50)}). Retrying in ${Math.round(delay)}ms...`,
      );

      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}

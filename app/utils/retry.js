// app/utils/retry.js
// ════════════════════════════════════════════
// Exponential backoff retry + Circuit Breaker
// For external API calls: Google Ads, Anthropic, SerpAPI
// ════════════════════════════════════════════
import { logger } from "./logger.js";

// ── Circuit Breaker state (in-memory) ──
const circuits = new Map();

/**
 * Get or create a circuit breaker for a named service.
 * @param {string} name - e.g. "anthropic", "googleAds", "serpapi"
 * @returns {object} circuit state
 */
function getCircuit(name) {
  if (!circuits.has(name)) {
    circuits.set(name, {
      failures: 0,
      lastFailure: 0,
      state: "closed", // closed = normal, open = blocked, half-open = testing
    });
  }
  return circuits.get(name);
}

/**
 * Default config for retry + circuit breaker.
 */
const DEFAULT_OPTIONS = {
  maxRetries: 3,
  baseDelayMs: 1000,       // 1s, then 2s, then 4s ...
  maxDelayMs: 30000,        // cap at 30s
  circuitName: null,        // if set, use circuit breaker
  circuitThreshold: 5,      // open circuit after N consecutive failures
  circuitResetMs: 300000,   // 5 minutes cooldown before half-open
  retryableErrors: null,    // function(error) => bool, or null = retry all
};

/**
 * Retry a function with exponential backoff.
 * Optionally uses a circuit breaker to stop calling a dead service.
 *
 * Usage:
 *   import { withRetry } from "../utils/retry.js";
 *
 *   const result = await withRetry(
 *     () => callAnthropicAPI(prompt),
 *     { circuitName: "anthropic", maxRetries: 3 }
 *   );
 *
 * @param {Function} fn - async function to call
 * @param {object} options - retry options
 * @returns {Promise<any>} result from fn
 */
export async function withRetry(fn, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { maxRetries, baseDelayMs, maxDelayMs, circuitName, circuitThreshold, circuitResetMs, retryableErrors } = opts;

  // ── Circuit Breaker check ──
  if (circuitName) {
    const circuit = getCircuit(circuitName);

    if (circuit.state === "open") {
      const elapsed = Date.now() - circuit.lastFailure;
      if (elapsed < circuitResetMs) {
        const waitSec = Math.ceil((circuitResetMs - elapsed) / 1000);
        logger.warn("retry.circuit", `Circuit OPEN for "${circuitName}" — blocking call. Retry in ${waitSec}s`);
        throw new Error(`Circuit breaker OPEN for ${circuitName}. Service unavailable. Retry after ${waitSec}s.`);
      }
      // Enough time passed → half-open (allow one attempt)
      circuit.state = "half-open";
      logger.info("retry.circuit", `Circuit HALF-OPEN for "${circuitName}" — testing one request`);
    }
  }

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();

      // Success → reset circuit breaker
      if (circuitName) {
        const circuit = getCircuit(circuitName);
        if (circuit.failures > 0 || circuit.state !== "closed") {
          logger.info("retry.circuit", `Circuit CLOSED for "${circuitName}" — service recovered`);
        }
        circuit.failures = 0;
        circuit.state = "closed";
      }

      return result;

    } catch (error) {
      lastError = error;

      // Check if this error is retryable
      if (retryableErrors && !retryableErrors(error)) {
        logger.warn("retry", `Non-retryable error on attempt ${attempt + 1}: ${error.message}`);
        throw error;
      }

      if (attempt < maxRetries) {
        // Exponential backoff with jitter
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt) + Math.random() * 500, maxDelayMs);
        logger.warn("retry", `Attempt ${attempt + 1}/${maxRetries + 1} failed for ${circuitName || "unknown"}. Retrying in ${Math.round(delay)}ms`, {
          error: error.message,
        });
        await sleep(delay);
      }
    }
  }

  // All retries exhausted → update circuit breaker
  if (circuitName) {
    const circuit = getCircuit(circuitName);
    circuit.failures++;
    circuit.lastFailure = Date.now();

    if (circuit.failures >= circuitThreshold) {
      circuit.state = "open";
      logger.error("retry.circuit", `Circuit OPENED for "${circuitName}" after ${circuit.failures} consecutive failures. Blocking for ${circuitResetMs / 1000}s`);
    }
  }

  logger.error("retry", `All ${maxRetries + 1} attempts failed for ${circuitName || "unknown"}`, {
    error: lastError?.message,
  });
  throw lastError;
}

/**
 * Get current circuit breaker status for a service.
 * Useful for health checks.
 *
 * @param {string} name - service name
 * @returns {{ state: string, failures: number, lastFailure: number }}
 */
export function getCircuitStatus(name) {
  if (!circuits.has(name)) {
    return { state: "closed", failures: 0, lastFailure: 0 };
  }
  const c = circuits.get(name);
  return { state: c.state, failures: c.failures, lastFailure: c.lastFailure };
}

/**
 * Reset a circuit breaker (e.g. after manual recovery).
 * @param {string} name
 */
export function resetCircuit(name) {
  if (circuits.has(name)) {
    circuits.set(name, { failures: 0, lastFailure: 0, state: "closed" });
    logger.info("retry.circuit", `Circuit manually reset for "${name}"`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

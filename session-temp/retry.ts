// retry.ts — Exponential backoff retry + Circuit Breaker
// For external API calls: Google Ads, Anthropic, SerpAPI

import { logger } from "./logger.js";

// ── Circuit Breaker types ──
type CircuitState = "closed" | "open" | "half-open";

interface CircuitBreaker {
  failures: number;
  lastFailure: number;
  state: CircuitState;
}

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  circuitName?: string | null;
  circuitThreshold?: number;
  circuitResetMs?: number;
  retryableErrors?: ((error: Error) => boolean) | null;
}

interface CircuitStatus {
  state: CircuitState;
  failures: number;
  lastFailure: number;
}

// ── Circuit Breaker state (in-memory) ──
const circuits: Map<string, CircuitBreaker> = new Map();

function getCircuit(name: string): CircuitBreaker {
  if (!circuits.has(name)) {
    circuits.set(name, {
      failures: 0,
      lastFailure: 0,
      state: "closed",
    });
  }
  return circuits.get(name)!;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  circuitName: null,
  circuitThreshold: 5,
  circuitResetMs: 300000,
  retryableErrors: null,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff.
 * Optionally uses a circuit breaker to stop calling a dead service.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const opts: Required<RetryOptions> = { ...DEFAULT_OPTIONS, ...options };
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
      circuit.state = "half-open";
      logger.info("retry.circuit", `Circuit HALF-OPEN for "${circuitName}" — testing one request`);
    }
  }

  let lastError: Error | undefined;

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
      lastError = error as Error;

      // Check if this error is retryable
      if (retryableErrors && !retryableErrors(lastError)) {
        logger.warn("retry", `Non-retryable error on attempt ${attempt + 1}: ${lastError.message}`);
        throw lastError;
      }

      if (attempt < maxRetries) {
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt) + Math.random() * 500, maxDelayMs);
        logger.warn("retry", `Attempt ${attempt + 1}/${maxRetries + 1} failed for ${circuitName || "unknown"}. Retrying in ${Math.round(delay)}ms`, {
          error: lastError.message,
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
  throw lastError!;
}

/**
 * Get current circuit breaker status for a service.
 * Useful for health checks.
 */
export function getCircuitStatus(name: string): CircuitStatus {
  if (!circuits.has(name)) {
    return { state: "closed", failures: 0, lastFailure: 0 };
  }
  const c = circuits.get(name)!;
  return { state: c.state, failures: c.failures, lastFailure: c.lastFailure };
}

/**
 * Reset a circuit breaker (e.g. after manual recovery).
 */
export function resetCircuit(name: string): void {
  if (circuits.has(name)) {
    circuits.set(name, { failures: 0, lastFailure: 0, state: "closed" });
    logger.info("retry.circuit", `Circuit manually reset for "${name}"`);
  }
}

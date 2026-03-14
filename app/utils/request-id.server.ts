// request-id.server.ts — Request ID tracing
// Assigns a unique ID to every request for end-to-end tracing.
// The ID flows through logs, Sentry, and response headers.

import { logger } from "./logger.js";

let counter = 0;

/**
 * Generate a unique request ID.
 * Format: req_{timestamp_base36}_{counter}_{random}
 */
export function generateRequestId(): string {
  counter = (counter + 1) % 1_000_000;
  return `req_${Date.now().toString(36)}_${counter}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Extract or generate a request ID from a Request.
 * Checks X-Request-ID header first (from load balancer / proxy).
 */
export function getRequestId(request: Request): string {
  return request.headers.get("x-request-id") || generateRequestId();
}

/**
 * Add request ID to response headers for client-side tracing.
 */
export function addRequestIdHeader(headers: Headers, requestId: string): void {
  headers.set("X-Request-ID", requestId);
}

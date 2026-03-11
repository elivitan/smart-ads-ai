// request-timeout.js — Request timeout middleware
// Prevents long-running requests from blocking the server
// Critical for scale: a stuck DB query or API call won't hold a connection forever

import { logger } from "./logger.js";

/**
 * Wrap an async handler with a timeout.
 * If the handler doesn't resolve within `ms`, returns a 504 Gateway Timeout.
 *
 * Usage:
 *   export const loader = withTimeout(async ({ request }) => { ... }, 30000);
 *
 * @param {Function} handler - The async route handler
 * @param {number} ms - Timeout in milliseconds (default: 30000 = 30s)
 * @returns {Function} Wrapped handler with timeout
 */
export function withTimeout(handler, ms = 30000) {
  return async function timeoutWrapper(...args) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ms);

    try {
      const result = await Promise.race([
        handler(...args),
        new Promise((_, reject) =>
          controller.signal.addEventListener("abort", () =>
            reject(new Error(`Request timeout after ${ms}ms`))
          )
        ),
      ]);
      clearTimeout(timeout);
      return result;
    } catch (error) {
      clearTimeout(timeout);
      if (error.message.includes("timeout")) {
        logger.warn(`[Timeout] Request exceeded ${ms}ms limit`);
        return Response.json(
          { success: false, error: "Request timed out. Please try again." },
          { status: 504 }
        );
      }
      throw error;
    }
  };
}

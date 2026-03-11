// app/utils/request-logger.js
// ════════════════════════════════════════════
// Request/Response logging middleware
// Wraps API route handlers to log: method, route, shop, duration, status
// Future: pipe to Datadog / CloudWatch / LogRocket
// ════════════════════════════════════════════
import { logger } from "./logger.js";

/**
 * Wrap an API route handler with request logging.
 * Works with both loader (GET) and action (POST/PUT/DELETE).
 *
 * Usage:
 *   import { withRequestLogging } from "../utils/request-logger.js";
 *   export const loader = withRequestLogging("state.GET", async ({ request }) => { ... });
 *   export const action = withRequestLogging("state.POST", async ({ request }) => { ... });
 *
 * @param {string} routeName - e.g. "state.GET", "scan.POST", "campaign.POST"
 * @param {Function} handler - the original route handler
 * @returns {Function} wrapped handler with logging
 */
export function withRequestLogging(routeName, handler) {
  return async function loggedHandler(args) {
    const start = Date.now();
    const request = args.request;
    const method = request.method;
    const url = new URL(request.url);

    let status = 200;
    let response;

    try {
      response = await handler(args);

      // Extract status from Response object if possible
      if (response && typeof response.status === "number") {
        status = response.status;
      }

      return response;
    } catch (error) {
      status = 500;
      logger.error(routeName, "Unhandled error in route handler", {
        error: error.message || String(error),
        extra: { method, path: url.pathname },
      });
      throw error;
    } finally {
      const duration = Date.now() - start;

      // Log level based on status
      const logLevel = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
      logger[logLevel](routeName, `${method} ${url.pathname} → ${status} (${duration}ms)`, {
        extra: { method, path: url.pathname, status, duration },
      });
    }
  };
}

// sentry-wrapper.server.js
// ═══════════════════════════════════════════════════
// Wraps API route handlers with Sentry error tracking
// Drop-in enhancement for existing withTimeout pattern
// ═══════════════════════════════════════════════════

import { captureApiError, trackSlowOperation } from "./sentry.server.js";

/**
 * Wraps an API route handler with Sentry monitoring.
 * Use INSTEAD of or AROUND withTimeout for full monitoring.
 * 
 * Usage in any API route:
 *   import { withSentryMonitoring } from "../utils/sentry-wrapper.server.js";
 *   
 *   export const action = withSentryMonitoring("api.scan", async ({ request }) => {
 *     // your existing handler code
 *   });
 */
export function withSentryMonitoring(routeName, handler) {
  return async function sentryWrappedHandler(args) {
    const startTime = Date.now();
    let shop = "unknown";

    try {
      // Try to extract shop from request
      if (args?.request) {
        try {
          const url = new URL(args.request.url);
          shop = url.searchParams.get("shop") || "unknown";
        } catch {
          // URL parsing failed, not critical
        }
      }

      // Run the actual handler
      const result = await handler(args);
      
      // Track slow operations
      const duration = Date.now() - startTime;
      trackSlowOperation(routeName, duration);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Report to Sentry with full context
      captureApiError(error, {
        route: routeName,
        shop,
        duration_ms: duration,
        method: args?.request?.method || "unknown",
        url: args?.request?.url || "unknown",
      });

      // Re-throw so withTimeout / existing error handling still works
      throw error;
    }
  };
}

/**
 * Lightweight error reporter for catch blocks.
 * Use when you already have try/catch and just want to report.
 * 
 * Usage:
 *   try { ... } catch (error) {
 *     reportRouteError(error, "api.scan", shop);
 *     return json({ error: "Something went wrong" }, { status: 500 });
 *   }
 */
export function reportRouteError(error, routeName, shop = "unknown") {
  captureApiError(error, {
    route: routeName,
    shop,
    action: "catch-block",
  });
}

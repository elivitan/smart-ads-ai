// sentry.server.js
// ═══════════════════════════════════════════════════
// Sentry Server-Side Initialization for Smart Ads AI
// Captures API errors, loader/action failures, and slow queries
// ═══════════════════════════════════════════════════

import * as Sentry from "@sentry/remix";

let initialized = false;

export function initSentryServer() {
  if (initialized) return;

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.log("[Sentry] No SENTRY_DSN env var, skipping server init");
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    autoInstrumentRemix: true,

    // ── Error Tracking ──
    sampleRate: 1.0, // Capture all errors

    // ── Performance ──
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,

    // ── Filtering ──
    beforeSend(event) {
      // Skip noisy expected errors
      const message = event.exception?.values?.[0]?.value || "";
      
      // Shopify auth redirects are expected, not errors
      if (message.includes("Response code 302") || message.includes("redirect")) {
        return null;
      }

      // Rate limiting responses are expected behavior
      if (message.includes("429") && message.includes("rate limit")) {
        return null;
      }

      return event;
    },

    // ── Tags ──
    initialScope: {
      tags: {
        app: "smart-ads-ai",
        side: "server",
      },
    },
  });

  initialized = true;
  console.log("[Sentry] Server initialized");
}

// ── Helper: Capture error with extra context ──
export function captureApiError(error, context = {}) {
  Sentry.withScope((scope) => {
    if (context.shop) scope.setTag("shop", context.shop);
    if (context.route) scope.setTag("route", context.route);
    if (context.action) scope.setTag("action", context.action);
    if (context.userId) scope.setUser({ id: context.userId });
    
    // Add extra data
    Object.entries(context).forEach(([key, value]) => {
      if (!["shop", "route", "action", "userId"].includes(key)) {
        scope.setExtra(key, value);
      }
    });

    Sentry.captureException(error);
  });
}

// ── Helper: Track slow operations ──
export function trackSlowOperation(name, durationMs, threshold = 5000) {
  if (durationMs > threshold) {
    Sentry.withScope((scope) => {
      scope.setTag("slow_operation", name);
      scope.setExtra("duration_ms", durationMs);
      scope.setExtra("threshold_ms", threshold);
      scope.setLevel("warning");
      Sentry.captureMessage(`Slow operation: ${name} took ${durationMs}ms (threshold: ${threshold}ms)`);
    });
  }
}

// Re-export for convenience
export { Sentry };

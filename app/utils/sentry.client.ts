// sentry.client.ts
// ═══════════════════════════════════════════════════
// Sentry Client-Side Initialization for Smart Ads AI
// Captures browser errors, performance, and session replays
// ═══════════════════════════════════════════════════

import * as Sentry from "@sentry/react-router";

// ── Extend Window for ENV injected by root loader ──
declare global {
  interface Window {
    ENV?: {
      SENTRY_DSN?: string;
      NODE_ENV?: string;
      [key: string]: string | undefined;
    };
  }
}

export function initSentryClient(): void {
  // Only initialize if DSN is available
  const dsn = typeof window !== "undefined" && window.ENV?.SENTRY_DSN;
  if (!dsn) {
    console.log("[Sentry] No DSN found, skipping client init");
    return;
  }

  Sentry.init({
    dsn,
    environment: window.ENV?.NODE_ENV || "development",

    // ── Error Tracking ──
    // Capture 100% of errors (free plan = 5,000/month)
    sampleRate: 1.0,

    // ── Performance Monitoring ──
    // 20% of transactions in production, 100% in dev
    tracesSampleRate: window.ENV?.NODE_ENV === "production" ? 0.2 : 1.0,

    integrations: [
      // React Router tracing (replaces legacy browserTracingIntegration with hooks)
      Sentry.reactRouterTracingIntegration(),
      // Session Replay — capture 10% normally, 100% on error
      Sentry.replayIntegration({
        maskAllText: false, // We want to see what users typed
        blockAllMedia: false,
      }),
    ],

    // ── Session Replay ──
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% when error occurs

    // ── Filtering ──
    beforeSend(event) {
      // Don't send events in development
      if (window.ENV?.NODE_ENV === "development") {
        console.log("[Sentry] Dev mode - event captured:", event.exception?.values?.[0]?.value);
        return null; // Don't send to Sentry in dev
      }
      return event;
    },

    // ── Tags ──
    initialScope: {
      tags: {
        app: "smart-ads-ai",
        side: "client",
      },
    },
  });

  console.log("[Sentry] Client initialized");
}

// Re-export for convenience
export { Sentry };

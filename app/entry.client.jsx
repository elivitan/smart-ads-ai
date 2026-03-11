import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";
import * as Sentry from "@sentry/remix";
import { useLocation, useMatches } from "react-router";
import { useEffect } from "react";

// ── Initialize Sentry (client side) ──
Sentry.init({
  dsn: window.ENV?.SENTRY_DSN || "",
  environment: window.ENV?.NODE_ENV || "development",

  // Error tracking: capture all errors
  sampleRate: 1.0,

  // Performance: 20% in production, 100% in dev
  tracesSampleRate: window.ENV?.NODE_ENV === "production" ? 0.2 : 1.0,

  integrations: [
    Sentry.browserTracingIntegration({
      useEffect,
      useLocation,
      useMatches,
    }),
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],

  // Session replay: 10% normal, 100% on error
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  beforeSend(event) {
    // Don't send errors in development
    if (window.ENV?.NODE_ENV === "development") {
      console.log("[Sentry] Dev mode - captured:", event.exception?.values?.[0]?.value);
      return null;
    }
    return event;
  },
});

hydrateRoot(document, <HydratedRouter />);

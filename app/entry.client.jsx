import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";
import * as Sentry from "@sentry/react-router";

// ── Initialize Sentry (client side) ──
Sentry.init({
  dsn: window.ENV?.SENTRY_DSN || "",
  environment: window.ENV?.NODE_ENV || "development",
  sampleRate: 1.0,
  tracesSampleRate: window.ENV?.NODE_ENV === "production" ? 0.2 : 1.0,
  integrations: [
    Sentry.reactRouterTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  beforeSend(event) {
    if (window.ENV?.NODE_ENV === "development") {
      console.log("[Sentry] Dev:", event.exception?.values?.[0]?.value);
      return null;
    }
    return event;
  },
});

hydrateRoot(document, <HydratedRouter />);

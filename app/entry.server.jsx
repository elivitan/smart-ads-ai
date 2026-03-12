import { PassThrough } from "stream";
import { renderToPipeableStream } from "react-dom/server";
import { ServerRouter } from "react-router";
import { createReadableStreamFromReadable } from "@react-router/node";
import { isbot } from "isbot";
import { addDocumentResponseHeaders } from "./shopify.server";
import * as Sentry from "@sentry/node";

// ── Initialize Sentry (server side) ──
Sentry.init({
  dsn: process.env.SENTRY_DSN || "",
  environment: process.env.NODE_ENV || "development",
  sampleRate: 1.0,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
  beforeSend(event) {
    const msg = event.exception?.values?.[0]?.value || "";
    if (msg.includes("302") || msg.includes("redirect")) return null;
    if (msg.includes("429") && msg.includes("rate limit")) return null;
    return event;
  },
});

// ── Start BullMQ workers (in-process) ──
import("./utils/queue.js").then(({ startWorkers }) => {
  startWorkers();
}).catch((e) => {
  console.warn("[Queue] Worker startup skipped:", e.message);
});

export const streamTimeout = 5000;

export const handleError = (error, { request }) => {
  if (!request.signal.aborted) {
    Sentry.captureException(error);
    console.error(error);
  }
};

export default async function handleRequest(
  request,
  responseStatusCode,
  responseHeaders,
  reactRouterContext,
) {
  addDocumentResponseHeaders(request, responseHeaders);
  const userAgent = request.headers.get("user-agent");
  const callbackName = isbot(userAgent ?? "") ? "onAllReady" : "onShellReady";

  return new Promise((resolve, reject) => {
    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={reactRouterContext} url={request.url} />,
      {
        [callbackName]: () => {
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);
          responseHeaders.set("Content-Type", "text/html");
          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          );
          pipe(body);
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          responseStatusCode = 500;
          Sentry.captureException(error);
          console.error(error);
        },
      },
    );
    setTimeout(abort, streamTimeout + 1000);
  });
}

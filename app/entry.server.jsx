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


// ── Graceful Shutdown ──
// On SIGTERM/SIGINT: close queues, disconnect DB, flush Sentry
let isShuttingDown = false;
async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[Shutdown] ${signal} received. Closing gracefully...`);
  
  try {
    // Flush Sentry events (max 2s)
    await Sentry.flush(2000);
    console.log("[Shutdown] Sentry flushed");
  } catch (e) { console.warn("[Shutdown] Sentry flush failed:", e.message); }
  
  try {
    // Disconnect Prisma
    const { default: prisma } = await import("./db.server.js");
    await prisma.$disconnect();
    console.log("[Shutdown] Prisma disconnected");
  } catch (e) { console.warn("[Shutdown] Prisma disconnect failed:", e.message); }
  
  try {
    // Close Redis
    const { getRedis } = await import("./utils/redis.js");
    const redis = getRedis();
    if (redis && typeof redis.quit === "function") {
      await redis.quit();
      console.log("[Shutdown] Redis closed");
    }
  } catch (e) { console.warn("[Shutdown] Redis close failed:", e.message); }
  
  console.log("[Shutdown] Clean shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

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

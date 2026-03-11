// request-logger.ts — Request/Response logging middleware
// Wraps API route handlers to log: method, route, shop, duration, status
// Future: pipe to Datadog / CloudWatch / LogRocket

import { logger } from "./logger.js";

// Remix route handler args type
interface RouteHandlerArgs {
  request: Request;
  params?: Record<string, string>;
  context?: unknown;
}

type RouteHandler = (args: RouteHandlerArgs) => Promise<Response> | Response;

/**
 * Wrap an API route handler with request logging.
 * Works with both loader (GET) and action (POST/PUT/DELETE).
 */
export function withRequestLogging(routeName: string, handler: RouteHandler): RouteHandler {
  return async function loggedHandler(args: RouteHandlerArgs): Promise<Response> {
    const start = Date.now();
    const request = args.request;
    const method = request.method;
    const url = new URL(request.url);

    let status = 200;
    let response: Response | undefined;

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
        error: (error as Error).message || String(error),
        extra: { method, path: url.pathname },
      });
      throw error;
    } finally {
      const duration = Date.now() - start;

      // Log level based on status
      const logLevel: "error" | "warn" | "info" = status >= 500 ? "error" : status >= 400 ? "warn" : "info";
      logger[logLevel](routeName, `${method} ${url.pathname} → ${status} (${duration}ms)`, {
        extra: { method, path: url.pathname, status, duration },
      });
    }
  };
}

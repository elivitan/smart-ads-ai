// request-timeout.ts — Request timeout middleware
// Prevents long-running requests from blocking the server
// Critical for scale: a stuck DB query or API call won't hold a connection forever

import { logger } from "./logger.js";

type AsyncHandler = (...args: unknown[]) => Promise<Response | unknown>;

/**
 * Wrap an async handler with a timeout.
 * If the handler doesn't resolve within `ms`, returns a 504 Gateway Timeout.
 *
 * Usage:
 *   export const loader = withTimeout(async ({ request }) => { ... }, 30000);
 */
export function withTimeout(handler: AsyncHandler, ms: number = 30000): AsyncHandler {
  return async function timeoutWrapper(...args: unknown[]): Promise<Response | unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ms);

    try {
      const result = await Promise.race([
        handler(...args),
        new Promise<never>((_, reject) =>
          controller.signal.addEventListener("abort", () =>
            reject(new Error(`Request timeout after ${ms}ms`))
          )
        ),
      ]);
      clearTimeout(timeout);
      return result;
    } catch (error: unknown) {
      clearTimeout(timeout);
      if (error instanceof Error && error.message.includes("timeout")) {
        logger.warn("timeout", `Request exceeded ${ms}ms limit`);
        return Response.json(
          { success: false, error: "Request timed out. Please try again." },
          { status: 504 }
        );
      }
      throw error;
    }
  };
}

import { authenticate } from "../shopify.server";
import { exploreKeywords, scanWebsite } from "../keyword-research.server";
import { z } from "zod";
import { logger } from "../utils/logger";
import { rateLimit, rateLimitResponse } from "../utils/rate-limiter";
import { cache, TTL } from "../utils/redis";
import { withRequestLogging } from "../utils/request-logger";
import { withSentryMonitoring } from "../utils/sentry-wrapper.server";

// ── Types ──
interface RouteHandlerArgs {
  request: Request;
  params?: Record<string, string>;
  context?: unknown;
}

const _action = async ({ request }: RouteHandlerArgs): Promise<Response> => {
  let session;
  try {
    ({ session } = await authenticate.admin(request));
  } catch (authErr: unknown) {
    logger.error("keywords.action", "Auth failed", { error: (authErr as Error).message });
    return Response.json({ success: false, error: "Authentication failed" }, { status: 401 });
  }
  const shop = session.shop;

  // Rate limit check
  const rl = await rateLimit.keywords(shop);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds || 60);
  const formData = await request.formData();
  const actionType = (formData.get("actionType") as string);

  try {
    if (actionType === "explore") {
      const keyword = (formData.get("keyword") as string);
      const location = (formData.get("location") as string) || "United States";
      if (!keyword) {
        return Response.json({ success: false, error: "Please enter a keyword" }, { status: 400 });
      }
      const cacheKey = `kw:explore:${keyword.toLowerCase().trim()}:${location}`;
      let result = await cache.get(cacheKey);
      if (!result) {
        result = await exploreKeywords(keyword, location);
        await cache.set(cacheKey, result, TTL.KEYWORD_DATA); // 12h
      }
      return Response.json({ success: true, ...(result as Record<string, unknown>) });
    }

    if (actionType === "scan") {
      const url = (formData.get("url") as string);
      if (!url) {
        return Response.json({ success: false, error: "Please enter a URL" }, { status: 400 });
      }
      const cacheKeyScan = `kw:scan:${url.toLowerCase().trim()}`;
      let result = await cache.get(cacheKeyScan);
      if (!result) {
        result = await scanWebsite(url);
        await cache.set(cacheKeyScan, result, TTL.KEYWORD_DATA); // 12h
      }
      return Response.json({ success: true, ...(result as Record<string, unknown>) });
    }

    return Response.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (err: unknown) {
    logger.error("keywords.action", "Keyword research error", { shop, error: (err as Error).message });
    return Response.json(
      { success: false, error: (err as Error).message || "Something went wrong" },
      { status: 500 }
    );
  }
};


// ── Middleware wrappers (Session 56) ──
export const action = withSentryMonitoring("api.keywords", withRequestLogging("api.keywords", _action));
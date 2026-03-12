import { authenticate } from "../shopify.server";
import { exploreKeywords, scanWebsite } from "../keyword-research.server";
import { z } from "zod";
import { logger } from "../utils/logger";
import { rateLimit, rateLimitResponse } from "../utils/rate-limiter";
import { cache, TTL } from "../utils/redis";
import { withRequestLogging } from "../utils/request-logger";
import { withSentryMonitoring } from "../utils/sentry-wrapper.server.js";

const _action = async ({ request }) => {
  let session;
  try {
    ({ session } = await authenticate.admin(request));
  } catch (authErr) {
    logger.error("keywords.action", "Auth failed", { error: authErr.message });
    return Response.json({ success: false, error: "Authentication failed" }, { status: 401 });
  }
  const shop = session.shop;

  // Rate limit check
  const rl = await rateLimit.keywords(shop);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterSeconds);
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  try {
    if (actionType === "explore") {
      const keyword = formData.get("keyword");
      const location = formData.get("location") || "United States";
      if (!keyword) {
        return Response.json({ success: false, error: "Please enter a keyword" }, { status: 400 });
      }
      const cacheKey = `kw:explore:${keyword.toLowerCase().trim()}:${location}`;
      let result = await cache.get(cacheKey);
      if (!result) {
        result = await exploreKeywords(keyword, location);
        await cache.set(cacheKey, result, TTL.KEYWORD_DATA); // 12h
      }
      return Response.json({ success: true, ...result });
    }

    if (actionType === "scan") {
      const url = formData.get("url");
      if (!url) {
        return Response.json({ success: false, error: "Please enter a URL" }, { status: 400 });
      }
      const cacheKeyScan = `kw:scan:${url.toLowerCase().trim()}`;
      let result = await cache.get(cacheKeyScan);
      if (!result) {
        result = await scanWebsite(url);
        await cache.set(cacheKeyScan, result, TTL.KEYWORD_DATA); // 12h
      }
      return Response.json({ success: true, ...result });
    }

    return Response.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    logger.error("keywords.action", "Keyword research error", { shop, error: err.message });
    return Response.json(
      { success: false, error: err.message || "Something went wrong" },
      { status: 500 }
    );
  }
};


// ── Middleware wrappers (Session 56) ──
export const action = withSentryMonitoring("api.keywords", withRequestLogging("api.keywords", _action));
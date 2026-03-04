// app/rateLimit.server.js
// Rate limiting for Anthropic, Google Ads, SerpAPI

const windows = new Map();

export function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  if (!windows.has(key)) windows.set(key, []);
  const ts = windows.get(key);
  while (ts.length > 0 && ts[0] <= now - windowMs) ts.shift();
  if (ts.length >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: ts[0] + windowMs - now,
    };
  }
  ts.push(now);
  return { allowed: true, remaining: limit - ts.length, retryAfterMs: 0 };
}

/** Anthropic: 50 calls/min per shop */
export function checkAnthropicLimit(shop) {
  return rateLimit("anthropic:" + shop, 50, 60000);
}

/** Google Ads: 10 mutate calls/min per shop */
export function checkGoogleAdsLimit(shop) {
  return rateLimit("gads:" + shop, 10, 60000);
}

/** SerpAPI: 20 calls/min per shop */
export function checkSerpApiLimit(shop) {
  return rateLimit("serp:" + shop, 20, 60000);
}

/** General: 120 calls/min per shop */
export function checkGeneralLimit(shop) {
  return rateLimit("general:" + shop, 120, 60000);
}

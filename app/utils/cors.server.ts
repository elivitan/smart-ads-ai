// cors.server.ts — CORS configuration for API routes
// Shopify apps run inside an iframe, so CORS must allow Shopify origins.

/**
 * Get allowed origins for CORS.
 * Shopify admin + the app's own domain.
 */
function getAllowedOrigins(): string[] {
  return [
    "https://admin.shopify.com",
    "https://*.myshopify.com",
    // Add app domain if configured
    ...(process.env.APP_URL ? [process.env.APP_URL] : []),
  ];
}

/**
 * Check if an origin is allowed.
 */
export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true; // Same-origin requests don't send Origin header
  const allowed = getAllowedOrigins();
  return allowed.some((pattern) => {
    if (pattern.includes("*")) {
      const regex = new RegExp("^" + pattern.replace(/\*/g, "[^.]+") + "$");
      return regex.test(origin);
    }
    return pattern === origin;
  });
}

/**
 * Add CORS headers to a Response.
 * Call in API route handlers that need cross-origin access.
 */
export function addCorsHeaders(headers: Headers, origin: string | null): void {
  const effectiveOrigin = origin && isAllowedOrigin(origin) ? origin : "https://admin.shopify.com";
  headers.set("Access-Control-Allow-Origin", effectiveOrigin);
  headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-ID");
  headers.set("Access-Control-Max-Age", "86400"); // 24 hours
  headers.set("Access-Control-Expose-Headers", "X-Request-ID, Retry-After");
}

/**
 * Handle CORS preflight (OPTIONS) requests.
 */
export function handleCorsPreFlight(request: Request): Response | null {
  if (request.method !== "OPTIONS") return null;
  const origin = request.headers.get("origin");
  const headers = new Headers();
  addCorsHeaders(headers, origin);
  return new Response(null, { status: 204, headers });
}

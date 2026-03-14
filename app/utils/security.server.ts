// security.server.ts — Security headers and input sanitization
// Adds OWASP-recommended security headers and input protection.

/**
 * Add security headers to a Response.
 * Call in entry.server.tsx or per-route.
 */
export function addSecurityHeaders(headers: Headers): void {
  // Prevent MIME-type sniffing
  headers.set("X-Content-Type-Options", "nosniff");

  // Prevent clickjacking (Shopify embeds in iframe, so we use SAMEORIGIN)
  if (!headers.has("X-Frame-Options")) {
    headers.set("X-Frame-Options", "SAMEORIGIN");
  }

  // XSS protection (legacy browsers)
  headers.set("X-XSS-Protection", "1; mode=block");

  // Referrer policy — don't leak full URL to external sites
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions policy — disable unnecessary browser features
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");

  // Strict Transport Security (HTTPS only, 1 year)
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
}

/**
 * Sanitize user input string — strips dangerous characters.
 * Use for search queries, shop names, etc.
 */
export function sanitizeInput(input: string, maxLength: number = 500): string {
  if (!input || typeof input !== "string") return "";

  return input
    .slice(0, maxLength)
    .replace(/[<>]/g, "")         // Strip HTML angle brackets
    .replace(/javascript:/gi, "") // Strip javascript: protocol
    .replace(/on\w+=/gi, "")     // Strip inline event handlers
    .replace(/\0/g, "")           // Strip null bytes
    .trim();
}

/**
 * Validate that a shop domain looks legitimate.
 * Shopify shop domains are always *.myshopify.com
 */
export function isValidShopDomain(shop: string): boolean {
  if (!shop || typeof shop !== "string") return false;
  return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop);
}

/**
 * Rate-limit aware request ID generator for tracing.
 */
export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

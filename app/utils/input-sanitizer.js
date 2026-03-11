// input-sanitizer.js — Input sanitization for safe processing
// Prevents XSS, SQL injection, and oversized payloads
// Used alongside Zod validation for defense-in-depth

/**
 * Sanitize a string: trim, remove null bytes, limit length.
 * @param {string} input
 * @param {number} maxLength (default 1000)
 * @returns {string}
 */
export function sanitizeString(input, maxLength = 1000) {
  if (typeof input !== "string") return "";
  return input
    .replace(/\0/g, "")           // Remove null bytes
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "") // Remove control chars
    .trim()
    .slice(0, maxLength);
}

/**
 * Sanitize HTML to prevent XSS (basic — strips all tags).
 * @param {string} input
 * @returns {string}
 */
export function stripHtml(input) {
  if (typeof input !== "string") return "";
  return input.replace(/<[^>]*>/g, "").trim();
}

/**
 * Validate and limit JSON payload size.
 * @param {Request} request
 * @param {number} maxBytes (default 1MB)
 * @returns {Promise<object|null>} Parsed JSON or null if too large/invalid
 */
export async function safeParseJson(request, maxBytes = 1024 * 1024) {
  try {
    const contentLength = parseInt(request.headers.get("content-length") || "0");
    if (contentLength > maxBytes) return null;

    const text = await request.text();
    if (text.length > maxBytes) return null;

    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Sanitize a shop domain for safe use in queries.
 * @param {string} shop
 * @returns {string|null}
 */
export function sanitizeShopDomain(shop) {
  if (typeof shop !== "string") return null;
  const cleaned = shop.trim().toLowerCase();
  // Must match Shopify shop domain pattern
  if (/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(cleaned)) return cleaned;
  return null;
}

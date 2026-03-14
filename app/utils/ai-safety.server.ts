// ai-safety.server.ts — AI input/output safety layer
// Prevents prompt injection in user-supplied data going to Claude,
// and validates/sanitizes Claude's JSON responses.

import { logger } from "./logger.js";

// ── Prompt Injection Protection ──────────────────────────────────────────

// Patterns that indicate prompt injection attempts
const INJECTION_PATTERNS = [
  /ignore\s+(previous|above|all)\s+(instructions|prompts)/i,
  /you\s+are\s+now\s+/i,
  /system\s*:\s*/i,
  /\bact\s+as\b/i,
  /\bpretend\s+(to\s+be|you\s+are)\b/i,
  /\brole\s*:\s*/i,
  /\bassistant\s*:\s*/i,
  /do\s+not\s+follow/i,
  /disregard\s+(your|the|all)/i,
  /override\s+(your|the|system)/i,
  /new\s+instructions?\s*:/i,
  /forget\s+(everything|your|all)/i,
  /\[system\]/i,
  /\[INST\]/i,
  /<\|im_start\|>/i,
  /<<SYS>>/i,
];

/**
 * Check if a string contains potential prompt injection.
 * Returns true if injection is detected.
 */
export function detectPromptInjection(input: string): boolean {
  if (!input || typeof input !== "string") return false;
  return INJECTION_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Sanitize user-provided text before including it in an AI prompt.
 * - Strips control characters
 * - Escapes special delimiters
 * - Truncates to max length
 * - Logs if injection attempt detected
 */
export function sanitizeForPrompt(input: string, maxLength: number = 2000, label: string = "unknown"): string {
  if (!input || typeof input !== "string") return "";

  // Check for injection attempts
  if (detectPromptInjection(input)) {
    logger.warn("ai-safety", `Potential prompt injection detected in ${label}`, {
      extra: { inputPreview: input.slice(0, 100) },
    });
  }

  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // Control chars
    .replace(/```/g, "'''")    // Prevent markdown code fence injection
    .replace(/\n{3,}/g, "\n\n") // Collapse excessive newlines
    .trim()
    .slice(0, maxLength);
}

/**
 * Wrap user data in a clearly delimited block for the prompt.
 * This makes it harder for injected instructions to break out.
 */
export function wrapUserData(label: string, data: string): string {
  const sanitized = sanitizeForPrompt(data, 3000, label);
  return `[USER_DATA:${label}]\n${sanitized}\n[/USER_DATA:${label}]`;
}

// ── Output Validation ────────────────────────────────────────────────────

/**
 * Safely parse JSON from Claude's response.
 * Handles markdown code fences, validates structure.
 */
export function safeParseAiJson<T = unknown>(text: string): { data: T | null; error: string | null } {
  if (!text || typeof text !== "string") {
    return { data: null, error: "Empty response" };
  }

  // Strip markdown code fences
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    const parsed = JSON.parse(cleaned);

    // Validate it's an object (not array, string, etc.)
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { data: null, error: "Response is not a JSON object" };
    }

    // Deep sanitize string values to prevent stored XSS
    const sanitized = deepSanitizeStrings(parsed);

    return { data: sanitized as T, error: null };
  } catch (e) {
    return { data: null, error: `JSON parse failed: ${(e as Error).message}` };
  }
}

/**
 * Recursively sanitize all string values in an object.
 * Strips HTML tags and dangerous patterns from AI output.
 */
function deepSanitizeStrings(obj: unknown, depth: number = 0): unknown {
  if (depth > 10) return obj; // Prevent infinite recursion

  if (typeof obj === "string") {
    return obj
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "") // Remove script tags
      .replace(/<[^>]*>/g, "") // Remove all HTML tags
      .replace(/javascript:/gi, "") // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, ""); // Remove event handlers
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deepSanitizeStrings(item, depth + 1));
  }

  if (typeof obj === "object" && obj !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = deepSanitizeStrings(value, depth + 1);
    }
    return result;
  }

  return obj; // numbers, booleans, null — pass through
}

/**
 * Validate that required fields exist in AI response.
 */
export function validateAiResponse(data: Record<string, unknown>, requiredFields: string[]): string[] {
  const missing: string[] = [];
  for (const field of requiredFields) {
    if (!(field in data) || data[field] === undefined || data[field] === null) {
      missing.push(field);
    }
  }
  return missing;
}

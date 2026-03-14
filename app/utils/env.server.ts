// env.server.ts — Environment variable validation
// Validates all required env vars on startup. Fails fast with clear messages.

import { z } from "zod";

const envSchema = z.object({
  // ── Required: Shopify ──
  SHOPIFY_API_KEY: z.string().min(1, "Missing SHOPIFY_API_KEY"),
  SHOPIFY_API_SECRET: z.string().min(1, "Missing SHOPIFY_API_SECRET"),
  SCOPES: z.string().min(1, "Missing SCOPES"),

  // ── Required: Database ──
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),

  // ── Required: AI ──
  ANTHROPIC_API_KEY: z.string().min(1, "Missing ANTHROPIC_API_KEY"),

  // ── Optional: Redis (graceful fallback to in-memory) ──
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.string().optional(),

  // ── Optional: Google Ads ──
  GOOGLE_ADS_DEVELOPER_TOKEN: z.string().optional(),
  GOOGLE_ADS_CLIENT_ID: z.string().optional(),
  GOOGLE_ADS_CLIENT_SECRET: z.string().optional(),
  GOOGLE_ADS_LOGIN_CUSTOMER_ID: z.string().optional(),

  // ── Optional: Search APIs ──
  SERPER_API_KEY: z.string().optional(),
  SERPAPI_KEY: z.string().optional(),

  // ── Optional: Monitoring ──
  SENTRY_DSN: z.string().optional(),

  // ── Runtime ──
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  USE_QUEUES: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let _validated: Env | null = null;

/**
 * Validate environment variables. Call once on startup.
 * Throws with clear error messages if required vars are missing.
 */
export function validateEnv(): Env {
  if (_validated) return _validated;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    console.error(`\n[ENV] ❌ Environment validation failed:\n${errors}\n`);
    throw new Error(`Environment validation failed:\n${errors}`);
  }

  _validated = result.data;

  // Warnings for optional but recommended vars
  const warnings: string[] = [];
  if (!_validated.SENTRY_DSN) warnings.push("SENTRY_DSN not set — error tracking disabled");
  if (!_validated.REDIS_URL && !_validated.REDIS_HOST) warnings.push("No Redis config — using in-memory fallback");
  if (!_validated.GOOGLE_ADS_DEVELOPER_TOKEN) warnings.push("Google Ads credentials not set — campaign features limited");
  if (!_validated.SERPER_API_KEY && !_validated.SERPAPI_KEY) warnings.push("No search API key — competitor intel disabled");

  if (warnings.length > 0) {
    console.warn(`[ENV] ⚠️  Warnings:\n${warnings.map(w => `  - ${w}`).join("\n")}`);
  } else {
    console.log("[ENV] ✅ All environment variables validated");
  }

  return _validated;
}

/**
 * Get validated env. Throws if validateEnv() hasn't been called.
 */
export function getEnv(): Env {
  if (!_validated) {
    return validateEnv();
  }
  return _validated;
}

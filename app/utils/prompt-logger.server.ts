// prompt-logger.server.ts — Persists AI prompt metadata to DB for observability
// Logs: action type, model, token usage, duration, success/error, and metadata.
// Does NOT store full prompt text (privacy) — only structured metadata.

import prisma from "../db.server.js";
import { logger } from "./logger.js";

interface PromptLogEntry {
  shop: string;
  action: string;
  model?: string;
  promptTokens?: number;
  outputTokens?: number;
  durationMs?: number;
  success?: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log an AI prompt interaction to the database.
 * Fire-and-forget — never blocks the caller.
 */
export function logPrompt(entry: PromptLogEntry): void {
  const record = {
    shop: entry.shop,
    action: entry.action,
    model: entry.model || "claude-sonnet-4-20250514",
    promptTokens: entry.promptTokens || 0,
    outputTokens: entry.outputTokens || 0,
    durationMs: entry.durationMs || 0,
    success: entry.success !== false,
    error: entry.error || null,
    metadata: JSON.stringify(entry.metadata || {}),
  };

  prisma.aiPromptLog.create({ data: record }).catch((err: Error) => {
    logger.warn("prompt-logger", "Failed to log AI prompt", { extra: { error: err.message } });
  });
}

/**
 * Helper to measure and log an AI call.
 * Wraps an async function, records timing + result, and logs to DB.
 */
export async function withPromptLogging<T>(
  entry: Omit<PromptLogEntry, "durationMs" | "success" | "error">,
  fn: () => Promise<T & { usage?: { input_tokens?: number; output_tokens?: number } }>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const durationMs = Date.now() - start;
    logPrompt({
      ...entry,
      durationMs,
      success: true,
      promptTokens: result?.usage?.input_tokens || entry.promptTokens,
      outputTokens: result?.usage?.output_tokens || entry.outputTokens,
    });
    return result;
  } catch (err: unknown) {
    const durationMs = Date.now() - start;
    logPrompt({
      ...entry,
      durationMs,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

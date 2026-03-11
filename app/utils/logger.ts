// logger.ts — Structured logging for Smart Ads AI

export type LogLevel = "info" | "warn" | "error";

export interface LogDetails {
  shop?: string;
  error?: unknown;
  extra?: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  action: string;
  message: string;
  shop?: string;
  error?: unknown;
  extra?: unknown;
}

function log(level: LogLevel, action: string, message: string, details: LogDetails = {}): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    action,
    message,
    ...(details.shop ? { shop: details.shop } : {}),
    ...(details.error ? { error: details.error } : {}),
    ...(details.extra ? { extra: details.extra } : {}),
  };

  // Future: send to Sentry, LogRocket, Datadog, etc.
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  fn(`[SmartAds][${level.toUpperCase()}] ${action}: ${message}`, details.error || details.extra || "");
}

export const logger = {
  info: (action: string, message: string, details?: LogDetails): void => log("info", action, message, details),
  warn: (action: string, message: string, details?: LogDetails): void => log("warn", action, message, details),
  error: (action: string, message: string, details?: LogDetails): void => log("error", action, message, details),
};

// app/utils/logger.js
// Structured logging for Smart Ads AI
// Prepares for future Sentry/LogRocket integration

/**
 * Structured log function
 * @param {string} level - 'info' | 'warn' | 'error'
 * @param {string} action - e.g. 'state.POST', 'scan.analyze'
 * @param {string} message - human-readable message
 * @param {object} details - extra context { shop, error, extra }
 */
function log(level, action, message, details = {}) {
  const entry = {
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
  info: (action, message, details) => log("info", action, message, details),
  warn: (action, message, details) => log("warn", action, message, details),
  error: (action, message, details) => log("error", action, message, details),
};

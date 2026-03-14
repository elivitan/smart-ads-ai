// tests/sentry.spec.cjs
// ═══════════════════════════════════════════════════
// E2E tests for Sentry integration
// Verifies Sentry files exist, config is correct,
// and error tracking hooks are in place
// ═══════════════════════════════════════════════════

const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ROOT = process.cwd();
// Helper: resolve .js/.ts file paths (TSX migration support)
function resolveSentryFile(name) {
  const jsPath = path.join(ROOT, "app", "utils", name + ".js");
  const tsPath = path.join(ROOT, "app", "utils", name + ".ts");
  if (fs.existsSync(tsPath)) return tsPath;
  if (fs.existsSync(jsPath)) return jsPath;
  return null;
}


// ── File existence tests ──
test.describe("Sentry Integration - Files", () => {
  test("sentry.client exists and has correct structure", () => {
    const filePath = resolveSentryFile("sentry.client");
    expect(filePath, "sentry.client.js or .ts must exist").toBeTruthy();
    
    const content = fs.readFileSync(filePath, "utf8");
    expect(content).toContain("Sentry.init");
    // reactRouterTracingIntegration replaced legacy browserTracingIntegration
    expect(content).toContain("reactRouterTracingIntegration");
    expect(content).toContain("replayIntegration");
    expect(content).toContain("SENTRY_DSN");
    expect(content).toContain("beforeSend");
  });

  test("sentry.server exists and has correct structure", () => {
    const filePath = resolveSentryFile("sentry.server");
    expect(filePath, "sentry.server.js or .ts must exist").toBeTruthy();
    
    const content = fs.readFileSync(filePath, "utf8");
    expect(content).toContain("Sentry.init");
    // autoInstrumentRemix was removed (deprecated in current Sentry)
    expect(content).toContain("captureApiError");
    expect(content).toContain("trackSlowOperation");
    expect(content).toContain("SENTRY_DSN");
  });

  test("sentry-wrapper.server exists and has correct structure", () => {
    const filePath = resolveSentryFile("sentry-wrapper.server");
    expect(filePath, "sentry-wrapper.server.js or .ts must exist").toBeTruthy();
    
    const content = fs.readFileSync(filePath, "utf8");
    expect(content).toContain("withSentryMonitoring");
    expect(content).toContain("reportRouteError");
    expect(content).toContain("captureApiError");
  });
});

// ── Configuration tests ──
test.describe("Sentry Integration - Config", () => {
  test("SENTRY_DSN is in .env.example or documented", () => {
    // Check if env example or .env has SENTRY_DSN placeholder
    const envExample = path.join(ROOT, ".env.example");
    const envFile = path.join(ROOT, ".env");
    
    let hasSentryDsn = false;
    
    if (fs.existsSync(envExample)) {
      const content = fs.readFileSync(envExample, "utf8");
      if (content.includes("SENTRY_DSN")) hasSentryDsn = true;
    }
    
    if (fs.existsSync(envFile)) {
      const content = fs.readFileSync(envFile, "utf8");
      if (content.includes("SENTRY_DSN")) hasSentryDsn = true;
    }

    // Also check if it's in the Sentry files themselves (as fallback docs)
    const clientFile = resolveSentryFile("sentry.client");
    if (clientFile) {
      const content = fs.readFileSync(clientFile, "utf8");
      if (content.includes("SENTRY_DSN")) hasSentryDsn = true;
    }
    
    expect(hasSentryDsn, "SENTRY_DSN must be documented somewhere").toBe(true);
  });

  test("sentry client filters dev errors", () => {
    const filePath = resolveSentryFile("sentry.client");
    if (!filePath) {
      test.skip();
      return;
    }
    const content = fs.readFileSync(filePath, "utf8");
    // Must have dev mode filtering to avoid sending dev errors
    expect(content).toContain("development");
    expect(content).toContain("beforeSend");
  });

  test("sentry server filters expected errors", () => {
    const filePath = resolveSentryFile("sentry.server");
    if (!filePath) {
      test.skip();
      return;
    }
    const content = fs.readFileSync(filePath, "utf8");
    // Must filter Shopify auth redirects (302) and rate limits (429)
    expect(content).toContain("302");
    expect(content).toContain("429");
  });

  test("sample rates are production-safe", () => {
    const clientPath = resolveSentryFile("sentry.client");
    const serverPath = resolveSentryFile("sentry.server");
    
    if (clientPath) {
      const content = fs.readFileSync(clientPath, "utf8");
      // Should NOT have tracesSampleRate: 1.0 hardcoded for production
      // Should have conditional sampling
      expect(content).toContain("production");
    }
    
    if (serverPath) {
      const content = fs.readFileSync(serverPath, "utf8");
      expect(content).toContain("production");
    }
  });
});

// ── Security tests ──
test.describe("Sentry Integration - Security", () => {
  test("DSN is never hardcoded in source files", () => {
    const fileNames = ["sentry.client", "sentry.server", "sentry-wrapper.server"];
    
    for (const name of fileNames) {
      const filePath = resolveSentryFile(name);
      if (!filePath) continue;
      
      const content = fs.readFileSync(filePath, "utf8");
      // DSN format: https://xxx@xxx.ingest.sentry.io/xxx
      const dsnPattern = /https:\/\/[a-f0-9]+@[a-z0-9]+\.ingest\.sentry\.io\/\d+/;
      expect(
        dsnPattern.test(content),
        `${name} must NOT contain hardcoded DSN`
      ).toBe(false);
    }
  });

  test("sentry auth token is not in source code", () => {
    const fileNames2 = ["sentry.client", "sentry.server"];
    
    for (const name of fileNames2) {
      const filePath = resolveSentryFile(name);
      if (!filePath) continue;
      
      const content = fs.readFileSync(filePath, "utf8");
      expect(content).not.toContain("sntrys_");
      expect(content).not.toContain("SENTRY_AUTH_TOKEN=");
    }
  });
});

// playwright.config.cjs
// ═══════════════════════════════════════════════════
// Playwright E2E Testing Configuration for Smart Ads AI
//
// USAGE:
//   1. Start app:  npx shopify app dev
//   2. Note the port (e.g. "Local: http://localhost:60876/")
//   3. Run tests:  set TEST_PORT=60876 && npx playwright test
//   4. With browser visible: set TEST_PORT=60876 && npx playwright test --headed
// ═══════════════════════════════════════════════════

const { defineConfig } = require("@playwright/test");

// Port from env variable, or default 3457
const PORT = process.env.TEST_PORT || "3457";
const BASE_URL = `http://localhost:${PORT}`;

console.log(`\n  Playwright using: ${BASE_URL}\n`);

module.exports = defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.cjs",
  timeout: 60000,
  retries: 1,
  workers: 1, // Shopify app = single instance, no parallel

  use: {
    baseURL: BASE_URL,
    headless: true,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
    // Viewport matching typical Shopify admin iframe
    viewport: { width: 1280, height: 800 },
  },

  // Reporter
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "test-results/html" }],
  ],

  // Output for screenshots/videos on failure
  outputDir: "test-results/artifacts",

  // NO webServer — app must already be running via "npx shopify app dev"
  // (Shopify CLI assigns random ports, so we can't auto-start it)
});

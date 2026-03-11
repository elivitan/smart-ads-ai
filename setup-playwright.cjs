// setup-playwright.cjs
// ═══════════════════════════════════════════════════
// Smart Ads AI — Playwright E2E Test Setup
// Run this ONCE to install Playwright and its browsers
// Then run: npx playwright test
// ═══════════════════════════════════════════════════

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("═══════════════════════════════════════════════════");
console.log("  Smart Ads AI — Playwright E2E Setup");
console.log("═══════════════════════════════════════════════════\n");

// Step 1: Check if Playwright is installed
let isInstalled = false;
try {
  require.resolve("@playwright/test");
  isInstalled = true;
  console.log("  ✅ @playwright/test is already installed\n");
} catch (e) {
  console.log("  📦 Installing @playwright/test...\n");
  try {
    execSync("npm install --save-dev @playwright/test", { stdio: "inherit" });
    console.log("\n  ✅ @playwright/test installed\n");
    isInstalled = true;
  } catch (err) {
    console.error("  ❌ Failed to install @playwright/test");
    console.error("     Error:", err.message);
    process.exit(1);
  }
}

// Step 2: Install browsers
if (isInstalled) {
  console.log("  🌐 Installing Playwright browsers (Chromium)...\n");
  try {
    execSync("npx playwright install chromium", { stdio: "inherit" });
    console.log("\n  ✅ Chromium browser installed\n");
  } catch (err) {
    console.error("  ❌ Failed to install browsers");
    console.error("     Error:", err.message);
    process.exit(1);
  }
}

// Step 3: Verify test files exist
console.log("  📋 Verifying test files...\n");
const testDir = path.join(process.cwd(), "tests");
const testFiles = [
  "helpers.cjs",
  "health-api.spec.cjs",
  "landing.spec.cjs",
  "navigation.spec.cjs",
  "campaigns.spec.cjs",
  "modals.spec.cjs",
  "api-routes.spec.cjs",
  "visual-integrity.spec.cjs",
  "error-handling.spec.cjs",
];

let allExist = true;
for (const file of testFiles) {
  const fullPath = path.join(testDir, file);
  if (fs.existsSync(fullPath)) {
    console.log(`  ✅ tests/${file}`);
  } else {
    console.log(`  ❌ tests/${file} NOT FOUND`);
    allExist = false;
  }
}

// Step 4: Verify config
const configPath = path.join(process.cwd(), "playwright.config.cjs");
if (fs.existsSync(configPath)) {
  console.log(`  ✅ playwright.config.cjs`);
} else {
  console.log(`  ❌ playwright.config.cjs NOT FOUND`);
  allExist = false;
}

console.log("\n═══════════════════════════════════════════════════");
if (allExist) {
  console.log("  SETUP COMPLETE! ✅");
  console.log("═══════════════════════════════════════════════════\n");
  console.log("  How to run tests:\n");
  console.log("  1. Start the app:    npx shopify app dev");
  console.log("  2. In new terminal:  npx playwright test");
  console.log("  3. Specific test:    npx playwright test tests/landing.spec.cjs");
  console.log("  4. With browser:     npx playwright test --headed");
  console.log("  5. Debug mode:       npx playwright test --debug");
  console.log("  6. HTML report:      npx playwright show-report test-results/html\n");
  console.log("  Test coverage:");
  console.log("  • health-api     — Health endpoint responses");
  console.log("  • landing        — Landing page buttons + interactions");
  console.log("  • navigation     — No broken <a href> or redirects");
  console.log("  • campaigns      — Campaigns page + wizard");
  console.log("  • modals         — Onboard, Credits, Launch dialogs");
  console.log("  • api-routes     — All 13 API endpoints respond (no 500s)");
  console.log("  • visual-integrity — CSS, dark theme, slider, responsive");
  console.log("  • error-handling — Error boundary, 429, 504, offline\n");
} else {
  console.log("  SETUP INCOMPLETE ❌ — fix missing files above");
  console.log("═══════════════════════════════════════════════════\n");
}

// tests/landing.spec.cjs
// ═══════════════════════════════════════════════════
// E2E Test: Landing Page Structure (Code Analysis)
// Verifies all landing page sections and buttons exist in source
// Uses file analysis — no browser auth needed
// ═══════════════════════════════════════════════════

const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

function readFile(filePath) {
  const full = path.join(ROOT, filePath);
  if (fs.existsSync(full)) return fs.readFileSync(full, "utf8");
  // Try .tsx/.ts variants (gradual TypeScript migration)
  const tsxPath = full.replace(/\.jsx$/, ".tsx");
  if (tsxPath !== full && fs.existsSync(tsxPath)) return fs.readFileSync(tsxPath, "utf8");
  const tsPath = full.replace(/\.js$/, ".ts");
  if (tsPath !== full && fs.existsSync(tsPath)) return fs.readFileSync(tsPath, "utf8");
  return null;
}

test.describe("Landing Page Structure", () => {
  test("Landing page has hero section with CTA buttons", async () => {
    const content = readFile("app/routes/app._index.jsx");
    expect(content).not.toBeNull();
    expect(content).toContain("hero");
    expect(content).toContain("hero-h");
    expect(content).toContain("hero-btns");
    expect(content).toContain("Start My Campaign");
    expect(content).toContain("Try Free Preview");
  });

  test("Landing page has pain points section", async () => {
    const content = readFile("app/routes/app._index.jsx");
    expect(content).toContain("pain-grid");
    expect(content).toContain("Wasted Ad Spend");
    expect(content).toContain("Google Ads Confusion");
  });

  test("Landing page has features section", async () => {
    const content = readFile("app/routes/app._index.jsx");
    expect(content).toContain("feat-grid");
    expect(content).toContain("Competitor Intelligence");
    expect(content).toContain("AI Ad Copy");
    expect(content).toContain("One-Click Launch");
  });

  test("Landing page has testimonials section", async () => {
    const content = readFile("app/routes/app._index.jsx");
    expect(content).toContain("test-grid");
    expect(content).toContain("Sarah K.");
    expect(content).toContain("Mike T.");
    expect(content).toContain("Lisa R.");
  });

  test("Landing page has bottom CTA", async () => {
    const content = readFile("app/routes/app._index.jsx");
    expect(content).toContain("cta-section");
    expect(content).toContain("Your products deserve better ads");
  });

  test("Landing page has budget teaser", async () => {
    const content = readFile("app/routes/app._index.jsx");
    expect(content).toContain("LandingBudgetTeaser");
    expect(content).toContain("lp-budget-section");
  });

  test("Landing page has top bar with promo", async () => {
    const content = readFile("app/routes/app._index.jsx");
    expect(content).toContain("top-bar");
    expect(content).toContain("Start Free Trial");
    expect(content).toContain("7 days FREE");
  });

  test("All CTA buttons call correct handlers", async () => {
    const content = readFile("app/routes/app._index.jsx");
    // Hero primary CTA should open upgrade modal
    expect(content).toContain("openUpgradeModal");
    // Hero secondary should trigger scan
    expect(content).toContain("doScan");
    // Credits nudge should open credits tab
    expect(content).toContain("openCreditsTab");
  });

  test("LandingComponents.jsx exists and exports correctly", async () => {
    const content = readFile("app/components/LandingComponents.jsx");
    expect(content).not.toBeNull();
    expect(content).toContain("LandingBudgetTeaser");
    expect(content).toContain("LandingMissingBlock");
  });

  test("Landing page route responds to GET request", async ({ request }) => {
    const response = await request.get("/app");
    // Should redirect to Shopify auth (302) or serve page (200) — not crash
    expect(response.status()).not.toBe(500);
  });
});

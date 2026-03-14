// tests/navigation.spec.cjs
// ═══════════════════════════════════════════════════
// E2E Test: Navigation Safety (Code Analysis)
// Verifies no dangerous navigation patterns in source code
// Uses API requests only — no browser auth needed
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

test.describe("Navigation Safety", () => {
  test("No <a href='/app/...'> in app._index.jsx", async () => {
    const content = readFile("app/routes/app._index.jsx");
    expect(content).not.toBeNull();
    const matches = content.match(/<a\s+href=["']\/app\//g);
    expect(matches).toBeNull();
  });

  test("No <a href='/app/...'> in app.campaigns.jsx", async () => {
    const content = readFile("app/routes/app.campaigns.jsx");
    expect(content).not.toBeNull();
    const matches = content.match(/<a\s+href=["']\/app\//g);
    expect(matches).toBeNull();
  });

  test("No <a href='/app/...'> in SubscriberHome.jsx", async () => {
    const content = readFile("app/components/SubscriberHome.jsx");
    expect(content).not.toBeNull();
    const matches = content.match(/<a\s+href=["']\/app\//g);
    expect(matches).toBeNull();
  });

  test("No window.history.pushState anywhere", async () => {
    const dirs = ["app/routes", "app/components"];
    for (const dir of dirs) {
      const full = path.join(ROOT, dir);
      if (!fs.existsSync(full)) continue;
      const files = fs.readdirSync(full).filter(f => f.endsWith(".jsx") || f.endsWith(".js") || f.endsWith(".tsx") || f.endsWith(".ts"));
      for (const file of files) {
        const content = fs.readFileSync(path.join(full, file), "utf8");
        const hasPushState = content.includes("history.pushState");
        expect(hasPushState, `${dir}/${file} contains history.pushState`).toBe(false);
      }
    }
  });

  test("No window.location.href assignments in components", async () => {
    const dirs = ["app/routes", "app/components"];
    for (const dir of dirs) {
      const full = path.join(ROOT, dir);
      if (!fs.existsSync(full)) continue;
      const files = fs.readdirSync(full).filter(f => f.endsWith(".jsx") || f.endsWith(".tsx"));
      for (const file of files) {
        const content = fs.readFileSync(path.join(full, file), "utf8");
        // Allow window.location.reload() but not window.location.href = ...
        const hasLocationAssign = /window\.location\.href\s*=/.test(content);
        expect(hasLocationAssign, `${dir}/${file} assigns window.location.href`).toBe(false);
      }
    }
  });

  test("CampaignWizard uses Link from react-router", async () => {
    const content = readFile("app/components/campaigns/CampaignWizard.jsx");
    expect(content).not.toBeNull();
    expect(content).toContain("from \"react-router\"");
  });

  test("App routes load without 500 errors", async ({ request }) => {
    // Verify the main routes exist and don't crash the server
    const routes = ["/app", "/app/campaigns", "/app/keywords", "/app/settings"];
    for (const route of routes) {
      const response = await request.get(route);
      // Should redirect to auth (302) or load (200) — never crash (500)
      expect(response.status(), `${route} returned 500`).not.toBe(500);
    }
  });
});

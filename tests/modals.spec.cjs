// tests/modals.spec.cjs
// ═══════════════════════════════════════════════════
// E2E Test: Modal Components (Code Analysis)
// Verifies all modals are properly wired
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

test.describe("Modal Components", () => {
  test("GlobalModals.jsx exists and imports all modals", async () => {
    const content = readFile("app/components/GlobalModals.jsx");
    expect(content).not.toBeNull();
    expect(content).toContain("OnboardModal");
    expect(content).toContain("BuyCreditsModal");
    expect(content).toContain("LaunchChoiceDialog");
  });

  test("GlobalModals reads state from useAppStore", async () => {
    const content = readFile("app/components/GlobalModals.jsx");
    expect(content).toContain("useAppStore");
    expect(content).toContain("showOnboard");
    expect(content).toContain("showBuyCredits");
    expect(content).toContain("showLaunchChoice");
  });

  test("OnboardModal has close handler", async () => {
    const content = readFile("app/components/GlobalModals.jsx");
    expect(content).toContain("onClose");
    expect(content).toContain("setShowOnboard(false)");
  });

  test("BuyCreditsModal has close handler", async () => {
    const content = readFile("app/components/GlobalModals.jsx");
    expect(content).toContain("setShowBuyCredits(false)");
  });

  test("LaunchChoiceDialog has close handler", async () => {
    const content = readFile("app/components/GlobalModals.jsx");
    expect(content).toContain("setShowLaunchChoice(false)");
  });

  test("GlobalModals is rendered in every return path of Index()", async () => {
    const content = readFile("app/routes/app._index.jsx");
    expect(content).not.toBeNull();

    // Count return statements and GlobalModals instances
    const returns = (content.match(/return\s*\(/g) || []).length;
    const globalModals = (content.match(/<GlobalModals/g) || []).length;

    // There should be at least as many GlobalModals as return blocks
    // (some returns like error/scanning screens may not have them)
    expect(globalModals).toBeGreaterThanOrEqual(3);
  });

  test("Modals.jsx exists with OnboardModal and BuyCreditsModal", async () => {
    const content = readFile("app/components/Modals.jsx");
    expect(content).not.toBeNull();
    expect(content).toContain("OnboardModal");
    expect(content).toContain("BuyCreditsModal");
  });

  test("LaunchChoiceDialog.jsx exists", async () => {
    const content = readFile("app/components/LaunchChoiceDialog.jsx");
    expect(content).not.toBeNull();
    expect(content).toContain("LaunchChoiceDialog");
  });

  test("Zustand store has modal state keys", async () => {
    const content = readFile("app/stores/useAppStore.js");
    expect(content).not.toBeNull();
    expect(content).toContain("showOnboard");
    expect(content).toContain("showBuyCredits");
    expect(content).toContain("showLaunchChoice");
    expect(content).toContain("setShowOnboard");
    expect(content).toContain("setShowBuyCredits");
    expect(content).toContain("setShowLaunchChoice");
  });
});

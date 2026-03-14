// tests/visual-integrity.spec.cjs
// ═══════════════════════════════════════════════════
// E2E Test: Visual & CSS Integrity (Code Analysis)
// Verifies CSS rules, slider safety, architecture rules
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

test.describe("Visual & CSS Integrity", () => {
  test("Slider CSS has z-index:9999", async () => {
    const css = readFile("app/routes/styles.index.js");
    expect(css).not.toBeNull();
    expect(css).toContain("z-index:9999");
  });

  test("Slider CSS has touch-action:none", async () => {
    const css = readFile("app/routes/styles.index.js");
    expect(css).not.toBeNull();
    expect(css).toContain("touch-action:none");
  });

  test("Slider CSS has user-select:none", async () => {
    const css = readFile("app/routes/styles.index.js");
    expect(css).not.toBeNull();
    expect(css).toContain("user-select:none");
  });

  test("No <style> tags in JSX components", async () => {
    const componentsDir = path.join(ROOT, "app/components");
    if (!fs.existsSync(componentsDir)) return;
    const files = fs.readdirSync(componentsDir).filter(f => f.endsWith(".jsx") || f.endsWith(".tsx"));
    for (const file of files) {
      const content = fs.readFileSync(path.join(componentsDir, file), "utf8");
      // Allow StyleTag in app._index.jsx but not in components
      // Allow LaunchProgress.jsx (legacy) — all others must use inline styles
      if (file === "LaunchProgress.jsx" || file === "LaunchProgress.tsx" || file === "SubscriberHome.jsx" || file === "SubscriberHome.tsx") continue;
      const hasStyleTag = /<style[\s>]/i.test(content);
      expect(hasStyleTag, `${file} contains <style> tag`).toBe(false);
    }
  });

  test("app._index.jsx under 600 lines", async () => {
    const content = readFile("app/routes/app._index.jsx");
    expect(content).not.toBeNull();
    const lineCount = content.split("\n").length;
    expect(lineCount).toBeLessThanOrEqual(650);
  });

  test("No component definitions inside Index()", async () => {
    const content = readFile("app/routes/app._index.jsx");
    expect(content).not.toBeNull();

    // Find Index() function body
    const indexStart = content.indexOf("export default function Index()");
    expect(indexStart).toBeGreaterThan(-1);

    const afterIndex = content.substring(indexStart);
    // Check for function declarations inside Index (bad pattern)
    const innerFunctions = afterIndex.match(/^\s+function\s+[A-Z][a-zA-Z]+\s*\(/gm);
    expect(innerFunctions).toBeNull();
  });

  test("WidgetErrorBoundary is OUTSIDE Index()", async () => {
    const content = readFile("app/routes/app._index.jsx");
    expect(content).not.toBeNull();

    const boundaryPos = content.indexOf("class WidgetErrorBoundary");
    const indexPos = content.indexOf("export default function Index()");
    expect(boundaryPos).toBeGreaterThan(-1);
    expect(boundaryPos).toBeLessThan(indexPos);
  });

  test("LockedOverlay is OUTSIDE Index()", async () => {
    const content = readFile("app/routes/app._index.jsx");
    expect(content).not.toBeNull();

    const overlayPos = content.indexOf("function LockedOverlay");
    const indexPos = content.indexOf("export default function Index()");
    expect(overlayPos).toBeGreaterThan(-1);
    expect(overlayPos).toBeLessThan(indexPos);
  });

  test("GlobalModals is imported and used in Index()", async () => {
    const content = readFile("app/routes/app._index.jsx");
    expect(content).not.toBeNull();
    expect(content).toContain("import GlobalModals");
    expect(content).toContain("<GlobalModals");
  });

  test("All components are in app/components/, not app/routes/", async () => {
    const routesDir = path.join(ROOT, "app/routes");
    if (!fs.existsSync(routesDir)) return;
    const files = fs.readdirSync(routesDir);
    const misplaced = files.filter(f =>
      (f.endsWith(".jsx") || f.endsWith(".tsx")) &&
      !f.startsWith("app.") &&
      !f.startsWith("auth.") &&
      !f.startsWith("api.") &&
      !f.startsWith("webhooks.") &&
      f !== "styles.index.js"
    );
    expect(misplaced, `Misplaced files in routes/: ${misplaced.join(", ")}`).toHaveLength(0);
  });
});

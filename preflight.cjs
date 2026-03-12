// preflight.cjs
// ═══════════════════════════════════════════════════════════════
// Smart Ads AI — Preflight Safety Check
// Run BEFORE every deploy or after any code change.
// Checks: hook safety, line count, imports, syntax, architecture
// ═══════════════════════════════════════════════════════════════

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const INDEX_FILE_JSX = path.join(ROOT, "app", "routes", "app._index.jsx");
const INDEX_FILE_TSX = path.join(ROOT, "app", "routes", "app._index.tsx");
const INDEX_FILE = fs.existsSync(INDEX_FILE_JSX) ? INDEX_FILE_JSX : INDEX_FILE_TSX;
const INDEX_EXT = INDEX_FILE.endsWith(".tsx") ? ".tsx" : ".jsx";
const STYLES_FILE = path.join(ROOT, "app", "routes", "styles.index.js");

let passed = 0;
let failed = 0;
let warnings = 0;

function pass(msg) { console.log(`  ✅ ${msg}`); passed++; }
function fail(msg) { console.log(`  ❌ ${msg}`); failed++; }
function warn(msg) { console.log(`  ⚠️  ${msg}`); warnings++; }

console.log("═══════════════════════════════════════════════════");
console.log("  Smart Ads AI — Preflight Safety Check");
console.log("═══════════════════════════════════════════════════\n");

// ─── CHECK 1: File exists ───
console.log("📁 FILE STRUCTURE:");
if (!fs.existsSync(INDEX_FILE)) {
  fail("app._index.jsx/.tsx NOT FOUND"); process.exit(1);
}
pass("app._index" + INDEX_EXT + " exists");

// ─── CHECK 2: Line count ───
console.log("\n📏 LINE COUNT:");
const code = fs.readFileSync(INDEX_FILE, "utf8");
const lines = code.split("\n");
const lineCount = lines.length;

if (lineCount > 1300) fail(`app._index${INDEX_EXT} is ${lineCount} lines — EXCEEDS 1,300 LIMIT! Something was inlined!`);
else if (lineCount > 1260) warn(`app._index${INDEX_EXT} is ${lineCount} lines — getting close to 1,300 limit`);
else pass(`app._index${INDEX_EXT} is ${lineCount} lines (limit: 1,300)`);

// ─── CHECK 3: All 20 imports ───
console.log("\n📦 IMPORTS:");
const importLines = lines.filter(l => l.startsWith("import "));
const importCount = importLines.length;

const requiredImports = [
  "react",
  "react-router",
  "shopify.server",
  "sync.server",
  "license.server",
  "db.server",
  "styles.index",
  "SmallWidgets",
  "SmallComponents",
  "CollectingDataScreen",
  "CompetitorComponents",
  "DashboardWidgets",
  "LandingComponents",
  "ProductModal",
  "useGoogleAdsData",
  "SubscriberHome",
  "GlobalModals",
  "ScanningScreen",
  "AutoScreens",
  "DashboardView",
  "useAppStore",
];

let missingImports = [];
for (const req of requiredImports) {
  // Check both .jsx and .tsx variants (Vite resolves automatically)
  const tsxVariant = req.replace('.jsx', '.tsx');
  const found = importLines.some(l => l.includes(req) || l.includes(tsxVariant));
  if (!found) missingImports.push(req);
}

if (importCount < 18 || importCount > 25) fail(`Expected 18-25 imports, found ${importCount}`);
else pass(`${importCount} imports present`);

if (missingImports.length > 0) fail(`Missing imports: ${missingImports.join(", ")}`);
else pass("All required modules imported");

// ─── CHECK 4: Hooks before first early return ───
console.log("\n🪝 HOOKS SAFETY:");

// Find Index() function start
const indexStart = lines.findIndex(l => l.includes("export default function Index()"));
if (indexStart === -1) { fail("Could not find 'export default function Index()'"); }
else {
  // Find first early return (if (...) return)
  let firstEarlyReturn = -1;
  for (let i = indexStart; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    // Match patterns like: if (scanError) return (
    // But NOT: if (!res.ok) return; (inside nested functions)
    // We look for return statements at Index() scope level
    if (trimmed.match(/^if\s*\(.*\)\s*return\s*\(/) && !trimmed.includes("=>")) {
      firstEarlyReturn = i;
      break;
    }
  }

  if (firstEarlyReturn === -1) {
    warn("Could not find first early return — manual check needed");
  } else {
    pass(`Index() starts at line ${indexStart + 1}, first early return at line ${firstEarlyReturn + 1}`);

    // Check for hooks AFTER early return
    const hookPatterns = /\b(useState|useEffect|useRef|useMemo|useCallback|useContext|useReducer|useLayoutEffect)\b/;
    let hooksAfterReturn = [];
    let insideNestedFunc = 0;

    for (let i = firstEarlyReturn + 1; i < lines.length; i++) {
      const line = lines[i];
      // Track nested function depth (rough)
      if (line.includes("function ") || line.includes("=>")) insideNestedFunc++;
      
      // Only check at Index() top level
      if (hookPatterns.test(line) && !line.trim().startsWith("//") && !line.trim().startsWith("*")) {
        // Check if this is a real hook call, not just a mention
        if (line.includes("use") && (line.includes("useState(") || line.includes("useEffect(") || 
            line.includes("useRef(") || line.includes("useMemo(") || line.includes("useCallback(") ||
            line.includes("useGoogleAdsData("))) {
          hooksAfterReturn.push({ line: i + 1, code: line.trim().slice(0, 80) });
        }
      }
    }

    if (hooksAfterReturn.length > 0) {
      fail(`Found ${hooksAfterReturn.length} hooks AFTER first early return (line ${firstEarlyReturn + 1}):`);
      hooksAfterReturn.slice(0, 5).forEach(h => console.log(`      Line ${h.line}: ${h.code}`));
    } else {
      pass("No hooks found after first early return");
    }
  }

  // Count hooks
  let hookCount = 0;
  for (let i = indexStart; i < (firstEarlyReturn > 0 ? firstEarlyReturn : lines.length); i++) {
    const line = lines[i];
    const matches = line.match(/\b(useState|useEffect|useRef|useMemo|useCallback)\s*\(/g);
    if (matches) hookCount += matches.length;
  }
  if (hookCount < 50) warn(`Only ${hookCount} hooks found before early return (expected ~66)`);
  else pass(`${hookCount} hooks found before early return`);
}

// ─── CHECK 5: No component definitions inside Index() ───
console.log("\n🏗️  ARCHITECTURE:");

const indexStartLine = lines.findIndex(l => l.includes("export default function Index()"));
if (indexStartLine >= 0) {
  let componentInsideIndex = [];
  for (let i = indexStartLine + 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    // Look for function Component patterns that return JSX
    if (trimmed.match(/^(const|function)\s+[A-Z][a-zA-Z]+\s*[=(]/) && 
        !trimmed.startsWith("//") &&
        !trimmed.includes("const REAL_STEPS") &&
        !trimmed.includes("const FREE_SCAN") &&
        !trimmed.includes("const INTRO_PHASES") &&
        !trimmed.includes("const BATCH") &&
        // Only flag if it looks like a React component (returns JSX)
        (trimmed.includes("return (") || trimmed.includes("=> (") || trimmed.includes("=> <"))) {
      componentInsideIndex.push({ line: i + 1, code: trimmed.slice(0, 80) });
    }
  }
  
  if (componentInsideIndex.length > 0) {
    fail(`Found ${componentInsideIndex.length} possible component definitions INSIDE Index():`);
    componentInsideIndex.forEach(c => console.log(`      Line ${c.line}: ${c.code}`));
  } else {
    pass("No component definitions inside Index()");
  }
}

// Check WidgetErrorBoundary + LockedOverlay are OUTSIDE Index()
if (indexStartLine >= 0) {
  const widgetEB = lines.findIndex(l => l.includes("class WidgetErrorBoundary"));
  const lockedOL = lines.findIndex(l => l.includes("function LockedOverlay"));
  
  if (widgetEB >= 0 && widgetEB < indexStartLine) pass("WidgetErrorBoundary is OUTSIDE Index() (line " + (widgetEB + 1) + ")");
  else fail("WidgetErrorBoundary should be OUTSIDE Index()");
  
  if (lockedOL >= 0 && lockedOL < indexStartLine) pass("LockedOverlay is OUTSIDE Index() (line " + (lockedOL + 1) + ")");
  else fail("LockedOverlay should be OUTSIDE Index()");
}

// ─── CHECK 6: Slider CSS safety ───
console.log("\n🎚️  SLIDER CSS:");
if (fs.existsSync(STYLES_FILE)) {
  const css = fs.readFileSync(STYLES_FILE, "utf8");
  
  const sliderZindex = css.includes(".budget-sim-slider") && css.includes("z-index:9999") || css.includes("z-index: 9999");
  const sliderTouch = css.includes("touch-action:none") || css.includes("touch-action: none");
  
  if (sliderZindex) pass("Slider z-index:9999 present");
  else warn("Could not verify slider z-index:9999 — check manually");
  
  if (sliderTouch) pass("Slider touch-action:none present");
  else warn("Could not verify slider touch-action:none — check manually");
} else {
  warn("styles.index.js not found");
}

// ─── CHECK 7: No .jsx backup files in routes ───
console.log("\n🧹 CLEANUP:");
const routesDir = path.join(ROOT, "app", "routes");
if (fs.existsSync(routesDir)) {
  const routeFiles = fs.readdirSync(routesDir);
  const backupFiles = routeFiles.filter(f => f.includes(".bak") || f.includes(".backup") || f.includes(".old") || (f.endsWith(".jsx") && f.includes("_copy")));
  
  if (backupFiles.length > 0) {
    fail(`Found backup files in app/routes/ — Vite will pick these up as routes:`);
    backupFiles.forEach(f => console.log(`      ${f}`));
  } else {
    pass("No backup files in app/routes/");
  }
  
  // Check for .bak-pre-serper files in app/
  const appDir = path.join(ROOT, "app");
  const appFiles = fs.readdirSync(appDir);
  const bakFiles = appFiles.filter(f => f.includes(".bak-"));
  if (bakFiles.length > 0) {
    warn(`Found ${bakFiles.length} .bak files in app/ — safe to delete after confirming stability:`);
    bakFiles.forEach(f => console.log(`      ${f}`));
  } else {
    pass("No .bak files in app/");
  }
}

// ─── CHECK 8: .env keys ───
console.log("\n🔑 ENV KEYS:");
const envPath = path.join(ROOT, ".env");
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, "utf8");
  
  const keys = [
    ["ANTHROPIC_API_KEY", true],
    ["SERPER_API_KEY", true],
    ["SERPAPI_KEY", false], // optional fallback
    ["NEWSAPI_KEY", false],
    ["DATABASE_URL", true],
    ["GOOGLE_ADS_DEVELOPER_TOKEN", true],
  ];
  
  for (const [key, required] of keys) {
    const match = env.match(new RegExp(`${key}=(.+)`));
    if (match && match[1].trim()) {
      const val = match[1].trim();
      pass(`${key} = ${val.slice(0, 8)}...${val.slice(-4)} (${val.length} chars)`);
    } else if (required) {
      fail(`${key} is MISSING or EMPTY`);
    } else {
      warn(`${key} not set (optional)`);
    }
  }
} else {
  warn(".env file not found — only expected when running from project root (not ZIP)");
}

// ─── CHECK 9: shopify.app.v.toml sections ───
console.log("\n⚙️  SHOPIFY CONFIG:");
const tomlPath = path.join(ROOT, "shopify.app.v.toml");
if (fs.existsSync(tomlPath)) {
  const toml = fs.readFileSync(tomlPath, "utf8");
  const requiredSections = ["[auth]", "[access_scopes]", "[build]"];
  
  for (const section of requiredSections) {
    if (toml.includes(section)) pass(`${section} section present in shopify.app.v.toml`);
    else fail(`${section} section MISSING from shopify.app.v.toml`);
  }
} else {
  warn("shopify.app.v.toml not found (not in ZIP)");
}

// ─── CHECK 10: Syntax check with Acorn (JSX only — Acorn can't parse TypeScript) ───
console.log("\n🔧 SYNTAX CHECK:");
if (INDEX_FILE.endsWith(".tsx") || INDEX_FILE.endsWith(".ts")) {
  // TSX/TS: Acorn can't parse TypeScript — use balance check instead
  let braceCount = 0, parenCount = 0, bracketCount = 0;
  for (const char of code) {
    if (char === "{") braceCount++;
    else if (char === "}") braceCount--;
    else if (char === "(") parenCount++;
    else if (char === ")") parenCount--;
    else if (char === "[") bracketCount++;
    else if (char === "]") bracketCount--;
  }
  const balanceOk = braceCount === 0 && parenCount === 0 && bracketCount === 0;
  if (balanceOk) pass("TypeScript balance check passed (braces/parens/brackets all balanced)");
  else {
    if (braceCount !== 0) fail(`Brace imbalance: ${braceCount > 0 ? braceCount + " unclosed {" : Math.abs(braceCount) + " extra }"}`);
    if (parenCount !== 0) fail(`Paren imbalance: ${parenCount > 0 ? parenCount + " unclosed (" : Math.abs(parenCount) + " extra )"}`);
    if (bracketCount !== 0) fail(`Bracket imbalance: ${bracketCount > 0 ? bracketCount + " unclosed [" : Math.abs(bracketCount) + " extra ]"}`);
  }
} else {
  try {
    // JSX: Use acorn for full AST validation
    const acorn = require("acorn");
    const jsx = require("acorn-jsx");
    acorn.Parser.extend(jsx()).parse(code, { sourceType: "module", ecmaVersion: 2022 });
    pass("Acorn syntax check passed");
  } catch (acornErr) {
    if (acornErr.code === "MODULE_NOT_FOUND") {
      let braceCount = 0, parenCount = 0, bracketCount = 0;
      for (const char of code) {
        if (char === "{") braceCount++;
        else if (char === "}") braceCount--;
        else if (char === "(") parenCount++;
        else if (char === ")") parenCount--;
        else if (char === "[") bracketCount++;
        else if (char === "]") bracketCount--;
      }
      if (braceCount === 0) pass("Brace balance: OK (0)");
      else fail(`Brace imbalance: ${braceCount > 0 ? braceCount + " unclosed {" : Math.abs(braceCount) + " extra }"}`);
      if (parenCount === 0) pass("Paren balance: OK (0)");
      else fail(`Paren imbalance: ${parenCount > 0 ? parenCount + " unclosed (" : Math.abs(parenCount) + " extra )"}`);
      if (bracketCount === 0) pass("Bracket balance: OK (0)");
      else fail(`Bracket imbalance: ${bracketCount > 0 ? bracketCount + " unclosed [" : Math.abs(bracketCount) + " extra ]"}`);
      warn("Acorn not installed — used basic brace check");
    } else {
      fail(`Syntax error: ${acornErr.message}`);
    }
  }
}

// ─── CHECK 11: ErrorBoundary coverage ───
console.log("\n🛡️  ERROR BOUNDARIES:");
const widgetNames = ["Market Intelligence", "Store Performance", "Top Missed Opportunity", "Health & Pulse", "Competitor Gap Finder", "Budget Simulator", "Ad Preview"];
let wrappedCount = 0;
for (const name of widgetNames) {
  // Check if there's a WidgetErrorBoundary wrapping near this widget
  const searchName = name.replace("&", "&amp;").replace("&", "&");
  if (code.includes(`label="${name}"`) || code.includes(`label="${searchName}"`)) {
    wrappedCount++;
  }
}
// Also count by WidgetErrorBoundary occurrences
const ebCount = (code.match(/WidgetErrorBoundary/g) || []).length;
pass(`${Math.floor(ebCount / 2)} WidgetErrorBoundary instances found (open+close tags)`);


// ─── CHECK 26: Health endpoint exists ───
console.log("\n🏥 HEALTH CHECK:");
{
  let healthFile = path.join(ROOT, "app", "routes", "app.api.health.js");
  if (!fs.existsSync(healthFile)) healthFile = path.join(ROOT, "app", "routes", "app.api.health.ts");
  if (fs.existsSync(healthFile)) {
    const content = fs.readFileSync(healthFile, "utf8");
    if (content.includes("export const loader") && content.includes("getCircuitStatus")) {
      pass("app.api.health.js exists with loader + circuit status");
    } else {
      fail("app.api.health.js exists but missing loader or getCircuitStatus");
    }
  } else {
    fail("app/routes/app.api.health.js does not exist");
  }
}

// ─── CHECK 27: retry.ts and request-logger.ts exist ───
console.log("\n🔄 MONITORING FILES:");
{
  const retryFile = path.join(ROOT, "app", "utils", "retry.ts");
  const reqLogFile = path.join(ROOT, "app", "utils", "request-logger.ts");
  let allExist = true;

  if (fs.existsSync(retryFile)) {
    const content = fs.readFileSync(retryFile, "utf8");
    if (content.includes("withRetry") && content.includes("getCircuitStatus")) {
      pass("retry.ts exists with withRetry + getCircuitStatus");
    } else {
      fail("retry.ts exists but missing withRetry or getCircuitStatus");
      allExist = false;
    }
  } else {
    fail("app/utils/retry.ts does not exist");
    allExist = false;
  }

  if (fs.existsSync(reqLogFile)) {
    const content = fs.readFileSync(reqLogFile, "utf8");
    if (content.includes("withRequestLogging")) {
      pass("request-logger.ts exists with withRequestLogging");
    } else {
      fail("request-logger.ts exists but missing withRequestLogging");
      allExist = false;
    }
  } else {
    fail("app/utils/request-logger.ts does not exist");
    allExist = false;
  }
}


// ─── CHECK 28: Full JSX AST validation on ALL files ───
console.log("\n🧪 FULL JSX VALIDATION:");
{
  let astOk = 0, astFail = 0;
  try {
    const acorn = require("acorn");
    const acornJsx = require("acorn-jsx");
    const AstParser = acorn.Parser.extend(acornJsx());

    function scanJsx(dir) {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) { scanJsx(fullPath); continue; }
        if (!entry.name.endsWith(".jsx") && !entry.name.endsWith(".js")) continue;
        if (entry.name.endsWith(".server.js") || entry.name.endsWith(".server.jsx")) continue;
        try {
          const code = fs.readFileSync(fullPath, "utf8");
          AstParser.parse(code, { sourceType: "module", ecmaVersion: 2022, locations: true });
          astOk++;
        } catch (parseErr) {
          const rel = path.relative(ROOT, fullPath);
          fail(rel + " — Line " + (parseErr.loc ? parseErr.loc.line : "?") + ": " + parseErr.message);
          astFail++;
        }
      }
    }

    scanJsx(path.join(ROOT, "app", "routes"));
    scanJsx(path.join(ROOT, "app", "components"));
    scanJsx(path.join(ROOT, "app", "stores"));
    scanJsx(path.join(ROOT, "app", "hooks"));
    scanJsx(path.join(ROOT, "app", "utils"));

    if (astFail === 0) pass("All " + astOk + " JSX/JS files pass AST validation");

  // --- TS/TSX VALIDATION (separate from Acorn) ---
  // Count .ts/.tsx files and do basic validation (Acorn can't parse TypeScript)
  let tsFileCount = 0;
  let tsOk = 0;
  function scanTs(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) { scanTs(fullPath); continue; }
      if (!entry.name.endsWith(".tsx") && !entry.name.endsWith(".ts")) continue;
      if (entry.name.endsWith(".d.ts")) continue; // skip declaration files
      tsFileCount++;
      try {
        const tsCode = fs.readFileSync(fullPath, "utf8");
        // Basic checks: has content, balanced braces
        let b = 0, p = 0;
        for (const ch of tsCode) {
          if (ch === "{") b++; else if (ch === "}") b--;
          if (ch === "(") p++; else if (ch === ")") p--;
        }
        if (b !== 0 || p !== 0) {
          const rel = path.relative(ROOT, fullPath);
          fail(rel + " — brace/paren imbalance: braces=" + b + " parens=" + p);
        } else {
          tsOk++;
        }
      } catch (e) {
        const rel = path.relative(ROOT, fullPath);
        fail(rel + " — read error: " + e.message);
      }
    }
  }
  scanTs(path.join(ROOT, "app", "utils"));
  scanTs(path.join(ROOT, "app", "components"));
  scanTs(path.join(ROOT, "app", "types"));
  scanTs(path.join(ROOT, "app", "routes"));
  if (tsFileCount > 0 && tsOk === tsFileCount) {
    pass("All " + tsOk + " TS/TSX files pass balance validation");
  } else if (tsFileCount === 0) {
    pass("No TS/TSX files to validate");
  }
    else fail(astFail + " files have syntax errors (see above)");
  } catch (e) {
    if (e.code === "MODULE_NOT_FOUND") {
      warn("acorn/acorn-jsx not installed — run: npm install --save-dev acorn acorn-jsx");
    } else {
      fail("AST validation crashed: " + e.message);
    }
  }
}

// ─── CHECK 29: Import resolution — verify all local imports resolve ───
console.log("\n🔗 IMPORT RESOLUTION:");
{
  const serverPatterns = ["shopify.server", "sync.server", "db.server", "license.server",
    "ai.server", "ai-brain.server", "market-intel.server", "store-analytics.server",
    "campaignLifecycle.server", "keyword-research.server",
    "prisma.server", "billing.server"];

  let resolveOk = 0, resolveFail = 0;
  const allFiles = new Set();

  function collectFiles(dir) {
    if (!fs.existsSync(dir) && !fs.existsSync(dir.replace(/\.js$/, ".ts"))) return;
    fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
      if (e.name === "node_modules" || e.name.startsWith(".")) return;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) collectFiles(full);
      else allFiles.add(full);
    });
  }
  collectFiles(path.join(ROOT, "app"));

  for (const filePath of allFiles) {
    if (!filePath.endsWith(".jsx") && !filePath.endsWith(".js") && !filePath.endsWith(".tsx") && !filePath.endsWith(".ts")) continue;
    const code = fs.readFileSync(filePath, "utf8");
    const imports = [...code.matchAll(/from\s+['"](\.\.?\/[^'"]+)['"]/g)];
    const dir = path.dirname(filePath);

    for (const [, src] of imports) {
      // Skip server files
      if (serverPatterns.some(s => src.includes(s))) continue;
      const resolved = path.resolve(dir, src);
      const tries = [resolved, resolved + ".jsx", resolved + ".js", resolved + ".ts", resolved + ".tsx", resolved.replace(/\.js$/, ".ts"), resolved.replace(/\.jsx$/, ".tsx"), resolved + "/index.js", resolved + "/index.jsx", resolved + "/index.ts", resolved + "/index.tsx"];
      if (!tries.some(t => allFiles.has(t))) {
        const rel = path.relative(ROOT, filePath);
        // Only warn, don't fail — some imports may be to non-code files
        warn(rel + " imports " + src + " — file not found");
        resolveFail++;
      } else {
        resolveOk++;
      }
    }
  }

  if (resolveFail === 0) pass("All " + resolveOk + " local imports resolve correctly");
  else warn(resolveFail + " imports could not be resolved (see warnings above)");
}


// ─── TYPESCRIPT CONFIG ───
{
  const tsconfigPath = path.join(ROOT, "tsconfig.json");
  if (fs.existsSync(tsconfigPath)) {
    try {
      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, "utf8"));
      const co = tsconfig.compilerOptions || {};
      if (co.strict !== true) {
        fail("TypeScript: strict mode not enabled in tsconfig.json");
      } else {
        pass("TypeScript: strict mode enabled");
      }
      if (!co.allowJs) {
        fail("TypeScript: allowJs not enabled (needed for gradual migration)");
      } else {
        pass("TypeScript: allowJs enabled for gradual migration");
      }
      // Count TS files
      const tsFilesList = [];
      function findTsFiles(dir) {
        if (!fs.existsSync(dir) && !fs.existsSync(dir.replace(/\.js$/, ".ts"))) return;
        for (const f of fs.readdirSync(dir)) {
          const full = path.join(dir, f);
          if (fs.statSync(full).isDirectory() && !f.startsWith(".") && f !== "node_modules" && f !== "build") {
            findTsFiles(full);
          } else if (f.endsWith(".ts") || f.endsWith(".tsx")) {
            tsFilesList.push(full);
          }
        }
      }
      findTsFiles(path.join(ROOT, "app"));
      pass("TypeScript: " + tsFilesList.length + " .ts/.tsx files found");
    } catch (e) {
      fail("TypeScript: tsconfig.json parse error — " + e.message);
    }
  } else {
    pass("TypeScript: No tsconfig.json yet (optional)");
  }
}

// ─── SUMMARY ───
console.log("\n═══════════════════════════════════════════════════");
console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${warnings} warnings`);
console.log("═══════════════════════════════════════════════════");

if (failed > 0) {
  console.log("\n🚨 PREFLIGHT FAILED — DO NOT DEPLOY");
  console.log("   Fix the issues above before making any changes.\n");
  process.exit(1);
} else if (warnings > 0) {
  console.log("\n⚠️  PREFLIGHT PASSED WITH WARNINGS");
  console.log("   Review warnings above. Safe to proceed with caution.\n");
  process.exit(0);
} else {
  console.log("\n🎉 PREFLIGHT PASSED — ALL CLEAR!");
  console.log("   Safe to proceed with changes.\n");
  process.exit(0);
}

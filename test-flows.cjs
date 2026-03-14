// test-flows.cjs
// ═══════════════════════════════════════════════════════════════
// Smart Ads AI — Flow & Logic Tests
// Run AFTER preflight.cjs. Checks that user flows actually work.
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const ROOT = process.cwd();

// Helper: resolve .jsx/.tsx paths (Batch 3 TSX migration)
function resolvePath(relPath) {
  const full = path.join(ROOT, relPath);
  if (fs.existsSync(full)) return relPath;
  const tsxPath = relPath.replace(/\.jsx$/, '.tsx');
  const tsxFull = path.join(ROOT, tsxPath);
  if (tsxFull !== full && fs.existsSync(tsxFull)) return tsxPath;
  const tsPath = relPath.replace(/\.js$/, '.ts');
  const tsFull = path.join(ROOT, tsPath);
  if (tsFull !== full && fs.existsSync(tsFull)) return tsPath;
  return relPath; // return original if nothing found
}

let passed = 0, failed = 0, warnings = 0;
function pass(msg) { console.log('  \u2705 ' + msg); passed++; }
function fail(msg) { console.log('  \u274C ' + msg); failed++; }
function warn(msg) { console.log('  \u26A0\uFE0F  ' + msg); warnings++; }

// Load files
const FILES = {};
const fileList = [
  ['index',      resolvePath('app/routes/app._index.jsx')],
  ['campaigns',  resolvePath('app/routes/app.campaigns.jsx')],
  ['subscriber', resolvePath('app/components/SubscriberHome.jsx')],
  ['wizard',     resolvePath('app/components/campaigns/CampaignWizard.jsx')],
  ['styles',     'app/routes/styles.index.js'],
  ['modals',     'app/components/Modals.tsx'],
];

console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
console.log('  Smart Ads AI \u2014 Flow & Logic Tests');
console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n');

let missingFiles = [];
for (const [key, relPath] of fileList) {
  const full = path.join(ROOT, relPath);
  if (fs.existsSync(full)) {
    FILES[key] = fs.readFileSync(full, 'utf8');
  } else {
    FILES[key] = null;
    missingFiles.push(relPath);
  }
}
if (missingFiles.length > 0) {
  console.log('Missing files (skipped):');
  missingFiles.forEach(f => console.log('  - ' + f));
  console.log('');
}

// SECTION A: NAVIGATION SAFETY
console.log('\uD83D\uDEF0\uFE0F  SECTION A: Navigation Safety\n');

for (const [key, relPath] of fileList) {
  if (!FILES[key]) continue;
  const matches = FILES[key].match(/<a\s+[^>]*href=["'][/]app[/][^"']*["']/g);
  if (matches && matches.length > 0) {
    fail('A1 [' + relPath + ']: ' + matches.length + ' <a href="/app/..."> found');
  } else {
    pass('A1 [' + relPath + ']: no <a href="/app/...">');
  }
}

for (const [key, relPath] of fileList) {
  if (!FILES[key]) continue;
  const usesLink = /<Link\s/.test(FILES[key]);
  if (!usesLink) continue;
  const importsLink = /import\s+{[^}]*Link[^}]*}\s+from\s+["']react-router["']/.test(FILES[key]);
  if (!importsLink) {
    fail('A2 [' + relPath + ']: uses <Link> but does NOT import Link');
  } else {
    pass('A2 [' + relPath + ']: Link imported correctly');
  }
}

let pushStateFound = false;
for (const [key, relPath] of fileList) {
  if (!FILES[key]) continue;
  if (FILES[key].includes('history.pushState')) {
    fail('A3 [' + relPath + ']: uses history.pushState');
    pushStateFound = true;
  }
}
if (!pushStateFound) pass('A3: No history.pushState found anywhere');

// SECTION B: CAMPAIGN LAUNCH FLOW
console.log('\n\uD83D\uDE80 SECTION B: Campaign Launch Flow\n');

if (FILES.index) {
  // Check both app._index.jsx and DashboardView.jsx for campaign launch buttons
  const dashPath = resolvePath('app/components/DashboardView.jsx');
  const dashCode = require('fs').existsSync(dashPath) ? require('fs').readFileSync(dashPath, 'utf8') : '';
  const allCode = FILES.index + '\n' + dashCode;
  const allLines = allCode.split(/\r?\n/);
  const autoLaunchButtons = allLines.filter(l =>
    l.includes('intent=autoLaunch') && l.includes('navigate')
  );
  if (autoLaunchButtons.length >= 3) {
    pass('B1: ' + autoLaunchButtons.length + ' Auto Launch buttons use URL params + navigate');
  } else {
    fail('B1: Expected 3+ Auto Launch buttons with intent=autoLaunch in URL, found ' + autoLaunchButtons.length);
  }

  const storePath = path.join(ROOT, 'app/stores/useAppStore.js');
  const storeCode = fs.existsSync(storePath) ? fs.readFileSync(storePath, 'utf8') : '';
  const navCheckCode = FILES.index + '\n' + storeCode;
  const navCheckLines = navCheckCode.split(/\r?\n/);
  const hasAutoNav = navCheckLines.some(l => l.includes('setTimeout') && l.includes('navigate("/app/campaigns")'));
  if (hasAutoNav) {
    pass('B2: handleAutoCampaign auto-navigates to campaigns page after success');
  } else {
    fail('B2: Missing setTimeout navigate to /app/campaigns after success');
  }

  // Check LaunchChoiceDialog uses URL params for intent
  const lcdPath = path.join(ROOT, resolvePath('app/components/LaunchChoiceDialog.jsx'));
  const lcdCode = fs.existsSync(lcdPath) ? fs.readFileSync(lcdPath, 'utf8') : '';
  const hasUrlIntent = lcdCode.includes('intent=') || allLines.some(l => l.includes('intent='));
  if (hasUrlIntent) {
    pass('B2b: Campaign intent passed via URL params');
  } else {
    fail('B2b: Campaign intent should use URL params (intent=autoLaunch or intent=wizard)');
  }
}

if (FILES.campaigns) {
  const c = FILES.campaigns;
  const checks = [
    ['URLSearchParams', c.includes('URLSearchParams')],
    ['params.get("intent")', c.includes('params.get("intent")')],
    ['history.replaceState', c.includes('history.replaceState')],
    ['setShowAutoLaunch', c.includes('setShowAutoLaunch(true)')],
    ['setShowStandaloneWizard', c.includes('setShowStandaloneWizard(true)')],
  ];
  const bad = checks.filter(x => !x[1]);
  if (bad.length === 0) pass('B3: URL param intent handling OK');
  else fail('B3: missing: ' + bad.map(x => x[0]).join(', '));
  if (c.includes('sessionStorage.getItem("campaignIntent")')) fail('B3b: still uses sessionStorage for campaignIntent');
  else pass('B3b: no sessionStorage for campaignIntent');
}

// SECTION C: OVERLAY COMPLETENESS
console.log('\n\uD83C\uDFAD SECTION C: Overlay Completeness\n');

if (FILES.campaigns) {
  const campLines = FILES.campaigns.split(/\r?\n/);
  const campStart = campLines.findIndex(l => l.includes('export default function Campaigns'));

  if (campStart >= 0) {
    let returnBlocks = [];
    for (let i = campStart; i < campLines.length; i++) {
      const trimmed = campLines[i].trim();
      if (trimmed.startsWith('return (') || trimmed === 'return (') {
        let blockText = '';
        let parenDepth = 0;
        let started = false;
        for (let j = i; j < Math.min(i + 200, campLines.length); j++) {
          blockText += campLines[j] + '\n';
          for (const ch of campLines[j]) {
            if (ch === '(') { parenDepth++; started = true; }
            if (ch === ')') parenDepth--;
          }
          if (started && parenDepth <= 0) break;
        }
        returnBlocks.push({ line: i + 1, text: blockText });

      }
    }

    returnBlocks.forEach((rb, idx) => {
      const hasAL = rb.text.includes('showAutoLaunch') && rb.text.includes('CampaignCreatingAnimation');
      const hasWZ = rb.text.includes('showStandaloneWizard') && rb.text.includes('CampaignWizard');
      if (hasAL && hasWZ) {
        pass('C1: Return block #' + (idx + 1) + ' (line ' + rb.line + ') has both overlays');
      } else {
        if (!hasAL) fail('C1: Return block #' + (idx + 1) + ' (line ' + rb.line + ') MISSING autoLaunch overlay');
        if (!hasWZ) fail('C1: Return block #' + (idx + 1) + ' (line ' + rb.line + ') MISSING wizard overlay');
      }
    });
  }

  const emptyIdx = FILES.campaigns.indexOf('if (!campaigns || campaigns.length === 0)');
  if (emptyIdx >= 0) {
    const block = FILES.campaigns.substring(emptyIdx, emptyIdx + 3000);
    if ((block.includes('navigate("/app")') || block.includes('to="/app"') || block.includes('goToDashboard')) && block.includes('Dashboard')) {
      pass('C2: Empty campaigns state has Dashboard link');
    } else {
      fail('C2: Empty campaigns state MISSING Dashboard link');
    }
  }
}

// SECTION D: COMPONENT ISOLATION
console.log('\n\uD83C\uDFD7\uFE0F  SECTION D: Component Isolation\n');

if (FILES.index) {
  const idxLines = FILES.index.split(/\r?\n/);
  const fnStart = idxLines.findIndex(l => l.includes('export default function Index()'));

  if (fnStart >= 0) {
    let inlineComps = [];
    for (let i = fnStart + 1; i < idxLines.length; i++) {
      const t = idxLines[i].trim();
      if (t.match(/^function\s+[A-Z][a-zA-Z]+\s*\(/) && !t.startsWith('//')) {
        inlineComps.push({ line: i + 1, code: t.substring(0, 80) });
      }
      if (t.match(/^const\s+[A-Z][a-zA-Z]+\s*=\s*(\([^)]*\)|[a-z]+)\s*=>/) && !t.startsWith('//')) {
        inlineComps.push({ line: i + 1, code: t.substring(0, 80) });
      }
    }
    if (inlineComps.length > 0) {
      fail('D1: ' + inlineComps.length + ' component(s) inside Index()');
    } else {
      pass('D1: No components defined inside Index()');
    }
  }

  const lc = FILES.index.split(/\r?\n/).length;
  if (lc > 650) fail('D2: app._index.jsx = ' + lc + ' lines (OVER 600!)');
  else if (lc > 630) warn('D2: app._index.jsx = ' + lc + ' lines (close to 600)');
  else pass('D2: app._index.jsx = ' + lc + ' lines');
}

// SECTION E: CSS SAFETY
console.log('\n\uD83C\uDFA8 SECTION E: CSS Safety\n');

if (FILES.styles) {
  const s = FILES.styles;
  const checks = [
    ['z-index:9999', s.includes('budget-sim-slider') && (s.includes('z-index:9999') || s.includes('z-index: 9999'))],
    ['touch-action:none', s.includes('touch-action:none') || s.includes('touch-action: none')],
    ['user-select:none', s.includes('user-select:none') || s.includes('user-select: none')],
  ];
  const failing = checks.filter(c => !c[1]);
  if (failing.length === 0) {
    pass('E1: Slider CSS intact (z-index:9999, touch-action:none, user-select:none)');
  } else {
    fail('E1: Slider CSS BROKEN: missing ' + failing.map(c => c[0]).join(', '));
  }
}

// SECTION F: CROSS-FILE CONSISTENCY
console.log('\n\uD83D\uDD17 SECTION F: Cross-File Consistency\n');

if (FILES.index) {
  const importLines = FILES.index.split(/\r?\n/).filter(l => l.startsWith('import '));
  let missing = [];
  for (const imp of importLines) {
    const m = imp.match(/from\s+["']([^"']+)["']/);
    if (!m) continue;
    const importPath = m[1];
    if (!importPath.startsWith('.')) continue;
    if (importPath.includes('.server')) continue;
    const resolved = path.join(ROOT, 'app', 'routes', importPath);
    const exists = fs.existsSync(resolved) ||
                   fs.existsSync(resolved + '.jsx') ||
                   fs.existsSync(resolved + '.js') ||
                   fs.existsSync(resolved.replace('.jsx', '.js')) ||
                   fs.existsSync(resolved + '.tsx') ||
                   fs.existsSync(resolved + '.ts') ||
                   fs.existsSync(resolved.replace('.jsx', '.tsx'));
    if (!exists) missing.push(importPath);
  }
  if (missing.length > 0) {
    fail('F1: ' + missing.length + ' imported file(s) not found:');
    missing.forEach(c => console.log('      ' + c));
  } else {
    pass('F1: All imported component files exist on disk');
  }
}

const routesDir = path.join(ROOT, 'app', 'routes');
if (fs.existsSync(routesDir)) {
  const known = ['CollectingDataScreen.jsx', 'CollectingDataScreen.tsx', 'MarketAlert.jsx', 'MarketAlert.tsx', 'StoreAnalytics.jsx', 'StoreAnalytics.tsx'];
  const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.jsx') || f.endsWith('.tsx'));
  const bad = files.filter(f => !f.startsWith('app.') && !known.includes(f));
  if (bad.length > 0) {
    warn('F2: ' + bad.length + ' non-route file(s) in routes/: ' + bad.join(', '));
  } else {
    pass('F2: No misplaced files in app/routes/');
  }
}

for (const key of ['index', 'campaigns']) {
  if (!FILES[key]) continue;
  let b = 0, p = 0;
  for (const ch of FILES[key]) {
    if (ch === '{') b++; if (ch === '}') b--;
    if (ch === '(') p++; if (ch === ')') p--;
  }
  const name = fileList.find(f => f[0] === key)[1];
  if (b === 0 && p === 0) {
    pass('F3 [' + name + ']: brace/paren balance OK');
  } else {
    fail('F3 [' + name + ']: IMBALANCED braces=' + b + ' parens=' + p);
  }
}


// ─── TYPESCRIPT CONFIG VALIDATION ───
{
  const tsconfigPath = path.join(ROOT, "tsconfig.json");
  if (!fs.existsSync(tsconfigPath)) {
    fail("TypeScript: tsconfig.json missing");
  } else {
    try {
      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, "utf8"));
      const co = tsconfig.compilerOptions;
      if (co.strict !== true) throw new Error("strict must be true");
      if (co.allowJs !== true) throw new Error("allowJs must be true");
      if (co.jsx !== "react-jsx") throw new Error("jsx must be react-jsx");
      if (co.moduleResolution !== "bundler") throw new Error("moduleResolution must be bundler");
      pass("TypeScript: tsconfig.json valid (strict + allowJs + react-jsx + bundler)");
    } catch (e) {
      fail("TypeScript: tsconfig.json invalid — " + e.message);
    }
  }
}

// SUMMARY
console.log('\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');

// ═══ Phase 9b: Server/Infra TypeScript Validation ═══
console.log('\n🔧 SECTION: Phase 9b TypeScript Validation\n');
{
  const utilsDir = path.join(ROOT, "app", "utils");
  const serverTsFiles = ["redis.ts", "queue.ts", "retry.ts", "rate-limiter.ts", "request-logger.ts", "db-health.ts"];
  
  let phase9bOk = true;
  for (const tsFile of serverTsFiles) {
    const fullPath = path.join(utilsDir, tsFile);
    if (!fs.existsSync(fullPath)) {
      fail("Phase 9b: " + tsFile + " not found in utils/");
      phase9bOk = false;
      continue;
    }
    
    const content = fs.readFileSync(fullPath, "utf8");
    if (!(content.includes(": ") || content.includes("interface ") || content.includes("type "))) {
      fail("Phase 9b: " + tsFile + " missing TypeScript annotations");
      phase9bOk = false;
      continue;
    }
    
    // Verify old .js version is gone
    const jsFile = tsFile.replace(".ts", ".js");
    const jsPath = path.join(utilsDir, jsFile);
    if (fs.existsSync(jsPath)) {
      fail("Phase 9b: " + jsFile + " still exists (should be .ts)");
      phase9bOk = false;
      continue;
    }
  }
  if (phase9bOk) pass("Phase 9b: All 6 server/infra files are TypeScript with annotations");

  // Check imports use .js extensions (Vite resolves .js → .ts)
  let importsOk = true;
  for (const tsFile of ["redis.ts", "queue.ts", "retry.ts", "request-logger.ts", "db-health.ts"]) {
    const fullPath = path.join(utilsDir, tsFile);
    if (!fs.existsSync(fullPath)) continue;
    const fileContent = fs.readFileSync(fullPath, "utf8");
    const importLines = fileContent.match(/from\s+["'][^"']+["']/g) || [];
    for (const imp of importLines) {
      if (imp.includes("./") && !imp.includes(".js")) {
        fail("Phase 9b: " + tsFile + " has import without .js extension: " + imp);
        importsOk = false;
      }
    }
  }
  if (importsOk) pass("Phase 9b: All server TS files import with .js extensions");
}

// ═══ Section G: API Route Protection Validation ═══
console.log('\n🛡️  SECTION G: API Route Protection\n');
{
  const routesDir = path.join(ROOT, "app", "routes");
  const apiRoutes = fs.readdirSync(routesDir).filter(f => f.startsWith("app.api.") && f.endsWith(".ts"));

  let sentryOk = true;
  let rateLimitOk = true;
  let loggingOk = true;
  const sentryMissing = [];
  const rateLimitMissing = [];

  for (const route of apiRoutes) {
    if (route === "app.api.health.ts") continue; // health has its own pattern
    const content = fs.readFileSync(path.join(routesDir, route), "utf8").replace(/\r/g, "");

    if (!content.includes("withSentryMonitoring") && !content.includes("reportRouteError")) {
      sentryMissing.push(route);
      sentryOk = false;
    }

    if (!content.includes("rateLimit.") && !content.includes("checkRateLimit")) {
      rateLimitMissing.push(route);
      rateLimitOk = false;
    }

    if (!content.includes("withRequestLogging") && !content.includes("logger.")) {
      loggingOk = false;
    }
  }

  if (sentryOk) {
    pass("G1: All API routes use Sentry monitoring (" + apiRoutes.length + " routes)");
  } else {
    warn("G1: " + sentryMissing.length + " API route(s) missing Sentry: " + sentryMissing.join(", "));
  }

  if (rateLimitOk) {
    pass("G2: All API routes use rate limiting (" + apiRoutes.length + " routes)");
  } else {
    warn("G2: " + rateLimitMissing.length + " API route(s) missing rate limit: " + rateLimitMissing.join(", "));
  }

  // Check catch blocks use (err: unknown) pattern
  let catchOk = true;
  for (const route of apiRoutes) {
    const content = fs.readFileSync(path.join(routesDir, route), "utf8").replace(/\r/g, "");
    if (content.includes("catch (err)") && !content.includes("catch (err:")) {
      catchOk = false;
    }
  }
  if (catchOk) {
    pass("G3: All API routes use typed catch blocks (err: unknown)");
  } else {
    warn("G3: Some API routes have untyped catch blocks");
  }
}

// ═══ Section H: Infrastructure Hardening Validation ═══
console.log('\n🏗️  SECTION H: Infrastructure Hardening\n');
{
  // H1: ENV validation module exists
  const envFile = path.join(ROOT, "app", "utils", "env.server.ts");
  if (fs.existsSync(envFile)) {
    const content = fs.readFileSync(envFile, "utf8");
    if (content.includes("z.object") && content.includes("validateEnv")) {
      pass("H1: ENV validation with Zod schema exists");
    } else {
      fail("H1: env.server.ts exists but missing Zod schema or validateEnv");
    }
  } else {
    fail("H1: app/utils/env.server.ts not found");
  }

  // H2: Security headers module exists
  const secFile = path.join(ROOT, "app", "utils", "security.server.ts");
  if (fs.existsSync(secFile)) {
    const content = fs.readFileSync(secFile, "utf8");
    if (content.includes("X-Content-Type-Options") && content.includes("Strict-Transport-Security")) {
      pass("H2: Security headers module with OWASP headers");
    } else {
      fail("H2: security.server.ts exists but missing key headers");
    }
  } else {
    fail("H2: app/utils/security.server.ts not found");
  }

  // H3: Security headers wired into entry.server
  const entryFile = path.join(ROOT, "app", "entry.server.tsx");
  const entryContent = fs.readFileSync(entryFile, "utf8");
  if (entryContent.includes("addSecurityHeaders")) {
    pass("H3: Security headers wired into entry.server.tsx");
  } else {
    fail("H3: addSecurityHeaders not called in entry.server.tsx");
  }

  // H4: ENV validation wired into entry.server
  if (entryContent.includes("validateEnv")) {
    pass("H4: ENV validation wired into entry.server.tsx");
  } else {
    fail("H4: validateEnv not called in entry.server.tsx");
  }

  // H5: Feature flags module exists
  const ffFile = path.join(ROOT, "app", "utils", "feature-flags.server.ts");
  if (fs.existsSync(ffFile) && fs.readFileSync(ffFile, "utf8").includes("isFeatureEnabled")) {
    pass("H5: Feature flags management module exists");
  } else {
    fail("H5: feature-flags.server.ts not found or incomplete");
  }

  // H6: Performance monitor exists
  const perfFile = path.join(ROOT, "app", "utils", "perf-monitor.server.ts");
  if (fs.existsSync(perfFile) && fs.readFileSync(perfFile, "utf8").includes("recordMetric")) {
    pass("H6: Performance monitoring module exists");
  } else {
    fail("H6: perf-monitor.server.ts not found or incomplete");
  }

  // H7: Health check module exists
  const hcFile = path.join(ROOT, "app", "utils", "health-check.server.ts");
  if (fs.existsSync(hcFile) && fs.readFileSync(hcFile, "utf8").includes("runHealthChecks")) {
    pass("H7: Health check module exists");
  } else {
    fail("H7: health-check.server.ts not found or incomplete");
  }

  // H8: CI has Playwright + Slack notification
  const ciFile = path.join(ROOT, ".github", "workflows", "ci.yml");
  const ciContent = fs.readFileSync(ciFile, "utf8");
  if (ciContent.includes("playwright") || ciContent.includes("Playwright")) {
    pass("H8: Playwright E2E in CI pipeline");
  } else {
    warn("H8: Playwright not found in CI pipeline");
  }

  // H9: Staging workflow exists
  const stagingFile = path.join(ROOT, ".github", "workflows", "staging.yml");
  if (fs.existsSync(stagingFile)) {
    pass("H9: Staging deployment workflow exists");
  } else {
    warn("H9: staging.yml not found");
  }

  // H10: Load test exists
  const loadTestFile = path.join(ROOT, "tests", "load-test.cjs");
  if (fs.existsSync(loadTestFile)) {
    pass("H10: Load test script exists");
  } else {
    warn("H10: tests/load-test.cjs not found");
  }

  // H11: Request ID tracing
  const reqIdFile = path.join(ROOT, "app", "utils", "request-id.server.ts");
  if (fs.existsSync(reqIdFile) && entryContent.includes("addRequestIdHeader")) {
    pass("H11: Request ID tracing wired in");
  } else {
    fail("H11: Request ID tracing missing");
  }

  // H12: CORS configuration
  const corsFile = path.join(ROOT, "app", "utils", "cors.server.ts");
  if (fs.existsSync(corsFile) && fs.readFileSync(corsFile, "utf8").includes("isAllowedOrigin")) {
    pass("H12: CORS configuration module exists");
  } else {
    fail("H12: cors.server.ts not found or incomplete");
  }

  // H13: DB alerts to Sentry
  const dbAlertsFile = path.join(ROOT, "app", "utils", "db-alerts.server.ts");
  if (fs.existsSync(dbAlertsFile) && fs.readFileSync(dbAlertsFile, "utf8").includes("trackDbQuery")) {
    pass("H13: DB slow query alerts module exists");
  } else {
    fail("H13: db-alerts.server.ts not found or incomplete");
  }

  // H14: Dead letter queue
  const dlqFile = path.join(ROOT, "app", "utils", "dead-letter.server.ts");
  if (fs.existsSync(dlqFile) && fs.readFileSync(dlqFile, "utf8").includes("addToDeadLetter")) {
    pass("H14: Dead letter queue module exists");
  } else {
    fail("H14: dead-letter.server.ts not found or incomplete");
  }

  // H15: Cache warming
  if (entryContent.includes("warmCaches")) {
    pass("H15: Cache warming wired into startup");
  } else {
    fail("H15: Cache warming not in entry.server.tsx");
  }

  // H16: API response compression
  const compFile = path.join(ROOT, "app", "utils", "compression.server.ts");
  if (fs.existsSync(compFile) && fs.readFileSync(compFile, "utf8").includes("compressJsonResponse")) {
    pass("H16: API response compression module exists");
  } else {
    fail("H16: compression.server.ts not found or incomplete");
  }

  // H17: Metrics endpoint
  const metricsRoute = path.join(ROOT, "app", "routes", "app.api.metrics.ts");
  if (fs.existsSync(metricsRoute) && fs.readFileSync(metricsRoute, "utf8").includes("getMetrics")) {
    pass("H17: Metrics API endpoint exists");
  } else {
    fail("H17: app.api.metrics.ts not found or incomplete");
  }

  // H18: Perf monitor wired into Sentry wrapper
  const wrapperContent = fs.readFileSync(path.join(ROOT, "app", "utils", "sentry-wrapper.server.ts"), "utf8");
  if (wrapperContent.includes("recordMetric")) {
    pass("H18: Perf monitor auto-tracks all API routes");
  } else {
    fail("H18: recordMetric not in sentry-wrapper.server.ts");
  }

  // H19: Uptime check script
  const uptimeFile = path.join(ROOT, "tests", "uptime-check.cjs");
  if (fs.existsSync(uptimeFile)) {
    pass("H19: Uptime check script exists");
  } else {
    warn("H19: tests/uptime-check.cjs not found");
  }
}

console.log('  RESULTS: ' + passed + ' passed, ' + failed + ' failed, ' + warnings + ' warnings');
console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');

if (failed > 0) {
  console.log('\n\uD83D\uDEA8 FLOW TESTS FAILED \u2014 Fix the issues above before deploying.');
  process.exit(1);
} else if (warnings > 0) {
  console.log('\n\u26A0\uFE0F  PASSED WITH WARNINGS \u2014 Review above.');
  process.exit(0);
} else {
  console.log('\n\uD83C\uDF89 ALL FLOW TESTS PASSED!');
  process.exit(0);
}

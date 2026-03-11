// test-flows.cjs
// ═══════════════════════════════════════════════════════════════
// Smart Ads AI — Flow & Logic Tests
// Run AFTER preflight.cjs. Checks that user flows actually work.
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const ROOT = process.cwd();

let passed = 0, failed = 0, warnings = 0;
function pass(msg) { console.log('  \u2705 ' + msg); passed++; }
function fail(msg) { console.log('  \u274C ' + msg); failed++; }
function warn(msg) { console.log('  \u26A0\uFE0F  ' + msg); warnings++; }

// Load files
const FILES = {};
const fileList = [
  ['index',      'app/routes/app._index.jsx'],
  ['campaigns',  'app/routes/app.campaigns.jsx'],
  ['subscriber', 'app/components/SubscriberHome.jsx'],
  ['wizard',     'app/components/campaigns/CampaignWizard.jsx'],
  ['styles',     'app/routes/styles.index.js'],
  ['modals',     'app/components/Modals.jsx'],
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
  const dashPath = 'app/components/DashboardView.jsx';
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
  const lcdPath = path.join(ROOT, 'app/components/LaunchChoiceDialog.jsx');
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

  // ═══ Phase 9b: Server/Infra TypeScript Validation ═══
  test("Phase 9b — server/infra files are TypeScript", () => {
    const serverTsFiles = ["redis.ts", "queue.ts", "retry.ts", "rate-limiter.ts", "request-logger.ts", "db-health.ts"];
    const utilsDir = findUtilsDir();
    
    for (const tsFile of serverTsFiles) {
      const fullPath = path.join(utilsDir, tsFile);
      assert(fs.existsSync(fullPath), tsFile + " should exist in utils/");
      
      const content = fs.readFileSync(fullPath, "utf8");
      // Verify it has TypeScript type annotations
      assert(
        content.includes(": ") || content.includes("interface ") || content.includes("type "),
        tsFile + " should contain TypeScript annotations"
      );
      
      // Verify old .js version is gone
      const jsFile = tsFile.replace(".ts", ".js");
      const jsPath = path.join(utilsDir, jsFile);
      assert(!fs.existsSync(jsPath), jsFile + " should NOT exist (replaced by .ts)");
    }
  });

  test("Phase 9b — server TS files import with .js extensions", () => {
    const serverTsFiles = ["redis.ts", "queue.ts", "retry.ts", "request-logger.ts", "db-health.ts"];
    const utilsDir = findUtilsDir();
    
    for (const tsFile of serverTsFiles) {
      const fullPath = path.join(utilsDir, tsFile);
      if (!fs.existsSync(fullPath)) continue;
      const content = fs.readFileSync(fullPath, "utf8");
      
      // All imports should use .js extension (Vite/Remix resolves .js → .ts)
      const importLines = content.match(/from\s+["'][^"']+["']/g) || [];
      for (const imp of importLines) {
        if (imp.includes("./") && !imp.includes(".js")) {
          throw new Error(tsFile + " has import without .js extension: " + imp);
        }
      }
    }
  });

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
  if (lc > 1300) fail('D2: app._index.jsx = ' + lc + ' lines (OVER 1300!)');
  else if (lc > 1280) warn('D2: app._index.jsx = ' + lc + ' lines (close to 1300)');
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
                   fs.existsSync(resolved.replace('.jsx', '.js'));
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
  const known = ['CollectingDataScreen.jsx', 'MarketAlert.jsx', 'StoreAnalytics.jsx'];
  const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.jsx'));
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

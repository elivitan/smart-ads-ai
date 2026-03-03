/**
 * patch-index.cjs
 * 
 * Run from project root: node patch-index.cjs
 * 
 * Fixes:
 * 1. Loader reads subscription from DB instead of cookie
 * 2. Frontend uses subscription from loader (not sessionStorage)
 * 3. After scan completes, reloads page so DB data refreshes (fixes scan loop)
 * 4. selectPlan saves to DB via API and updates local state from response
 */

const fs = require("fs");
const path = require("path");

const FILE = path.join("app", "routes", "app._index.jsx");
const backup = FILE + ".pre-dbpatch-" + Date.now();

console.log("\n🔧 Patching app._index.jsx for DB-backed subscriptions...\n");

if (!fs.existsSync(FILE)) {
  console.log("❌ File not found:", FILE);
  process.exit(1);
}

fs.copyFileSync(FILE, backup);
console.log("💾 Backup:", backup);

let code = fs.readFileSync(FILE, "utf-8");
const origSize = code.length;
let changes = 0;

// ═══════════════════════════════════════════════
// 1. ADD import for getSubscriptionInfo
// ═══════════════════════════════════════════════
if (!code.includes("getSubscriptionInfo")) {
  code = code.replace(
    'import { getShopProducts, getSyncStatus } from "../sync.server.js";',
    'import { getShopProducts, getSyncStatus } from "../sync.server.js";\nimport { getSubscriptionInfo } from "../license.server.js";'
  );
  console.log("✅ Added import for getSubscriptionInfo");
  changes++;
}

// ═══════════════════════════════════════════════
// 2. UPDATE LOADER to read subscription from DB
// ═══════════════════════════════════════════════
const oldLoader = `  const planFromCookie = getPlanFromCookie(request);
  const isPaidServer = !!planFromCookie && planFromCookie !== "free";
  return { products: dbProducts, syncStatus, shop, planFromCookie, isPaidServer, needsInitialSync };`;

const newLoader = `  // Read subscription from database (not cookie!)
  const subscription = await getSubscriptionInfo(shop);
  const isPaidServer = subscription.plan !== "free";
  return { products: dbProducts, syncStatus, shop, subscription, isPaidServer, needsInitialSync };`;

if (code.includes(oldLoader)) {
  code = code.replace(oldLoader, newLoader);
  console.log("✅ Updated loader to read subscription from DB");
  changes++;
} else {
  console.log("⚠️  Could not find loader pattern — check manually");
}

// ═══════════════════════════════════════════════
// 3. UPDATE useLoaderData destructure
// ═══════════════════════════════════════════════
const oldDestructure = `const { products: dbProducts, planFromCookie, isPaidServer, shop: shopDomain, needsInitialSync } = useLoaderData();`;
const newDestructure = `const { products: dbProducts, subscription: serverSubscription, isPaidServer, shop: shopDomain, needsInitialSync } = useLoaderData();`;

if (code.includes(oldDestructure)) {
  code = code.replace(oldDestructure, newDestructure);
  console.log("✅ Updated useLoaderData destructure");
  changes++;
} else {
  console.log("⚠️  Could not find useLoaderData pattern — check manually");
}

// ═══════════════════════════════════════════════
// 4. UPDATE selectedPlan initialization (from DB, not cookie/sessionStorage)
// ═══════════════════════════════════════════════
const oldPlanInit = `const [selectedPlan, setSelectedPlan] = useState(
    isPaidServer ? planFromCookie : ((() => { try { return sessionStorage.getItem("sai_plan") || null; } catch { return null; } })()))`;

// Try a more flexible match
const planInitRegex = /const \[selectedPlan, setSelectedPlan\] = useState\(\s*isPaidServer \? planFromCookie[^)]*\)\s*\)/;
const newPlanInit = `const [selectedPlan, setSelectedPlan] = useState(
    serverSubscription?.plan && serverSubscription.plan !== "free" ? serverSubscription.plan : null)`;

if (planInitRegex.test(code)) {
  code = code.replace(planInitRegex, newPlanInit);
  console.log("✅ Updated selectedPlan to use DB subscription");
  changes++;
} else if (code.includes("isPaidServer ? planFromCookie")) {
  // Simpler replacement
  code = code.replace(
    /isPaidServer \? planFromCookie[^)]*\)\s*\)/,
    `serverSubscription?.plan && serverSubscription.plan !== "free" ? serverSubscription.plan : null)`
  );
  console.log("✅ Updated selectedPlan (alt match)");
  changes++;
} else {
  console.log("⚠️  Could not find selectedPlan init — check manually");
}

// ═══════════════════════════════════════════════
// 5. UPDATE credits initialization (from DB, not sessionStorage)
// ═══════════════════════════════════════════════
const oldScanCredits = /const \[scanCredits, setScanCreditsRaw\] = useState\(\(\) => \{[^}]+\}\);/;
const newScanCredits = `const [scanCredits, setScanCreditsRaw] = useState(serverSubscription?.scanCredits || 0);`;

if (oldScanCredits.test(code)) {
  code = code.replace(oldScanCredits, newScanCredits);
  console.log("✅ Updated scanCredits to use DB value");
  changes++;
} else {
  console.log("⚠️  Could not find scanCredits init — check manually");
}

const oldAiCredits = /const \[aiCredits, setAiCreditsRaw\] = useState\(\(\) => \{[^}]+\}\);/;
const newAiCredits = `const [aiCredits, setAiCreditsRaw] = useState(serverSubscription?.aiCredits || 0);`;

if (oldAiCredits.test(code)) {
  code = code.replace(oldAiCredits, newAiCredits);
  console.log("✅ Updated aiCredits to use DB value");
  changes++;
} else {
  console.log("⚠️  Could not find aiCredits init — check manually");
}

// ═══════════════════════════════════════════════
// 6. UPDATE selectPlan to save to DB and update state from response
// ═══════════════════════════════════════════════
const oldSelectPlan = /function selectPlan\(plan\) \{[\s\S]*?\.catch\(\(\) => \{\}\);\s*\}/;

const newSelectPlan = `function selectPlan(plan) {
    setSelectedPlan(plan);
    setAiCredits({ starter: 10, pro: 200, premium: 1000 }[plan] || 0);
    // Save to DB via API
    fetch("/app/api/subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.success && data.subscription) {
          setScanCredits(data.subscription.scanCredits || 0);
          setAiCredits(data.subscription.aiCredits || 0);
        }
      })
      .catch(() => {});
  }`;

if (oldSelectPlan.test(code)) {
  code = code.replace(oldSelectPlan, newSelectPlan);
  console.log("✅ Updated selectPlan to save to DB");
  changes++;
} else {
  console.log("⚠️  Could not find selectPlan — check manually");
}

// ═══════════════════════════════════════════════
// 7. FIX SCAN LOOP: After scan completes, reload page
//    so loader re-reads from DB (analyzedCount updates)
// ═══════════════════════════════════════════════
const oldScanEnd = `setAiResults({ summary, recommended_budget:100, products:allAiProducts });
      setFakeProgress(100); setScanMsg(hasScanAccess ? "Your store is ready to grow 🎉" : "Preview ready!");
      triggerConfetti(); await new Promise(r => setTimeout(r, 800));`;

const newScanEnd = `setAiResults({ summary, recommended_budget:100, products:allAiProducts });
      setFakeProgress(100); setScanMsg(hasScanAccess ? "Your store is ready to grow 🎉" : "Preview ready!");
      triggerConfetti(); await new Promise(r => setTimeout(r, 800));

      // Reload page so loader refreshes DB data (fixes scan loop)
      window.location.reload();`;

if (code.includes(oldScanEnd)) {
  code = code.replace(oldScanEnd, newScanEnd);
  console.log("✅ Added page reload after scan to refresh DB data");
  changes++;
} else {
  console.log("⚠️  Could not find scan end pattern — check manually");
}

// ═══════════════════════════════════════════════
// 8. REMOVE getPlanFromCookie function (no longer needed)
// ═══════════════════════════════════════════════
const cookieHelper = /\/\/ Cookie helper[^]*?function getPlanFromCookie\(request\) \{[^}]*\{[^}]*\}[^}]*\}/;
if (cookieHelper.test(code)) {
  code = code.replace(cookieHelper, "// Subscription is now read from database via license.server.js");
  console.log("✅ Removed getPlanFromCookie (no longer needed)");
  changes++;
} else {
  console.log("⚠️  Could not find getPlanFromCookie — may already be removed");
}

// ═══════════════════════════════════════════════
// WRITE RESULT
// ═══════════════════════════════════════════════
fs.writeFileSync(FILE, code, "utf-8");
const newSize = code.length;

console.log(`
════════════════════════════════════════════
📊 Patch Results:
   Changes applied: ${changes}
   Original size: ${origSize.toLocaleString()} bytes
   New size:      ${newSize.toLocaleString()} bytes
   Backup:        ${backup}

Next: npm run dev
════════════════════════════════════════════
`);

// ═══════════════════════════════════════════════
// 5b. FALLBACK: Fix credits if regex didn't match
// ═══════════════════════════════════════════════
code = fs.readFileSync(FILE, "utf-8");
let extraChanges = 0;

const oldSC = 'const [scanCredits, setScanCreditsRaw] = useState(() => { try { const c = sessionStorage.getItem("sai_scan_credits"); return c ? parseInt(c) : 0; } catch { return 0; } });';
const newSC = 'const [scanCredits, setScanCreditsRaw] = useState(serverSubscription?.scanCredits || 0);';

const oldAC = 'const [aiCredits, setAiCreditsRaw] = useState(() => { try { const c = sessionStorage.getItem("sai_credits"); return c ? parseInt(c) : 0; } catch { return 0; } });';
const newAC = 'const [aiCredits, setAiCreditsRaw] = useState(serverSubscription?.aiCredits || 0);';

if (code.includes(oldSC)) {
  code = code.replace(oldSC, newSC);
  console.log("✅ Fixed scanCredits init (fallback)");
  extraChanges++;
}
if (code.includes(oldAC)) {
  code = code.replace(oldAC, newAC);
  console.log("✅ Fixed aiCredits init (fallback)");
  extraChanges++;
}

if (extraChanges > 0) {
  fs.writeFileSync(FILE, code, "utf-8");
  console.log(`✅ Applied ${extraChanges} extra credit fixes`);
}

// ═══════════════════════════════════════════════
// CLEANUP: Remove any .backup files from routes folder
// (they cause parser errors in Remix)
// ═══════════════════════════════════════════════
const routesDir = path.join("app", "routes");
const backupFiles = fs.readdirSync(routesDir).filter(f => f.includes(".backup") || f.includes(".pre-license") || f.includes(".pre-dbpatch"));
for (const f of backupFiles) {
  const fullPath = path.join(routesDir, f);
  fs.unlinkSync(fullPath);
  console.log("🗑️  Removed backup from routes:", f);
}

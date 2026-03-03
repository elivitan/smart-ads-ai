/**
 * patch-final.cjs
 * 
 * THE ONE PATCH TO FIX EVERYTHING
 * Run: node patch-final.cjs
 * 
 * Fixes:
 * 1. BLANK SCREEN: Remove 'fullSync' import that doesn't exist
 * 2. LOADER: Read subscription from DB instead of cookie
 * 3. FRONTEND: Use DB subscription data
 * 4. SCAN LOOP: Already fixed (!aiResults) - verify only
 */

const fs = require("fs");
const path = require("path");

const FILE = path.join("app", "routes", "app._index.jsx");
console.log("\n>>> Final comprehensive patch...\n");

let code = fs.readFileSync(FILE, "utf-8");
let changes = 0;

// ═══ FIX 1: BLANK SCREEN — fullSync doesn't exist ═══
if (code.includes("import { fullSync, getShopProducts, getSyncStatus }")) {
  code = code.replace(
    "import { fullSync, getShopProducts, getSyncStatus }",
    "import { getShopProducts, getSyncStatus }"
  );
  console.log("OK FIX 1: Removed fullSync import (was crashing the page)");
  changes++;
}

// ═══ FIX 2: Add license.server.js import ═══
if (!code.includes("getSubscriptionInfo")) {
  code = code.replace(
    'import { getShopProducts, getSyncStatus } from "../sync.server.js";',
    'import { getShopProducts, getSyncStatus } from "../sync.server.js";\nimport { getSubscriptionInfo } from "../license.server.js";'
  );
  console.log("OK FIX 2: Added getSubscriptionInfo import");
  changes++;
}

// ═══ FIX 3: Update loader to read from DB ═══
const oldLoader = `  const planFromCookie = getPlanFromCookie(request);
  const isPaidServer = !!planFromCookie && planFromCookie !== "free";
  return { products: dbProducts, syncStatus, shop, planFromCookie, isPaidServer, needsInitialSync };`;

const newLoader = `  const subscription = await getSubscriptionInfo(shop);
  const isPaidServer = subscription.plan !== "free";
  return { products: dbProducts, syncStatus, shop, subscription, isPaidServer, needsInitialSync };`;

if (code.includes(oldLoader)) {
  code = code.replace(oldLoader, newLoader);
  console.log("OK FIX 3: Loader reads subscription from DB");
  changes++;
}

// ═══ FIX 4: Update useLoaderData destructure ═══
const oldDestructure = 'const { products: dbProducts, planFromCookie, isPaidServer, shop: shopDomain, needsInitialSync } = useLoaderData();';
const newDestructure = 'const { products: dbProducts, subscription: serverSubscription, isPaidServer, shop: shopDomain, needsInitialSync } = useLoaderData();';

if (code.includes(oldDestructure)) {
  code = code.replace(oldDestructure, newDestructure);
  console.log("OK FIX 4: Updated useLoaderData destructure");
  changes++;
}

// ═══ FIX 5: Update selectedPlan init ═══
// Find the exact line with planFromCookie and replace
const lines = code.split("\n");
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("planFromCookie") && lines[i].includes("isPaidServer")) {
    lines[i] = "    serverSubscription && serverSubscription.plan !== 'free' ? serverSubscription.plan : null";
    console.log("OK FIX 5: Updated selectedPlan init (line " + (i+1) + ")");
    changes++;
    break;
  }
}
code = lines.join("\n");

// ═══ FIX 6: Update credits init from DB ═══
const oldSC = 'const [scanCredits, setScanCreditsRaw] = useState(() => { try { const c = sessionStorage.getItem("sai_scan_credits"); return c ? parseInt(c) : 0; } catch { return 0; } });';
const newSC = 'const [scanCredits, setScanCreditsRaw] = useState(serverSubscription?.scanCredits || 0);';
if (code.includes(oldSC)) {
  code = code.replace(oldSC, newSC);
  console.log("OK FIX 6a: scanCredits from DB");
  changes++;
}

const oldAC = 'const [aiCredits, setAiCreditsRaw] = useState(() => { try { const c = sessionStorage.getItem("sai_credits"); return c ? parseInt(c) : 0; } catch { return 0; } });';
const newAC = 'const [aiCredits, setAiCreditsRaw] = useState(serverSubscription?.aiCredits || 0);';
if (code.includes(oldAC)) {
  code = code.replace(oldAC, newAC);
  console.log("OK FIX 6b: aiCredits from DB");
  changes++;
}

// ═══ FIX 7: Update selectPlan to save to DB ═══
const oldSelect = /function selectPlan\(plan\) \{[\s\S]*?\.catch\(\(\) => \{\}\);\s*\}/;
const newSelect = `function selectPlan(plan) {
    setSelectedPlan(plan);
    setAiCredits({ starter: 10, pro: 200, premium: 1000 }[plan] || 0);
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

if (oldSelect.test(code)) {
  code = code.replace(oldSelect, newSelect);
  console.log("OK FIX 7: selectPlan saves to DB");
  changes++;
}

// ═══ VERIFY: Scan loop fix ═══
if (code.includes("analyzedCount === 0 && !aiResults")) {
  console.log("OK VERIFY: Scan loop fix already applied");
} else {
  console.log("!! Scan loop fix NOT found - check manually");
}

// ═══ CLEANUP: Remove backups from routes ═══
try {
  const routesDir = path.join("app", "routes");
  fs.readdirSync(routesDir)
    .filter(f => f.includes(".pre-") || f.includes(".backup"))
    .forEach(f => { fs.unlinkSync(path.join(routesDir, f)); console.log("Removed:", f); });
} catch {}

// ═══ WRITE ═══
fs.writeFileSync(FILE, code, "utf-8");
console.log("\nApplied " + changes + " fixes. Run: npm run dev\n");

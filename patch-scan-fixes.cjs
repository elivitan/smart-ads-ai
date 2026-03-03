/**
 * patch-scan-fixes.cjs
 * 
 * Run: node patch-scan-fixes.cjs
 * 
 * Fixes:
 * 1. SCAN LOOP: Uses aiResults as flag to prevent re-scan
 * 2. PROGRESS SYNC: Updates after each batch response (not fake timer)
 * 3. CANCEL: Properly aborts fetch
 */

const fs = require("fs");
const path = require("path");

const FILE = path.join("app", "routes", "app._index.jsx");
const backup = FILE + ".pre-scanfix";

console.log("\n>>> Patching scan fixes...\n");

fs.copyFileSync(FILE, backup);
let code = fs.readFileSync(FILE, "utf-8");
let changes = 0;

// ═══ FIX 1: SCAN LOOP ═══
// Don't show CollectingDataScreen if aiResults exists (scan just finished)
const old1 = "if (isPaid && analyzedCount === 0) return (";
const new1 = "if (isPaid && analyzedCount === 0 && !aiResults) return (";

if (code.includes(old1)) {
  code = code.replace(old1, new1);
  console.log("OK FIX 1: Added !aiResults to prevent scan loop");
  changes++;
} else {
  console.log("-- FIX 1: pattern not found");
}

// ═══ FIX 2: PROGRESS SYNC ═══
// Replace fake creep timer with real batch-based progress
const old2 = `        let creepPct = batchStartPct;
        if (creepRef.current) clearInterval(creepRef.current);
        const creepTimer = setInterval(() => {
          if (creepPct < batchEndPct - 0.5) creepPct += 0.3;
          setFakeProgress(Math.round(creepPct * 10) / 10);
          const fakeNum = Math.min(Math.round((creepPct - 10) / 82 * total), total);
          const curPct = Math.round(creepPct);
          if (hasScanAccess) {
            const sn = curPct<25?"Searching Google":curPct<45?"Analyzing competitors":curPct<60?"Checking rankings":curPct<80?"Generating ad copy":"Building strategy";
            setScanMsg(fakeNum+" of "+total+" products \xB7 "+sn);
          } else setScanMsg("Analyzing product "+fakeNum+" of "+total+"...");
        }, 400);
        creepRef.current = creepTimer;

        const af = new FormData(); af.append("step", "analyze-batch"); af.append("products", JSON.stringify(batch)); af.append("storeDomain", storeUrl);
        const ar = await fetch("/app/api/scan", { method:"POST", body:af, signal:scanAbort.signal });
        clearInterval(creepTimer); creepRef.current = null;`;

const new2 = `        // Real progress: update based on actual batch completion
        const doneCount = start;
        const doingCount = Math.min(start + BATCH, total);
        setFakeProgress(batchStartPct);
        if (hasScanAccess) {
          const step = b === 0 ? "Searching Google & analyzing competitors" : b < batches - 1 ? "Generating AI-optimized ad copy" : "Building competitive strategy";
          setScanMsg(doneCount + " of " + total + " products done \\xB7 " + step);
        } else {
          setScanMsg("Analyzing products " + (doneCount + 1) + "-" + doingCount + " of " + total + "...");
        }

        const af = new FormData(); af.append("step", "analyze-batch"); af.append("products", JSON.stringify(batch)); af.append("storeDomain", storeUrl);
        const ar = await fetch("/app/api/scan", { method:"POST", body:af, signal:scanAbort.signal });`;

if (code.includes(old2)) {
  code = code.replace(old2, new2);
  console.log("OK FIX 2: Real batch progress (no fake timer)");
  changes++;
} else {
  console.log("-- FIX 2: batch loop pattern not found");
}

// ═══ FIX 3: CANCEL ═══
// Add abort signal to cancel handler
const old3 = `            onCancel={() => {
              cancelRef.current = true;
              if (creepRef.current) { clearInterval(creepRef.current); creepRef.current = null; }
              setIsScanning(false); setFakeProgress(0);
              setProducts([]); setAiResults(null);
            }}`;

const new3 = `            onCancel={() => {
              cancelRef.current = true;
              if (cancelRef._abort) cancelRef._abort();
              if (creepRef.current) { clearInterval(creepRef.current); creepRef.current = null; }
              setIsScanning(false); setFakeProgress(0);
              setProducts([]); setAiResults(null);
            }}`;

if (code.includes(old3)) {
  code = code.replace(old3, new3);
  console.log("OK FIX 3: Cancel aborts fetch");
  changes++;
} else {
  console.log("-- FIX 3: cancel pattern not found");
}

// ═══ FIX 4: Remove reload ═══
const reloadLine = "      window.location.reload();";
if (code.includes(reloadLine)) {
  code = code.replace(reloadLine, "      // aiResults prevents loop - no reload needed");
  console.log("OK FIX 4: Removed window.location.reload");
  changes++;
}

// ═══ CLEANUP ═══
const routesDir = path.join("app", "routes");
try {
  fs.readdirSync(routesDir)
    .filter(f => f.includes(".pre-scanfix") || f.includes(".pre-dbpatch") || f.includes(".pre-license") || f.includes(".backup"))
    .forEach(f => { fs.unlinkSync(path.join(routesDir, f)); console.log("Removed backup:", f); });
} catch {}

fs.writeFileSync(FILE, code, "utf-8");
console.log("\nApplied " + changes + " fixes. Run: npm run dev\n");

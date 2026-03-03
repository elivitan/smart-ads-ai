// This is a Node.js script to patch app._index.jsx
// Run: node fix_patch.js

const fs = require('fs');
const path = require('path');

const filePath = path.join('app', 'routes', 'app._index.jsx');
let content = fs.readFileSync(filePath, 'utf8');
let changes = 0;

// ============================================
// FIX 1: Replace batch scanMsg + creepTimer
// OLD: _done count updates once per batch, separate _batchMsgs array
// NEW: creepTimer continuously updates both progress AND scanMsg with synced step names
// ============================================

const oldBatch = `        const _done = Math.min(start + BATCH_SIZE, total);
        if (isPaid) {
          const _batchMsgs = [
            \`Searching Google for your competitors... 🔍\`,
            \`Scraping competitor websites for keywords... 🕵️\`,
            \`Checking where your store ranks in Google... 📊\`,
            \`Writing headlines that beat your competition... ✍️\`,
            \`Building your competitive ad strategy... 🎯\`,
          ];
          setScanMsg(\`\${_done} of \${total} products done — \` + _batchMsgs[b % _batchMsgs.length]);
        } else {
          setScanMsg(\`Analyzing product \${_done} of \${total}...\`);
        }

        const batchStartPct = 10 + Math.round((b / batches) * 82);
        const batchEndPct = 10 + Math.round(((b + 1) / batches) * 82);

        let creepPct = batchStartPct;
        const creepTarget = batchEndPct - 3;
        const creepTimer = setInterval(() => {
          if (creepPct < creepTarget) {
            creepPct = Math.min(creepPct + 0.3, creepTarget);
            setFakeProgress(Math.round(creepPct * 10) / 10);
          }
        }, 300);`;

const newBatch = `        const batchStartPct = 10 + Math.round((b / batches) * 82);
        const batchEndPct = 10 + Math.round(((b + 1) / batches) * 82);

        let creepPct = batchStartPct;
        const creepTarget = batchEndPct - 3;
        const creepTimer = setInterval(() => {
          if (creepPct < creepTarget) {
            creepPct = Math.min(creepPct + 0.3, creepTarget);
            setFakeProgress(Math.round(creepPct * 10) / 10);
          }
          // Sync scanMsg with percentage — same thresholds as dynamicSteps on the left
          const curPct = Math.round(creepPct);
          const fakeProductNum = Math.min(Math.round((creepPct - 10) / 82 * total), total);
          if (isPaid) {
            let stepName;
            if (curPct < 25) stepName = "Searching Google for competitors";
            else if (curPct < 45) stepName = "Analyzing competitor websites";
            else if (curPct < 60) stepName = "Checking your Google rankings";
            else if (curPct < 80) stepName = "Generating AI-optimized ad copy";
            else stepName = "Building your competitive strategy";
            setScanMsg(fakeProductNum + " of " + total + " products \\u00b7 " + stepName);
          } else {
            setScanMsg("Analyzing product " + fakeProductNum + " of " + total + "...");
          }
        }, 400);`;

if (content.includes(oldBatch)) {
  content = content.replace(oldBatch, newBatch);
  changes++;
  console.log("FIX 1: Synced scanMsg with creepTimer ✅");
} else {
  console.log("FIX 1: ❌ Pattern not found - checking...");
  console.log("  Has _batchMsgs:", content.includes("_batchMsgs"));
  console.log("  Has _done:", content.includes("const _done = Math.min"));
  console.log("  Has creepTimer:", content.includes("creepTimer"));
}

// ============================================
// FIX 2: Align dynamicSteps "Fetching" threshold 8% → 10%
// ============================================
if (content.includes("done: pct >= 8,   active: pct < 8")) {
  content = content.replace("done: pct >= 8,   active: pct < 8", "done: pct >= 10,  active: pct < 10");
  content = content.replace("active: pct >= 8  && pct < 25", "active: pct >= 10 && pct < 25");
  changes++;
  console.log("FIX 2: Aligned Fetching step threshold 8→10% ✅");
}

// ============================================
// FIX 3: Add timing hint for paid scan
// ============================================
const oldTip = "          {isPaid && <TipRotator/>}";
const newTip = '          {isPaid && <p className="ld-timing">⏱ Full competitor analysis typically takes 1–2 minutes</p>}\n          {isPaid && <TipRotator/>}';
if (content.includes(oldTip)) {
  content = content.replace(oldTip, newTip);
  changes++;
  console.log("FIX 3: Added timing hint ✅");
}

// Add ld-timing CSS
if (!content.includes(".ld-timing{")) {
  content = content.replace(
    ".tip-box{",
    ".ld-timing{font-size:12px;color:rgba(255,255,255,.35);margin-top:2px;margin-bottom:6px}\n.tip-box{"
  );
  console.log("FIX 3b: Added ld-timing CSS ✅");
}

// Write
fs.writeFileSync(filePath, content, 'utf8');
console.log(`\nDone! ${changes} fixes applied.`);
console.log(`File: ${filePath}`);

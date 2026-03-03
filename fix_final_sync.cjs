const fs = require('fs');
const filePath = 'app/routes/app._index.jsx';
let content = fs.readFileSync(filePath, 'utf8');
let fixes = 0;

// ============================================================
// ROOT CAUSE: Sidebar steps use PERCENTAGE thresholds (25,45,60,80)
// but batches don't align with those thresholds. 
// When creepPct crosses 45%, sidebar jumps to next step,
// but product count stays the same because batch hasn't finished.
//
// FIX: Make sidebar use scanStep (batch-based) instead of pct.
// scanStep will be set to batch number + 2 (since step 1 = fetch).
// Also make scanMsg step name match scanStep, not pct.
// ============================================================

// PART 1: Replace dynamicSteps in the Loading Screen
// Change from pct-based thresholds to scanStep-based

const oldDynamicSteps = `    const dynamicSteps = isPaid ? [
      { label: "Fetching products from your store",      done: pct >= 10,  active: pct < 10 },
      { label: "Searching Google for competitors",       done: pct >= 25,  active: pct >= 10 && pct < 25 },
      { label: "Analyzing competitor websites",          done: pct >= 45,  active: pct >= 25 && pct < 45 },
      { label: "Checking your Google rankings",          done: pct >= 60,  active: pct >= 45 && pct < 60 },
      { label: "Generating AI-optimized ad copy",        done: pct >= 80,  active: pct >= 60 && pct < 80 },
      { label: "Building your competitive strategy",     done: pct >= 100, active: pct >= 80 && pct < 100 },
    ] : [
      { label: "Fetching products",        done: pct >= 10,  active: pct < 10 },
      { label: "Quick AI analysis",        done: pct >= 55,  active: pct >= 10 && pct < 55 },
      { label: "Generating preview",       done: pct >= 100, active: pct >= 55 && pct < 100 },
    ];`;

const newDynamicSteps = `    // Sidebar steps driven by scanStep (batch-based), not pct
    const dynamicSteps = isPaid ? [
      { label: "Fetching products from your store",      done: scanStep >= 2,  active: scanStep === 1 },
      { label: "Searching Google for competitors",       done: scanStep >= 3,  active: scanStep === 2 },
      { label: "Analyzing competitor websites",          done: scanStep >= 4,  active: scanStep === 3 },
      { label: "Checking your Google rankings",          done: scanStep >= 5,  active: scanStep === 4 },
      { label: "Generating AI-optimized ad copy",        done: scanStep >= 6,  active: scanStep === 5 },
      { label: "Building your competitive strategy",     done: pct >= 100,     active: scanStep >= 6 && pct < 100 },
    ] : [
      { label: "Fetching products",        done: scanStep >= 2,  active: scanStep === 1 },
      { label: "Quick AI analysis",        done: pct >= 90,      active: scanStep >= 2 && pct < 90 },
      { label: "Generating preview",       done: pct >= 100,     active: pct >= 90 && pct < 100 },
    ];`;

if (content.includes(oldDynamicSteps)) {
  content = content.replace(oldDynamicSteps, newDynamicSteps);
  fixes++;
  console.log('FIX 1: dynamicSteps now batch-based ✅');
} else {
  console.log('FIX 1: Could not find dynamicSteps ❌');
  // Try to find partial match
  if (content.includes('const dynamicSteps = isPaid')) {
    console.log('  Found "const dynamicSteps = isPaid" - format may differ');
  }
}

// PART 2: In doScan, update scanStep at the START of each batch
// Map batch number to step number (2-6 for paid, step 1 = fetch)
// 6 batches mapped to steps 2-6:
//   batch 0 -> step 2, batch 1 -> step 3, batch 2 -> step 4, etc.

// Find the line that sets initial scanMsg for a batch and add scanStep update
const oldBatchStart = `        // Set initial message for this batch immediately
        const initialStepName = getStepNameByPct(batchStartPct);`;

const newBatchStart = `        // Map batch to sidebar step (step 1=fetch, steps 2-6 = analysis)
        const stepNum = Math.min(2 + Math.floor(b / batches * 5), 6);
        setScanStep(stepNum);
        const stepNames = ["Searching Google for competitors","Analyzing competitor websites","Checking your Google rankings","Generating AI-optimized ad copy","Building your competitive strategy"];
        const initialStepName = stepNames[stepNum - 2] || stepNames[stepNames.length - 1];`;

if (content.includes(oldBatchStart)) {
  content = content.replace(oldBatchStart, newBatchStart);
  fixes++;
  console.log('FIX 2: scanStep set at batch start ✅');
} else {
  console.log('FIX 2: Could not find batch start marker ❌');
}

// PART 3: In the creepTimer, use the same batch-based step name
// Replace getStepNameByPct(curPct) with the batch-based step name

const oldCreepMsg = `          // Update step name based on current percentage (syncs with sidebar)
          const curPct = Math.round(creepPct);
          const stepName = getStepNameByPct(curPct);`;

const newCreepMsg = `          // Step name stays constant during this batch (syncs with sidebar)
          const stepName = initialStepName;`;

if (content.includes(oldCreepMsg)) {
  content = content.replace(oldCreepMsg, newCreepMsg);
  fixes++;
  console.log('FIX 3: creepTimer uses batch-based step name ✅');
} else {
  console.log('FIX 3: Could not find creepTimer msg block ❌');
}

// PART 4: When batch ends, use the SAME step name (not pct-based)
const oldEndSync = `        const endStepName = getStepNameByPct(batchEndPct);`;
const newEndSync = `        const endStepName = initialStepName;`;

if (content.includes(oldEndSync)) {
  content = content.replace(oldEndSync, newEndSync);
  fixes++;
  console.log('FIX 4: batch-end sync uses batch step name ✅');
} else {
  console.log('FIX 4: Could not find end sync marker ❌');
}

// PART 5: Remove the unused getStepNameByPct function
const oldFunc = `      // Helper: get step name for a given percentage (must match dynamicSteps thresholds!)
      function getStepNameByPct(pct) {
        if (!isPaid) return "Analyzing";
        if (pct < 25) return "Searching Google for competitors";
        if (pct < 45) return "Analyzing competitor websites";
        if (pct < 60) return "Checking your Google rankings";
        if (pct < 80) return "Generating AI-optimized ad copy";
        return "Building your competitive strategy";
      }`;

if (content.includes(oldFunc)) {
  content = content.replace(oldFunc, '      // Step names are now batch-based, defined inline');
  fixes++;
  console.log('FIX 5: Removed unused getStepNameByPct ✅');
}

// Also remove getStepName if it exists
const oldFunc2 = `      // Helper: get step name for a given batch index
      function getStepName(batchIdx) {
        if (!isPaid) return "Analyzing";
        // Map batch index to step name
        const stepIdx = Math.min(Math.floor(batchIdx / batches * paidStepNames.length), paidStepNames.length - 1);
        return paidStepNames[stepIdx];
      }`;

if (content.includes(oldFunc2)) {
  content = content.replace(oldFunc2, '');
  fixes++;
  console.log('FIX 6: Removed unused getStepName ✅');
}

// Remove paidStepNames array if exists
if (content.includes('const paidStepNames = [')) {
  content = content.replace(/\s*const paidStepNames = \[[\s\S]*?\];/, '');
  fixes++;
  console.log('FIX 7: Removed unused paidStepNames ✅');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log(`\n${'='.repeat(50)}`);
console.log(`Done! ${fixes} fixes applied.`);
console.log(`${'='.repeat(50)}`);
console.log('\nHow it works now:');
console.log('  Batch 0 starts -> sidebar: "Searching Google" + msg: "3 of 17 · Searching Google"');
console.log('  Batch 0 ends   -> msg: "3 of 17 · Searching Google" (same step!)');
console.log('  Batch 1 starts -> sidebar: "Analyzing competitor" + msg: "6 of 17 · Analyzing competitor"');
console.log('  Step name ONLY changes when a new batch starts.');
console.log('  Product count ONLY changes when a batch starts/ends.');
console.log('  Sidebar and center message are ALWAYS in sync.');

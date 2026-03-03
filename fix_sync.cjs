const fs = require('fs');
const path = require('path');

const filePath = path.join('app', 'routes', 'app._index.jsx');
let content = fs.readFileSync(filePath, 'utf8');
let fixes = 0;

// THE PROBLEM:
// After a batch completes:
//   1. clearInterval(creepTimer) - stops updating scanMsg
//   2. setFakeProgress(batchEndPct) - sidebar jumps to new step
//   3. New batch loop starts - new creepTimer created
//   4. New creepTimer fires after 400ms - scanMsg finally updates
//
// In that gap between step 2 and 4, the sidebar shows the NEW step
// but scanMsg still shows the OLD step name.
//
// FIX: After setFakeProgress(batchEndPct), immediately update scanMsg
// to match what the sidebar will show at batchEndPct.

const oldBlock = `        clearInterval(creepTimer);
        creepRef.current = null;`;

// Build the new block that also updates scanMsg immediately
const newBlock = `        clearInterval(creepTimer);
        creepRef.current = null;

        // Immediately sync scanMsg with the new percentage so it matches sidebar
        if (isPaid) {
          const newPct = batchEndPct;
          const completedProducts = start + batch.length;
          let stepName;
          if (newPct < 25) stepName = "Searching Google for competitors";
          else if (newPct < 45) stepName = "Analyzing competitor websites";
          else if (newPct < 60) stepName = "Checking your Google rankings";
          else if (newPct < 80) stepName = "Generating AI-optimized ad copy";
          else stepName = "Building your competitive strategy";
          setScanMsg(completedProducts + " of " + total + " products \\u00b7 " + stepName);
        } else {
          setScanMsg("Analyzing product " + Math.min(start + batch.length, total) + " of " + total + "...");
        }`;

if (content.includes(oldBlock)) {
  content = content.replace(oldBlock, newBlock);
  fixes++;
  console.log('FIX 1: Added immediate scanMsg sync after batch completes ✅');
} else {
  console.log('FIX 1: Could not find target block ❌');
  // Debug: find clearInterval(creepTimer)
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('clearInterval(creepTimer)')) {
      console.log(`  Line ${i+1}: ${lines[i].trim()}`);
    }
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log(`\nDone! ${fixes} fixes applied.`);

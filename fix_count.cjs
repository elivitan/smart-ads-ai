const fs = require('fs');
const path = require('path');

const filePath = path.join('app', 'routes', 'app._index.jsx');
let content = fs.readFileSync(filePath, 'utf8');
let fixes = 0;

// FIX: Replace fakeNum calculation with real completed product count
// The fakeNum formula "(creepPct - 10) / 82 * total" gives fake numbers
// based on percentage, not actual batch completion.
// 
// Instead: use the batch loop variable "start" which tracks how many 
// products have been SENT for analysis. At the start of each batch,
// "start" = b * BATCH_SIZE = actual products completed so far.

// Step 1: Pass "start" into the creepTimer closure by capturing it
// The variable "start" is already defined in the for loop before creepTimer

// Step 2: Replace fakeNum line with real count based on "start"
const oldFakeNum = 'const fakeNum = Math.min(Math.round((creepPct - 10) / 82 * total), total);';
const newFakeNum = 'const fakeNum = start; // real count: products sent to AI so far';

if (content.includes(oldFakeNum)) {
  content = content.replace(oldFakeNum, newFakeNum);
  fixes++;
  console.log('FIX 1: Replaced fakeNum with real batch count (start) ✅');
} else {
  console.log('FIX 1: fakeNum line not found ❌');
  // Try to find it
  if (content.includes('fakeNum')) {
    console.log('  "fakeNum" exists in file');
    // Find the line
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('fakeNum') && lines[i].includes('Math.round')) {
        console.log(`  Line ${i+1}: ${lines[i].trim()}`);
      }
    }
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log(`\nDone! ${fixes} fixes applied.`);

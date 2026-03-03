const fs = require("fs");
let c = fs.readFileSync("app/routes/app._index.jsx", "utf-8");

// Replace early return with conditional JSX
const oldCode = '    if (isPaid && analyzedCount === 0 && !aiResults) return (';
const newCode = '    if (isPaid && analyzedCount === 0 && !aiResults) return mainJSX_collecting;';

// First, wrap the CollectingDataScreen block in a variable BEFORE the return
// Find the line before the if statement
const ifIdx = c.indexOf(oldCode);
if (ifIdx === -1) { console.log("Pattern not found"); process.exit(1); }

// Find the closing of this early return block - it ends with ");"  then "    return ("
const afterIf = c.indexOf("    return (", ifIdx + 10);
if (afterIf === -1) { console.log("Could not find main return"); process.exit(1); }

// Extract the CollectingDataScreen JSX block
const collectingBlock = c.slice(ifIdx + oldCode.length, afterIf).trim();
// Remove trailing ");" from the block
const cleanBlock = collectingBlock.replace(/\);\s*$/, "");

// Build the replacement: assign to variable, then use conditional
const replacement = `    const mainJSX_collecting = (
${cleanBlock}
    );

    // Fresh paid subscriber - never scanned yet
    if (isPaid && analyzedCount === 0 && !aiResults) return mainJSX_collecting;

`;

c = c.slice(0, ifIdx) + replacement + c.slice(afterIf);

fs.writeFileSync("app/routes/app._index.jsx", c);
console.log("Fixed! Early return converted to variable assignment.");

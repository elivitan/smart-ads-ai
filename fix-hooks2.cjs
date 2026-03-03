const fs = require("fs");
let code = fs.readFileSync("app/routes/app._index.jsx", "utf-8");
const start = code.indexOf("export default function Index");
const indexCode = code.slice(start);
const lines = indexCode.split("\n");

// Find the useMemo blocks (lines 561-582 approximately)
// and the autoLaunching return (line 520)
// We need to move the useMemos before line 520

// Get line numbers in the full file
const fullLines = code.split("\n");
const indexStartLine = code.slice(0, start).split("\n").length - 1;

// Find autoLaunching return in full file
let autoLaunchLine = -1;
let memoStartLine = -1;
let memoEndLine = -1;

for (let i = indexStartLine; i < fullLines.length; i++) {
  const l = fullLines[i].trim();
  if (l.startsWith("if (autoLaunching) return (") && autoLaunchLine === -1) {
    autoLaunchLine = i;
  }
  if (l.startsWith("const sortedProducts = useMemo") && memoStartLine === -1) {
    memoStartLine = i;
  }
}

// Find the end of the last useMemo block (keywordGaps)
for (let i = memoStartLine; i < fullLines.length; i++) {
  const l = fullLines[i].trim();
  if (l.startsWith("const { keywordGaps")) {
    // Find closing of this useMemo
    let depth = 0;
    for (let j = i; j < fullLines.length; j++) {
      const line = fullLines[j];
      for (const ch of line) {
        if (ch === "(") depth++;
        if (ch === ")") depth--;
      }
      if (depth <= 0 && j > i) {
        memoEndLine = j;
        break;
      }
    }
    break;
  }
}

console.log("autoLaunching return at line:", autoLaunchLine);
console.log("useMemo block lines:", memoStartLine, "-", memoEndLine);

if (autoLaunchLine === -1 || memoStartLine === -1 || memoEndLine === -1) {
  console.log("Could not find patterns");
  process.exit(1);
}

// Extract the memo lines
const memoBlock = fullLines.slice(memoStartLine, memoEndLine + 1).join("\n");

// Remove memo from original position
const before = fullLines.slice(0, memoStartLine).join("\n");
const after = fullLines.slice(memoEndLine + 1).join("\n");
const withoutMemo = before + "\n" + after;

// Insert memo before autoLaunching return
const newLines = withoutMemo.split("\n");
let insertAt = -1;
for (let i = 0; i < newLines.length; i++) {
  if (newLines[i].trim().startsWith("if (autoLaunching) return (")) {
    insertAt = i;
    break;
  }
}

if (insertAt === -1) {
  console.log("Could not find insert point");
  process.exit(1);
}

newLines.splice(insertAt, 0, memoBlock, "");
fs.writeFileSync("app/routes/app._index.jsx", newLines.join("\n"));
console.log("Moved useMemo blocks before autoLaunching return. Fixed!");

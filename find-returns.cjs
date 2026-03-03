const fs = require("fs");
const code = fs.readFileSync("app/routes/app._index.jsx", "utf-8");
const start = code.indexOf("export default function Index");
const indexCode = code.slice(start);
const lines = indexCode.split("\n");
const hookRegex = /\b(useState|useEffect|useMemo|useRef|useCallback)\s*\(/;
let lastHook = 0;
for (let i = 0; i < Math.min(lines.length, 800); i++) {
  if (hookRegex.test(lines[i])) {
    lastHook = i;
  }
  if (/^\s+if\s*\(.*\)\s*return\s/.test(lines[i]) || /^\s+return\s*\(/.test(lines[i])) {
    if (i < 700) {
      console.log("Line", i, (i < lastHook ? "BEFORE-LAST-HOOK" : "ok"), ":", lines[i].trim().slice(0,90));
    }
  }
}
console.log("\nLast hook at line:", lastHook);

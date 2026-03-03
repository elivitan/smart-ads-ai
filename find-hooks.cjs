const fs = require("fs");
const code = fs.readFileSync("app/routes/app._index.jsx", "utf-8");
const start = code.indexOf("export default function Index");
const indexCode = code.slice(start);
const lines = indexCode.split("\n");
const hookRegex = /\b(useState|useEffect|useMemo|useRef|useCallback)\s*\(/;
let foundReturn = false;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("isPaid && analyzedCount === 0")) {
    foundReturn = true;
    console.log("=== EARLY RETURN at relative line", i, "===");
    console.log(lines[i].trim().slice(0,80));
    continue;
  }
  if (foundReturn && hookRegex.test(lines[i])) {
    console.log("HOOK AFTER:", i, ":", lines[i].trim().slice(0,80));
  }
}
if (!foundReturn) console.log("Early return not found - checking ALL early returns...");

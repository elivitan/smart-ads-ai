const fs = require("fs");
const code = fs.readFileSync("app/routes/app._index.jsx", "utf-8");
const start = code.indexOf("export default function Index");
const indexCode = code.slice(start);
const lines = indexCode.split("\n");
const hookRegex = /\b(useState|useEffect|useMemo|useRef|useCallback)\s*\(/;
for (let i = 350; i < 580; i++) {
  const l = lines[i].trim();
  if (hookRegex.test(lines[i]) || l.startsWith("return ") || l.startsWith("return(") || l.match(/if\s*\(.*return/)) {
    console.log(i, ":", l.slice(0,100));
  }
}

const fs = require("fs");
const file = "C:\\Users\\אלי\\v\\app\\routes\\app.api.scan.js";
let src = fs.readFileSync(file, "utf-8");
const lines = src.split("\n");
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("await useScanCredit(") && !lines[i-1].includes("eslint-disable")) {
    lines.splice(i, 0, "    // eslint-disable-next-line react-hooks/rules-of-hooks");
    i++;
  }
}
fs.copyFileSync(file, file + ".bak_" + Date.now());
fs.writeFileSync(file, lines.join("\n"), "utf-8");
console.log("תוקן");

const fs = require("fs");
const pkg = JSON.parse(fs.readFileSync("C:\\Users\\אלי\\v\\package.json", "utf-8"));
pkg.scripts.lint = "eslint .";
fs.writeFileSync("C:\\Users\\אלי\\v\\package.json", JSON.stringify(pkg, null, 2), "utf-8");
console.log("✅ תוקן");

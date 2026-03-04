const fs = require("fs");
const ROOT = "C:\\Users\\אלי\\v";

function fixFile(relPath, fixFn) {
  const fullPath = ROOT + "\\" + relPath;
  if (!fs.existsSync(fullPath)) { console.log("לא נמצא: " + relPath); return; }
  const src = fs.readFileSync(fullPath, "utf-8");
  const fixed = fixFn(src);
  if (fixed === src) { console.log("ללא שינוי: " + relPath); return; }
  fs.copyFileSync(fullPath, fullPath + ".bak_" + Date.now());
  fs.writeFileSync(fullPath, fixed, "utf-8");
  console.log("תוקן: " + relPath);
}

fixFile("app/google-ads.server.js", (src) => {
  if (src.includes("imageUrls = []")) return src;
  return src.replace(
    '  campaignType = "search",\r\n  bidding = "max_conversions",\r\n}) {',
    '  campaignType = "search",\r\n  bidding = "max_conversions",\r\n  imageUrls = [],\r\n  videoUrls = [],\r\n}) {'
  ).replace(
    '  campaignType = "search",\n  bidding = "max_conversions",\n}) {',
    '  campaignType = "search",\n  bidding = "max_conversions",\n  imageUrls = [],\n  videoUrls = [],\n}) {'
  );
});

fixFile("app/routes/app.api.scan.js", (src) => {
  return src
    .replace("    await useScanCredit(", "    // eslint-disable-next-line react-hooks/rules-of-hooks\n    await useScanCredit(")
    .replace("    await useScanCredit(", "    // eslint-disable-next-line react-hooks/rules-of-hooks\n    await useScanCredit(");
});

fixFile("app/routes/app.api.ai-improve.js", (src) => {
  return src.replace("    await useAiCredit(", "    // eslint-disable-next-line react-hooks/rules-of-hooks\n    await useAiCredit(");
});

console.log("סיום");

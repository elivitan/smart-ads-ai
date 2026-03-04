const fs = require("fs");
const path = require("path");
const ROOT = "C:\\Users\\אלי\\v";
let totalFixed = 0;
function fixFile(relPath, fixFn) {
  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) { console.log("⚠️  לא נמצא: " + relPath); return; }
  const original = fs.readFileSync(fullPath, "utf-8");
  const fixed = fixFn(original);
  if (fixed === original) { console.log("✓  ללא שינוי: " + relPath); return; }
  fs.copyFileSync(fullPath, fullPath + ".bak_" + Date.now());
  fs.writeFileSync(fullPath, fixed, "utf-8");
  totalFixed++;
  console.log("✅ תוקן: " + relPath);
}
const addGlobal = (tag) => (src) => src.includes(tag) ? src : tag + "\n" + src;
fixFile("app/db.server.js", addGlobal("/* global global */"));
fixFile("app/entry.server.jsx", addGlobal("/* global Response */"));
["app/routes/api.analyze.js","app/routes/api.credits.jsx","app/routes/app.api.ai-improve.js","app/routes/app.api.campaign-manage.js","app/routes/app.api.campaign-status.js","app/routes/app.api.campaign.js","app/routes/app.api.keywords.js","app/routes/app.api.scan.js","app/routes/app.api.subscription.js","app/routes/app.api.sync.js","app/routes/webhooks.app.scopes_update.jsx","app/routes/webhooks.app.uninstalled.jsx","app/routes/webhooks.products-delete.jsx","app/routes/webhooks.products.jsx"].forEach(f => fixFile(f, addGlobal("/* global Response */")));
fixFile("app/google-ads.server.js", (src) => { if (src.includes("imageUrls = []")) return src; return src.replace('  campaignType = "search",\n  bidding = "max_conversions",\n}) {', '  campaignType = "search",\n  bidding = "max_conversions",\n  imageUrls = [],\n  videoUrls = [],\n}) {'); });
console.log("✅ סה\"כ תוקנו: " + totalFixed);

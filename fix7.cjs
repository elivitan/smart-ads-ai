const fs = require('fs');
let c = fs.readFileSync('app/routes/app.api.scan.js', 'utf-8');
c = c.replace(
  'async function saveAiResultsToDB(shop, products, aiProducts) {\n  let saved = 0;\n  for (const aiProduct of aiProducts) {',
  'async function saveAiResultsToDB(shop, products, aiProducts) {\n  console.log("[SmartAds] saveAiResultsToDB called:", products.length, "products,", aiProducts.length, "AI results");\n  console.log("[SmartAds] Product IDs:", products.map(p => p.id).slice(0,3));\n  console.log("[SmartAds] AI titles:", aiProducts.map(p => p.title).slice(0,3));\n  let saved = 0;\n  for (const aiProduct of aiProducts) {'
);
fs.writeFileSync('app/routes/app.api.scan.js', c);
console.log('Debug logs added');

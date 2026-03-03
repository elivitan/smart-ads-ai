const fs = require('fs');
let c = fs.readFileSync('app/routes/app.api.scan.js', 'utf-8');
// Add debug log to saveAiResultsToDB
c = c.replace(
  'if (!sourceProduct?.id) continue;',
  'console.log("[SmartAds] Match attempt:", aiProduct.title, "-> found:", sourceProduct?.title, "id:", sourceProduct?.id);\n    if (!sourceProduct?.id) continue;'
);
fs.writeFileSync('app/routes/app.api.scan.js', c);
console.log('Added debug log');

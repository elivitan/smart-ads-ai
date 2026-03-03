const fs = require("fs");
let c = fs.readFileSync("app/routes/app.api.scan.js", "utf-8");

const marker = 'return Response.json({ success: true, products, storeInfo });';
const idx = c.indexOf(marker);
if (idx === -1) { console.log("Pattern not found"); process.exit(1); }

const insert = `// Save products to DB so AiAnalysis foreign key works
      for (const p of products) {
        try {
          await prisma.product.upsert({
            where: { id: p.id },
            create: { id: p.id, shop, title: p.title, description: p.description, handle: p.handle, image: p.image, price: p.price },
            update: { title: p.title, description: p.description, handle: p.handle, image: p.image, price: p.price, syncedAt: new Date() },
          });
        } catch (err) { console.log("[SmartAds] Failed to save product:", p.id, err.message); }
      }
      console.log("[SmartAds] Saved", products.length, "products to DB");

      `;

c = c.slice(0, idx) + insert + c.slice(idx);
fs.writeFileSync("app/routes/app.api.scan.js", c);
console.log("Fixed! Products now save to DB.");

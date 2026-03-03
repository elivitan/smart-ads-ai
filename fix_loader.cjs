const fs = require('fs');
let c = fs.readFileSync('app/routes/app._index.jsx', 'utf8');
if (!c.includes('return { products: [], aiResults: null }')) {
  console.log('Pattern not found'); process.exit(1);
}
var old = 'export const loader = async ({ request }) => {\n  await authenticate.admin(request);\n  return { products: [], aiResults: null };\n};';
var lines = [
  'import { fullSync, getShopProducts, getSyncStatus } from "../sync.server.js";',
  'import prisma from "../db.server.js";',
  '',
  'export const loader = async ({ request }) => {',
  '  const { admin, session } = await authenticate.admin(request);',
  '  const shop = session.shop;',
  '  const status = await getSyncStatus(shop);',
  '  if (status.totalProducts === 0) {',
  '    try { await fullSync(admin, shop); } catch (e) { console.error("Auto sync failed:", e.message); }',
  '  }',
  '  const dbProducts = await getShopProducts(shop);',
  '  const syncStatus = await getSyncStatus(shop);',
  '  return { products: dbProducts, syncStatus, shop };',
  '};',
];
c = c.replace(old, lines.join('\n'));
fs.writeFileSync('app/routes/app._index.jsx', c);
console.log('Done');

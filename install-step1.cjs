const { execSync } = require('child_process');
const fs = require('fs');

console.log('\n=== Smart Ads AI - Step 1: Database & Sync ===\n');

const files = [
  'prisma/schema.prisma',
  'app/sync.server.js',
  'app/routes/app.api.sync.js',
  'app/routes/webhooks.products.jsx',
  'app/routes/webhooks.products-delete.jsx',
];

let ok = true;
for (const f of files) {
  if (fs.existsSync(f)) console.log('  OK  ' + f);
  else { console.log('  MISSING  ' + f); ok = false; }
}
if (!ok) { console.log('\nCopy all files first!\n'); process.exit(1); }

console.log('\nGenerating Prisma client...');
execSync('npx prisma generate', { stdio: 'inherit' });

console.log('\nPushing schema to database...');
execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });

console.log('\n=== DONE! Tables: Product, AiAnalysis, SyncLog ===\n');

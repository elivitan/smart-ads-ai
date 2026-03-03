const fs = require('fs');
// Check what the scan API fetch step returns as product IDs
// The issue is likely that fetched products have Shopify GID format
// but AI results come back with title only, no ID
const scanCode = fs.readFileSync('app/routes/app.api.scan.js', 'utf-8');
const aiCode = fs.readFileSync('app/ai.server.js', 'utf-8');
// Check if AI results include product IDs
console.log('=== AI server returns ID? ===');
const hasId = aiCode.includes('id:') || aiCode.includes('product.id');
console.log(hasId ? 'YES - includes ID' : 'NO - probably title only');
console.log('\n=== First 30 lines of ai.server.js ===');
console.log(aiCode.split('\n').slice(0, 30).join('\n'));

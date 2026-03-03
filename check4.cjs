const fs = require('fs');
const code = fs.readFileSync('app/routes/app.api.scan.js', 'utf-8');
// Find the saveAiResultsToDB call and what 'products' variable is passed
const lines = code.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('saveAiResultsToDB')) {
    console.log('Line', i+1, ':', lines[i].trim());
  }
}
// Also check what products are sent to analyze-batch
console.log('\n=== analyze-batch section ===');
let inAnalyze = false;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('analyze-batch')) inAnalyze = true;
  if (inAnalyze && (lines[i].includes('products') || lines[i].includes('saveAi'))) {
    console.log('Line', i+1, ':', lines[i].trim());
  }
  if (inAnalyze && lines[i].includes('return Response')) { inAnalyze = false; break; }
}

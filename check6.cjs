const fs = require('fs');
const code = fs.readFileSync('app/routes/app.api.scan.js', 'utf-8');
// Check if the debug log was added
console.log('Has debug log:', code.includes('Match attempt'));
// Check the match logic
const lines = code.split('\n');
for (let i = 18; i < 35; i++) {
  console.log(i+1, ':', lines[i]);
}

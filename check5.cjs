const fs = require('fs');
const code = fs.readFileSync('app/routes/app._index.jsx', 'utf-8');
const lines = code.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('analyze-batch') && lines[i].includes('append')) {
    for (let j = Math.max(0,i-5); j < Math.min(lines.length, i+5); j++) {
      console.log(j+1, ':', lines[j].trim().slice(0,100));
    }
    break;
  }
}

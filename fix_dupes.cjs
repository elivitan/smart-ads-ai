const fs = require('fs');
const path = require('path');

const filePath = path.join('app', 'routes', 'app._index.jsx');
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

let newLines = [];
let i = 0;
let fixes = 0;

while (i < lines.length) {
  const line = lines[i];
  const next = lines[i + 1] || '';
  
  // Fix duplicate creepRef/creepTimer lines
  if (line.includes('if (creepRef.current) clearInterval(creepRef.current); const creepTimer = setInterval') &&
      next.includes('if (creepRef.current) clearInterval(creepRef.current); const creepTimer = setInterval')) {
    newLines.push('        if (creepRef.current) clearInterval(creepRef.current);');
    newLines.push('        const creepTimer = setInterval(() => {');
    i += 2; // skip both duplicate lines
    fixes++;
    console.log('FIX 1: Removed duplicate creepTimer line ✅');
    continue;
  }
  
  newLines.push(line);
  i++;
}

// Remove excessive blank lines (3+ in a row → max 1)
let result = newLines.join('\n');
result = result.replace(/\n{4,}/g, '\n\n');

fs.writeFileSync(filePath, result, 'utf8');
console.log(`Done! ${fixes} fixes applied. Lines: ${result.split('\n').length}`);

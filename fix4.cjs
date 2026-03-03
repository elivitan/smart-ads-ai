const fs = require('fs');
let c = fs.readFileSync('app/routes/app._index.jsx', 'utf-8');
const lines = c.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('planFromCookie')) {
    console.log('Found at line', i+1, ':', lines[i].trim().slice(0,80));
    lines[i] = lines[i].replace(/isPaidServer.*\)\)?\)?/, "serverSubscription && serverSubscription.plan !== 'free' ? serverSubscription.plan : null)");
    console.log('Replaced:', lines[i].trim().slice(0,80));
  }
}
fs.writeFileSync('app/routes/app._index.jsx', lines.join('\n'));
console.log('Done!');

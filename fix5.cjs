const fs = require('fs');
let c = fs.readFileSync('app/routes/app._index.jsx', 'utf-8');
c = c.replace(
  "serverSubscription && serverSubscription.plan !== 'free' ? serverSubscription.plan : null)\n  );",
  "serverSubscription && serverSubscription.plan !== 'free' ? serverSubscription.plan : null\n  );"
);
fs.writeFileSync('app/routes/app._index.jsx', c);
console.log('Fixed!');

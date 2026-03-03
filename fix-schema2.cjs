const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf-8');

schema = schema.replace(
  '  // aiAnalysis relation removed',
  '  aiAnalysis      AiAnalysis?'
);

schema = schema.replace(
  '  // product relation removed - AiAnalysis is standalone',
  '  product         Product   @relation(fields: [productId], references: [id], onDelete: Cascade)'
);

fs.writeFileSync('prisma/schema.prisma', schema);
console.log('Schema restored!');

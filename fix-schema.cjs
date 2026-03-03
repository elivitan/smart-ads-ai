const fs = require('fs');
let schema = fs.readFileSync('prisma/schema.prisma', 'utf-8');

// Remove the relation line from AiAnalysis
schema = schema.replace(
  '  product         Product   @relation(fields: [productId], references: [id], onDelete: Cascade)',
  '  // product relation removed - AiAnalysis is standalone'
);

// Remove the aiAnalysis field from Product model
schema = schema.replace(
  '  aiAnalysis      AiAnalysis?',
  '  // aiAnalysis relation removed'
);

fs.writeFileSync('prisma/schema.prisma', schema);
console.log('Schema updated!');

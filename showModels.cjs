const fs = require('fs');
const schema = fs.readFileSync('prisma/schema.prisma', 'utf-8');
const models = schema.match(/model (Product|AiAnalysis) \{[\s\S]*?\n\}/g);
if (models) models.forEach(m => console.log(m + '\n'));

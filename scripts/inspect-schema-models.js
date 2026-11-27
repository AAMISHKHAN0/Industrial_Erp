const fs = require('fs');
const schema = fs.readFileSync('backend/prisma/schema.prisma', 'utf8');

const targetTables = [
  'demand_notes',
  'demand_note_items',
  'purchase_orders',
  'purchase_order_items',
  'goods_receiving_notes',
  'goods_receiving_items'
];

const blocks = schema.split('model ').slice(1);
for (const b of blocks) {
  const modelName = b.split(' ')[0];
  for (const t of targetTables) {
    if (b.includes(`@@map("${t}")`)) {
      console.log(`========================================`);
      console.log(`TABLE: ${t} (Model: ${modelName})`);
      console.log(`========================================`);
      const body = b.split('}')[0];
      const lines = body.split('\n').filter(l => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('@@'));
      for (const line of lines) {
        console.log(line);
      }
    }
  }
}

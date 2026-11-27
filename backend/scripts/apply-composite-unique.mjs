import { readFileSync, writeFileSync } from 'fs';

const path = 'prisma/schema.prisma';
let text = readFileSync(path, 'utf8');

// @@map name -> fields that should become @@unique([companyId, field])
const MAP = {
  warehouses: ['code'],
  branches: ['code'],
  designations: ['code'],
  employees: ['employeeCode'],
  categories: ['code'],
  units: ['code'],
  items: ['itemCode'],
  vendors: ['vendorCode'],
  demand_notes: ['demandNumber'],
  vendor_quotations: ['quotationNumber'],
  purchase_orders: ['poNumber'],
  goods_receiving_notes: ['grnNumber'],
  customers: ['customerCode'],
  sales_orders: ['soNumber'],
  bill_of_materials: ['bomNumber'],
  production_orders: ['productionNumber'],
  payheads: ['name', 'code'],
  accounts: ['accountCode'],
  journal_entries: ['entryNumber'],
};

// Process each model block independently
text = text.replace(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g, (block, modelName, body) => {
  const mapMatch = body.match(/@@map\("([^"]+)"\)/);
  if (!mapMatch) return block;
  const mapName = mapMatch[1];
  const fields = MAP[mapName];
  if (!fields) return block;

  let newBody = body;
  const uniqueLines = [];
  for (const field of fields) {
    // strip @unique from the field definition line
    const re = new RegExp(`(^\\s*${field}\\s+\\S+)(\\s+@unique)`, 'm');
    if (re.test(newBody)) {
      newBody = newBody.replace(re, '$1');
      uniqueLines.push(`  @@unique([companyId, ${field}])`);
    }
  }
  if (uniqueLines.length) {
    // insert @@unique lines right before @@map
    newBody = newBody.replace(/(\n\s*@@map\()/, `\n${uniqueLines.join('\n')}$1`);
  }
  return `model ${modelName} {${newBody}\n}`;
});

writeFileSync(path, text);
console.log('Composite unique constraints applied.');

const path = require('path');
const fs = require('fs');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/pg'));

const client = new Client({
  host: '127.0.0.1',
  port: 5433,
  user: 'postgres',
  password: '1YKVdCM2Fq2zZSoC80gWnd35lIzbJA1G',
  database: 'textile_erp'
});

async function run() {
  await client.connect();

  // Read schema.prisma to parse models and fields
  const schemaPath = path.resolve(__dirname, '../backend/prisma/schema.prisma');
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');

  // Simple model parser
  const modelRegex = /model\s+(\w+)\s+{([^}]+)}/g;
  let match;
  const models = {};

  while ((match = modelRegex.exec(schemaContent)) !== null) {
    const modelName = match[1];
    const body = match[2];
    
    // Check for @@map("table_name")
    const mapMatch = body.match(/@@map\("([^"]+)"\)/);
    const tableName = mapMatch ? mapMatch[1] : modelName.toLowerCase();

    const fields = [];
    const lines = body.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) continue;
      const parts = trimmed.split(/\s+/);
      const fieldName = parts[0];
      const fieldType = parts[1];
      // Skip relations (types starting with uppercase or arrays)
      if (['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json', 'Decimal'].some(t => fieldType && fieldType.startsWith(t))) {
        fields.push(fieldName);
      }
    }
    models[tableName] = { modelName, fields };
  }

  // Get all columns from information_schema
  const dbColsRes = await client.query(`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public';
  `);

  const dbTables = {};
  for (const row of dbColsRes.rows) {
    if (!dbTables[row.table_name]) dbTables[row.table_name] = new Set();
    dbTables[row.table_name].add(row.column_name);
  }

  console.log('=== SCHEMA COMPARISON REPORT (Prisma vs DB 5433) ===\n');
  const missingTables = [];
  const missingColumns = [];

  for (const [table, data] of Object.entries(models)) {
    if (!dbTables[table]) {
      missingTables.push(table);
      continue;
    }
    for (const field of data.fields) {
      if (!dbTables[table].has(field)) {
        missingColumns.push({ table, column: field, model: data.modelName });
      }
    }
  }

  console.log('MISSING TABLES (' + missingTables.length + '):', missingTables);
  console.log('\nMISSING COLUMNS (' + missingColumns.length + '):');
  console.table(missingColumns);

  await client.end();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

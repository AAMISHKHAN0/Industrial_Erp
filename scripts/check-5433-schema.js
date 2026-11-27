const path = require('path');
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
  console.log('Connected to textile_erp on port 5433!');

  // Check demand_notes columns
  const dnCols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'demand_notes'
    ORDER BY ordinal_position;
  `);
  console.log('PORT 5433 DEMAND_NOTES COLUMNS:', dnCols.rows.map(r => r.column_name));

  // Check material_issues columns
  const miCols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'material_issues'
    ORDER BY ordinal_position;
  `);
  console.log('PORT 5433 MATERIAL_ISSUES COLUMNS:', miCols.rows.map(r => r.column_name));

  // Check applied migrations in _prisma_migrations
  const migs = await client.query(`
    SELECT migration_name, finished_at, applied_steps_count 
    FROM _prisma_migrations 
    ORDER BY started_at;
  `);
  console.log('PORT 5433 APPLIED MIGRATIONS:', migs.rows);

  await client.end();
}

run().catch(err => {
  console.error('PORT 5433 ERR:', err.message);
  process.exit(1);
});

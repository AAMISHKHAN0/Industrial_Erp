const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/pg'));

const client = new Client({
  connectionString: 'postgresql://postgres:MBzfd9sgqg93dYfkkFVxrk%24O4i37g%25R3@127.0.0.1:5432/textile_erp_test'
});

async function run() {
  await client.connect();

  // Check columns for demand_notes
  const dnCols = await client.query(`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'demand_notes'
    ORDER BY ordinal_position;
  `);
  console.log('DEMAND_NOTES COLUMNS IN DB:', dnCols.rows.map(r => r.column_name));

  // Check columns for goods_receiving_notes
  const grnCols = await client.query(`
    SELECT column_name, data_type, is_nullable 
    FROM information_schema.columns 
    WHERE table_name = 'goods_receiving_notes'
    ORDER BY ordinal_position;
  `);
  console.log('GRN COLUMNS IN DB:', grnCols.rows.map(r => r.column_name));

  // Check what migrations are recorded in _prisma_migrations
  const migs = await client.query(`
    SELECT migration_name, finished_at, applied_steps_count 
    FROM _prisma_migrations 
    ORDER BY started_at;
  `);
  console.log('APPLIED MIGRATIONS IN DB:', migs.rows);

  await client.end();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

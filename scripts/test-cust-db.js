const { Client } = require('../backend/node_modules/pg');

async function check() {
  const c = new Client('postgresql://postgres:MBzfd9sgqg93dYfkkFVxrk%24O4i37g%25R3@127.0.0.1:5432/textile_erp_test?schema=public');
  await c.connect();
  const r = await c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'customers' ORDER BY ordinal_position");
  console.log('Columns in customers:');
  r.rows.forEach(col => console.log(`  ${col.column_name}: ${col.data_type}`));
  await c.end();
}

check().catch(console.error);

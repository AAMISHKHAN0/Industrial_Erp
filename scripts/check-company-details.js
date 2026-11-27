const { Client } = require('../backend/node_modules/pg');

async function checkDetails() {
  const client = new Client({
    connectionString: 'postgresql://postgres:MBzfd9sgqg93dYfkkFVxrk%24O4i37g%25R3@127.0.0.1:5433/textile_erp_test'
  });
  await client.connect();
  const compId = '5b9e417f-0c63-40e9-9169-3c0251eb4b78';

  const tables = ['items', 'vouchers', 'stock_ledger', 'journal_entries', 'journal_entry_items', 'accounts', 'units', 'categories', 'warehouses', 'accounting_periods'];
  for (const t of tables) {
    const cols = await client.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`, [t]);
    console.log(`\nTable ${t} columns:`);
    console.log(cols.rows.map(c => `${c.column_name} (${c.data_type})`).join(', '));
  }

  const accounts = await client.query('SELECT id, code, name, type FROM accounts WHERE "companyId" = $1', [compId]);
  console.log(`\nAccounts for company (${accounts.rows.length}):`, accounts.rows.slice(0, 5));

  const periods = await client.query('SELECT id, name FROM accounting_periods WHERE "companyId" = $1', [compId]);
  console.log(`\nPeriods:`, periods.rows);

  const units = await client.query('SELECT id, name, code FROM units WHERE "companyId" = $1', [compId]);
  console.log(`\nUnits:`, units.rows);

  const wh = await client.query('SELECT id, name, code FROM warehouses WHERE "companyId" = $1', [compId]);
  console.log(`\nWarehouses:`, wh.rows);

  await client.end();
}

checkDetails().catch(console.error);

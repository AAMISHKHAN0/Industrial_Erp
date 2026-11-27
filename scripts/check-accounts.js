const { Client } = require('../backend/node_modules/pg');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://postgres:MBzfd9sgqg93dYfkkFVxrk%24O4i37g%25R3@127.0.0.1:5433/textile_erp_test'
  });
  await client.connect();
  const compId = '5b9e417f-0c63-40e9-9169-3c0251eb4b78';
  const accounts = await client.query('SELECT id, "accountCode", name, type FROM accounts WHERE "companyId" = $1', [compId]);
  console.log('Accounts found:', accounts.rows.length);
  console.table(accounts.rows.slice(0, 10));

  const periods = await client.query('SELECT id, name FROM accounting_periods WHERE "companyId" = $1', [compId]);
  console.log('Periods found:', periods.rows);

  const warehouses = await client.query('SELECT id, name, code FROM warehouses WHERE "companyId" = $1', [compId]);
  console.log('Warehouses:', warehouses.rows);

  const units = await client.query('SELECT id, name, code FROM units WHERE "companyId" = $1', [compId]);
  console.log('Units:', units.rows);

  const categories = await client.query('SELECT id, name, code FROM categories WHERE "companyId" = $1', [compId]);
  console.log('Categories:', categories.rows);

  await client.end();
}

main().catch(console.error);

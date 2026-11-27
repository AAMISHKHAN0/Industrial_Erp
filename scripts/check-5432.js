const fs = require('fs');
const path = require('path');
const { Client } = require(path.join(__dirname, '../backend/node_modules/pg'));

async function check() {
  const c = new Client({
    connectionString: 'postgresql://postgres:MBzfd9sgqg93dYfkkFVxrk%24O4i37g%25R3@127.0.0.1:5432/textile_erp_test'
  });
  await c.connect();
  const tables = await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
  console.log('Tables in textile_erp_test count:', tables.rows.length);
  const users = await c.query('SELECT id, email, role, "companyId" FROM users');
  console.log('Users in textile_erp_test:', users.rows);
  const companies = await c.query('SELECT id, name FROM companies');
  console.log('Companies:', companies.rows);
  await c.end();
}
check().catch(console.error);

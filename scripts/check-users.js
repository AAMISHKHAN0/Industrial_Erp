const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/pg'));
const fs = require('fs');

async function main() {
  const creds = JSON.parse(fs.readFileSync('C:/Users/Aamishkhan/AppData/Roaming/Industrial ERP/data/.db_credentials.json', 'utf8'));
  const client = new Client({
    host: '127.0.0.1',
    port: 5433,
    user: creds.adminUser,
    password: creds.adminPassword,
    database: 'textile_erp',
  });
  await client.connect();
  const res = await client.query('SELECT id, email, role, "companyId", password FROM users');
  console.log('Users in textile_erp:', res.rows.map(r => ({ id: r.id, email: r.email, role: r.role, pwd: r.password ? r.password.substring(0, 20) : null })));
  await client.end();
}
main().catch(console.error);

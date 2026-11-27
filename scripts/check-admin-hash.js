const fs = require('fs');
const { Client } = require('../desktop/embedded/backend/node_modules/pg');
const { verify } = require('../backend/node_modules/@node-rs/argon2');

async function main() {
  const credFile = 'C:\\Users\\Aamishkhan\\AppData\\Roaming\\industrial-erp-desktop\\data\\.db_credentials.json';
  const creds = JSON.parse(fs.readFileSync(credFile, 'utf8'));

  const client = new Client({
    host: '127.0.0.1',
    port: 5433,
    user: creds.adminUser,
    password: creds.adminPassword,
    database: 'textile_erp'
  });
  await client.connect();
  const res = await client.query("SELECT email, password FROM users WHERE email = 'admin@industrialerp.local'");
  console.log('User found:', res.rows.length);
  if (res.rows.length > 0) {
    const hash = res.rows[0].password;
    console.log('Hash:', hash);
    const valid = await verify(hash, 'Admin#2026!');
    console.log('Is Admin#2026! valid?', valid);
  }
  await client.end();
}

main().catch(console.error);

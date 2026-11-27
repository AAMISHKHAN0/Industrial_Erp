const fs = require('fs');
const path = require('path');
const { Client } = require('../desktop/embedded/backend/node_modules/pg');

async function main() {
  const credFile = 'C:\\Users\\Aamishkhan\\AppData\\Roaming\\industrial-erp-desktop\\data\\.db_credentials.json';
  const creds = JSON.parse(fs.readFileSync(credFile, 'utf8'));

  const adminClient = new Client({
    host: '127.0.0.1',
    port: 5433,
    user: creds.adminUser,
    password: creds.adminPassword,
    database: 'textile_erp'
  });
  await adminClient.connect();
  console.log('Granting permissions to erp_app on textile_erp...');
  await adminClient.query(`GRANT CONNECT ON DATABASE "textile_erp" TO "${creds.appUser}"`);
  await adminClient.query(`GRANT USAGE ON SCHEMA public TO "${creds.appUser}"`);
  await adminClient.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${creds.appUser}"`);
  await adminClient.query(`GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO "${creds.appUser}"`);
  await adminClient.query(`ALTER DEFAULT PRIVILEGES FOR ROLE "${creds.adminUser}" IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${creds.appUser}"`);
  await adminClient.query(`ALTER DEFAULT PRIVILEGES FOR ROLE "${creds.adminUser}" IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO "${creds.appUser}"`);
  await adminClient.end();

  // Test as erp_app
  const appClient = new Client({
    host: '127.0.0.1',
    port: 5433,
    user: creds.appUser,
    password: creds.appPassword,
    database: 'textile_erp'
  });
  await appClient.connect();
  const u = await appClient.query('SELECT count(*) FROM users');
  const v = await appClient.query('SELECT count(*) FROM vouchers');
  console.log(`SUCCESS! textile_erp as erp_app -> Users: ${u.rows[0].count}, Vouchers: ${v.rows[0].count}`);
  await appClient.end();
}

main().catch(console.error);

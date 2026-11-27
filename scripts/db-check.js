const { Client } = require('../backend/node_modules/pg');

async function check() {
  const appDb = new Client({
    connectionString: 'postgresql://postgres:MBzfd9sgqg93dYfkkFVxrk%24O4i37g%25R3@localhost:5432/textile_erp_test?schema=public'
  });
  await appDb.connect();
  const users = await appDb.query('SELECT id, email, role, status FROM users;');
  console.log('Users in textile_erp_test:');
  users.rows.forEach(u => console.log(`- ${u.email} (${u.role}) status=${u.status}`));
  await appDb.end();
}

check().catch(console.error);

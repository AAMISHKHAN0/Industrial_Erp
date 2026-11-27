const { Client } = require('../backend/node_modules/pg');

async function main() {
  const c = new Client({
    connectionString: 'postgresql://postgres:7MFBARDWtl3oKqDJR7qTb7aB11FPv-sU@127.0.0.1:5433/textile_erp'
  });
  await c.connect();

  const user = await c.query("SELECT id, email, role, status FROM users WHERE email = 'owner@digitalerena.local'");
  console.log('User:', user.rows[0]);

  if (user.rows[0]) {
    const roles = await c.query('SELECT ur.id, r.name FROM user_roles ur JOIN roles r ON ur."roleId" = r.id WHERE ur."userId" = $1', [user.rows[0].id]);
    console.log('User roles in roles table:', roles.rows);
  }

  // Also check textile_erp_fresh
  const cFresh = new Client({
    connectionString: 'postgresql://postgres:7MFBARDWtl3oKqDJR7qTb7aB11FPv-sU@127.0.0.1:5433/textile_erp_fresh'
  });
  await cFresh.connect();
  const freshUsers = await cFresh.query("SELECT id, email, role, status FROM users");
  console.log('Fresh DB users:', freshUsers.rows);

  await c.end();
  await cFresh.end();
}

main().catch(console.error);

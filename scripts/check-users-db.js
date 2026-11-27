const path = require('path');
const pgPath = path.resolve(__dirname, '../backend/node_modules/pg');
const { Client } = require(pgPath);
const client = new Client({
  connectionString: 'postgresql://postgres:MBzfd9sgqg93dYfkkFVxrk%24O4i37g%25R3@127.0.0.1:5432/textile_erp_test'
});
async function run() {
  await client.connect();
  const users = await client.query('SELECT id, email, role, status, "companyId" FROM users');
  console.log('USERS:', JSON.stringify(users.rows, null, 2));
  const userRoles = await client.query('SELECT * FROM user_roles');
  console.log('USER_ROLES:', JSON.stringify(userRoles.rows, null, 2));
  const roles = await client.query('SELECT * FROM roles');
  console.log('ROLES:', JSON.stringify(roles.rows, null, 2));
  const perms = await client.query('SELECT r.name, p.code, p.name as pname FROM role_permissions rp JOIN roles r ON rp."roleId" = r.id JOIN permissions p ON rp."permissionId" = p.id WHERE r.name = $1', ['OWNER']);
  console.log('OWNER PERMS COUNT:', perms.rows.length);
  console.log('SAMPLE PERMS:', JSON.stringify(perms.rows.slice(0, 10), null, 2));
  const ownerRes = await client.query('SELECT id, email, role, password, status FROM users WHERE email = $1', ['owner@digitalerena.local']);
  console.log('OWNER_RECORD:', { ...ownerRes.rows[0], password: ownerRes.rows[0]?.password?.substring(0, 20) + '...' });
  const argon2 = require(path.resolve(__dirname, '../backend/node_modules/@node-rs/argon2'));
  const isMatch = await argon2.verify(ownerRes.rows[0].password, 'Admin#2026!');
  console.log('Admin#2026! matches password:', isMatch);
  await client.end();
}
run().catch(err => {
  console.error(err);
  process.exit(1);
});

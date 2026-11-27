const { Client } = require('../backend/node_modules/pg');
const { verify } = require('../backend/node_modules/@node-rs/argon2');

async function check() {
  const c = new Client({
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    password: decodeURIComponent('MBzfd9sgqg93dYfkkFVxrk%24O4i37g%25R3'),
    database: 'textile_erp_test'
  });
  await c.connect();
  const u = await c.query('SELECT id, email, "companyId", status, password FROM users WHERE email = $1', ['owner@digitalerena.local']);
  console.log('User row:', { ...u.rows[0], password: u.rows[0]?.password?.slice(0, 30) });
  if (u.rows[0]) {
    const isV = await verify(u.rows[0].password, 'Admin#2026!');
    console.log('Argon2 verify with Admin#2026!:', isV);
  }
  await c.end();
}

check().catch(console.error);

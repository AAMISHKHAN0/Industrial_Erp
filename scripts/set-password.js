const { hash } = require('../backend/node_modules/@node-rs/argon2');
const { Client } = require('../backend/node_modules/pg');

async function setPw() {
  const password = 'Admin#2026!';
  const pwHash = await hash(password, { memoryCost: 19456, timeCost: 2, outputLen: 32, parallelism: 1 });
  const client = new Client({
    connectionString: 'postgresql://postgres:MBzfd9sgqg93dYfkkFVxrk%24O4i37g%25R3@localhost:5432/textile_erp_test?schema=public'
  });
  await client.connect();
  const res = await client.query('UPDATE users SET password = $1, status = $2 WHERE email = $3 RETURNING id, email', [
    pwHash,
    'ACTIVE',
    'owner@digitalerena.local'
  ]);
  console.log('Password updated successfully:', res.rows[0]);
  await client.end();
}

setPw().catch(console.error);

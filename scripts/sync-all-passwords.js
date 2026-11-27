const { hash } = require('../backend/node_modules/@node-rs/argon2');
const { Client } = require('../backend/node_modules/pg');

async function syncPasswords() {
  const password = 'Admin#2026!';
  const pwHash = await hash(password, { memoryCost: 19456, timeCost: 2, outputLen: 32, parallelism: 1 });

  // 1. textile_erp
  const c1 = new Client({
    connectionString: 'postgresql://postgres:7MFBARDWtl3oKqDJR7qTb7aB11FPv-sU@127.0.0.1:5433/textile_erp'
  });
  await c1.connect();
  await c1.query("UPDATE users SET password = $1, status = 'ACTIVE' WHERE email IN ('owner@digitalerena.local', 'admin@industrialerp.local')", [pwHash]);
  const r1 = await c1.query("SELECT id, email, role, status FROM users WHERE email IN ('owner@digitalerena.local', 'admin@industrialerp.local')");
  console.log('textile_erp users updated:', r1.rows);
  await c1.end();

  // 2. textile_erp_fresh
  const c2 = new Client({
    connectionString: 'postgresql://postgres:7MFBARDWtl3oKqDJR7qTb7aB11FPv-sU@127.0.0.1:5433/textile_erp_fresh'
  });
  await c2.connect();
  await c2.query("UPDATE users SET password = $1, status = 'ACTIVE' WHERE email = 'pg1959655@gmail.com'", [pwHash]);
  const r2 = await c2.query("SELECT id, email, role, status FROM users WHERE email = 'pg1959655@gmail.com'");
  console.log('textile_erp_fresh users updated:', r2.rows);
  await c2.end();
}

syncPasswords().catch(console.error);

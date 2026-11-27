const { hash } = require('../backend/node_modules/@node-rs/argon2');
const { Client } = require('../backend/node_modules/pg');

async function main() {
  const password = 'Admin#2026!';
  const pwHash = await hash(password, { memoryCost: 19456, timeCost: 2, outputLen: 32, parallelism: 1 });
  const client = new Client({
    connectionString: 'postgresql://postgres:MBzfd9sgqg93dYfkkFVxrk%24O4i37g%25R3@127.0.0.1:5433/textile_erp_test?schema=public'
  });
  await client.connect();

  const compRes = await client.query('SELECT id FROM companies ORDER BY "createdAt" DESC LIMIT 1');
  const companyId = compRes.rows[0].id;

  for (const email of ['admin@industrialerp.local', 'owner@digitalerena.local']) {
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      await client.query('UPDATE users SET password = $1, status = $2, role = $3, "companyId" = $4 WHERE email = $5', [
        pwHash,
        'ACTIVE',
        'ADMIN',
        companyId,
        email
      ]);
      console.log('Updated user:', email);
    } else {
      await client.query(
        'INSERT INTO users (id, email, password, role, status, "companyId", "createdAt", "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), NOW())',
        [email, pwHash, 'ADMIN', 'ACTIVE', companyId]
      );
      console.log('Inserted user:', email);
    }
  }

  await client.end();
}

main().catch(console.error);

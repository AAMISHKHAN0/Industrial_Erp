const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function testUpgrade() {
  const rootClient = new Client({ connectionString: 'postgresql://postgres:MBzfd9sgqg93dYfkkFVxrk%24O4i37g%25R3@localhost:5432/postgres' });
  await rootClient.connect();
  await rootClient.query('DROP DATABASE IF EXISTS textile_erp_upgrade_verify;');
  await rootClient.query('CREATE DATABASE textile_erp_upgrade_verify;');
  await rootClient.end();
  console.log('1. Created empty database textile_erp_upgrade_verify');

  const upgradeUrl = 'postgresql://postgres:MBzfd9sgqg93dYfkkFVxrk%24O4i37g%25R3@localhost:5432/textile_erp_upgrade_verify?schema=public';
  const client = new Client({ connectionString: upgradeUrl });
  await client.connect();

  // Create _prisma_migrations table
  await client.query(`
    CREATE TABLE _prisma_migrations (
      id VARCHAR(36) PRIMARY KEY,
      checksum VARCHAR(64) NOT NULL,
      finished_at TIMESTAMPTZ,
      migration_name VARCHAR(255) NOT NULL,
      logs TEXT,
      rolled_back_at TIMESTAMPTZ,
      started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      applied_steps_count INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Apply migrations 1, 2, 3 manually to simulate previous state
  const m1 = fs.readFileSync(path.join(__dirname, '../prisma/migrations/0_init/migration.sql'), 'utf8');
  await client.query(m1);
  await client.query(`INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, applied_steps_count) VALUES ('m1', 'chk1', now(), '0_init', 1)`);

  const m2 = fs.readFileSync(path.join(__dirname, '../prisma/migrations/20261120183000_m2_posting_models/migration.sql'), 'utf8');
  await client.query(m2);
  await client.query(`INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, applied_steps_count) VALUES ('m2', 'chk2', now(), '20261120183000_m2_posting_models', 1)`);

  const m3 = fs.readFileSync(path.join(__dirname, '../prisma/migrations/20261121041000_add_voucher_reversal/migration.sql'), 'utf8');
  await client.query(m3);
  await client.query(`INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, applied_steps_count) VALUES ('m3', 'chk3', now(), '20261121041000_add_voucher_reversal', 1)`);

  console.log('2. Applied pre-M4 baseline migrations (0_init, m2_posting_models, add_voucher_reversal)');

  // Let's inspect the actual tables in the DB
  const tableRes = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`);
  console.log('Tables present before M4:');
  console.log(tableRes.rows.map(r => r.table_name).join(', '));

  const uCols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'users'`);
  console.log('User columns:', uCols.rows.map(c => c.column_name).join(', '));

  const accCols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'accounts'`);
  console.log('Account columns:', accCols.rows.map(c => c.column_name).join(', '));

  // Seed baseline records using actual schema
  // Insert Company
  await client.query(`INSERT INTO companies (id, name, "updatedAt") VALUES ('comp-upg-1', 'Upgrade Test Co', now())`);
  // Insert User
  await client.query(`INSERT INTO users (id, "companyId", email, password, role, "updatedAt") VALUES ('u-upg-1', 'comp-upg-1', 'admin@upg.com', 'hash123', 'ADMIN', now())`);
  
  // Insert Accounts
  await client.query(`INSERT INTO accounts (id, "companyId", "accountCode", name, type, balance, "updatedAt") VALUES ('acc-cash', 'comp-upg-1', '1001', 'Cash at Bank', 'ASSET', 50000.00, now())`);
  await client.query(`INSERT INTO accounts (id, "companyId", "accountCode", name, type, balance, "updatedAt") VALUES ('acc-rev', 'comp-upg-1', '4001', 'Sales Revenue', 'INCOME', 50000.00, now())`);
  
  // Check if Account table exists
  const hasAccount = tableRes.rows.some(r => r.table_name === 'Account' || r.table_name === 'accounts');
  const accountTableName = tableRes.rows.find(r => r.table_name.toLowerCase() === 'account' || r.table_name.toLowerCase() === 'accounts')?.table_name;
  console.log('Account table name:', accountTableName);

  if (accountTableName) {
    const cols = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1`, [accountTableName]);
    console.log(`Columns of ${accountTableName}:`, cols.rows.map(c => c.column_name).join(', '));
  }

  const itemCols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'items'`);
  console.log('Item columns:', itemCols.rows.map(c => c.column_name).join(', '));

  const voucherCols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'vouchers'`);
  console.log('Voucher columns:', voucherCols.rows.map(c => c.column_name).join(', '));

  // Insert Items
  await client.query(`INSERT INTO items (id, "companyId", "itemCode", name, "updatedAt") VALUES ('item-upg-1', 'comp-upg-1', 'YARN-001', 'Test Cotton Yarn', now())`);
  console.log('Seeded Item record: YARN-001');

  // Insert Voucher
  await client.query(`INSERT INTO vouchers (id, "companyId", "voucherNumber", "voucherType", "businessDate", status, "updatedAt") VALUES ('v-upg-1', 'comp-upg-1', 'V-UPG-001', 'JOURNAL', now(), 'POSTED', now())`);
  console.log('Seeded Voucher record: V-UPG-001, Status: POSTED');

  await client.end();

  // Run prisma migrate deploy to apply migration 4
  console.log('4. Running prisma migrate deploy to apply pending migrations...');
  const deployOut = execSync('npx.cmd prisma migrate deploy', {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: upgradeUrl },
    encoding: 'utf8'
  });
  console.log(deployOut);

  // Reconnect and verify data integrity
  const verifyClient = new Client({ connectionString: upgradeUrl });
  await verifyClient.connect();

  const userRes = await verifyClient.query('SELECT email, role FROM users WHERE id = $1', ['u-upg-1']);
  console.log(`5. Verified User: ${userRes.rows[0].email} (${userRes.rows[0].role})`);
  if (userRes.rows[0].email !== 'admin@upg.com') throw new Error('User record corrupted');

  const accRes = await verifyClient.query('SELECT "accountCode", name, balance FROM accounts WHERE "companyId" = $1 ORDER BY "accountCode"', ['comp-upg-1']);
  console.log('   Verified Account Balances post-migration:');
  for (const row of accRes.rows) {
    console.log(`     Account ${row.accountCode} (${row.name}): Balance = ${row.balance}`);
    if (row.accountCode === '1001' && Number(row.balance) !== 50000) throw new Error('Cash balance corrupted');
    if (row.accountCode === '4001' && Number(row.balance) !== 50000) throw new Error('Revenue balance corrupted');
  }

  const iRes = await verifyClient.query('SELECT name, "itemCode" FROM items WHERE id = $1', ['item-upg-1']);
  console.log(`   Verified Item: ${iRes.rows[0].itemCode} (${iRes.rows[0].name})`);
  if (iRes.rows[0].itemCode !== 'YARN-001') throw new Error('Item record corrupted');

  const vRes = await verifyClient.query('SELECT "voucherNumber", "voucherType", status FROM vouchers WHERE id = $1', ['v-upg-1']);
  console.log(`   Verified Voucher: ${vRes.rows[0].voucherNumber} - Type: ${vRes.rows[0].voucherType}, Status: ${vRes.rows[0].status}`);
  if (vRes.rows[0].voucherNumber !== 'V-UPG-001') throw new Error('Voucher corrupted');

  const migRes = await verifyClient.query('SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at');
  console.log('6. Applied migrations in history:');
  for (const m of migRes.rows) {
    console.log(`   - ${m.migration_name} (finished: ${m.finished_at})`);
  }

  await verifyClient.end();
  console.log('\n================================================================');
  console.log('>>> UPGRADE DATA INTEGRITY TEST PASSED!                      <<<');
  console.log('>>> ALL RECORDS & BALANCES SURVIVED THE MIGRATION UPGRADE!   <<<');
  console.log('================================================================\n');
}

testUpgrade().catch(e => { console.error(e); process.exit(1); });

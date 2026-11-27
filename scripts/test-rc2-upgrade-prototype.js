const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/pg'));

async function testUpgrade() {
  console.log('>>> TESTING RC2 -> RC3 SEAMLESS UPGRADE WITH DATA RETENTION <<<');

  const testDir = path.join(os.tmpdir(), 'rc2_upgrade_' + Date.now());
  const dataDir = path.join(testDir, 'pgsql_data');
  fs.mkdirSync(testDir, { recursive: true });

  const pgBin = path.resolve(__dirname, '../desktop/embedded/pgsql/bin');
  const initdb = path.join(pgBin, 'initdb.exe');
  const pgctl = path.join(pgBin, 'pg_ctl.exe');

  // STEP 1: Simulate an RC2 installation (trust auth, existing records)
  console.log('\n1. Setting up simulated RC2 cluster (trust authentication)...');
  spawnSync(initdb, [
    '-D', dataDir,
    '-U', 'postgres',
    '-E', 'UTF8',
    '--no-locale',
    '-A', 'trust'
  ], { windowsHide: true });

  console.log('2. Starting RC2 PostgreSQL service on port 5440...');
  const logFile = path.join(testDir, 'pg.log');
  spawnSync(pgctl, ['start', '-D', dataDir, '-l', logFile, '-o', '-p 5440 -h 127.0.0.1'], { windowsHide: true, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 2000));

  // Seed existing RC2 data
  const seedClient = new Client({ host: '127.0.0.1', port: 5440, user: 'postgres', database: 'postgres' });
  await seedClient.connect();
  await seedClient.query('CREATE DATABASE textile_erp');
  await seedClient.end();

  const rc2Client = new Client({ host: '127.0.0.1', port: 5440, user: 'postgres', database: 'textile_erp' });
  await rc2Client.connect();
  await rc2Client.query(`
    CREATE TABLE users (id serial primary key, email text, name text);
    CREATE TABLE vouchers (id serial primary key, voucher_no text, amount numeric);
    INSERT INTO users (email, name) VALUES ('owner@digitalerena.local', 'Plant Director');
    INSERT INTO vouchers (voucher_no, amount) VALUES ('RC2-VOUCHER-001', 250000.00);
  `);
  await rc2Client.end();
  console.log('   ✓ RC2 cluster seeded with existing user and PKR 250,000.00 voucher.');

  // Verify RC2 allows passwordless connection before upgrade
  const testRc2Conn = new Client({ host: '127.0.0.1', port: 5440, user: 'postgres', database: 'textile_erp' });
  await testRc2Conn.connect();
  await testRc2Conn.end();
  console.log('   ✓ RC2 allows passwordless connection (trust mode confirmed).');

  // STEP 2: Execute RC3 Upgrade Procedure
  console.log('\n2. Executing RC3 upgrade procedure on existing RC2 cluster...');
  const adminPassword = 'NewRc3AdminSecret#987';
  const appPassword = 'NewRc3AppSecret#456';

  // A. Set SCRAM passwords while still in transition
  const upgradeClient = new Client({ host: '127.0.0.1', port: 5440, user: 'postgres', database: 'postgres' });
  await upgradeClient.connect();
  await upgradeClient.query("SET password_encryption = 'scram-sha-256'");
  await upgradeClient.query(`ALTER ROLE postgres WITH PASSWORD '${adminPassword}'`);
  await upgradeClient.query(`CREATE ROLE erp_app WITH LOGIN PASSWORD '${appPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE`);
  await upgradeClient.end();

  const upgradeErpClient = new Client({ host: '127.0.0.1', port: 5440, user: 'postgres', password: adminPassword, database: 'textile_erp' });
  await upgradeErpClient.connect();
  await upgradeErpClient.query('GRANT CONNECT ON DATABASE textile_erp TO erp_app');
  await upgradeErpClient.query('GRANT USAGE ON SCHEMA public TO erp_app');
  await upgradeErpClient.query('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO erp_app');
  await upgradeErpClient.query('GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO erp_app');
  await upgradeErpClient.query('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO erp_app');
  await upgradeErpClient.query('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO erp_app');
  await upgradeErpClient.end();

  // B. Enforce SCRAM in pg_hba.conf and postgresql.conf
  const hbaPath = path.join(dataDir, 'pg_hba.conf');
  let hbaContent = fs.readFileSync(hbaPath, 'utf8');
  hbaContent = hbaContent.replace(/\btrust\b/g, 'scram-sha-256');
  fs.writeFileSync(hbaPath, hbaContent);

  const confPath = path.join(dataDir, 'postgresql.conf');
  let confContent = fs.readFileSync(confPath, 'utf8');
  if (!confContent.includes('password_encryption = scram-sha-256')) {
    confContent += '\npassword_encryption = scram-sha-256\n';
    fs.writeFileSync(confPath, confContent);
  }

  // C. Reload or restart PostgreSQL to apply SCRAM authentication
  console.log('   Restarting PostgreSQL to enforce SCRAM authentication...');
  spawnSync(pgctl, ['stop', '-D', dataDir, '-m', 'fast'], { windowsHide: true });
  await new Promise(r => setTimeout(r, 1000));
  spawnSync(pgctl, ['start', '-D', dataDir, '-l', logFile, '-o', '-p 5440 -h 127.0.0.1'], { windowsHide: true, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 2000));

  // STEP 3: Verify Passwordless Rejection
  console.log('\n3. Verifying passwordless connections are REJECTED post-upgrade...');
  let rejected = false;
  try {
    const c = new Client({ host: '127.0.0.1', port: 5440, user: 'postgres', database: 'textile_erp' });
    await c.connect();
    await c.end();
  } catch (err) {
    rejected = true;
    console.log('   ✓ Passwordless connection rejected:', err.message);
  }
  if (!rejected) throw new Error('Passwordless connection was NOT rejected after upgrade!');

  // STEP 4: Verify Existing Data Survival via Least-Privilege Account
  console.log('\n4. Verifying existing RC2 data survived intact via least-privilege erp_app account...');
  const appClient = new Client({
    host: '127.0.0.1',
    port: 5440,
    user: 'erp_app',
    password: appPassword,
    database: 'textile_erp',
  });
  await appClient.connect();

  const userRes = await appClient.query("SELECT * FROM users WHERE email = 'owner@digitalerena.local'");
  if (userRes.rows.length === 0 || userRes.rows[0].name !== 'Plant Director') {
    throw new Error('Existing user record was lost or corrupted during upgrade!');
  }
  console.log(`   ✓ Existing user preserved: ${userRes.rows[0].email} (${userRes.rows[0].name})`);

  const voucherRes = await appClient.query("SELECT * FROM vouchers WHERE voucher_no = 'RC2-VOUCHER-001'");
  if (voucherRes.rows.length === 0 || Number(voucherRes.rows[0].amount) !== 250000) {
    throw new Error('Existing voucher record was lost or corrupted during upgrade!');
  }
  console.log(`   ✓ Existing transaction preserved: ${voucherRes.rows[0].voucher_no} (PKR ${voucherRes.rows[0].amount})`);

  // Verify least-privilege: appClient cannot DROP TABLE
  let dropPrevented = false;
  try {
    await appClient.query('DROP TABLE vouchers');
  } catch (err) {
    dropPrevented = true;
    console.log('   ✓ Least-privilege enforced (cannot DROP TABLE):', err.message);
  }
  if (!dropPrevented) throw new Error('erp_app was able to DROP TABLE!');

  await appClient.end();

  // Teardown
  spawnSync(pgctl, ['stop', '-D', dataDir, '-m', 'fast'], { windowsHide: true });
  fs.rmSync(testDir, { recursive: true, force: true });

  console.log('\n================================================================');
  console.log('>>> RC2 -> RC3 UPGRADE VERIFIED: ZERO DATA LOSS, SCRAM ACTIVE <<<');
  console.log('================================================================\n');
}

testUpgrade().catch(err => {
  console.error('[FATAL] Upgrade test failed:', err);
  process.exit(1);
});

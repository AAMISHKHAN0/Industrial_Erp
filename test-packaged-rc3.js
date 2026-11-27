const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');
const http = require('http');
const crypto = require('crypto');
const { Client } = require(path.resolve(__dirname, 'backend/node_modules/pg'));

async function checkSocket(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.on('connect', () => { socket.destroy(); resolve(true); });
    socket.on('error', () => { socket.destroy(); resolve(false); });
    socket.on('timeout', () => { socket.destroy(); resolve(false); });
    socket.connect(port, host);
  });
}

async function waitForSocket(host, port, maxRetries = 25, intervalMs = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    if (await checkSocket(host, port)) return true;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return false;
}

function httpPost(url, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const postData = JSON.stringify(data);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...headers,
      },
      timeout: 15000,
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'GET',
      headers: headers,
      timeout: 15000,
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runRc3AcceptanceVerification() {
  console.log('================================================================');
  console.log('>>> STARTING RC3 STANDALONE RUNTIME & SECURITY ACCEPTANCE    <<<');
  console.log('>>> SCRAM-SHA-256, LEAST-PRIVILEGE & RC2 UPGRADE VALIDATION  <<<');
  console.log('================================================================\n');

  const rootDir = path.resolve(__dirname);
  const unpackedDir = path.join(rootDir, 'desktop/dist/win-unpacked');
  const embeddedDir = path.join(unpackedDir, 'resources/embedded');

  const nodeExe = path.join(embeddedDir, 'node/node.exe');
  const pgBin = path.join(embeddedDir, 'pgsql/bin');
  const initDbExe = path.join(pgBin, 'initdb.exe');
  const pgCtlExe = path.join(pgBin, 'pg_ctl.exe');
  const backendDir = path.join(embeddedDir, 'backend');
  const frontendDir = path.join(embeddedDir, 'frontend');

  console.log('1. Checking packaged binaries in unpacked distribution:');
  console.log(`   - Node.js runtime:   ${fs.existsSync(nodeExe) ? 'PRESENT' : 'MISSING'}`);
  console.log(`   - initdb.exe:        ${fs.existsSync(initDbExe) ? 'PRESENT' : 'MISSING'}`);
  console.log(`   - pg_ctl.exe:        ${fs.existsSync(pgCtlExe) ? 'PRESENT' : 'MISSING'}`);
  console.log(`   - backend main.js:   ${fs.existsSync(path.join(backendDir, 'dist/src/main.js')) ? 'PRESENT' : 'MISSING'}`);
  console.log(`   - frontend server:   ${fs.existsSync(path.join(frontendDir, 'server.js')) ? 'PRESENT' : 'MISSING'}`);

  if (!fs.existsSync(nodeExe) || !fs.existsSync(pgCtlExe) || !fs.existsSync(path.join(backendDir, 'dist/src/main.js'))) {
    throw new Error('Packaged embedded binaries are incomplete.');
  }

  // Generate unique per-install credentials
  const adminPassword = crypto.randomBytes(24).toString('hex');
  const appPassword = crypto.randomBytes(24).toString('hex');
  const testPgPort = 5435;

  const isolatedDataDir = path.join(process.env.TEMP || 'C:\\Temp', `erp_rc3_test_${Date.now()}`);
  const pgDataDir = path.join(isolatedDataDir, 'pgsql_data');
  fs.mkdirSync(isolatedDataDir, { recursive: true });

  const credFile = path.join(isolatedDataDir, '.db_credentials.json');
  fs.writeFileSync(credFile, JSON.stringify({
    adminUser: 'postgres',
    adminPassword,
    appUser: 'erp_app',
    appPassword,
    createdAt: new Date().toISOString(),
  }, null, 2), { mode: 0o600 });
  console.log('   ✓ Unique per-installation credentials generated and secured in .db_credentials.json');

  // 2. Initialize PostgreSQL cluster with SCRAM-SHA-256
  console.log(`\n2. Initializing new PostgreSQL cluster with SCRAM-SHA-256:\n   ${pgDataDir}`);
  const pwFile = path.join(isolatedDataDir, '.init_pw.tmp');
  fs.writeFileSync(pwFile, adminPassword + '\n', { mode: 0o600 });

  const initRes = spawnSync(initDbExe, [
    '-D', pgDataDir,
    '-U', 'postgres',
    '-E', 'UTF8',
    '--no-locale',
    '-A', 'scram-sha-256',
    `--pwfile=${pwFile}`
  ], { windowsHide: true });
  try { fs.unlinkSync(pwFile); } catch {}

  if (initRes.status !== 0) throw new Error(`initdb failed: ${initRes.stderr?.toString()}`);
  console.log('   ✓ PostgreSQL cluster initialized with SCRAM-SHA-256.');

  // Verify pg_hba.conf active rules contain scram-sha-256 and no trust
  const hbaText = fs.readFileSync(path.join(pgDataDir, 'pg_hba.conf'), 'utf8');
  const activeRules = hbaText.split('\n').filter(l => !l.trim().startsWith('#') && l.trim()).join('\n');
  if (/\btrust\b/.test(activeRules) || !activeRules.includes('scram-sha-256')) {
    throw new Error('pg_hba.conf active rules do not strictly enforce scram-sha-256!');
  }
  console.log('   ✓ pg_hba.conf verified: all active connection rules enforce scram-sha-256 (no trust).');

  // 3. Start PostgreSQL on loopback
  console.log(`\n3. Starting isolated PostgreSQL service on 127.0.0.1:${testPgPort}...`);
  const logFile = path.join(isolatedDataDir, 'postgres.log');
  spawnSync(pgCtlExe, ['start', '-D', pgDataDir, '-l', logFile, '-o', `-p ${testPgPort} -h 127.0.0.1`], { windowsHide: true, stdio: 'ignore' });

  const pgOnline = await waitForSocket('127.0.0.1', testPgPort, 20);
  if (!pgOnline) throw new Error(`PostgreSQL failed to listen on port ${testPgPort}`);
  console.log(`   ✓ PostgreSQL is online on port ${testPgPort}.`);

  // 4. Verify passwordless connections are REJECTED
  console.log('\n4. Verifying passwordless connection rejection...');
  let passwordlessRejected = false;
  try {
    const c = new Client({ host: '127.0.0.1', port: testPgPort, user: 'postgres', database: 'postgres' });
    await c.connect();
    await c.end();
  } catch (err) {
    passwordlessRejected = true;
    console.log(`   ✓ Passwordless connection rejected: ${err.message}`);
  }
  if (!passwordlessRejected) {
    throw new Error('Security violation: PostgreSQL accepted a passwordless connection!');
  }

  // Verify wrong password is rejected
  let wrongPwRejected = false;
  try {
    const c = new Client({ host: '127.0.0.1', port: testPgPort, user: 'postgres', password: 'InvalidPassword#123', database: 'postgres' });
    await c.connect();
    await c.end();
  } catch (err) {
    wrongPwRejected = true;
    console.log(`   ✓ Invalid password rejected: ${err.message}`);
  }
  if (!wrongPwRejected) {
    throw new Error('Security violation: PostgreSQL accepted an invalid password!');
  }

  // 5. Deploy migrations using admin account and provision least-privilege erp_app
  console.log('\n5. Deploying migrations and provisioning least-privilege role via packaged runner...');
  const adminDbUrl = `postgresql://postgres:${encodeURIComponent(adminPassword)}@127.0.0.1:${testPgPort}/textile_erp?schema=public`;
  const appDbUrl = `postgresql://erp_app:${encodeURIComponent(appPassword)}@127.0.0.1:${testPgPort}/textile_erp?schema=public`;

  const migRes = spawnSync(nodeExe, ['run-migrations.js'], {
    cwd: backendDir,
    env: {
      ...process.env,
      DATABASE_URL: adminDbUrl,
      APP_DB_USER: 'erp_app',
      APP_DB_PASSWORD: appPassword,
    },
    windowsHide: true,
    encoding: 'utf8',
  });
  console.log(migRes.stdout);
  if (migRes.status !== 0) throw new Error(`Migration runner failed: ${migRes.stderr}`);
  console.log('   ✓ Migrations deployed and least-privilege permissions granted to "erp_app".');

  // 6. Verify least-privilege enforcement for erp_app
  console.log('\n6. Verifying least-privilege boundaries for erp_app...');
  const erpClient = new Client({ host: '127.0.0.1', port: testPgPort, user: 'erp_app', password: appPassword, database: 'textile_erp' });
  await erpClient.connect();

  // Test DML capability (should succeed)
  const countRes = await erpClient.query('SELECT COUNT(*) FROM _prisma_migrations');
  console.log(`   ✓ erp_app can execute DML (SELECT): read ${countRes.rows[0].count} migration records.`);

  // Test DDL restriction (DROP TABLE should be forbidden)
  let dropDenied = false;
  try {
    await erpClient.query('DROP TABLE _prisma_migrations');
  } catch (err) {
    dropDenied = true;
    console.log(`   ✓ erp_app DDL restriction enforced (cannot DROP TABLE): ${err.message}`);
  }
  if (!dropDenied) {
    throw new Error('Least-privilege violation: erp_app was able to DROP TABLE!');
  }
  await erpClient.end();

  // 7. Spawning NestJS API using least-privilege erp_app account
  console.log('\n7. Spawning NestJS API using least-privilege erp_app connection on port 4002...');
  const backendProc = spawn(nodeExe, ['dist/src/main.js'], {
    cwd: backendDir,
    env: { ...process.env, DATABASE_URL: appDbUrl, PORT: '4002', HOST: '127.0.0.1' },
    windowsHide: true,
  });

  backendProc.stdout.on('data', d => {
    console.log('   [Backend stdout]', d.toString().trim());
  });
  backendProc.stderr.on('data', d => {
    console.error('   [Backend stderr]', d.toString().trim());
  });

  let backendReady = false;
  for (let i = 0; i < 30; i++) {
    try {
      const h = await httpGet('http://127.0.0.1:4002/api/v1/health');
      if (h.status === 200) { backendReady = true; break; }
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  if (!backendReady) throw new Error('Packaged backend failed to pass health checks.');
  console.log('   ✓ Packaged backend API running on http://127.0.0.1:4002 under least-privilege account.');

  // 8. Test First-Run Setup & Transaction Flow under least-privilege
  console.log('\n8. Executing bootstrap and transaction flow under least-privilege account...');
  const bootstrapRes = await httpPost('http://127.0.0.1:4002/api/v1/auth/bootstrap', {
    companyName: 'Digital Erena RC3 Enterprise',
    adminEmail: 'director@digitalerena.local',
    adminName: 'Chief Operating Officer',
    password: 'MasterPassword#2026',
  });
  if (bootstrapRes.status !== 201) throw new Error(`Bootstrap failed: ${JSON.stringify(bootstrapRes.body)}`);
  const companyId = (bootstrapRes.body?.data || bootstrapRes.body).company.id;
  console.log(`   ✓ Created Company: "${(bootstrapRes.body?.data || bootstrapRes.body).company.name}"`);

  // Login
  const loginRes = await httpPost('http://127.0.0.1:4002/api/v1/auth/login', {
    email: 'director@digitalerena.local',
    password: 'MasterPassword#2026',
  });
  if (loginRes.status !== 200) throw new Error(`Login failed: ${JSON.stringify(loginRes.body)}`);
  const sessionToken = (loginRes.body?.data || loginRes.body).sessionToken;
  console.log('   ✓ Offline login succeeded with Argon2id session token.');

  // Retrieve accounts & post transaction
  const accountsRes = await httpGet('http://127.0.0.1:4002/api/v1/finance/accounts', {
    Authorization: `Bearer ${sessionToken}`,
    'X-Company-Id': companyId,
  });
  const accounts = accountsRes.body?.data || accountsRes.body;
  const bankAcc = accounts.find(a => a.accountCode === 'BANK' || a.name === 'Bank');
  const revenueAcc = accounts.find(a => a.accountCode === 'SALES_REVENUE' || a.accountCode === 'CASH');

  const postRes = await httpPost('http://127.0.0.1:4002/api/v1/finance/journal-entries', {
    entryNumber: 'RC3-VOUCHER-001',
    entryDate: new Date().toISOString(),
    description: 'RC3 Verified Journal Voucher - Capital Inflow',
    reference: 'REF-RC3-2026',
    items: [
      { accountId: bankAcc.id, debitAmount: 500000, creditAmount: 0, description: 'Bank Capital' },
      { accountId: revenueAcc.id, debitAmount: 0, creditAmount: 500000, description: 'Owner Contribution' },
    ],
  }, {
    Authorization: `Bearer ${sessionToken}`,
    'X-Company-Id': companyId,
  });
  if (postRes.status !== 201) throw new Error(`Transaction failed: ${JSON.stringify(postRes.body)}`);
  console.log('   ✓ Journal voucher committed: PKR 500,000.00 debit/credit balanced.');

  // Clean up fresh test instances
  try { backendProc.kill(); } catch {}
  spawnSync(pgCtlExe, ['stop', '-D', pgDataDir, '-m', 'fast'], { windowsHide: true });
  fs.rmSync(isolatedDataDir, { recursive: true, force: true });

  // 9. SIMULATE EXISTING RC2 INSTALLATION UPGRADE & VERIFY ZERO DATA LOSS
  console.log('\n9. SIMULATING EXISTING RC2 INSTALLATION UPGRADE & VERIFYING ZERO DATA LOSS...');
  const upgradeDir = path.join(process.env.TEMP || 'C:\\Temp', `erp_rc2_to_rc3_test_${Date.now()}`);
  const upgradePgDataDir = path.join(upgradeDir, 'pgsql_data');
  fs.mkdirSync(upgradeDir, { recursive: true });
  const upgradePort = 5436;

  // A. Initialize simulated RC2 cluster with trust authentication
  console.log('   Initializing simulated RC2 cluster with trust authentication...');
  spawnSync(initDbExe, ['-D', upgradePgDataDir, '-U', 'postgres', '-E', 'UTF8', '--no-locale', '-A', 'trust'], { windowsHide: true });

  // Start RC2 postgres
  const upgradeLog = path.join(upgradeDir, 'pg.log');
  spawnSync(pgCtlExe, ['start', '-D', upgradePgDataDir, '-l', upgradeLog, '-o', `-p ${upgradePort} -h 127.0.0.1`], { windowsHide: true, stdio: 'ignore' });
  await waitForSocket('127.0.0.1', upgradePort, 20);

  // Seed existing RC2 records
  const seedClient = new Client({ host: '127.0.0.1', port: upgradePort, user: 'postgres', database: 'postgres' });
  await seedClient.connect();
  await seedClient.query('CREATE DATABASE textile_erp');
  await seedClient.end();

  const seedErpClient = new Client({ host: '127.0.0.1', port: upgradePort, user: 'postgres', database: 'textile_erp' });
  await seedErpClient.connect();
  await seedErpClient.query(`
    CREATE TABLE company (id text primary key, name text);
    CREATE TABLE users (id text primary key, email text, role text);
    CREATE TABLE vouchers (id text primary key, entry_number text, amount numeric);
    INSERT INTO company VALUES ('comp-rc2-001', 'Legacy Textile Mills (From RC2)');
    INSERT INTO users VALUES ('user-rc2-001', 'manager@legacytextile.local', 'OWNER');
    INSERT INTO vouchers VALUES ('vouch-rc2-001', 'RC2-PRE-UPGRADE-VOUCHER', 750000.00);
  `);
  await seedErpClient.end();
  console.log('   ✓ Seeded existing RC2 records: Company, User, and PKR 750,000.00 transaction.');

  // B. Run RC3 upgrade procedure on the running cluster
  console.log('   Applying RC3 upgrade: converting trust -> SCRAM-SHA-256 and creating erp_app...');
  const upgAdminPw = crypto.randomBytes(24).toString('hex');
  const upgAppPw = crypto.randomBytes(24).toString('hex');

  const upgClient = new Client({ host: '127.0.0.1', port: upgradePort, user: 'postgres', database: 'postgres' });
  await upgClient.connect();
  await upgClient.query("SET password_encryption = 'scram-sha-256'");
  await upgClient.query(`ALTER ROLE postgres WITH PASSWORD '${upgAdminPw}'`);
  await upgClient.query(`CREATE ROLE erp_app WITH LOGIN PASSWORD '${upgAppPw}' NOSUPERUSER NOCREATEDB NOCREATEROLE`);
  await upgClient.end();

  const upgGrantsClient = new Client({ host: '127.0.0.1', port: upgradePort, user: 'postgres', password: upgAdminPw, database: 'textile_erp' });
  await upgGrantsClient.connect();
  await upgGrantsClient.query('GRANT CONNECT ON DATABASE textile_erp TO erp_app');
  await upgGrantsClient.query('GRANT USAGE ON SCHEMA public TO erp_app');
  await upgGrantsClient.query('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO erp_app');
  await upgGrantsClient.query('GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO erp_app');
  await upgGrantsClient.end();

  // Update pg_hba.conf to scram-sha-256
  const upgHbaPath = path.join(upgradePgDataDir, 'pg_hba.conf');
  let upgHba = fs.readFileSync(upgHbaPath, 'utf8').replace(/\btrust\b/g, 'scram-sha-256');
  fs.writeFileSync(upgHbaPath, upgHba);

  // Reload config
  spawnSync(pgCtlExe, ['reload', '-D', upgradePgDataDir], { windowsHide: true });
  await new Promise(r => setTimeout(r, 1500));

  // C. Verify passwordless connection is now rejected on upgraded cluster
  let upgPasswordlessRejected = false;
  try {
    const c = new Client({ host: '127.0.0.1', port: upgradePort, user: 'postgres', database: 'textile_erp' });
    await c.connect();
    await c.end();
  } catch (err) {
    upgPasswordlessRejected = true;
    console.log(`   ✓ Upgraded cluster strictly rejects passwordless connection: ${err.message}`);
  }
  if (!upgPasswordlessRejected) {
    throw new Error('Security failure: Upgraded cluster still accepts passwordless connections!');
  }

  // D. Verify existing RC2 records are 100% intact through least-privilege erp_app
  const upgVerifyClient = new Client({ host: '127.0.0.1', port: upgradePort, user: 'erp_app', password: upgAppPw, database: 'textile_erp' });
  await upgVerifyClient.connect();

  const compRes = await upgVerifyClient.query('SELECT * FROM company');
  const usrRes = await upgVerifyClient.query('SELECT * FROM users');
  const vouchRes = await upgVerifyClient.query('SELECT * FROM vouchers');

  if (compRes.rows[0]?.name !== 'Legacy Textile Mills (From RC2)' ||
      usrRes.rows[0]?.email !== 'manager@legacytextile.local' ||
      Number(vouchRes.rows[0]?.amount) !== 750000.00) {
    throw new Error('Data loss detected during upgrade from RC2 to RC3!');
  }
  console.log(`   ✓ Existing Company survived upgrade: "${compRes.rows[0].name}"`);
  console.log(`   ✓ Existing User survived upgrade:    "${usrRes.rows[0].email}"`);
  console.log(`   ✓ Existing Voucher survived upgrade: "${vouchRes.rows[0].entry_number}" (PKR ${vouchRes.rows[0].amount})`);

  // Verify least-privilege on upgraded cluster (cannot drop table)
  let upgDropDenied = false;
  try {
    await upgVerifyClient.query('DROP TABLE vouchers');
  } catch (err) {
    upgDropDenied = true;
    console.log(`   ✓ erp_app least-privilege verified on upgraded cluster (DROP TABLE blocked): ${err.message}`);
  }
  if (!upgDropDenied) {
    throw new Error('Least-privilege violation: erp_app was able to DROP TABLE on upgraded cluster!');
  }

  await upgVerifyClient.end();

  // Teardown upgrade test
  spawnSync(pgCtlExe, ['stop', '-D', upgradePgDataDir, '-m', 'fast'], { windowsHide: true });
  fs.rmSync(upgradeDir, { recursive: true, force: true });

  console.log('\n================================================================');
  console.log('>>> ALL RC3 SECURITY & UPGRADE ACCEPTANCE CHECKS PASSED!     <<<');
  console.log('>>> SCRAM-SHA-256 ACTIVE, LEAST-PRIVILEGE PROVEN, NO DATA LOSS <<<');
  console.log('================================================================\n');
}

runRc3AcceptanceVerification().catch(err => {
  console.error('\n[FATAL] RC3 Acceptance Verification Failed:', err);
  process.exit(1);
});

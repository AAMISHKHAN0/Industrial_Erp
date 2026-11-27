const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/pg'));

async function test() {
  const testDir = path.join(os.tmpdir(), 'scram_proto_' + Date.now());
  const dataDir = path.join(testDir, 'data');
  fs.mkdirSync(testDir, { recursive: true });

  const pgBin = path.resolve('desktop/embedded/pgsql/bin');
  const initdb = path.join(pgBin, 'initdb.exe');
  const pgctl = path.join(pgBin, 'pg_ctl.exe');

  const adminPw = 'AdminScramSecret#2026';
  const appPw = 'AppScramSecret#2026';

  const pwFile = path.join(testDir, 'pw.txt');
  fs.writeFileSync(pwFile, adminPw + '\n');

  console.log('1. Initializing SCRAM cluster...');
  const initRes = spawnSync(initdb, [
    '-D', dataDir,
    '-U', 'postgres',
    '-E', 'UTF8',
    '--no-locale',
    '-A', 'scram-sha-256',
    '--pwfile=' + pwFile
  ], { windowsHide: true, encoding: 'utf8' });
  fs.unlinkSync(pwFile);

  if (initRes.status !== 0) {
    throw new Error('initdb failed: ' + initRes.stderr);
  }

  console.log('2. Starting postgres on 5439...');
  const logFile = path.join(testDir, 'pg.log');
  spawnSync(pgctl, ['start', '-D', dataDir, '-l', logFile, '-o', '-p 5439 -h 127.0.0.1'], { windowsHide: true, stdio: 'ignore' });

  await new Promise(r => setTimeout(r, 2000));

  console.log('3. Testing passwordless connection for postgres...');
  let passwordlessFailed = false;
  try {
    const c = new Client({ host: '127.0.0.1', port: 5439, user: 'postgres', database: 'postgres' });
    await c.connect();
    await c.end();
  } catch (err) {
    passwordlessFailed = true;
    console.log('   ✓ Passwordless connection rejected as expected:', err.message);
  }
  if (!passwordlessFailed) throw new Error('Passwordless connection succeeded when it should have failed!');

  console.log('4. Testing wrong password connection...');
  let wrongPwFailed = false;
  try {
    const c = new Client({ host: '127.0.0.1', port: 5439, user: 'postgres', password: 'WrongPassword!', database: 'postgres' });
    await c.connect();
    await c.end();
  } catch (err) {
    wrongPwFailed = true;
    console.log('   ✓ Wrong password rejected as expected:', err.message);
  }
  if (!wrongPwFailed) throw new Error('Wrong password succeeded when it should have failed!');

  console.log('5. Testing valid admin SCRAM connection...');
  const adminClient = new Client({ host: '127.0.0.1', port: 5439, user: 'postgres', password: adminPw, database: 'postgres' });
  await adminClient.connect();
  console.log('   ✓ Admin authenticated via SCRAM-SHA-256 successfully.');

  // Create textile_erp DB and erp_app user
  await adminClient.query('CREATE DATABASE textile_erp');
  await adminClient.query(`CREATE ROLE erp_app WITH LOGIN PASSWORD '${appPw}' NOSUPERUSER NOCREATEDB NOCREATEROLE`);
  await adminClient.end();

  console.log('6. Provisioning least-privilege permissions in textile_erp...');
  const appAdminClient = new Client({ host: '127.0.0.1', port: 5439, user: 'postgres', password: adminPw, database: 'textile_erp' });
  await appAdminClient.connect();
  await appAdminClient.query('CREATE TABLE sample_data (id serial primary key, name text)');
  await appAdminClient.query('GRANT CONNECT ON DATABASE textile_erp TO erp_app');
  await appAdminClient.query('GRANT USAGE ON SCHEMA public TO erp_app');
  await appAdminClient.query('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO erp_app');
  await appAdminClient.query('GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO erp_app');
  await appAdminClient.end();

  console.log('7. Testing erp_app passwordless connection...');
  let appPasswordlessFailed = false;
  try {
    const c = new Client({ host: '127.0.0.1', port: 5439, user: 'erp_app', database: 'textile_erp' });
    await c.connect();
    await c.end();
  } catch (err) {
    appPasswordlessFailed = true;
    console.log('   ✓ erp_app passwordless connection rejected as expected:', err.message);
  }
  if (!appPasswordlessFailed) throw new Error('erp_app passwordless connection succeeded!');

  console.log('8. Testing erp_app DML (SELECT / INSERT)...');
  const erpClient = new Client({ host: '127.0.0.1', port: 5439, user: 'erp_app', password: appPw, database: 'textile_erp' });
  await erpClient.connect();
  await erpClient.query("INSERT INTO sample_data (name) VALUES ('Ledger Transaction 1')");
  const rows = await erpClient.query('SELECT * FROM sample_data');
  console.log('   ✓ erp_app DML succeeded. Read rows:', rows.rows.length);

  console.log('9. Testing erp_app DDL restriction (DROP TABLE)...');
  let dropFailed = false;
  try {
    await erpClient.query('DROP TABLE sample_data');
  } catch (err) {
    dropFailed = true;
    console.log('   ✓ erp_app DROP TABLE rejected as expected (least-privilege):', err.message);
  }
  if (!dropFailed) throw new Error('erp_app was able to DROP TABLE!');
  await erpClient.end();

  console.log('10. Cleaning up...');
  spawnSync(pgctl, ['stop', '-D', dataDir, '-m', 'fast'], { windowsHide: true });
  fs.rmSync(testDir, { recursive: true, force: true });
  console.log('\n>>> ALL SCRAM AND LEAST-PRIVILEGE CHECKS PASSED PERFECTLY! <<<');
}

test().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const testDir = path.resolve('test_port_repro');
if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
fs.mkdirSync(testDir, { recursive: true });

const initdb = path.resolve('desktop/embedded/pgsql/bin/initdb.exe');
const pgctl = path.resolve('desktop/embedded/pgsql/bin/pg_ctl.exe');

console.log('Initializing test cluster...');
const initRes = spawnSync(initdb, ['-D', testDir, '-U', 'postgres', '-A', 'trust', '--no-locale'], { encoding: 'utf8' });
if (initRes.status !== 0) {
  console.error('initdb failed:', initRes.stderr);
  process.exit(1);
}

const logFile = path.join(testDir, 'postgres.log');
console.log('Testing pg_ctl start with -o "-p 5434 -h 127.0.0.1"...');
const res = spawnSync(pgctl, ['start', '-D', testDir, '-l', logFile, '-o', '-p 5434 -h 127.0.0.1'], { encoding: 'utf8' });
console.log('pg_ctl exit code:', res.status);
console.log('pg_ctl stdout:', res.stdout);
console.log('pg_ctl stderr:', res.stderr);

setTimeout(() => {
  if (fs.existsSync(logFile)) {
    console.log('--- postgres.log ---');
    console.log(fs.readFileSync(logFile, 'utf8'));
  }
  const pidFile = path.join(testDir, 'postmaster.pid');
  if (fs.existsSync(pidFile)) {
    console.log('--- postmaster.pid ---');
    console.log(fs.readFileSync(pidFile, 'utf8'));
  }
  spawnSync(pgctl, ['stop', '-D', testDir, '-m', 'immediate']);
  try { fs.rmSync(testDir, { recursive: true, force: true }); } catch {}
  process.exit(0);
}, 1500);

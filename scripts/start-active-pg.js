const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const pgDataDir = 'C:\\Users\\Aamishkhan\\AppData\\Roaming\\Industrial ERP\\data\\pgsql_data';
const pgCtl = path.resolve(__dirname, '../desktop/embedded/pgsql/bin/pg_ctl.exe');
const logFile = 'C:\\Users\\Aamishkhan\\AppData\\Roaming\\Industrial ERP\\logs\\postgres.log';

// Clean stale postmaster.pid if not alive
const pidFile = path.join(pgDataDir, 'postmaster.pid');
if (fs.existsSync(pidFile)) {
  try {
    const lines = fs.readFileSync(pidFile, 'utf8').split('\n');
    const pid = parseInt(lines[0], 10);
    try {
      process.kill(pid, 0);
      console.log(`Postgres is already running with PID ${pid}`);
      process.exit(0);
    } catch {
      console.log(`Cleaning stale postmaster.pid for PID ${pid}`);
      fs.unlinkSync(pidFile);
    }
  } catch {}
}

console.log('Starting postgres on 5433...');
const child = spawn(pgCtl, ['start', '-D', pgDataDir, '-l', logFile, '-o', '-p 5433'], {
  detached: true,
  stdio: 'ignore',
});
child.unref();

setTimeout(() => {
  console.log('Check complete.');
  process.exit(0);
}, 2000);

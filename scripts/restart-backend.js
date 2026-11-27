const { spawn, execSync } = require('child_process');
const path = require('path');

async function restart() {
  console.log('Finding existing backend process on port 4000...');
  try {
    const ps = execSync('powershell "Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess"', { encoding: 'utf8' }).trim();
    if (ps) {
      console.log(`Killing old backend PID ${ps}...`);
      try { process.kill(parseInt(ps), 'SIGKILL'); } catch (e) {}
      execSync(`taskkill /F /PID ${ps}`, { stdio: 'ignore' });
    }
  } catch (e) {}

  await new Promise(r => setTimeout(r, 1000));

  console.log('Spawning updated backend on port 4000...');
  const backendDir = path.resolve(__dirname, '../backend');
  const proc = spawn('node', ['dist/src/main.js'], {
    cwd: backendDir,
    env: {
      ...process.env,
      PORT: '4000',
      DATABASE_URL: 'postgresql://postgres:MBzfd9sgqg93dYfkkFVxrk%24O4i37g%25R3@127.0.0.1:5432/textile_erp_test?schema=public',
      JWT_SECRET: 'textile-erp-jwt-secret-key-2026',
      JWT_EXPIRATION: '3600',
      JWT_REFRESH_EXPIRATION: '86400',
      FRONTEND_URL: 'http://localhost:3000'
    },
    detached: true,
    stdio: 'ignore'
  });
  proc.unref();

  console.log(`Spawned new backend process with PID ${proc.pid}. Waiting for health check...`);
  let ready = false;
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const res = await fetch('http://127.0.0.1:4000/api/v1/auth/bootstrap/status');
      if (res.status === 200) {
        ready = true;
        break;
      }
    } catch (e) {}
  }

  if (!ready) {
    throw new Error('Backend failed to become healthy within 20s');
  }
  console.log('Backend successfully restarted and verified healthy on port 4000.');
}

restart().catch(console.error);

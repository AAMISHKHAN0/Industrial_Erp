const { spawn } = require('child_process');
const path = require('path');

async function measureStartup() {
  const backendDir = path.resolve(__dirname, '../backend');
  const t0 = performance.now();
  const proc = spawn('node', ['dist/src/main.js'], {
    cwd: backendDir,
    env: {
      ...process.env,
      PORT: '4005',
      DATABASE_URL: 'postgresql://postgres:MBzfd9sgqg93dYfkkFVxrk%24O4i37g%25R3@127.0.0.1:5433/textile_erp_test?schema=public'
    },
    windowsHide: true,
    stdio: 'ignore'
  });

  let started = false;
  let elapsed = 0;
  for (let i = 0; i < 50; i++) {
    await new Promise(r => setTimeout(r, 200));
    try {
      const res = await fetch('http://127.0.0.1:4005/api/v1/health');
      if (res.status === 200) {
        elapsed = performance.now() - t0;
        started = true;
        break;
      }
    } catch (e) {}
  }

  proc.kill('SIGKILL');
  try { process.kill(proc.pid); } catch (e) {}

  console.log(`Backend API startup time: ${elapsed.toFixed(2)} ms (started: ${started})`);
  return elapsed;
}

measureStartup().catch(console.error);

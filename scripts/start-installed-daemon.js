const { spawn } = require('child_process');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

console.log('Spawning Industrial ERP GUI with clean environment...');
const child = spawn('C:\\Users\\Aamishkhan\\AppData\\Local\\Programs\\Industrial ERP\\Industrial ERP.exe', [], {
  env,
  stdio: 'inherit',
});

child.on('error', (err) => {
  console.error('Spawn error:', err);
});

child.on('exit', (code, signal) => {
  console.log(`Industrial ERP exited with code ${code}, signal ${signal}`);
});

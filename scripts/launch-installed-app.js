const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const appExe = 'C:\\Users\\Aamishkhan\\AppData\\Local\\Programs\\Industrial ERP\\Industrial ERP.exe';
console.log(`Launching installed app: ${appExe}`);

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const startTime = Date.now();
const child = spawn(appExe, [], {
  env,
  detached: true,
  stdio: 'ignore',
});
child.unref();

console.log(`Spawned with PID: ${child.pid}`);

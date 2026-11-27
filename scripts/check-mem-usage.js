const { execSync } = require('child_process');

function getMem() {
  try {
    const portJson = execSync('powershell "Get-NetTCPConnection -LocalPort 4000, 3000, 5433 -State Listen -ErrorAction SilentlyContinue | Select-Object LocalPort, OwningProcess | ConvertTo-Json"', { encoding: 'utf8' });
    const parsed = JSON.parse(portJson);
    const pids = [...new Set(parsed.map(x => x.OwningProcess))];
    const procJson = execSync(`powershell "Get-Process -Id ${pids.join(',')} | Select-Object Id, ProcessName, @{Name='WorkingSetMB';Expression={[math]::Round($_.WorkingSet64/1MB,2)}}, @{Name='PrivateMemMB';Expression={[math]::Round($_.PrivateMemorySize64/1MB,2)}} | ConvertTo-Json"`, { encoding: 'utf8' });
    console.table(JSON.parse(procJson));
  } catch (e) {
    console.error(e.message);
  }
}

getMem();

const os = require('os');
const { execSync } = require('child_process');

function getSpecs() {
  const cpus = os.cpus();
  const totalMemGB = (os.totalmem() / (1024 ** 3)).toFixed(2);
  const freeMemGB = (os.freemem() / (1024 ** 3)).toFixed(2);

  let cpuName = cpus[0]?.model || 'Unknown';
  let osInfo = `${os.type()} ${os.release()} (${os.arch()})`;

  try {
    const wmicCpu = execSync('wmic cpu get name /value', { encoding: 'utf8' });
    const match = wmicCpu.match(/Name=(.+)/);
    if (match) cpuName = match[1].trim();
  } catch (e) {}

  try {
    const wmicOs = execSync('wmic os get Caption,Version /value', { encoding: 'utf8' });
    const capMatch = wmicOs.match(/Caption=(.+)/);
    const verMatch = wmicOs.match(/Version=(.+)/);
    if (capMatch) osInfo = `${capMatch[1].trim()} (v${verMatch ? verMatch[1].trim() : os.release()})`;
  } catch (e) {}

  let diskInfo = 'Unknown';
  try {
    const psDisk = execSync('powershell "Get-PSDrive -PSProvider FileSystem | Select-Object Name, Used, Free | ConvertTo-Json"', { encoding: 'utf8' });
    diskInfo = JSON.parse(psDisk);
  } catch (e) {}

  const specs = {
    os: osInfo,
    cpu: cpuName,
    cores: cpus.length,
    totalMemory: `${totalMemGB} GB`,
    freeMemory: `${freeMemGB} GB`,
    platform: process.platform,
    nodeVersion: process.version,
    disks: diskInfo
  };

  console.log(JSON.stringify(specs, null, 2));
}

getSpecs();

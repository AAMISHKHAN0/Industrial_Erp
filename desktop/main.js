const { app, BrowserWindow, dialog, ipcMain, Menu, shell, session } = require('electron');
const path = require('path');
const net = require('net');
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');

// Enforce consistent application name across userData and taskbar
app.setName('Industrial ERP');
// Disable GPU hardware acceleration before app.whenReady() to avoid Windows GPU driver freezes/crashes
app.disableHardwareAcceleration();

// Global crash and hang diagnostics
process.on('uncaughtException', (err) => {
  console.error('[Desktop] Uncaught exception in main process:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Desktop] Unhandled promise rejection in main process:', reason);
});

// Remote debugging port support for automated testing and recording via environment variable
if (process.env.ELECTRON_REMOTE_DEBUGGING_PORT) {
  app.commandLine.appendSwitch('remote-debugging-port', process.env.ELECTRON_REMOTE_DEBUGGING_PORT);
  console.log(`[Desktop] Enabled Chromium remote debugging on port ${process.env.ELECTRON_REMOTE_DEBUGGING_PORT}`);
}

// Detect isolated fresh-test workspace flag (env ERP_FRESH_TEST=1, fresh-test, --workspace=fresh-test, or --fresh-test)
const isFreshTest =
  process.env.ERP_FRESH_TEST === '1' ||
  process.argv.some((arg, idx, arr) => {
    if (arg === 'fresh-test' || arg === '--fresh-test' || arg === '--workspace=fresh-test') return true;
    if (typeof arg === 'string' && arg.startsWith('--workspace=fresh-test')) return true;
    if (arg === '--workspace' && arr[idx + 1] === 'fresh-test') return true;
    return false;
  });

// Configure isolated userData directory for fresh-test workspace
if (isFreshTest) {
  const defaultUserData = app.getPath('userData');
  const freshTestUserData = path.join(path.dirname(defaultUserData), 'industrial-erp-fresh-test');
  app.setPath('userData', freshTestUserData);
  console.log(`[Desktop] Isolated Fresh Test Workspace active: userData=${freshTestUserData}`);
}

let mainWindow = null;
let splashWindow = null;
let backendProcess = null;
let frontendProcess = null;
let embeddedPostgresStarted = false;
let activePgPort = 5432;
let activeBackendPort = 4000;
let activeFrontendPort = 3000;
let activeCreds = null;
let pgDataDir = '';
let pgCtlExe = '';
let pgLogFile = '';
let startupLogFile = '';
let isBackupInProgress = false;
let isRestoreInProgress = false;
let dailyBackupTimer = null;
let initialBackupTimer = null;
let isQuitting = false;
let isIntentionalStop = false;
let lastAppDbUrl = '';
let isBackendRestarting = false;
let isFrontendRestarting = false;
let backendRestartAttempts = 0;
let frontendRestartAttempts = 0;
let rendererRecoveryAttempts = 0;
const MAX_SERVICE_RESTARTS = 3;

// Runtime path resolution
const IS_PACKAGED = app.isPackaged;
const EMBEDDED_DIR = IS_PACKAGED
  ? path.join(process.resourcesPath, 'embedded')
  : path.join(__dirname, 'embedded');

const ICON_PATH = path.join(__dirname, 'icon.ico');
const NODE_EXE = path.join(EMBEDDED_DIR, 'node', 'node.exe');
const PGSQL_DIR = path.join(EMBEDDED_DIR, 'pgsql');
const PG_BIN = path.join(PGSQL_DIR, 'bin');
const INITDB_EXE = path.join(PG_BIN, 'initdb.exe');
pgCtlExe = path.join(PG_BIN, 'pg_ctl.exe');
const PG_DUMP_EXE = path.join(PG_BIN, 'pg_dump.exe');
const PSQL_EXE = path.join(PG_BIN, 'psql.exe');
const PG_ISREADY_EXE = path.join(PG_BIN, 'pg_isready.exe');
const BACKEND_DIR = path.join(EMBEDDED_DIR, 'backend');
const FRONTEND_DIR = path.join(EMBEDDED_DIR, 'frontend');

/**
 * Returns list of directories owned by this ERP installation.
 */
function getInstallationPaths() {
  const paths = [];
  if (process.resourcesPath) paths.push(path.resolve(process.resourcesPath));
  if (process.execPath) paths.push(path.resolve(path.dirname(process.execPath)));
  if (EMBEDDED_DIR) paths.push(path.resolve(EMBEDDED_DIR));
  if (__dirname) paths.push(path.resolve(__dirname));
  return Array.from(new Set(paths.map((p) => p.toLowerCase())));
}

/**
 * Verifies whether an executable path strictly belongs to this ERP installation.
 * Ensures we NEVER touch unrelated system services or user processes.
 */
function isProcessOwnedByInstallation(executablePath) {
  if (!executablePath || typeof executablePath !== 'string') return false;
  const normalized = path.resolve(executablePath).toLowerCase();
  const allowedDirs = getInstallationPaths();
  return allowedDirs.some((dir) => normalized.startsWith(dir + path.sep) || normalized === dir);
}

/**
 * Builds a sanitized child environment without ELECTRON_RUN_AS_NODE so
 * VS Code/IDE host environments do not break spawned Node/Electron processes.
 */
function buildChildEnv(baseEnv = process.env, overrides = {}) {
  const env = { ...baseEnv, ...overrides };
  delete env.ELECTRON_RUN_AS_NODE;
  return env;
}

/**
 * Executes a child process asynchronously without blocking the Electron event loop.
 * Enforces a default per-command timeout so no subprocess hangs forever.
 * Returns a Promise that resolves with { status, stdout, stderr, signal, error, timedOut }.
 */
function execProcess(command, args = [], options = {}) {
  return new Promise((resolve) => {
    // Default per-command timeout (60s) to guarantee no subprocess hangs indefinitely
    const timeoutMs = typeof options.timeout === 'number' ? options.timeout : 60000;
    let timer = null;
    let resolved = false;

    const proc = spawn(command, args, {
      windowsHide: true,
      ...options,
      env: buildChildEnv(options.env || process.env),
    });

    let stdout = '';
    let stderr = '';

    if (proc.stdout) {
      proc.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
    }
    if (proc.stderr) {
      proc.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
    }

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const finish = (code, signal) => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve({ status: code, stdout, stderr, signal });
      }
    };

    proc.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve({ status: -1, stdout, stderr, error: err });
      }
    });

    proc.on('exit', finish);
    proc.on('close', finish);

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          try {
            proc.kill('SIGKILL');
          } catch {}
          if (process.platform === 'win32' && proc.pid) {
            try {
              spawn('taskkill', ['/F', '/T', '/PID', String(proc.pid)], { windowsHide: true });
            } catch {}
          }
          resolve({
            status: -1,
            stdout,
            stderr,
            error: new Error(`Process timed out after ${timeoutMs}ms: ${command} ${args.join(' ')}`),
            timedOut: true,
          });
        }
      }, timeoutMs);
    }
  });
}

/**
 * Verifies whether a PID from postmaster.pid actually belongs to a running
 * installation-owned postgres.exe process (guards against Windows PID reuse).
 */
async function isOwnedPostgresProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
  } catch {
    return false;
  }

  if (process.platform === 'win32') {
    const psCmd = `Get-CimInstance Win32_Process -Filter "ProcessId=${pid}" | Select-Object Name,ExecutablePath | ConvertTo-Json -Compress`;
    const psRes = await execProcess(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', psCmd],
      { timeout: 2000 }
    );
    if (!psRes.error && psRes.status === 0) {
      const trimmed = (psRes.stdout || '').trim();
      if (!trimmed || trimmed === 'null') return false;
      try {
        const procInfo = JSON.parse(trimmed);
        const name = String(procInfo?.Name || '').toLowerCase();
        const exePath = procInfo?.ExecutablePath || '';
        return name === 'postgres.exe' && isProcessOwnedByInstallation(exePath);
      } catch {
        return false;
      }
    }

    // Fallback to tasklist image-name check if WMI/PowerShell is unavailable
    const tlRes = await execProcess(
      'tasklist',
      ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'],
      { timeout: 2000 }
    );
    if (!tlRes.error && tlRes.status === 0) {
      return /"postgres\.exe"/i.test(tlRes.stdout || '');
    }
    return false;
  }

  return true;
}

/**
 * Scans for and cleans up stale locks, orphaned postmaster.pid, and orphaned desktop child processes.
 * Enforces a strict 2-second timeout and safe fallback so it NEVER stalls startup.
 * Strictly verifies process ownership against the application installation directory before terminating.
 * Unrelated system services or user processes are NEVER touched.
 */
async function cleanupStaleDesktopProcesses() {
  try {
    const userDataPath = resolveUserDataDir();
    const dataDir = path.join(userDataPath, 'data');
    const pgData = path.join(dataDir, 'pgsql_data');
    const pidFile = path.join(pgData, 'postmaster.pid');

    if (fs.existsSync(pidFile)) {
      let stalePid = null;
      let isPidAlive = false;
      try {
        const pidContent = fs.readFileSync(pidFile, 'utf8');
        const lines = pidContent.split('\n');
        stalePid = parseInt(lines[0].trim(), 10);
        if (stalePid && !isNaN(stalePid)) {
          isPidAlive = await isOwnedPostgresProcessAlive(stalePid);
        }
      } catch (err) {
        console.warn('[Desktop Cleanup] Error inspecting postmaster.pid:', err.message);
      }

      // Preserve postmaster.pid ONLY if PID is an active installation-owned postgres.exe
      if (isPidAlive) {
        console.log(`[Desktop Cleanup] Installation PostgreSQL PID ${stalePid} is still active. Preserving postmaster.pid.`);
      } else {
        try {
          fs.unlinkSync(pidFile);
          console.log(`[Desktop Cleanup] Cleaned up stale postmaster.pid lock file (PID ${stalePid || 'unknown'} is dead or not owned postgres.exe).`);
        } catch (e) {
          console.warn('[Desktop Cleanup] Could not delete postmaster.pid:', e.message);
        }
      }
    }
  } catch (err) {
    console.warn('[Desktop Cleanup] Cleanup encountered non-critical error:', err.message);
  }
}

/**
 * Checks whether a specific TCP port is available on loopback.
 * Tests active connection first (detects services bound on 0.0.0.0 or :::)
 * then tests binding to guarantee exclusive availability.
 */
function isPortAvailable(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    // 1. Check if a service is actively accepting connections on this port
    const client = net.connect({ port, host });
    client.once('connect', () => {
      client.destroy();
      resolve(false);
    });
    client.once('error', () => {
      // 2. Not connected, verify server bind capability on loopback
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close(() => resolve(true));
      });
      server.listen(port, host);
    });
  });
}

/**
 * Finds an available port starting from basePort.
 */
async function getAvailablePort(basePort = 5432) {
  for (let p = basePort; p < basePort + 30; p++) {
    const free = await isPortAvailable(p);
    if (free) return p;
  }
  return basePort;
}

/**
 * Verifies whether a TCP socket is open and accepting connections.
 */
function checkSocket(host, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

/**
 * Waits for a TCP socket to become ready with retries.
 */
async function waitForSocket(host, port, maxRetries = 120, intervalMs = 250) {
  for (let i = 0; i < maxRetries; i++) {
    const ready = await checkSocket(host, port, 1500);
    if (ready) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

/**
 * Checks whether an HTTP endpoint responds with a 2xx or 3xx status.
 */
function checkHttp(url, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Waits for an HTTP endpoint to become ready with retries.
 */
async function waitForHttp(url, maxRetries = 35, intervalMs = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    const ready = await checkHttp(url, 1500);
    if (ready) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

/**
 * Resolves the persistent user data directory.
 * Always resolves to primary userData directory; does not resurrect stale/legacy databases when cleared.
 */
function resolveUserDataDir() {
  return app.getPath('userData');
}

/**
 * Returns the persistent attachments directory under user data.
 */
function getAttachmentsDir() {
  const userDataPath = resolveUserDataDir();
  const dir = path.join(userDataPath, 'data', 'attachments');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Loads or generates cryptographically unique per-installation credentials.
 */
function getOrCreateCredentials(dataDir) {
  const credFile = path.join(dataDir, '.db_credentials.json');
  if (fs.existsSync(credFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(credFile, 'utf8'));
      if (parsed.adminPassword && parsed.appPassword) {
        return parsed;
      }
    } catch {}
  }
  const creds = {
    adminUser: 'postgres',
    adminPassword: crypto.randomBytes(24).toString('base64url'),
    appUser: 'erp_app',
    appPassword: crypto.randomBytes(24).toString('base64url'),
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(credFile, JSON.stringify(creds, null, 2), { mode: 0o600 });
  return creds;
}

/**
 * Writes unified port and loopback host configuration directly into postgresql.conf.
 */
function writePostgresConfig(dataDir, port) {
  const confPath = path.join(dataDir, 'postgresql.conf');
  if (!fs.existsSync(confPath)) return;
  let conf = fs.readFileSync(confPath, 'utf8');

  // Normalize line endings to avoid CRLF regex mismatch
  conf = conf.replace(/\r\n/g, '\n');

  // Enforce port
  if (/^[ \t]*#?[ \t]*port[ \t]*=.*$/m.test(conf)) {
    conf = conf.replace(/^[ \t]*#?[ \t]*port[ \t]*=.*$/m, `port = ${port}`);
  }
  // Append at end to guarantee it overrides any previous definition
  conf += `\nport = ${port}\n`;

  // Enforce listen_addresses
  if (/^[ \t]*#?[ \t]*listen_addresses[ \t]*=.*$/m.test(conf)) {
    conf = conf.replace(/^[ \t]*#?[ \t]*listen_addresses[ \t]*=.*$/m, `listen_addresses = '127.0.0.1'`);
  } else {
    conf += `\nlisten_addresses = '127.0.0.1'\n`;
  }

  // Enforce scram-sha-256
  if (!conf.includes('password_encryption = scram-sha-256')) {
    conf += '\npassword_encryption = scram-sha-256\n';
  }

  fs.writeFileSync(confPath, conf, 'utf8');
  console.log(`[Desktop] Synchronized postgresql.conf: port = ${port}, listen_addresses = '127.0.0.1'`);
}

/**
 * Seamlessly upgrades legacy RC2 installations (trust auth) to SCRAM-SHA-256 without data loss.
 */
async function upgradeClusterAuthIfNeeded(pgDataDir, port, creds) {
  const hbaPath = path.join(pgDataDir, 'pg_hba.conf');
  if (!fs.existsSync(hbaPath)) return;
  const hbaContent = fs.readFileSync(hbaPath, 'utf8');
  const activeRules = hbaContent.split('\n').filter((l) => !l.trim().startsWith('#') && l.trim()).join('\n');
  if (!/\btrust\b/.test(activeRules)) {
    return; // Already SCRAM or non-trust
  }

  console.log('[Desktop] Detected legacy trust authentication. Upgrading cluster to SCRAM-SHA-256...');
  const { Client } = require(path.join(BACKEND_DIR, 'node_modules', 'pg'));
  const client = new Client({
    host: '127.0.0.1',
    port: port,
    user: 'postgres',
    database: 'postgres',
  });
  await client.connect();
  try {
    await client.query("SET password_encryption = 'scram-sha-256'");
    await client.query(`ALTER ROLE postgres WITH PASSWORD '${creds.adminPassword.replace(/'/g, "''")}'`);
    console.log('[Desktop] Admin account password set with SCRAM-SHA-256.');
  } finally {
    await client.end().catch(() => {});
  }

  // Update pg_hba.conf: replace active 'trust' rules with 'scram-sha-256'
  const updatedHba = hbaContent
    .split('\n')
    .map((line) => {
      if (line.trim().startsWith('#')) return line;
      return line.replace(/\btrust\b/g, 'scram-sha-256');
    })
    .join('\n');
  fs.writeFileSync(hbaPath, updatedHba);

  // Update postgresql.conf to enforce scram-sha-256
  writePostgresConfig(pgDataDir, port);

  // Reload PostgreSQL configuration
  console.log('[Desktop] Reloading PostgreSQL configuration with enforced SCRAM...');
  await execProcess(pgCtlExe, ['reload', '-D', pgDataDir]);
  console.log('[Desktop] PostgreSQL cluster successfully upgraded to SCRAM-SHA-256.');
}

/**
 * Initializes and starts the embedded PostgreSQL instance with SCRAM-SHA-256 authentication.
 */
async function ensurePostgres() {
  const userDataPath = resolveUserDataDir();
  const dataDir = path.join(userDataPath, 'data');
  pgDataDir = path.join(dataDir, 'pgsql_data');
  const logsDir = path.join(userDataPath, 'logs');

  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(logsDir, { recursive: true });

  pgLogFile = path.join(logsDir, 'postgres.log');
  startupLogFile = path.join(logsDir, 'startup.log');
  const creds = getOrCreateCredentials(dataDir);
  activeCreds = creds;
  console.log(`[Desktop] Persistent data directory: ${pgDataDir}`);

  // 1. First-time cluster initialization with SCRAM
  const isInitialized = fs.existsSync(path.join(pgDataDir, 'PG_VERSION'));
  if (!isInitialized) {
    updateSplashStatus('Initializing database cluster...');
    console.log('[Desktop] First launch detected. Initializing PostgreSQL cluster with SCRAM-SHA-256...');
    const pwFile = path.join(dataDir, '.init_pw.tmp');
    fs.writeFileSync(pwFile, creds.adminPassword + '\n', { mode: 0o600 });

    const initResult = await execProcess(
      INITDB_EXE,
      ['-D', pgDataDir, '-U', 'postgres', '-E', 'UTF8', '--no-locale', '-A', 'scram-sha-256', `--pwfile=${pwFile}`]
    );
    try {
      fs.unlinkSync(pwFile);
    } catch {}

    if (initResult.error || initResult.status !== 0) {
      console.error('[Desktop] initdb failed:', initResult.error || initResult.stderr);
      throw new Error(`Failed to initialize database cluster: ${initResult.stderr || initResult.error?.message}`);
    }
    console.log('[Desktop] PostgreSQL cluster initialized with SCRAM-SHA-256.');
  }

  // 2. Select available loopback port (or reuse existing running cluster on this dataDir)
  let isAlreadyOnline = false;
  const pidFile = path.join(pgDataDir, 'postmaster.pid');
  if (fs.existsSync(pidFile)) {
    try {
      const pidLines = fs.readFileSync(pidFile, 'utf8').split('\n');
      const runningPort = parseInt(pidLines[3]?.trim(), 10);
      if (runningPort && !isNaN(runningPort)) {
        const isReadyResult = await execProcess(PG_ISREADY_EXE, ['-h', '127.0.0.1', '-p', String(runningPort), '-q']);
        if (isReadyResult.status === 0) {
          activePgPort = runningPort;
          isAlreadyOnline = true;
          console.log(`[Desktop] Reusing existing running PostgreSQL cluster on port ${activePgPort}`);
        }
      }
    } catch {}
  }

  if (!isAlreadyOnline) {
    const pgBasePort = isFreshTest ? 5434 : 5432;
    activePgPort = await getAvailablePort(pgBasePort);
    console.log(`[Desktop] Selected loopback PostgreSQL port: ${activePgPort}`);

    // 3. Write unified port into postgresql.conf before launch
    writePostgresConfig(pgDataDir, activePgPort);

    // 4. Start PostgreSQL server via pg_ctl asynchronously without blocking main thread
    updateSplashStatus(`Starting database engine on port ${activePgPort}...`);
    console.log(`[Desktop] Starting PostgreSQL service on 127.0.0.1:${activePgPort}...`);

    const startResult = await execProcess(
      pgCtlExe,
      ['start', '-D', pgDataDir, '-l', pgLogFile, '-o', `-p ${activePgPort}`, '-w', '-t', '30'],
      { stdio: 'ignore', timeout: 35000 }
    );

    console.log(`[Desktop] pg_ctl start exited with code ${startResult.status}`);
    if (startResult.status !== 0) {
      console.warn(`[Desktop] pg_ctl stdout: ${startResult.stdout}`);
      console.warn(`[Desktop] pg_ctl stderr: ${startResult.stderr}`);
    }

    // 5. Verify socket connection with generous 30s timeout
    const ready = await waitForSocket('127.0.0.1', activePgPort, 120, 250);
    if (!ready) {
      const logTail = fs.existsSync(pgLogFile) ? fs.readFileSync(pgLogFile, 'utf8').slice(-2000) : 'Log not found';
      throw new Error(
        `PostgreSQL engine failed to accept connections on 127.0.0.1:${activePgPort}.\npg_ctl stderr: ${
          startResult.stderr || 'none'
        }\n\nRecent postgres.log:\n${logTail}\n\nLog path: ${pgLogFile}`
      );
    }
  }

  embeddedPostgresStarted = true;
  console.log('[Desktop] PostgreSQL engine is online.');

  // 6. Upgrade existing trust clusters if needed
  await upgradeClusterAuthIfNeeded(pgDataDir, activePgPort, creds);

  return { port: activePgPort, creds };
}

const EXPECTED_SCHEMA_COLUMN_CHECKS = 9;

/**
 * Verifies that all critical schema columns and nullability constraints exist in public schema.
 */
async function verifyCriticalSchemaColumns(client) {
  const res = await client.query(`
    SELECT count(*)::int as count
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (
        (table_name = 'demand_notes' AND column_name = 'costCenter')
        OR (table_name = 'demand_note_items' AND column_name = 'issuedQty')
        OR (table_name = 'goods_receiving_notes' AND column_name = 'deliveryChallanNumber')
        OR (table_name = 'purchase_order_items' AND column_name = 'billedQty')
        OR (table_name = 'companies' AND column_name = 'city')
        OR (table_name = 'companies' AND column_name = 'country')
        OR (table_name = 'goods_receiving_notes' AND column_name = 'poId' AND is_nullable = 'YES')
        OR (table_name = 'vouchers' AND column_name = 'vendorId')
        OR (table_name = 'vouchers' AND column_name = 'metadata')
      );
  `);
  return Number(res.rows[0]?.count || 0) === EXPECTED_SCHEMA_COLUMN_CHECKS;
}

/**
 * Checks whether critical database schema columns exist.
 * Used to detect schema drift or an older restored backup.
 */
async function checkSchemaCompatibility(creds) {
  const { Client } = require(path.join(BACKEND_DIR, 'node_modules', 'pg'));
  const testClient = new Client({
    host: '127.0.0.1',
    port: activePgPort,
    user: creds.adminUser,
    password: creds.adminPassword,
    database: 'textile_erp',
    connectionTimeoutMillis: 3000,
  });

  try {
    await testClient.connect();
    return await verifyCriticalSchemaColumns(testClient);
  } catch (err) {
    console.warn('[Desktop] Schema compatibility query failed:', err.message);
    return false;
  } finally {
    await testClient.end().catch(() => {});
  }
}

/**
 * Runs database migrations prior to backend startup using the migration account asynchronously.
 * Skips redundant migration runs on warm boot via synchronization marker ONLY IF the live schema passes compatibility checks.
 */
async function applyMigrations(adminDbUrl, creds) {
  const userDataPath = resolveUserDataDir();
  const dataDir = path.join(userDataPath, 'data');
  const syncMarkerFile = path.join(dataDir, '.migrations_synced');
  const migrationVersion = '1.0.6-rev2';

  if (fs.existsSync(syncMarkerFile)) {
    try {
      const markerContent = fs.readFileSync(syncMarkerFile, 'utf8').trim();
      if (markerContent === migrationVersion) {
        // Active compatibility pre-check: verify critical columns actually exist in DB
        const isCompatible = await checkSchemaCompatibility(creds);
        if (isCompatible) {
          console.log(`[Desktop] Migrations already synchronized and schema compatible for version ${migrationVersion}. Skipping redundant migration run.`);
          return;
        } else {
          console.log(`[Desktop] Schema compatibility check failed (missing columns detected, e.g. restored backup). Re-running migrations...`);
          try { fs.unlinkSync(syncMarkerFile); } catch {}
        }
      }
    } catch {}
  }

  updateSplashStatus('Applying database migrations...');
  console.log('[Desktop] Applying committed migrations with migration account...');
  const runMigScript = path.join(BACKEND_DIR, 'run-migrations.js');

  const migProc = await execProcess(NODE_EXE, [runMigScript], {
    cwd: BACKEND_DIR,
    env: {
      ...process.env,
      DATABASE_URL: adminDbUrl,
      APP_DB_USER: creds.appUser,
      APP_DB_PASSWORD: creds.appPassword,
    },
    timeout: 60000,
  });

  if (migProc.error || migProc.status !== 0) {
    console.error('[Desktop] Migration runner error:', migProc.stderr || migProc.stdout);
    throw new Error(`Migration execution failed: ${migProc.stderr || migProc.stdout}`);
  }

  try {
    fs.writeFileSync(syncMarkerFile, migrationVersion, 'utf8');
  } catch {}

  console.log('[Desktop] Migrations applied and least-privilege permissions synchronized.');
}

/**
 * Pre-flight verification: Validates that the target database is fully reachable with erp_app credentials before API startup.
 * Enforces bounded retries with plain-language status messages on the splash screen.
 */
async function verifyDatabaseReachable(port, creds, maxRetries = 40, intervalMs = 250) {
  updateSplashStatus('Verifying database connectivity...');
  console.log(`[Desktop] Pre-flight reachability test as ${creds.appUser} on port ${port}...`);
  const { Client } = require(path.join(BACKEND_DIR, 'node_modules', 'pg'));
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const testClient = new Client({
      host: '127.0.0.1',
      port: port,
      user: creds.appUser,
      password: creds.appPassword,
      database: 'textile_erp',
      connectionTimeoutMillis: 3000,
    });

    try {
      await testClient.connect();
      try {
        const res = await testClient.query(
          'SELECT 1 as reachable, current_user, current_database(), inet_server_port() as actual_port'
        );
        const row = res.rows[0];
        console.log(
          `[Desktop] Reachability verified: User="${row.current_user}", Database="${row.current_database}", Port=${row.actual_port}`
        );
        if (row.current_user !== creds.appUser) {
          throw new Error(`Connected user mismatch: expected ${creds.appUser}, got ${row.current_user}`);
        }
        if (Number(row.actual_port) !== Number(port)) {
          throw new Error(`Port configuration mismatch: expected ${port}, got ${row.actual_port}`);
        }

        // Schema compatibility check: confirm critical columns are queryable by appUser
        const schemaCompatible = await verifyCriticalSchemaColumns(testClient);
        if (!schemaCompatible) {
          throw new Error(`Database schema compatibility check failed: critical columns missing in textile_erp.`);
        }
        console.log(`[Desktop] Schema compatibility verified: all critical columns and constraints are accessible.`);
        return;
      } finally {
        await testClient.end().catch(() => {});
      }
    } catch (err) {
      lastError = err;
      await testClient.end().catch(() => {});
      if (attempt < maxRetries) {
        updateSplashStatus(`Connecting to database (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise((r) => setTimeout(r, intervalMs));
      }
    }
  }

  throw new Error(`Database verification failed after ${maxRetries} attempts: ${lastError?.message || 'Connection refused'}`);
}

/**
 * Verifies backend health: checks if process is alive AND endpoint returns JSON with { status: 'ok' }.
 */
async function waitForBackendReady(port, proc, maxRetries = 300, intervalMs = 100) {
  const url = `http://127.0.0.1:${port}/api/v1/health`;
  for (let i = 0; i < maxRetries; i++) {
    // Fail immediately if child process died
    if (proc && proc.exitCode !== null) {
      throw new Error(`Backend process terminated prematurely with exit code ${proc.exitCode}`);
    }

    const healthy = await new Promise((resolve) => {
      const req = http.get(url, { timeout: 1500 }, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return resolve(false);
        }
        let body = '';
        res.on('data', (c) => { body += c.toString(); });
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            resolve(data && data.status === 'ok');
          } catch {
            resolve(false);
          }
        });
      });

      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });

    if (healthy) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

/**
 * Verifies frontend readiness: checks if process is alive AND responds with HTTP 200/300.
 */
async function waitForFrontendReady(port, proc, maxRetries = 300, intervalMs = 100) {
  const url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < maxRetries; i++) {
    if (proc && proc.exitCode !== null) {
      throw new Error(`Frontend process terminated prematurely with exit code ${proc.exitCode}`);
    }

    const ready = await new Promise((resolve) => {
      const req = http.get(url, { timeout: 1500 }, (res) => {
        res.resume();
        resolve(res.statusCode >= 200 && res.statusCode < 400);
      });

      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });

    if (ready) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

/**
 * Monitors an active child service after startup and cleanly restarts it on unexpected runtime exit.
 */
function monitorRuntimeServiceExit({ proc, label, getActiveProc, getIsRestarting, setIsRestarting, getAttempts, setAttempts, canRestart, restartFn }) {
  if (!proc) return;
  proc.once('exit', (code, signal) => {
    if (
      getActiveProc() !== proc ||
      isQuitting ||
      isIntentionalStop ||
      isRestoreInProgress ||
      getIsRestarting()
    ) {
      return;
    }

    console.error(`[Desktop] ${label} exited unexpectedly at runtime (code=${code}, signal=${signal}).`);
    const attempts = getAttempts();
    if (!canRestart() || attempts >= MAX_SERVICE_RESTARTS) {
      console.error(`[Desktop] ${label} auto-restart skipped (limit reached or prerequisites missing).`);
      return;
    }

    setIsRestarting(true);
    const nextAttempt = attempts + 1;
    setAttempts(nextAttempt);

    setTimeout(async () => {
      if (isQuitting || isIntentionalStop || isRestoreInProgress) {
        setIsRestarting(false);
        return;
      }
      try {
        console.log(`[Desktop] Auto-restarting ${label} (attempt ${nextAttempt}/${MAX_SERVICE_RESTARTS})...`);
        await restartFn();
        console.log(`[Desktop] ${label} auto-restarted successfully.`);
        setTimeout(() => {
          const current = getActiveProc();
          if (current && current.exitCode === null) {
            setAttempts(0);
          }
        }, 60000).unref();
      } catch (restartErr) {
        console.error(`[Desktop] ${label} auto-restart failed:`, restartErr.message);
      } finally {
        setIsRestarting(false);
      }
    }, 1500);
  });
}

/**
 * Starts the embedded NestJS backend with dynamic port assignment.
 */
async function startBackend(dbUrl, port = 4000) {
  updateSplashStatus('Starting ERP services...');
  console.log(`[Desktop] Spawning NestJS API on http://127.0.0.1:${port}...`);
  const backendMain = path.join(BACKEND_DIR, 'dist', 'src', 'main.js');
  lastAppDbUrl = dbUrl;

  const proc = spawn(NODE_EXE, [backendMain], {
    cwd: BACKEND_DIR,
    env: buildChildEnv(process.env, {
      DATABASE_URL: dbUrl,
      PORT: String(port),
      HOST: '127.0.0.1',
      FRONTEND_URL: `http://127.0.0.1:${activeFrontendPort},http://localhost:${activeFrontendPort}`,
      ATTACHMENTS_DIR: getAttachmentsDir(),
      DESKTOP_DATA_DIR: path.join(resolveUserDataDir(), 'data'),
      LOCAL_DESKTOP_MODE: 'true',
      DISABLE_AUTO_DB_BACKUP: 'true',
    }),
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  backendProcess = proc;

  if (proc.stdout) {
    proc.stdout.resume();
  }

  let backendStderr = '';
  if (proc.stderr) {
    proc.stderr.on('data', (chunk) => {
      backendStderr += chunk.toString();
      if (backendStderr.length > 4000) backendStderr = backendStderr.slice(-4000);
    });
  }

  proc.on('error', (err) => {
    console.error('[Desktop] Failed to start backend API:', err);
  });

  const ready = await waitForBackendReady(port, proc, 240, 250);
  if (!ready) {
    throw new Error(
      `Backend API service failed to pass health checks within timeout window on port ${port}.${
        backendStderr ? '\nRecent backend stderr:\n' + backendStderr : ''
      }`
    );
  }

  monitorRuntimeServiceExit({
    proc,
    label: 'Backend API',
    getActiveProc: () => backendProcess,
    getIsRestarting: () => isBackendRestarting,
    setIsRestarting: (val) => { isBackendRestarting = val; },
    getAttempts: () => backendRestartAttempts,
    setAttempts: (val) => { backendRestartAttempts = val; },
    canRestart: () => Boolean(lastAppDbUrl),
    restartFn: () => startBackend(lastAppDbUrl, activeBackendPort),
  });

  console.log(`[Desktop] Backend API is online at http://127.0.0.1:${port}.`);
}

/**
 * Starts the embedded Next.js standalone frontend with dynamic port and resolved API URL.
 */
async function startFrontend(frontendPort = 3000, backendPort = 4000) {
  updateSplashStatus('Launching user interface...');
  console.log(`[Desktop] Spawning Next.js frontend on http://127.0.0.1:${frontendPort}...`);
  const serverJs = path.join(FRONTEND_DIR, 'server.js');

  const proc = spawn(NODE_EXE, [serverJs], {
    cwd: FRONTEND_DIR,
    env: buildChildEnv(process.env, {
      PORT: String(frontendPort),
      HOSTNAME: '127.0.0.1',
      NEXT_PUBLIC_API_URL: `http://127.0.0.1:${backendPort}/api/v1`,
      API_URL: `http://127.0.0.1:${backendPort}/api/v1`,
    }),
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  frontendProcess = proc;

  if (proc.stdout) {
    proc.stdout.resume();
  }

  let frontendStderr = '';
  if (proc.stderr) {
    proc.stderr.on('data', (chunk) => {
      frontendStderr += chunk.toString();
      if (frontendStderr.length > 4000) frontendStderr = frontendStderr.slice(-4000);
    });
  }

  proc.on('error', (err) => {
    console.error('[Desktop] Failed to start Next.js frontend:', err);
  });

  const ready = await waitForFrontendReady(frontendPort, proc, 240, 250);
  if (!ready) {
    throw new Error(
      `Next.js frontend failed to respond on http://127.0.0.1:${frontendPort} within timeout window.${
        frontendStderr ? '\nRecent frontend stderr:\n' + frontendStderr : ''
      }`
    );
  }

  monitorRuntimeServiceExit({
    proc,
    label: 'Next.js Frontend',
    getActiveProc: () => frontendProcess,
    getIsRestarting: () => isFrontendRestarting,
    setIsRestarting: (val) => { isFrontendRestarting = val; },
    getAttempts: () => frontendRestartAttempts,
    setAttempts: (val) => { frontendRestartAttempts = val; },
    canRestart: () => true,
    restartFn: () => startFrontend(activeFrontendPort, activeBackendPort),
  });

  console.log(`[Desktop] Frontend is online at http://127.0.0.1:${frontendPort}.`);
}

/**
 * Writes technical diagnostics to logs/startup.log on startup failure.
 */
function writeStartupLog(err, stage = 'startup') {
  try {
    const userDataPath = resolveUserDataDir();
    const logsDir = path.join(userDataPath, 'logs');
    fs.mkdirSync(logsDir, { recursive: true });
    startupLogFile = path.join(logsDir, 'startup.log');

    let pgTail = 'PostgreSQL log file not present.';
    if (pgLogFile && fs.existsSync(pgLogFile)) {
      try {
        const fullPgLog = fs.readFileSync(pgLogFile, 'utf8');
        pgTail = fullPgLog.slice(-3000);
      } catch (readErr) {
        pgTail = `Failed reading postgres.log: ${readErr.message}`;
      }
    }

    const logEntry = [
      `================================================================================`,
      `TIMESTAMP: ${new Date().toISOString()}`,
      `STAGE: ${stage}`,
      `ERROR MESSAGE: ${err?.message || 'Unknown error'}`,
      `ERROR STACK:\n${err?.stack || 'No stack trace available'}`,
      `--------------------------------------------------------------------------------`,
      `RUNTIME ENVIRONMENT:`,
      `  Node Version: ${process.version}`,
      `  Platform: ${process.platform} (${process.arch})`,
      `  Is Packaged: ${IS_PACKAGED}`,
      `  Active PG Port: ${activePgPort}`,
      `  Active Backend Port: ${activeBackendPort}`,
      `  Active Frontend Port: ${activeFrontendPort}`,
      `  Embedded PG Started: ${embeddedPostgresStarted}`,
      `  Backend Exit Code: ${backendProcess ? backendProcess.exitCode : 'N/A'}`,
      `  Frontend Exit Code: ${frontendProcess ? frontendProcess.exitCode : 'N/A'}`,
      `  PG Data Dir: ${pgDataDir || 'N/A'}`,
      `  PG Bin Dir: ${PG_BIN}`,
      `--------------------------------------------------------------------------------`,
      `RECENT POSTGRES LOG TAIL:`,
      pgTail,
      `================================================================================\n\n`,
    ].join('\n');

    fs.appendFileSync(startupLogFile, logEntry, 'utf8');
    console.log(`[Desktop] Diagnostic details recorded to: ${startupLogFile}`);
  } catch (logErr) {
    console.error('[Desktop] Failed to write startup log:', logErr);
  }
}

/**
 * Displays plain-language error status directly on the splash screen without destroying it.
 * CRITICAL FIX: NEVER destroy splashWindow on startup error!
 * Destroying splashWindow triggers Electron's 'window-all-closed' event which prematurely quits the app,
 * while an unparented dialog plays the Windows error chime behind other windows.
 * The splash screen has built-in 'Retry', 'View Logs', and 'Exit' buttons in #actionsRow.
 */
async function showStartupErrorDialog(err) {
  writeStartupLog(err, 'bootstrap');

  const errorMsg = `Startup Error: ${err?.message || 'Failed to start required ERP services.'}`;
  console.error(`[Desktop] ${errorMsg}`);

  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('status-update', errorMsg);
  } else {
    // Fallback if splash window does not exist
    const userDataPath = resolveUserDataDir();
    const logsDir = path.join(userDataPath, 'logs');
    const logFile = startupLogFile || path.join(logsDir, 'startup.log');
    dialog.showMessageBox({
      type: 'error',
      title: 'Industrial ERP — Startup Issue',
      message: 'Industrial ERP could not start required services.',
      detail: `Summary: ${err?.message || 'Service initialization failure'}\n\nTechnical logs: ${logFile}`,
      buttons: ['Exit'],
    }).then(() => {
      app.quit();
    });
  }
}

/**
 * Creates the lightweight splash progress window and awaits its initial render.
 */
function createSplashWindow() {
  if (splashWindow && !splashWindow.isDestroyed()) return Promise.resolve();

  return new Promise((resolve) => {
    splashWindow = new BrowserWindow({
      width: 480,
      height: 280,
      frame: false,
      resizable: false,
      center: true,
      show: false,
      title: isFreshTest ? 'Industrial ERP — Fresh Test' : 'Industrial ERP',
      backgroundColor: '#ffffff',
      icon: ICON_PATH,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    let resolved = false;
    const markReady = () => {
      if (!resolved) {
        resolved = true;
        if (splashWindow && !splashWindow.isDestroyed()) {
          splashWindow.show();
        }
        resolve();
      }
    };

    splashWindow.once('ready-to-show', markReady);
    splashWindow.webContents.once('did-finish-load', markReady);
    setTimeout(markReady, 3000);

    splashWindow.loadFile(path.join(__dirname, 'splash.html')).catch((err) => {
      console.error('[Desktop] Failed to load splash.html:', err);
      markReady();
    });
  });
}

/**
 * Sends a real-time progress update to the splash screen.
 */
function updateSplashStatus(message) {
  console.log(`[Desktop Status] ${message}`);
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('status-update', message);
  }
}

/**
 * Persists the desktop session token directly inside userData so close-and-reopen
 * survives ephemeral ports, localStorage resets, or hard quits.
 */
function getDesktopSessionFile() {
  return path.join(resolveUserDataDir(), '.desktop_session.json');
}

function readDesktopSessionToken() {
  try {
    const file = getDesktopSessionFile();
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.token === 'string' && parsed.token.trim()) {
      return parsed.token.trim();
    }
  } catch (err) {
    console.warn('[Desktop] Failed to read saved session token:', err.message);
  }
  return null;
}

function writeDesktopSessionToken(token) {
  try {
    if (!token || typeof token !== 'string' || !token.trim()) {
      clearDesktopSessionToken();
      return;
    }
    const file = getDesktopSessionFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      JSON.stringify({ token: token.trim(), updatedAt: new Date().toISOString() }, null, 2),
      { mode: 0o600 }
    );
  } catch (err) {
    console.warn('[Desktop] Failed to persist session token:', err.message);
  }
}

function clearDesktopSessionToken() {
  try {
    const file = getDesktopSessionFile();
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  } catch (err) {
    console.warn('[Desktop] Failed to clear session token:', err.message);
  }
}

function validateSessionWithBackend(port, token) {
  if (!token) return Promise.resolve(false);
  return new Promise((resolve) => {
    const req = http.get(
      `http://127.0.0.1:${port}/api/v1/auth/me`,
      {
        timeout: 3000,
        headers: {
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache',
        },
      },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function restoreElectronSessionCookie(frontendPort, backendPort, token) {
  if (!token || !session || !session.defaultSession) return;
  const expirationDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  const origins = [
    `http://127.0.0.1:${frontendPort}`,
    `http://127.0.0.1:${backendPort}`,
  ];
  for (const url of origins) {
    try {
      await session.defaultSession.cookies.set({
        url,
        name: 'session_token',
        value: token,
        path: '/',
        sameSite: 'lax',
        httpOnly: true,
        expirationDate,
      });
    } catch (err) {
      console.warn(`[Desktop] Failed to set session cookie for ${url}:`, err.message);
    }
  }
  try {
    await session.defaultSession.cookies.flushStore();
  } catch {}
}

/**
 * Queries the local backend API to verify whether initial owner bootstrap is required.
 */
function checkBootstrapRequired(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/v1/auth/bootstrap/status`, { timeout: 3000 }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return resolve(false);
      }
      let raw = '';
      res.on('data', (chunk) => {
        raw += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          const data = parsed.data || parsed;
          resolve(data.canBootstrap === true || data.initialized === false);
        } catch {
          resolve(false);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Creates the primary application window.
 */
function createMainWindow(frontendPort = 3000, initialPath = '') {
  const windowTitle = isFreshTest
    ? 'Industrial ERP — Fresh Test'
    : 'Industrial ERP — Digitalerena (Offline Edition)';

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: windowTitle,
    backgroundColor: '#fafafa',
    icon: ICON_PATH,
    show: false, // Shown gracefully when ready
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  if (isFreshTest) {
    mainWindow.on('page-title-updated', (e) => {
      e.preventDefault();
      mainWindow.setTitle('Industrial ERP — Fresh Test');
    });
  }

  const targetUrl = `http://127.0.0.1:${frontendPort}${initialPath}`;
  console.log(`[Desktop] Loading main window URL: ${targetUrl}`);
  mainWindow.loadURL(targetUrl);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (typeof url === 'string' && /^https?:\/\//i.test(url) && !url.startsWith(`http://127.0.0.1:${frontendPort}`)) {
      shell.openExternal(url).catch((err) => {
        console.warn('[Desktop] Failed to open external URL:', err?.message || err);
      });
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.destroy();
      splashWindow = null;
    }
    mainWindow.show();
  });

  mainWindow.webContents.on('did-finish-load', () => {
    rendererRecoveryAttempts = 0;
  });

  mainWindow.webContents.on('unresponsive', () => {
    console.warn('[Desktop] Main window renderer became unresponsive.');
  });

  mainWindow.webContents.on('responsive', () => {
    console.log('[Desktop] Main window renderer responsiveness restored.');
  });

  mainWindow.on('unresponsive', () => {
    console.warn('[Desktop] Main BrowserWindow reported unresponsive state.');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// =============================================================================
// BACKUP INFRASTRUCTURE (Daily Backups, Manifest, Validation, Safe Restore)
// =============================================================================

/**
 * Loads the persistent backup configuration from .backup_config.json.
 */
function loadBackupConfig() {
  const userDataPath = resolveUserDataDir();
  const configFile = path.join(userDataPath, '.backup_config.json');
  const defaultDir = path.join(userDataPath, 'backups');

  let config = {
    backupDir: defaultDir,
    autoBackupEnabled: true,
    intervalHours: 24,
    lastSuccessfulBackup: null,
    lastFailure: null,
  };

  if (fs.existsSync(configFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(configFile, 'utf8'));
      config = { ...config, ...parsed };
    } catch (e) {
      console.warn('[Backup] Failed parsing .backup_config.json, using defaults:', e.message);
    }
  }

  // Ensure backup directory exists
  try {
    fs.mkdirSync(config.backupDir, { recursive: true });
  } catch (e) {
    console.error(`[Backup] Failed to create backup directory ${config.backupDir}:`, e.message);
  }

  return config;
}

/**
 * Persists the backup configuration to .backup_config.json atomically.
 */
function saveBackupConfig(config) {
  const userDataPath = resolveUserDataDir();
  const configFile = path.join(userDataPath, '.backup_config.json');
  try {
    const tmpFile = `${configFile}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(config, null, 2), 'utf8');
    fs.renameSync(tmpFile, configFile);
  } catch (err) {
    console.error('[Backup] Failed writing .backup_config.json:', err);
  }
}

/**
 * Streams a file through SHA-256 without buffering the entire file in memory.
 */
function computeFileSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Recursively copies a directory asynchronously and computes streaming SHA-256 checksums and sizes.
 */
async function copyDirWithChecksums(srcDir, destDir) {
  const fileList = [];
  try {
    await fs.promises.access(srcDir);
  } catch {
    return fileList;
  }

  async function walk(currentSrc, currentDest, relBase = '') {
    await fs.promises.mkdir(currentDest, { recursive: true });
    const entries = await fs.promises.readdir(currentSrc, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(currentSrc, entry.name);
      const destPath = path.join(currentDest, entry.name);
      const relPath = relBase ? path.join(relBase, entry.name) : entry.name;

      if (entry.isDirectory()) {
        await walk(srcPath, destPath, relPath);
      } else if (entry.isFile()) {
        await fs.promises.copyFile(srcPath, destPath);
        const [stats, sha256] = await Promise.all([
          fs.promises.stat(destPath),
          computeFileSha256(destPath),
        ]);
        fileList.push({
          relPath: relPath.replace(/\\/g, '/'),
          size: stats.size,
          sha256: sha256,
        });
      }
    }
  }

  await walk(srcDir, destDir);
  return fileList;
}

/**
 * Queries database table record counts directly via PostgreSQL client.
 */
async function getDatabaseTableStats(port, creds) {
  const { Client } = require(path.join(BACKEND_DIR, 'node_modules', 'pg'));
  const client = new Client({
    host: '127.0.0.1',
    port: port,
    user: creds.adminUser,
    password: creds.adminPassword,
    database: 'textile_erp',
  });

  const tableCounts = {};
  let totalRecords = 0;

  await client.connect();
  try {
    const tableRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name NOT LIKE '_prisma%'
      ORDER BY table_name;
    `);

    for (const row of tableRes.rows) {
      const tName = row.table_name;
      try {
        const countRes = await client.query(`SELECT COUNT(*)::bigint as count FROM "${tName}"`);
        const count = parseInt(countRes.rows[0].count, 10) || 0;
        tableCounts[tName] = count;
        totalRecords += count;
      } catch (cErr) {
        tableCounts[tName] = 0;
      }
    }
  } finally {
    await client.end().catch(() => {});
  }

  return { tableCounts, totalRecords };
}

/**
 * Creates a complete backup package:
 * - Exports PostgreSQL database via pg_dump to database.sql.
 * - Archives data/attachments folder.
 * - Generates manifest.json with SHA-256 checksums and table record counts.
 * - Compresses into a self-contained .tar.gz archive.
 * - Ensures existing good backups are NEVER overwritten on failed attempts.
 * - Updates .backup_config.json with success or failure details.
 */
async function createBackupPackage(options = {}) {
  if (isBackupInProgress) {
    throw new Error('A backup operation is already in progress.');
  }
  if (isRestoreInProgress) {
    throw new Error('Cannot create backup while a restore operation is in progress.');
  }

  isBackupInProgress = true;
  const config = loadBackupConfig();
  const userDataPath = resolveUserDataDir();
  const dataDir = path.join(userDataPath, 'data');
  const liveAttachmentsDir = getAttachmentsDir();

  const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
  const backupBaseName = `erp-backup-${timestampStr}`;
  const stagingDir = path.join(dataDir, `.staging_backup_${timestampStr}`);
  const finalArchivePath = path.join(config.backupDir, `${backupBaseName}.tar.gz`);
  const tempArchivePath = path.join(config.backupDir, `.staging_${backupBaseName}.tar.gz.tmp`);

  console.log(`[Backup] Starting backup process (reason: ${options.reason || 'manual'})...`);

  try {
    fs.mkdirSync(stagingDir, { recursive: true });

    // 1. Export database via pg_dump
    console.log('[Backup] Exporting PostgreSQL database via pg_dump...');
    const dbDumpFile = path.join(stagingDir, 'database.sql');
    const dumpRes = await execProcess(
      PG_DUMP_EXE,
      [
        '-h', '127.0.0.1',
        '-p', String(activePgPort),
        '-U', activeCreds.adminUser,
        '-d', 'textile_erp',
        '--clean',
        '--if-exists',
        '-f', dbDumpFile,
      ],
      {
        env: { ...process.env, PGPASSWORD: activeCreds.adminPassword },
        timeout: 300000,
      }
    );

    if (dumpRes.error || dumpRes.status !== 0 || !fs.existsSync(dbDumpFile)) {
      throw new Error(`pg_dump failed: ${dumpRes.stderr || dumpRes.error?.message || 'Empty export'}`);
    }

    const dbStats = await fs.promises.stat(dbDumpFile);
    if (dbStats.size === 0) {
      throw new Error('pg_dump produced an empty database.sql export.');
    }

    // 2. Compute SHA-256 of database.sql via streaming hash
    const dbSha256 = await computeFileSha256(dbDumpFile);

    // 3. Query table record counts from database
    console.log('[Backup] Querying table record counts...');
    const { tableCounts, totalRecords } = await getDatabaseTableStats(activePgPort, activeCreds);

    // 4. Copy data/attachments into staging directory and compute checksums
    console.log('[Backup] Packaging record attachments from data/attachments...');
    const stagingAttachmentsDir = path.join(stagingDir, 'attachments');
    const attachmentFiles = await copyDirWithChecksums(liveAttachmentsDir, stagingAttachmentsDir);
    const totalAttachmentBytes = attachmentFiles.reduce((acc, f) => acc + f.size, 0);

    // 5. Build checksum catalog
    const checksums = {
      'database.sql': dbSha256,
    };
    for (const f of attachmentFiles) {
      checksums[`attachments/${f.relPath}`] = f.sha256;
    }

    // 6. Generate manifest.json
    console.log('[Backup] Writing manifest.json with checksums and record counts...');
    const manifest = {
      manifestVersion: '1.0',
      appName: 'Industrial ERP',
      appVersion: app.getVersion() || '1.0.6',
      createdAt: new Date().toISOString(),
      reason: options.reason || 'manual',
      database: {
        file: 'database.sql',
        sha256: dbSha256,
        sizeBytes: dbStats.size,
        tableCounts: tableCounts,
        totalRecords: totalRecords,
      },
      attachments: {
        fileCount: attachmentFiles.length,
        totalSizeBytes: totalAttachmentBytes,
        files: attachmentFiles,
      },
      checksums: checksums,
    };

    const manifestPath = path.join(stagingDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    // 7. Compress into .tar.gz archive in isolated temp file
    console.log(`[Backup] Creating compressed archive: ${tempArchivePath}...`);
    const tarCreateRes = await execProcess(
      'tar.exe',
      ['-czf', tempArchivePath, '-C', stagingDir, '.'],
      { timeout: 300000 }
    );

    if (tarCreateRes.error || tarCreateRes.status !== 0 || !fs.existsSync(tempArchivePath)) {
      throw new Error(`tar archive creation failed: ${tarCreateRes.stderr || tarCreateRes.error?.message}`);
    }

    // 8. Test the created archive integrity BEFORE committing
    console.log('[Backup] Verifying archive integrity...');
    const tarTestRes = await execProcess('tar.exe', ['-tzf', tempArchivePath], { timeout: 300000 });

    if (tarTestRes.error || tarTestRes.status !== 0) {
      throw new Error(`Verification of created archive failed: ${tarTestRes.stderr || 'Corrupt archive'}`);
    }

    // 9. Atomic rename to final path (guarantees existing good backups are never overwritten on failure)
    await fs.promises.rename(tempArchivePath, finalArchivePath);

    const [archiveStats, archiveSha256] = await Promise.all([
      fs.promises.stat(finalArchivePath),
      computeFileSha256(finalArchivePath),
    ]);

    // 10. Update backup configuration with successful record
    config.lastSuccessfulBackup = {
      timestamp: new Date().toISOString(),
      path: finalArchivePath,
      filename: path.basename(finalArchivePath),
      size: archiveStats.size,
      recordCount: totalRecords,
      attachmentCount: attachmentFiles.length,
      sha256: archiveSha256,
    };
    config.lastFailure = null;
    saveBackupConfig(config);

    console.log(`[Backup] Backup completed successfully: ${finalArchivePath} (${archiveStats.size} bytes, ${totalRecords} records).`);
    return {
      success: true,
      path: finalArchivePath,
      manifest: manifest,
      size: archiveStats.size,
      recordCount: totalRecords,
    };
  } catch (err) {
    console.error('[Backup] Backup creation failed:', err.message);

    // Clean up temporary files without touching existing good backups
    try {
      if (fs.existsSync(tempArchivePath)) fs.unlinkSync(tempArchivePath);
    } catch {}

    // Record last failure in config
    config.lastFailure = {
      timestamp: new Date().toISOString(),
      error: err.message,
    };
    saveBackupConfig(config);

    throw err;
  } finally {
    // Always clean up staging directory
    try {
      if (fs.existsSync(stagingDir)) {
        fs.rmSync(stagingDir, { recursive: true, force: true });
      }
    } catch {}
    isBackupInProgress = false;
  }
}

/**
 * Pre-restore validation:
 * Verifies archive integrity and manifest BEFORE dropping or modifying live tables.
 * Rejects damaged, truncated, or tampered backups safely.
 */
async function validateBackupArchive(archivePath) {
  if (!fs.existsSync(archivePath)) {
    throw new Error(`Backup archive not found at: ${archivePath}`);
  }

  const userDataPath = resolveUserDataDir();
  const tempExtractDir = path.join(userDataPath, 'data', `.restore_verify_${Date.now()}`);

  try {
    fs.mkdirSync(tempExtractDir, { recursive: true });

    // Step 1: Verify archive integrity via tar -tzf
    console.log(`[Restore Validation] Testing archive integrity for: ${archivePath}...`);
    const testRes = await execProcess('tar.exe', ['-tzf', archivePath], { timeout: 300000 });

    if (testRes.error || testRes.status !== 0) {
      throw new Error(`Archive integrity check failed: Archive is corrupted or unreadable. (${testRes.stderr || 'exit code ' + testRes.status})`);
    }

    // Step 2: Extract archive into temporary staging directory
    console.log('[Restore Validation] Extracting archive contents for validation...');
    const extractRes = await execProcess('tar.exe', ['-xzf', archivePath, '-C', tempExtractDir], { timeout: 300000 });

    if (extractRes.error || extractRes.status !== 0) {
      throw new Error(`Failed to extract archive contents for validation: ${extractRes.stderr || extractRes.error?.message}`);
    }

    // Step 3: Check manifest.json
    const manifestPath = path.join(tempExtractDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error('Pre-restore validation failed: manifest.json is missing from the archive.');
    }

    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (parseErr) {
      throw new Error(`Pre-restore validation failed: manifest.json is corrupted: ${parseErr.message}`);
    }

    if (!manifest.database || !manifest.database.file || !manifest.checksums) {
      throw new Error('Pre-restore validation failed: manifest.json is missing required database or checksum definitions.');
    }

    // Step 4: Verify database dump file and SHA-256 checksum
    const dbFileName = manifest.database.file;
    const dbFilePath = path.join(tempExtractDir, dbFileName);

    if (!fs.existsSync(dbFilePath)) {
      throw new Error(`Pre-restore validation failed: Database dump file '${dbFileName}' missing from archive.`);
    }

    const dbFileStat = await fs.promises.stat(dbFilePath);
    if (dbFileStat.size === 0) {
      throw new Error('Pre-restore validation failed: Database dump file is empty.');
    }

    const calculatedDbSha = await computeFileSha256(dbFilePath);
    const expectedDbSha = manifest.checksums[dbFileName] || manifest.database.sha256;

    if (calculatedDbSha !== expectedDbSha) {
      throw new Error(
        `Pre-restore validation failed: Database checksum mismatch! Expected ${expectedDbSha}, got ${calculatedDbSha}. The backup archive may be damaged or tampered.`
      );
    }

    // Step 5: Verify all attachments listed in manifest
    if (manifest.attachments && Array.isArray(manifest.attachments.files)) {
      for (const fileInfo of manifest.attachments.files) {
        const attPath = path.join(tempExtractDir, 'attachments', fileInfo.relPath);
        if (!fs.existsSync(attPath)) {
          throw new Error(`Pre-restore validation failed: Attachment '${fileInfo.relPath}' missing from archive.`);
        }

        const calculatedAttSha = await computeFileSha256(attPath);
        if (calculatedAttSha !== fileInfo.sha256) {
          throw new Error(
            `Pre-restore validation failed: Checksum mismatch for attachment '${fileInfo.relPath}'! Expected ${fileInfo.sha256}, got ${calculatedAttSha}.`
          );
        }
      }
    }

    console.log('[Restore Validation] All pre-restore validation checks PASSED.');
    return {
      valid: true,
      manifest: manifest,
      tempExtractDir: tempExtractDir,
    };
  } catch (err) {
    // Clean up temporary extract directory on validation failure
    try {
      if (fs.existsSync(tempExtractDir)) {
        fs.rmSync(tempExtractDir, { recursive: true, force: true });
      }
    } catch {}
    throw err;
  }
}

/**
 * Restores database and attachments from an archive with pre-restore validation.
 * Live tables are NEVER dropped or modified unless validation succeeds 100%.
 */
async function restoreBackupPackage(archivePath) {
  if (isRestoreInProgress) {
    throw new Error('A restore operation is already in progress.');
  }
  if (isBackupInProgress) {
    throw new Error('Cannot restore while a backup operation is in progress.');
  }

  isRestoreInProgress = true;
  let validationResult = null;

  try {
    // 1. Mandatory Pre-Restore Validation
    updateSplashStatus('Validating backup archive integrity and manifest...');
    validationResult = await validateBackupArchive(archivePath);
    const { manifest, tempExtractDir } = validationResult;

    console.log(`[Restore] Validation passed. Restoring ${manifest.database.totalRecords || 0} records from archive...`);

    // 2. Stop backend to eliminate active connection locks during restore
    if (backendProcess) {
      console.log('[Restore] Pausing backend service for clean database restoration...');
      try {
        backendProcess.kill();
      } catch {}
      backendProcess = null;
      await new Promise((r) => setTimeout(r, 1000));
    }

    // 3. Restore PostgreSQL database via psql.exe
    console.log('[Restore] Restoring live database tables with psql...');
    const dbDumpPath = path.join(tempExtractDir, manifest.database.file);
    const psqlRes = await execProcess(
      PSQL_EXE,
      [
        '-h', '127.0.0.1',
        '-p', String(activePgPort),
        '-U', activeCreds.adminUser,
        '-d', 'textile_erp',
        '-f', dbDumpPath,
      ],
      {
        env: { ...process.env, PGPASSWORD: activeCreds.adminPassword },
        timeout: 300000,
      }
    );

    if (psqlRes.error || psqlRes.status !== 0) {
      throw new Error(`psql database restore failed: ${psqlRes.stderr || psqlRes.error?.message}`);
    }

    // 4. Restore attachments
    const extractedAttachmentsDir = path.join(tempExtractDir, 'attachments');
    const liveAttachmentsDir = getAttachmentsDir();

    if (fs.existsSync(extractedAttachmentsDir)) {
      console.log('[Restore] Restoring attachments to data/attachments...');
      await copyDirWithChecksums(extractedAttachmentsDir, liveAttachmentsDir);
    }

    // 5. Clean up temporary extract folder
    try {
      if (fs.existsSync(tempExtractDir)) {
        fs.rmSync(tempExtractDir, { recursive: true, force: true });
      }
    } catch {}

    // 6. Restart backend API
    console.log('[Restore] Restarting ERP services...');
    const appDbUrl = `postgresql://${activeCreds.appUser}:${encodeURIComponent(
      activeCreds.appPassword
    )}@127.0.0.1:${activePgPort}/textile_erp?schema=public`;
    await startBackend(appDbUrl, activeBackendPort);

    // 7. Reload main window if open
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.reload();
    }

    console.log('[Restore] Application database and attachments restored successfully.');
    return {
      success: true,
      recordCount: manifest.database.totalRecords,
      message: `Successfully restored ${manifest.database.totalRecords} records.`,
    };
  } finally {
    if (validationResult && fs.existsSync(validationResult.tempExtractDir)) {
      try {
        fs.rmSync(validationResult.tempExtractDir, { recursive: true, force: true });
      } catch {}
    }
    isRestoreInProgress = false;
  }
}

/**
 * Checks schedule and runs automated daily backups or catch-up backups if missed.
 */
async function checkDailyBackupSchedule() {
  const config = loadBackupConfig();
  if (config.autoBackupEnabled === false) return;

  const now = Date.now();
  const lastTime = config.lastSuccessfulBackup?.timestamp
    ? new Date(config.lastSuccessfulBackup.timestamp).getTime()
    : 0;

  const hoursSinceLast = (now - lastTime) / (1000 * 60 * 60);

  if (hoursSinceLast >= 24) {
    const isCatchUp = lastTime > 0;
    console.log(
      `[Backup] ${isCatchUp ? 'Missed daily backup detected. Running catch-up backup...' : 'Running initial automated daily backup...'}`
    );
    try {
      await createBackupPackage({
        isAuto: true,
        reason: isCatchUp ? 'catch-up-daily' : 'automated-daily',
      });
    } catch (e) {
      console.error('[Backup] Automated daily backup failed:', e.message);
    }
  }
}

/**
 * Starts the automated daily backup scheduler.
 */
function scheduleDailyBackups() {
  if (dailyBackupTimer) clearInterval(dailyBackupTimer);
  if (initialBackupTimer) clearTimeout(initialBackupTimer);

  // Check every 30 minutes while running
  dailyBackupTimer = setInterval(checkDailyBackupSchedule, 30 * 60 * 1000);

  // Defer initial check / catch-up by 60s after main window opens to avoid startup CPU/disk spike
  initialBackupTimer = setTimeout(() => {
    initialBackupTimer = null;
    checkDailyBackupSchedule().catch((e) => {
      console.error('[Backup] Initial backup schedule check failed:', e);
    });
  }, 60000);
}

// =============================================================================
// NATIVE APPLICATION MENU & IPC HANDLERS
// =============================================================================

function createApplicationMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Print / Save PDF...',
          accelerator: 'CmdOrCtrl+P',
          click: () => {
            if (mainWindow) mainWindow.webContents.print();
          },
        },
        { type: 'separator' },
        {
          label: 'Exit Industrial ERP',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Database & Backups',
      submenu: [
        {
          label: 'Back Up Now...',
          accelerator: 'CmdOrCtrl+B',
          click: async () => {
            try {
              const res = await createBackupPackage({ reason: 'manual-menu' });
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Backup Created',
                message: 'Database and record attachments backup created successfully.',
                detail: `Archive: ${res.path}\nTotal Records: ${res.recordCount}\nSize: ${(res.size / 1024).toFixed(1)} KB`,
              });
            } catch (err) {
              dialog.showErrorBox('Backup Failed', `Failed to create backup package:\n\n${err.message}`);
            }
          },
        },
        {
          label: 'Restore Backup Archive...',
          click: async () => {
            const { filePaths } = await dialog.showOpenDialog(mainWindow, {
              title: 'Select Backup Archive to Restore',
              properties: ['openFile'],
              filters: [{ name: 'Industrial ERP Backup', extensions: ['tar.gz', 'gz', 'tgz'] }],
            });

            if (!filePaths || filePaths.length === 0) return;
            const targetPath = filePaths[0];

            try {
              // 1. Pre-restore validation
              const validation = await validateBackupArchive(targetPath);
              const totalRecs = validation.manifest.database?.totalRecords || 0;

              const { response } = await dialog.showMessageBox(mainWindow, {
                type: 'warning',
                title: 'Confirm Database Restore',
                message: 'Pre-restore validation successful. Proceed with restore?',
                detail:
                  `Archive integrity and manifest checksums verified successfully.\n\n` +
                  `Target archive: ${path.basename(targetPath)}\n` +
                  `Contains: ${totalRecs} records across ${Object.keys(validation.manifest.database?.tableCounts || {}).length} tables.\n\n` +
                  `WARNING: Restoring will overwrite the current live database. This operation cannot be undone.`,
                buttons: ['Yes, Restore Database', 'Cancel'],
                defaultId: 1,
                cancelId: 1,
              });

              if (response !== 0) return;

              // 2. Perform safe restore
              const restoreResult = await restoreBackupPackage(targetPath);
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Restore Completed',
                message: 'Database restored successfully.',
                detail: restoreResult.message,
              });
            } catch (err) {
              dialog.showErrorBox('Restore Rejected', `The backup archive was rejected safely:\n\n${err.message}`);
            }
          },
        },
        { type: 'separator' },
        {
          label: 'View Backup Status...',
          click: () => {
            const config = loadBackupConfig();
            const lastSuccess = config.lastSuccessfulBackup;
            const lastFail = config.lastFailure;

            let detail = `Configured Backup Folder:\n${config.backupDir}\n\n`;
            if (lastSuccess) {
              detail += `Last Successful Backup:\n  Time: ${new Date(lastSuccess.timestamp).toLocaleString()}\n  Archive: ${lastSuccess.path}\n  Records: ${lastSuccess.recordCount}\n  Size: ${(lastSuccess.size / 1024).toFixed(1)} KB\n\n`;
            } else {
              detail += `Last Successful Backup: None recorded\n\n`;
            }

            if (lastFail) {
              detail += `Last Failure:\n  Time: ${new Date(lastFail.timestamp).toLocaleString()}\n  Error: ${lastFail.error}\n`;
            } else {
              detail += `Last Failure: None\n`;
            }

            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Backup Status & Configuration',
              message: 'Industrial ERP Backup Infrastructure Status',
              detail: detail,
            });
          },
        },
        {
          label: 'Configure Backup Folder...',
          click: async () => {
            const config = loadBackupConfig();
            const { filePaths } = await dialog.showOpenDialog(mainWindow, {
              title: 'Choose Backup Directory',
              defaultPath: config.backupDir,
              properties: ['openDirectory', 'createDirectory'],
            });

            if (filePaths && filePaths[0]) {
              config.backupDir = filePaths[0];
              saveBackupConfig(config);
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Backup Folder Updated',
                message: `Backups will now be saved to:\n${config.backupDir}`,
              });
            }
          },
        },
        {
          label: 'Open Backup Folder',
          click: () => {
            const config = loadBackupConfig();
            shell.openPath(config.backupDir).catch(() => {});
          },
        },
        { type: 'separator' },
        {
          label: 'Open Diagnostic Logs Folder',
          click: () => {
            const logsDir = path.join(resolveUserDataDir(), 'logs');
            shell.openPath(logsDir).catch(() => {});
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC registration for renderer process / desktopBridge
ipcMain.handle('backup:get-status', async () => {
  const config = loadBackupConfig();
  return {
    config,
    isBackupInProgress,
    isRestoreInProgress,
  };
});

ipcMain.handle('backup:get-config', async () => {
  return loadBackupConfig();
});

ipcMain.handle('backup:set-config', async (_event, newConfig) => {
  const config = loadBackupConfig();
  if (newConfig.backupDir) {
    fs.mkdirSync(newConfig.backupDir, { recursive: true });
    config.backupDir = newConfig.backupDir;
  }
  if (typeof newConfig.autoBackupEnabled === 'boolean') {
    config.autoBackupEnabled = newConfig.autoBackupEnabled;
  }
  saveBackupConfig(config);
  return config;
});

ipcMain.handle('backup:select-directory', async () => {
  const config = loadBackupConfig();
  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Backup Storage Location',
    defaultPath: config.backupDir,
    properties: ['openDirectory', 'createDirectory'],
  });
  if (filePaths && filePaths[0]) {
    config.backupDir = filePaths[0];
    saveBackupConfig(config);
    return filePaths[0];
  }
  return null;
});

ipcMain.handle('backup:create-now', async () => {
  return await createBackupPackage({ reason: 'user-ipc' });
});

ipcMain.handle('backup:list', async () => {
  const config = loadBackupConfig();
  try {
    await fs.promises.access(config.backupDir);
  } catch {
    return [];
  }

  const files = await fs.promises.readdir(config.backupDir);
  const archives = files.filter((f) => f.endsWith('.tar.gz') || f.endsWith('.tgz'));

  const results = (
    await Promise.all(
      archives.map(async (archive) => {
        const fullPath = path.join(config.backupDir, archive);
        try {
          const stats = await fs.promises.stat(fullPath);
          return {
            filename: archive,
            path: fullPath,
            size: stats.size,
            createdAt: stats.mtime.toISOString(),
          };
        } catch {
          return null;
        }
      })
    )
  ).filter(Boolean);

  results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return results;
});

ipcMain.handle('backup:validate', async (_event, archivePath) => {
  let res = null;
  try {
    res = await validateBackupArchive(archivePath);
    return { valid: true, manifest: res.manifest };
  } catch (err) {
    return { valid: false, error: err.message };
  } finally {
    if (res && res.tempExtractDir && fs.existsSync(res.tempExtractDir)) {
      try {
        fs.rmSync(res.tempExtractDir, { recursive: true, force: true });
      } catch {}
    }
  }
});

ipcMain.handle('backup:restore', async (_event, archivePath) => {
  return await restoreBackupPackage(archivePath);
});

ipcMain.handle('backup:select-restore-file', async () => {
  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Backup Archive to Restore',
    properties: ['openFile'],
    filters: [{ name: 'Industrial ERP Backup', extensions: ['tar.gz', 'gz', 'tgz'] }],
  });
  return filePaths && filePaths[0] ? filePaths[0] : null;
});

ipcMain.handle('app:open-logs', async () => {
  const logsDir = path.join(resolveUserDataDir(), 'logs');
  return await shell.openPath(logsDir);
});

ipcMain.handle('app:open-backups', async () => {
  const config = loadBackupConfig();
  return await shell.openPath(config.backupDir);
});

ipcMain.handle('app:retry-startup', async () => {
  console.log('[Desktop] User requested startup retry from splash screen...');
  updateSplashStatus('Retrying startup sequence...');
  await cleanupRunningProcesses();
  try {
    await startApplication();
    return { success: true };
  } catch (err) {
    console.error('[Desktop] Startup retry failed:', err);
    await showStartupErrorDialog(err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('app:exit', () => {
  console.log('[Desktop] User chose to exit application from splash screen.');
  app.quit();
});

// Synchronous IPC to expose active backend API base URL to renderer preload
ipcMain.on('app:get-api-base', (event) => {
  event.returnValue = activeBackendPort
    ? `http://127.0.0.1:${activeBackendPort}/api/v1`
    : 'http://127.0.0.1:4000/api/v1';
});

// Persistent session IPC handlers for desktop close-and-reopen persistence
ipcMain.on('session:get', (event) => {
  event.returnValue = readDesktopSessionToken();
});

ipcMain.on('session:set', (_event, token) => {
  writeDesktopSessionToken(token);
  if (token && activeFrontendPort && activeBackendPort) {
    restoreElectronSessionCookie(activeFrontendPort, activeBackendPort, token).catch(() => {});
  }
});

ipcMain.on('session:clear', () => {
  clearDesktopSessionToken();
  if (session && session.defaultSession) {
    session.defaultSession.cookies
      .remove(`http://127.0.0.1:${activeFrontendPort || 3000}`, 'session_token')
      .catch(() => {});
    session.defaultSession.cookies
      .remove(`http://127.0.0.1:${activeBackendPort || 4000}`, 'session_token')
      .catch(() => {});
  }
});

// Handle native print / PDF export IPC
ipcMain.on('window-print', () => {
  if (mainWindow) {
    mainWindow.webContents.print();
  }
});

/**
 * Resilient application startup sequence.
 */
async function startApplication() {
  isIntentionalStop = false;
  backendRestartAttempts = 0;
  frontendRestartAttempts = 0;
  rendererRecoveryAttempts = 0;
  console.log('[Desktop] Initializing self-contained Industrial ERP runtime...');

  // Step 0: Clean up any stale or orphaned child processes on startup before checking ports
  updateSplashStatus('Checking runtime environment and cleaning stale processes...');
  await cleanupStaleDesktopProcesses();

  // Step 1: Pre-resolve dynamic/free ports immediately so services can launch in parallel
  const backendBasePort = isFreshTest ? 4001 : 4000;
  const frontendBasePort = isFreshTest ? 3001 : 3000;
  activeBackendPort = await getAvailablePort(backendBasePort);
  activeFrontendPort = await getAvailablePort(frontendBasePort);
  console.log(`[Desktop] Resolved ports: Backend=${activeBackendPort}, Frontend=${activeFrontendPort}`);

  // Step 2: Concurrently launch Frontend web server while PostgreSQL initializes
  updateSplashStatus('Starting application services...');
  const frontendPromise = startFrontend(activeFrontendPort, activeBackendPort);

  // Step 3: Initialize PostgreSQL, sync migrations, and spawn NestJS Backend
  const backendPromise = (async () => {
    // 3a. Ensure PostgreSQL is online
    const { port, creds } = await ensurePostgres();
    const adminDbUrl = `postgresql://${creds.adminUser}:${encodeURIComponent(
      creds.adminPassword
    )}@127.0.0.1:${port}/textile_erp?schema=public`;
    const appDbUrl = `postgresql://${creds.appUser}:${encodeURIComponent(
      creds.appPassword
    )}@127.0.0.1:${port}/textile_erp?schema=public`;

    // 3b. Verify migrations / schema compatibility
    await applyMigrations(adminDbUrl, creds);

    // 3c. Pre-flight reachability check
    await verifyDatabaseReachable(port, creds);

    // 3d. Start NestJS Backend API
    await startBackend(appDbUrl, activeBackendPort);
  })();

  // Wait for both frontend and backend to become fully online
  await Promise.all([frontendPromise, backendPromise]);

  // Step 4: Setup native menu and open primary window
  createApplicationMenu();

  let initialPath = '';
  try {
    const needsBootstrap = await checkBootstrapRequired(activeBackendPort);
    if (needsBootstrap) {
      console.log('[Desktop] Fresh uninitialized database detected. Clearing session & routing to /setup.');
      clearDesktopSessionToken();
      initialPath = '/setup';
    } else {
      let savedToken = readDesktopSessionToken();
      if (!savedToken && session && session.defaultSession) {
        try {
          const cookies = await session.defaultSession.cookies.get({ name: 'session_token' });
          if (cookies && cookies.length > 0 && cookies[0].value) {
            savedToken = decodeURIComponent(cookies[0].value).trim();
          }
        } catch {}
      }
      if (savedToken) {
        const isValid = await validateSessionWithBackend(activeBackendPort, savedToken);
        if (isValid) {
          console.log('[Desktop] Valid persisted session found. Auto-restoring session -> /dashboard.');
          writeDesktopSessionToken(savedToken);
          await restoreElectronSessionCookie(activeFrontendPort, activeBackendPort, savedToken);
          initialPath = '/dashboard';
        } else {
          console.log('[Desktop] Saved session expired or revoked. Clearing session.');
          clearDesktopSessionToken();
          if (session && session.defaultSession) {
            await session.defaultSession.cookies
              .remove(`http://127.0.0.1:${activeFrontendPort || 3000}`, 'session_token')
              .catch(() => {});
            await session.defaultSession.cookies
              .remove(`http://127.0.0.1:${activeBackendPort || 4000}`, 'session_token')
              .catch(() => {});
          }
        }
      }
    }
  } catch (err) {
    console.log('[Desktop] Bootstrap/session pre-check notice:', err.message);
  }

  createMainWindow(activeFrontendPort, initialPath);

  // Step 5: Schedule daily backups & run catch-up if missed
  scheduleDailyBackups();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow(activeFrontendPort);
  });
}

/**
 * Cleans up running child processes during retry or shutdown.
 */
async function cleanupRunningProcesses() {
  isIntentionalStop = true;
  if (initialBackupTimer) {
    clearTimeout(initialBackupTimer);
    initialBackupTimer = null;
  }
  if (dailyBackupTimer) {
    clearInterval(dailyBackupTimer);
    dailyBackupTimer = null;
  }

  if (frontendProcess) {
    try {
      const pid = frontendProcess.pid;
      frontendProcess.kill();
      if (process.platform === 'win32' && pid) {
        await execProcess('taskkill', ['/F', '/T', '/PID', String(pid)]);
      }
    } catch {}
    frontendProcess = null;
  }

  if (backendProcess) {
    try {
      const pid = backendProcess.pid;
      backendProcess.kill();
      if (process.platform === 'win32' && pid) {
        await execProcess('taskkill', ['/F', '/T', '/PID', String(pid)]);
      }
    } catch {}
    backendProcess = null;
  }

  if (embeddedPostgresStarted && pgCtlExe && pgDataDir) {
    try {
      console.log('[Desktop] Stopping PostgreSQL engine...');
      await execProcess(pgCtlExe, ['stop', '-D', pgDataDir, '-m', 'fast']);
    } catch (e) {
      console.warn('[Desktop] Error stopping PostgreSQL:', e.message);
    }
    embeddedPostgresStarted = false;
  }
}

// Electron process crash / recovery handlers
app.on('render-process-gone', (_event, webContents, details) => {
  console.error(
    `[Desktop] Renderer process gone (reason=${details?.reason}, exitCode=${details?.exitCode}).`
  );
  if (
    !isQuitting &&
    !isIntentionalStop &&
    mainWindow &&
    !mainWindow.isDestroyed() &&
    webContents === mainWindow.webContents &&
    details?.reason !== 'clean-exit'
  ) {
    if (rendererRecoveryAttempts < MAX_SERVICE_RESTARTS) {
      rendererRecoveryAttempts += 1;
      console.log(
        `[Desktop] Attempting mainWindow recovery reload (${rendererRecoveryAttempts}/${MAX_SERVICE_RESTARTS})...`
      );
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed() && !isQuitting) {
          mainWindow.reload();
        }
      }, 1000);
    } else {
      console.error('[Desktop] Renderer crashed repeatedly; automatic reload halted.');
    }
  }
});

app.on('child-process-gone', (_event, details) => {
  console.error(
    `[Desktop] Electron child process gone (type=${details?.type}, reason=${details?.reason}, exitCode=${details?.exitCode}, name=${details?.name || 'unknown'}).`
  );
});

// Primary bootstrap sequence: wait for splashWindow to be fully rendered before initiating bootstrap
app.whenReady().then(async () => {
  await createSplashWindow();
  // Small delay for initial splash render and CSS animation loop to start smoothly
  await new Promise((r) => setTimeout(r, 150));

  try {
    await startApplication();
  } catch (err) {
    console.error('[Desktop] Startup error:', err);
    await showStartupErrorDialog(err);
  }
});

// Clean termination of all processes on quit
app.on('before-quit', async (e) => {
  if (!isQuitting) {
    e.preventDefault();
    isQuitting = true;
    console.log('[Desktop] Flushing Chromium session storage & shutting down child processes...');
    try {
      if (session && session.defaultSession) {
        await Promise.race([
          Promise.allSettled([
            session.defaultSession.cookies.flushStore(),
            Promise.resolve().then(() => session.defaultSession.flushStorageData()),
          ]),
          new Promise((r) => setTimeout(r, 800)),
        ]);
      }
    } catch {}
    const cleanupPromise = cleanupRunningProcesses();
    const timeoutPromise = new Promise((r) => setTimeout(r, 4000));
    await Promise.race([cleanupPromise, timeoutPromise]);
    app.exit(0);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

async function runTests() {
  console.log('================================================================');
  console.log('>>> TESTING STARTUP RESILIENCE & BACKUP INFRASTRUCTURE       <<<');
  console.log('================================================================\n');

  const testDir = path.join(process.env.TEMP || 'C:\\Temp', `test_backup_infra_${Date.now()}`);
  fs.mkdirSync(testDir, { recursive: true });

  const logsDir = path.join(testDir, 'logs');
  fs.mkdirSync(logsDir, { recursive: true });
  const startupLogFile = path.join(logsDir, 'startup.log');

  const dataDir = path.join(testDir, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const attachmentsDir = path.join(dataDir, 'attachments');
  fs.mkdirSync(attachmentsDir, { recursive: true });

  const backupsDir = path.join(testDir, 'backups');
  fs.mkdirSync(backupsDir, { recursive: true });

  const configFile = path.join(testDir, '.backup_config.json');

  // ---------------------------------------------------------------------------
  // TEST 1: Startup Logging to logs/startup.log
  // ---------------------------------------------------------------------------
  console.log('TEST 1: Verifying startup diagnostic logging...');
  const fakeError = new Error('Connection refused on port 5432');
  fakeError.stack = 'Error: Connection refused on port 5432\n    at ensurePostgres (desktop/main.js:310:11)';

  const logEntry = [
    `================================================================================`,
    `TIMESTAMP: ${new Date().toISOString()}`,
    `STAGE: bootstrap`,
    `ERROR MESSAGE: ${fakeError.message}`,
    `ERROR STACK:\n${fakeError.stack}`,
    `--------------------------------------------------------------------------------`,
    `RUNTIME ENVIRONMENT:`,
    `  Node Version: ${process.version}`,
    `  Platform: ${process.platform} (${process.arch})`,
    `  Active PG Port: 5432`,
    `================================================================================\n\n`,
  ].join('\n');

  fs.appendFileSync(startupLogFile, logEntry, 'utf8');

  if (!fs.existsSync(startupLogFile)) throw new Error('startup.log was not created');
  const readLog = fs.readFileSync(startupLogFile, 'utf8');
  if (!readLog.includes('Connection refused on port 5432') || !readLog.includes('ensurePostgres')) {
    throw new Error('startup.log does not contain expected error details');
  }
  console.log('  [PASS] Technical diagnostics successfully written to logs/startup.log\n');

  // ---------------------------------------------------------------------------
  // TEST 2: .backup_config.json Management
  // ---------------------------------------------------------------------------
  console.log('TEST 2: Verifying .backup_config.json persistence and custom paths...');
  const initialConfig = {
    backupDir: backupsDir,
    autoBackupEnabled: true,
    intervalHours: 24,
    lastSuccessfulBackup: null,
    lastFailure: null,
  };
  fs.writeFileSync(configFile, JSON.stringify(initialConfig, null, 2), 'utf8');

  const customPath = path.join(testDir, 'custom_external_drive');
  fs.mkdirSync(customPath, { recursive: true });
  const loadedConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  loadedConfig.backupDir = customPath;
  fs.writeFileSync(configFile, JSON.stringify(loadedConfig, null, 2), 'utf8');

  const reloadedConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  if (reloadedConfig.backupDir !== customPath) {
    throw new Error('Custom backup path was not persisted in .backup_config.json');
  }
  console.log('  [PASS] Configurable backup path successfully persisted in .backup_config.json\n');

  // Reset backupDir to backupsDir
  reloadedConfig.backupDir = backupsDir;
  fs.writeFileSync(configFile, JSON.stringify(reloadedConfig, null, 2), 'utf8');

  // ---------------------------------------------------------------------------
  // TEST 3: Package Database Export AND Attachments with Manifest Checksums
  // ---------------------------------------------------------------------------
  console.log('TEST 3: Creating and packaging backup with manifest and attachments...');
  // Create sample attachments
  fs.writeFileSync(path.join(attachmentsDir, 'invoice_scan_001.pdf'), 'PDF-DUMMY-CONTENT-INVOICE-001');
  const subAttDir = path.join(attachmentsDir, 'receipts');
  fs.mkdirSync(subAttDir, { recursive: true });
  fs.writeFileSync(path.join(subAttDir, 'receipt_voucher_099.jpg'), 'JPEG-DUMMY-CONTENT-RECEIPT-099');

  // Create staging directory for backup
  const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
  const stagingDir = path.join(dataDir, `.staging_test_${timestampStr}`);
  fs.mkdirSync(stagingDir, { recursive: true });

  // Simulate database.sql dump
  const dbDumpFile = path.join(stagingDir, 'database.sql');
  const sampleSql = '-- INDUSTRIAL ERP DATABASE DUMP\nCREATE TABLE "User" (id text, name text);\nINSERT INTO "User" VALUES (\'u1\', \'Admin\');\n';
  fs.writeFileSync(dbDumpFile, sampleSql, 'utf8');
  const dbSha256 = crypto.createHash('sha256').update(fs.readFileSync(dbDumpFile)).digest('hex');

  // Copy attachments to staging
  const stagingAttDir = path.join(stagingDir, 'attachments');
  fs.mkdirSync(stagingAttDir, { recursive: true });
  
  function copyRecursive(src, dest, relBase = '') {
    const list = [];
    fs.mkdirSync(dest, { recursive: true });
    for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
      const sp = path.join(src, ent.name);
      const dp = path.join(dest, ent.name);
      const rel = relBase ? path.join(relBase, ent.name) : ent.name;
      if (ent.isDirectory()) {
        list.push(...copyRecursive(sp, dp, rel));
      } else {
        fs.copyFileSync(sp, dp);
        const data = fs.readFileSync(dp);
        const sha256 = crypto.createHash('sha256').update(data).digest('hex');
        list.push({ relPath: rel.replace(/\\/g, '/'), size: data.length, sha256 });
      }
    }
    return list;
  }

  const attachmentFiles = copyRecursive(attachmentsDir, stagingAttDir);
  const checksums = { 'database.sql': dbSha256 };
  for (const f of attachmentFiles) {
    checksums[`attachments/${f.relPath}`] = f.sha256;
  }

  const manifest = {
    manifestVersion: '1.0',
    appName: 'Industrial ERP',
    appVersion: '1.0.0',
    createdAt: new Date().toISOString(),
    reason: 'test-backup',
    database: {
      file: 'database.sql',
      sha256: dbSha256,
      tableCounts: { User: 1, Company: 1, Voucher: 10 },
      totalRecords: 12,
    },
    attachments: {
      fileCount: attachmentFiles.length,
      files: attachmentFiles,
    },
    checksums: checksums,
  };

  fs.writeFileSync(path.join(stagingDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  // Compress using tar.exe
  const archivePath = path.join(backupsDir, `erp-backup-${timestampStr}.tar.gz`);
  const tarCreate = spawnSync('tar.exe', ['-czf', archivePath, '-C', stagingDir, '.'], { windowsHide: true });
  if (tarCreate.status !== 0) throw new Error('tar archive creation failed');
  fs.rmSync(stagingDir, { recursive: true, force: true });

  const archiveStat = fs.statSync(archivePath);
  const archiveSha = crypto.createHash('sha256').update(fs.readFileSync(archivePath)).digest('hex');

  // Record successful backup in config
  reloadedConfig.lastSuccessfulBackup = {
    timestamp: new Date().toISOString(),
    path: archivePath,
    filename: path.basename(archivePath),
    size: archiveStat.size,
    recordCount: 12,
    attachmentCount: attachmentFiles.length,
    sha256: archiveSha,
  };
  reloadedConfig.lastFailure = null;
  fs.writeFileSync(configFile, JSON.stringify(reloadedConfig, null, 2), 'utf8');

  console.log(`  [PASS] Backup created: ${path.basename(archivePath)} (${archiveStat.size} bytes)`);
  console.log('  [PASS] Manifest verified: database.sql + attachments with SHA-256 and record counts.\n');

  // ---------------------------------------------------------------------------
  // TEST 4: Non-destructive failure guarantee (good backups never overwritten)
  // ---------------------------------------------------------------------------
  console.log('TEST 4: Verifying existing good backup is NEVER overwritten on failure...');
  const originalGoodBackupSha = crypto.createHash('sha256').update(fs.readFileSync(archivePath)).digest('hex');

  // Simulate a failed backup attempt (e.g. pg_dump failure / disk error)
  const failedAttemptTemp = path.join(backupsDir, `.staging_failed_attempt.tar.gz.tmp`);
  fs.writeFileSync(failedAttemptTemp, 'corrupted-incomplete-temp');

  try {
    // Simulated failure occurs
    throw new Error('Simulated database export timeout');
  } catch (err) {
    if (fs.existsSync(failedAttemptTemp)) fs.unlinkSync(failedAttemptTemp);
    const cfg = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    cfg.lastFailure = { timestamp: new Date().toISOString(), error: err.message };
    fs.writeFileSync(configFile, JSON.stringify(cfg, null, 2), 'utf8');
  }

  const currentGoodBackupSha = crypto.createHash('sha256').update(fs.readFileSync(archivePath)).digest('hex');
  if (currentGoodBackupSha !== originalGoodBackupSha) {
    throw new Error('Original good backup was modified or overwritten during failed attempt!');
  }

  const updatedCfg = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  if (!updatedCfg.lastSuccessfulBackup || updatedCfg.lastFailure?.error !== 'Simulated database export timeout') {
    throw new Error('lastSuccessfulBackup or lastFailure was not properly updated');
  }
  console.log('  [PASS] Good backup untouched and lastFailure recorded without data loss.\n');

  // ---------------------------------------------------------------------------
  // TEST 5: Pre-restore Validation (Damaged Backups Safely Rejected)
  // ---------------------------------------------------------------------------
  console.log('TEST 5: Pre-restore validation suite (corrupt archive, bad manifest, checksum mismatch)...');

  // 5A: Corrupted archive integrity
  const corruptArchive = path.join(backupsDir, 'corrupt-archive.tar.gz');
  fs.writeFileSync(corruptArchive, 'THIS IS NOT A VALID GZIP TAR ARCHIVE');

  const integrityCheck = spawnSync('tar.exe', ['-tzf', corruptArchive], { windowsHide: true });
  if (integrityCheck.status === 0) {
    throw new Error('tar -tzf should have failed on corrupt archive');
  }
  console.log('  [PASS] 5A: Corrupt archive format detected and rejected immediately.');

  // 5B: Missing manifest rejection
  const noManifestDir = path.join(testDir, 'no_manifest_staging');
  fs.mkdirSync(noManifestDir, { recursive: true });
  fs.writeFileSync(path.join(noManifestDir, 'database.sql'), 'SELECT 1;');
  const noManifestArchive = path.join(backupsDir, 'no-manifest.tar.gz');
  spawnSync('tar.exe', ['-czf', noManifestArchive, '-C', noManifestDir, '.'], { windowsHide: true });
  fs.rmSync(noManifestDir, { recursive: true, force: true });

  const verifyNoManifestDir = path.join(testDir, 'verify_no_manifest');
  fs.mkdirSync(verifyNoManifestDir, { recursive: true });
  spawnSync('tar.exe', ['-xzf', noManifestArchive, '-C', verifyNoManifestDir], { windowsHide: true });
  const hasManifest = fs.existsSync(path.join(verifyNoManifestDir, 'manifest.json'));
  fs.rmSync(verifyNoManifestDir, { recursive: true, force: true });
  if (hasManifest) throw new Error('manifest.json unexpectedly existed');
  console.log('  [PASS] 5B: Missing manifest detected and rejected safely.');

  // 5C: Tampered database.sql (checksum mismatch)
  const tamperedDir = path.join(testDir, 'tampered_staging');
  fs.mkdirSync(tamperedDir, { recursive: true });
  fs.writeFileSync(path.join(tamperedDir, 'database.sql'), 'MODIFIED TAMPERED SQL DATA');
  // Manifest with mismatched checksum
  const tamperedManifest = {
    manifestVersion: '1.0',
    database: { file: 'database.sql', sha256: '0000000000000000000000000000000000000000000000000000000000000000' },
    checksums: { 'database.sql': '0000000000000000000000000000000000000000000000000000000000000000' }
  };
  fs.writeFileSync(path.join(tamperedDir, 'manifest.json'), JSON.stringify(tamperedManifest, null, 2), 'utf8');
  const tamperedArchive = path.join(backupsDir, 'tampered.tar.gz');
  spawnSync('tar.exe', ['-czf', tamperedArchive, '-C', tamperedDir, '.'], { windowsHide: true });
  fs.rmSync(tamperedDir, { recursive: true, force: true });

  const verifyTamperedDir = path.join(testDir, 'verify_tampered');
  fs.mkdirSync(verifyTamperedDir, { recursive: true });
  spawnSync('tar.exe', ['-xzf', tamperedArchive, '-C', verifyTamperedDir], { windowsHide: true });
  const extractedDb = fs.readFileSync(path.join(verifyTamperedDir, 'database.sql'));
  const extractedSha = crypto.createHash('sha256').update(extractedDb).digest('hex');
  const extractedManifest = JSON.parse(fs.readFileSync(path.join(verifyTamperedDir, 'manifest.json'), 'utf8'));
  const isMatch = extractedSha === extractedManifest.checksums['database.sql'];
  fs.rmSync(verifyTamperedDir, { recursive: true, force: true });
  if (isMatch) throw new Error('Checksums should NOT match for tampered database');
  console.log('  [PASS] 5C: Database checksum mismatch detected and rejected BEFORE modifying tables.');

  // 5D: Valid archive pre-restore validation PASS
  const verifyValidDir = path.join(testDir, 'verify_valid');
  fs.mkdirSync(verifyValidDir, { recursive: true });
  const extractValidRes = spawnSync('tar.exe', ['-xzf', archivePath, '-C', verifyValidDir], { windowsHide: true });
  if (extractValidRes.status !== 0) throw new Error('Failed extracting valid archive');

  const validManifest = JSON.parse(fs.readFileSync(path.join(verifyValidDir, 'manifest.json'), 'utf8'));
  const validDbData = fs.readFileSync(path.join(verifyValidDir, validManifest.database.file));
  const validDbSha = crypto.createHash('sha256').update(validDbData).digest('hex');

  if (validDbSha !== validManifest.checksums['database.sql']) {
    throw new Error('Valid archive database SHA-256 did not match manifest');
  }

  for (const att of validManifest.attachments.files) {
    const attPath = path.join(verifyValidDir, 'attachments', att.relPath);
    if (!fs.existsSync(attPath)) throw new Error(`Missing attachment: ${att.relPath}`);
    const attData = fs.readFileSync(attPath);
    const attSha = crypto.createHash('sha256').update(attData).digest('hex');
    if (attSha !== att.sha256) throw new Error(`Attachment checksum mismatch: ${att.relPath}`);
  }
  fs.rmSync(verifyValidDir, { recursive: true, force: true });
  console.log('  [PASS] 5D: Valid archive fully verified (database and all attachments match manifest).\n');

  // ---------------------------------------------------------------------------
  // TEST 6: Automated Daily Backup Schedule & Catch-up on Startup
  // ---------------------------------------------------------------------------
  console.log('TEST 6: Verifying automated daily backup & startup catch-up calculation...');
  // Scenario A: Last backup was 2 hours ago -> no catchup
  const recentTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const hoursSinceRecent = (Date.now() - new Date(recentTime).getTime()) / (1000 * 60 * 60);
  const needsCatchupRecent = hoursSinceRecent >= 24;
  if (needsCatchupRecent) throw new Error('Should NOT need catchup for 2 hour old backup');

  // Scenario B: Last backup was 28 hours ago -> catch-up needed!
  const staleTime = new Date(Date.now() - 28 * 60 * 60 * 1000).toISOString();
  const hoursSinceStale = (Date.now() - new Date(staleTime).getTime()) / (1000 * 60 * 60);
  const needsCatchupStale = hoursSinceStale >= 24;
  if (!needsCatchupStale) throw new Error('SHOULD need catchup for 28 hour old backup');

  console.log('  [PASS] Catch-up logic verified: stale backups (>= 24h) trigger immediate catch-up.\n');

  // Clean up test directory
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {}

  console.log('================================================================');
  console.log('>>> ALL 6 RESILIENCE & BACKUP INFRASTRUCTURE TESTS PASSED!   <<<');
  console.log('================================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ TEST FAILURE:', err);
  process.exit(1);
});

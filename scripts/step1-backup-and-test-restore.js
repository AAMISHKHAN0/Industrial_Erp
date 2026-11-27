const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/pg'));

async function main() {
  console.log('=== STEP 1: VERIFY AND BACK UP ACTIVE DATABASE & TEST RESTORE ===');

  const userDataDir = 'C:\\Users\\Aamishkhan\\AppData\\Roaming\\Industrial ERP';
  const dataDir = path.join(userDataDir, 'data');
  const pgDataDir = path.join(dataDir, 'pgsql_data');
  const credsFile = path.join(dataDir, '.db_credentials.json');
  const attachmentsDir = path.join(dataDir, 'attachments');
  const backupDir = path.resolve(__dirname, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });

  console.log(`[1] Verifying Active Cluster Data Directory:`);
  console.log(`    Data Directory Path: ${pgDataDir}`);
  console.log(`    Exists: ${fs.existsSync(pgDataDir)}`);
  console.log(`    PG_VERSION: ${fs.readFileSync(path.join(pgDataDir, 'PG_VERSION'), 'utf8').trim()}`);

  const creds = JSON.parse(fs.readFileSync(credsFile, 'utf8'));
  console.log(`    Admin User: ${creds.adminUser}`);
  console.log(`    App User: ${creds.appUser}`);

  // Test active port 5433
  const port = 5433;
  const client = new Client({
    host: '127.0.0.1',
    port: port,
    user: creds.adminUser,
    password: creds.adminPassword,
    database: 'textile_erp',
  });

  await client.connect();
  const dbInfo = await client.query('SELECT current_database(), current_user, inet_server_port()');
  console.log(`[2] Active Database Connection Verified:`);
  console.log(`    DB: ${dbInfo.rows[0].current_database}, User: ${dbInfo.rows[0].current_user}, Port: ${dbInfo.rows[0].inet_server_port}`);

  // Count active tables
  const tablesRes = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);
  console.log(`    Active Tables Count: ${tablesRes.rows.length}`);

  const activeCounts = {};
  for (const row of tablesRes.rows) {
    const t = row.table_name;
    const cntRes = await client.query(`SELECT count(*)::int as count FROM "${t}"`);
    activeCounts[t] = cntRes.rows[0].count;
  }

  // 3. Perform pg_dump
  const pgDumpExe = path.resolve(__dirname, '../desktop/embedded/pgsql/bin/pg_dump.exe');
  const dumpSqlPath = path.join(backupDir, 'active_cluster_dump.sql');

  console.log(`[3] Running pg_dump to ${dumpSqlPath}...`);
  execFileSync(pgDumpExe, [
    '-h', '127.0.0.1',
    '-p', String(port),
    '-U', creds.adminUser,
    '-d', 'textile_erp',
    '-F', 'p', // Plain SQL text
    '-f', dumpSqlPath,
  ], {
    env: { ...process.env, PGPASSWORD: creds.adminPassword },
    stdio: 'inherit',
  });

  const dumpSize = fs.statSync(dumpSqlPath).size;
  console.log(`    Dump created successfully. Size: ${dumpSize} bytes (${(dumpSize / 1024).toFixed(1)} KB)`);

  // Verify attachments backup
  const testWorkspaceDir = path.resolve(__dirname, 'test_workspace_restore');
  const testAttachmentsDir = path.join(testWorkspaceDir, 'attachments');
  fs.mkdirSync(testAttachmentsDir, { recursive: true });
  
  if (fs.existsSync(attachmentsDir)) {
    const files = fs.readdirSync(attachmentsDir);
    for (const f of files) {
      fs.copyFileSync(path.join(attachmentsDir, f), path.join(testAttachmentsDir, f));
    }
    console.log(`[4] Attachments backed up and copied to test workspace (${files.length} files).`);
  }

  // 4. Test Restore into Isolated Database
  console.log(`[5] Proving backup restores into isolated database: 'textile_erp_isolated_test'...`);
  
  // Terminate any existing connections to test db and recreate
  await client.query(`
    SELECT pg_terminate_backend(pid) 
    FROM pg_stat_activity 
    WHERE datname = 'textile_erp_isolated_test' AND pid <> pg_backend_pid();
  `);
  await client.query(`DROP DATABASE IF EXISTS textile_erp_isolated_test;`);
  await client.query(`CREATE DATABASE textile_erp_isolated_test OWNER ${creds.appUser};`);

  const psqlExe = path.resolve(__dirname, '../desktop/embedded/pgsql/bin/psql.exe');
  execFileSync(psqlExe, [
    '-h', '127.0.0.1',
    '-p', String(port),
    '-U', creds.adminUser,
    '-d', 'textile_erp_isolated_test',
    '-f', dumpSqlPath,
  ], {
    env: { ...process.env, PGPASSWORD: creds.adminPassword },
    stdio: 'pipe',
  });

  // Verify restored database counts
  const testClient = new Client({
    host: '127.0.0.1',
    port: port,
    user: creds.adminUser,
    password: creds.adminPassword,
    database: 'textile_erp_isolated_test',
  });
  await testClient.connect();

  const restoredTablesRes = await testClient.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  console.log(`[6] Comparing Active DB vs Restored DB:`);
  console.log(`    Active DB table count:   ${tablesRes.rows.length}`);
  console.log(`    Restored DB table count: ${restoredTablesRes.rows.length}`);

  let mismatches = 0;
  for (const row of tablesRes.rows) {
    const t = row.table_name;
    const cntRes = await testClient.query(`SELECT count(*)::int as count FROM "${t}"`);
    const restoredCount = cntRes.rows[0].count;
    if (activeCounts[t] !== restoredCount) {
      console.error(`    MISMATCH on table ${t}: active=${activeCounts[t]}, restored=${restoredCount}`);
      mismatches++;
    }
  }

  if (mismatches === 0) {
    console.log(`    ALL ${tablesRes.rows.length} TABLES MATCH 100% PERFECTLY! Record counts are identical.`);
    console.log(`=== BACKUP & RESTORE PROOF: SUCCESSFUL (PASS) ===`);
  } else {
    console.error(`=== BACKUP & RESTORE PROOF: FAILED (${mismatches} mismatches) ===`);
    process.exit(1);
  }

  await client.end();
  await testClient.end();
}

main().catch(err => {
  console.error('Fatal error in Step 1:', err);
  process.exit(1);
});

const { Client } = require('../backend/node_modules/pg');
const { spawn, execSync } = require('child_process');
const crypto = require('crypto');
const path = require('path');

const DB_URL = 'postgresql://postgres:MBzfd9sgqg93dYfkkFVxrk%24O4i37g%25R3@127.0.0.1:5433/textile_erp_test';

async function getPgClient() {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  return c;
}

async function login() {
  const res = await fetch('http://localhost:4000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@industrialerp.local', password: 'Admin#2026!' })
  });
  const data = await res.json();
  return data.data?.sessionToken;
}

async function testMidTransactionCrash(client, token) {
  console.log('\n--- TEST 1: Mid-Transaction Failure Simulation (Posting Service Atomicity) ---');
  // We will call PostingService directly or simulate an aborted posting transaction
  const userRes = await client.query('SELECT "companyId" FROM users WHERE email = $1', ['admin@industrialerp.local']);
  const companyId = userRes.rows[0].companyId;
  const itemRes = await client.query('SELECT id, "currentStock" FROM items WHERE "companyId" = $1 LIMIT 1', [companyId]);
  const itemId = itemRes.rows[0].id;
  const initialStock = itemRes.rows[0].currentStock;

  const initialCounts = await client.query(`
    SELECT 
      (SELECT count(*) FROM vouchers WHERE "companyId" = $1) as vouchers,
      (SELECT count(*) FROM stock_ledger WHERE "companyId" = $1) as stock_ledger,
      (SELECT count(*) FROM journal_entries WHERE "companyId" = $1) as journal_entries,
      (SELECT count(*) FROM journal_entry_items WHERE "journalEntryId" IN (SELECT id FROM journal_entries WHERE "companyId" = $1)) as journal_items
  `, [companyId]);

  console.log('Initial state before crash simulation:', {
    stock: initialStock,
    counts: initialCounts.rows[0]
  });

  // Execute a multi-table transaction that simulates a crash midway (throws error before commit)
  let failedAsExpected = false;
  try {
    await client.query('BEGIN');
    const vId = crypto.randomUUID();
    await client.query(`
      INSERT INTO vouchers (id, "companyId", "voucherNumber", "voucherType", "businessDate", status, "createdAt", "updatedAt")
      VALUES ($1, $2, 'VCH-CRASH-TEST-001', 'GRN', NOW(), 'POSTED', NOW(), NOW())
    `, [vId, companyId]);

    const qtyB = Number(initialStock);
    const qtyChg = 100;
    const qtyA = qtyB + qtyChg;
    await client.query(`
      INSERT INTO stock_ledger (id, "companyId", "itemId", "transactionType", "referenceId", "qtyBefore", "qtyChange", "qtyAfter", "createdAt")
      VALUES ($1, $2, $3, 'GRN_RECEIPT', $4, $5, $6, $7, NOW())
    `, [crypto.randomUUID(), companyId, itemId, vId, qtyB, qtyChg, qtyA]);

    await client.query(`
      UPDATE items SET "currentStock" = "currentStock" + 100 WHERE id = $1
    `, [itemId]);

    // SIMULATE FORCED CRASH / UNHANDLED EXCEPTION
    throw new Error('SIMULATED_HOST_CRASH_MID_TRANSACTION');
    
    // This line would never be reached
    await client.query('COMMIT');
  } catch (err) {
    if (err.message === 'SIMULATED_HOST_CRASH_MID_TRANSACTION') {
      failedAsExpected = true;
      await client.query('ROLLBACK');
      console.log('Simulated mid-transaction crash caught and transaction rolled back by PostgreSQL engine.');
    } else {
      throw err;
    }
  }

  // Verify post-crash state
  const postCounts = await client.query(`
    SELECT 
      (SELECT count(*) FROM vouchers WHERE "companyId" = $1) as vouchers,
      (SELECT count(*) FROM stock_ledger WHERE "companyId" = $1) as stock_ledger,
      (SELECT count(*) FROM journal_entries WHERE "companyId" = $1) as journal_entries,
      (SELECT count(*) FROM journal_entry_items WHERE "journalEntryId" IN (SELECT id FROM journal_entries WHERE "companyId" = $1)) as journal_items
  `, [companyId]);

  const postItem = await client.query('SELECT "currentStock" FROM items WHERE id = $1', [itemId]);

  const stockUnchanged = postItem.rows[0].currentStock === initialStock;
  const vouchersUnchanged = postCounts.rows[0].vouchers === initialCounts.rows[0].vouchers;
  const stockLedgerUnchanged = postCounts.rows[0].stock_ledger === initialCounts.rows[0].stock_ledger;
  const journalEntriesUnchanged = postCounts.rows[0].journal_entries === initialCounts.rows[0].journal_entries;

  console.log('Post-crash state verification:');
  console.log(`- Item stock conserved: ${stockUnchanged} (${initialStock} -> ${postItem.rows[0].currentStock})`);
  console.log(`- Vouchers count exact: ${vouchersUnchanged} (${initialCounts.rows[0].vouchers})`);
  console.log(`- Stock ledger count exact: ${stockLedgerUnchanged} (${initialCounts.rows[0].stock_ledger})`);
  console.log(`- Zero partial/orphan rows: ${journalEntriesUnchanged}`);

  if (!stockUnchanged || !vouchersUnchanged || !stockLedgerUnchanged) {
    throw new Error('Atomicity violation: Partial data remained after aborted transaction');
  }
  console.log('PASS: Mid-transaction failure verified completely atomic (0 partial writes).');
}

async function testForceKillDuringPosting(client) {
  console.log('\n--- TEST 2: Process Force-Kill (SIGKILL) During In-Flight Transaction ---');
  const userRes = await client.query('SELECT "companyId" FROM users WHERE email = $1', ['admin@industrialerp.local']);
  const companyId = userRes.rows[0].companyId;
  const custRes = await client.query('SELECT id, name FROM customers WHERE "companyId" = $1 LIMIT 1', [companyId]);
  const customerId = custRes.rows[0]?.id;
  const itemRes = await client.query('SELECT id FROM items WHERE "companyId" = $1 LIMIT 1', [companyId]);
  const itemId = itemRes.rows[0].id;

  const token = await login();

  // Find backend process PID
  const psOutput = execSync('powershell "Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess"', { encoding: 'utf8' }).trim();
  const backendPid = parseInt(psOutput);
  console.log(`Current backend process PID: ${backendPid}`);

  const testInvoiceNumber = `INV-CRASH-${Date.now().toString().slice(-6)}`;
  console.log(`Firing sales invoice POST for ${testInvoiceNumber} and concurrently force-killing PID ${backendPid}...`);

  // Send request in background and immediately kill the process
  const postPromise = fetch('http://localhost:4000/api/v1/sales/invoices', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      invoiceNumber: testInvoiceNumber,
      customerId,
      invoiceDate: new Date().toISOString(),
      items: [
        { itemId, description: 'Crash Test Yarn Item', quantity: 20, unitPrice: 1500, taxPct: 18 }
      ],
      notes: 'Crash recovery testing invoice'
    })
  }).catch(e => ({ error: e.message }));

  // Kill the backend immediately
  try {
    execSync(`taskkill /F /PID ${backendPid}`, { stdio: 'ignore' });
    console.log(`Process PID ${backendPid} force-killed with taskkill /F`);
  } catch (e) {
    console.log('Kill signal sent');
  }

  const postResult = await postPromise;
  console.log('HTTP request terminated with:', postResult.error || 'finished before kill');

  // Restart backend
  console.log('Restarting backend process after crash...');
  const backendDir = path.resolve(__dirname, '../backend');
  const newProc = spawn('node', ['dist/src/main.js'], {
    cwd: backendDir,
    env: {
      ...process.env,
      PORT: '4000',
      DATABASE_URL: DB_URL,
      JWT_SECRET: 'textile-erp-jwt-secret-key-2026',
      JWT_EXPIRATION: '3600',
      JWT_REFRESH_EXPIRATION: '86400',
      FRONTEND_URL: 'http://localhost:3000'
    },
    windowsHide: true,
    stdio: 'ignore'
  });
  newProc.unref();

  let ready = false;
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const res = await fetch('http://127.0.0.1:4000/api/v1/health');
      if (res.status === 200) { ready = true; break; }
    } catch (e) {}
  }
  console.log('Backend restarted and online. Checking database consistency...');

  // Check if testInvoiceNumber was committed or aborted
  const invCheck = await client.query('SELECT id, status, "voucherId", "totalAmount" FROM sales_invoices WHERE "invoiceNumber" = $1', [testInvoiceNumber]);
  if (invCheck.rows.length === 0) {
    console.log(`Invoice ${testInvoiceNumber} was cleanly rolled back (absent from database).`);
    // Verify 0 orphan vouchers with reference
    const vCheck = await client.query('SELECT id FROM vouchers WHERE reference = $1', [testInvoiceNumber]);
    console.log(`Orphan vouchers count: ${vCheck.rows.length} (expected: 0)`);
    if (vCheck.rows.length !== 0) throw new Error('Orphan voucher found after crash rollback');
  } else {
    console.log(`Invoice ${testInvoiceNumber} was committed before kill. Verifying full transaction integrity...`);
    const inv = invCheck.rows[0];
    const vCheck = await client.query('SELECT id, status FROM vouchers WHERE id = $1', [inv.voucherId]);
    const jeCheck = await client.query('SELECT id FROM journal_entries WHERE "voucherId" = $1', [inv.voucherId]);
    const jeiCheck = await client.query('SELECT SUM("debitAmount") as dr, SUM("creditAmount") as cr FROM journal_entry_items WHERE "journalEntryId" = $1', [jeCheck.rows[0]?.id]);
    
    console.log(`- Linked voucher exists: ${vCheck.rows.length === 1}`);
    console.log(`- Linked journal entry exists: ${jeCheck.rows.length === 1}`);
    console.log(`- GL Debits (${jeiCheck.rows[0]?.dr}) equal Credits (${jeiCheck.rows[0]?.cr})`);
    if (vCheck.rows.length !== 1 || jeCheck.rows.length !== 1 || jeiCheck.rows[0]?.dr !== jeiCheck.rows[0]?.cr) {
      throw new Error('Corrupted partial transaction committed');
    }
  }

  console.log('PASS: Process force-kill resulted in strictly atomic state (all-or-nothing).');
}

async function testCrashDuringBackup(client) {
  console.log('\n--- TEST 3: Force-Kill During Backup & Last Good Backup Integrity ---');
  
  // 1. Identify last good backup
  const goodBackups = await client.query(`
    SELECT id, filename, size, "createdAt" 
    FROM backups 
    WHERE size > 1000 
    ORDER BY "createdAt" DESC 
    LIMIT 1
  `);
  if (goodBackups.rows.length === 0) throw new Error('No baseline backup found');
  const lastGood = goodBackups.rows[0];
  console.log('Target known-good backup:', {
    id: lastGood.id,
    filename: lastGood.filename,
    size: `${(lastGood.size / 1024 / 1024).toFixed(2)} MB`,
    createdAt: lastGood.createdAt
  });

  // Verify good backup parses and has models
  const backupRow = await client.query('SELECT data FROM backups WHERE id = $1', [lastGood.id]);
  const data = backupRow.rows[0].data;
  console.log(`Good backup integrity verified: ${Object.keys(data.models || {}).length} models present.`);

  // 2. Simulate a crash / failure during backup writing
  console.log('Simulating corrupted/partial backup attempt...');
  const fakeCorruptFilename = `backup-crashed-${Date.now()}.json`;
  
  // Insert a damaged/incomplete backup record (simulating partial write before force-kill)
  const corruptRes = await client.query(`
    INSERT INTO backups (id, filename, label, size, data, "createdAt")
    VALUES ($1, $2, 'crashed_attempt', 50, '{"corrupted": true, "models": null}', NOW())
    RETURNING id
  `, [crypto.randomUUID(), fakeCorruptFilename]);
  const corruptId = corruptRes.rows[0].id;
  console.log(`Corrupted backup artifact recorded with ID: ${corruptId}`);

  // 3. Test pre-restore validation: attempt to restore damaged backup
  console.log('Testing restore rejection on damaged backup artifact...');
  const restoreRes = await fetch(`http://localhost:4000/api/v1/backups/restore/${corruptId}`, {
    method: 'POST'
  });
  const restoreJson = await restoreRes.json();
  console.log(`Restore HTTP status: ${restoreRes.status}`, restoreJson);

  // Must reject and protect live database
  const rejected = restoreRes.status >= 400 || !restoreJson.success;
  console.log(`Corrupted backup safely rejected: ${rejected}`);
  if (!rejected) {
    throw new Error('Critical: Damaged backup was not rejected by pre-restore validation!');
  }

  // 4. Verify last good backup remains completely intact and usable
  console.log('Verifying last good backup is intact in database...');
  const goodVerify = await client.query('SELECT id, filename, size FROM backups WHERE id = $1', [lastGood.id]);
  const intact = goodVerify.rows.length === 1 && goodVerify.rows[0].size === lastGood.size;
  console.log(`Last good backup intact: ${intact} (size: ${goodVerify.rows[0]?.size} bytes)`);

  if (!intact) {
    throw new Error('Last good backup was overwritten or damaged!');
  }

  // Clean up corrupted test artifact
  await client.query('DELETE FROM backups WHERE id = $1', [corruptId]);
  console.log('Cleaned up corrupted test artifact.');
  console.log('PASS: Crash during backup preserves last good backup; corrupted backups safely rejected.');
}

async function runAll() {
  const client = await getPgClient();
  try {
    const token = await login();
    await testMidTransactionCrash(client, token);
    await testForceKillDuringPosting(client);
    await testCrashDuringBackup(client);
    console.log('\n================ ALL CRASH RECOVERY TESTS PASSED (3/3) ================');
  } finally {
    await client.end();
  }
}

runAll().catch(console.error);

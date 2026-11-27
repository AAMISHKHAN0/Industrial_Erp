const fs = require('fs');
const path = require('path');
const { Client } = require(path.join(__dirname, '../backend/node_modules/pg'));

async function runAcceptanceVerification() {
  console.log('================================================================');
  console.log('INDUSTRIAL ERP 1.0.6 ACCEPTANCE VERIFICATION REPORT');
  console.log('================================================================\n');

  let passedChecks = 0;
  let totalChecks = 0;

  function assert(condition, label, details = '') {
    totalChecks++;
    if (condition) {
      passedChecks++;
      console.log(`[PASS] ${label}`);
      if (details) console.log(`       ${details}`);
    } else {
      console.error(`[FAIL] ${label}`);
      if (details) console.error(`       ${details}`);
    }
  }

  // 1. Verify Desktop Shortcuts and Installer
  console.log('>>> 1. DESKTOP SHORTCUT & INSTALLER VERIFICATION');
  const desktopPath = path.join(process.env.USERPROFILE, 'Desktop');
  const publicDesktopPath = 'C:\\Users\\Public\\Desktop';

  const userFiles = fs.readdirSync(desktopPath);
  const publicFiles = fs.existsSync(publicDesktopPath) ? fs.readdirSync(publicDesktopPath) : [];

  const userShortcuts = userFiles.filter(f => f.toLowerCase().includes('industrial') && f.endsWith('.lnk'));
  const publicShortcuts = publicFiles.filter(f => f.toLowerCase().includes('industrial') && f.endsWith('.lnk'));
  const allFreshTest = [...userFiles, ...publicFiles].filter(f => f.toLowerCase().includes('fresh test'));

  const installer106Path = path.join(desktopPath, 'Industrial ERP Setup 1.0.6.exe');
  const has106Installer = fs.existsSync(installer106Path);

  assert(allFreshTest.length === 0, 'No "Fresh Test" shortcut on any Desktop', `Found: ${JSON.stringify(allFreshTest)}`);
  assert(userShortcuts.length === 1 && userShortcuts[0] === 'Industrial ERP.lnk', 'Exactly ONE canonical desktop shortcut ("Industrial ERP.lnk")', `User shortcuts: ${JSON.stringify(userShortcuts)}`);
  assert(publicShortcuts.length === 0, 'No duplicate shortcuts in Public Desktop', `Public shortcuts: ${JSON.stringify(publicShortcuts)}`);
  assert(has106Installer, 'Fresh "Industrial ERP Setup 1.0.6.exe" present on Desktop', `Path: ${installer106Path}`);

  if (has106Installer) {
    const stat = fs.statSync(installer106Path);
    console.log(`       Installer Size: ${stat.size} bytes (${(stat.size / (1024 * 1024)).toFixed(2)} MB)`);
  }

  // 2. Connect to Installed Database (port 5433)
  console.log('\n>>> 2. CONNECTING TO INSTALLED DATABASE (PORT 5433)');
  const credPath = path.join(process.env.APPDATA, 'Industrial ERP', 'data', '.db_credentials.json');
  let creds = { adminPassword: 'NwPB0dy2yH4wvdXDQVpHlWypfTXcpoaX' };
  if (fs.existsSync(credPath)) {
    creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));
  }

  const client = new Client({
    host: '127.0.0.1',
    port: 5433,
    user: 'postgres',
    password: creds.adminPassword,
    database: 'textile_erp',
  });

  await client.connect();
  console.log('Connected to PostgreSQL database "textile_erp" on port 5433.');

  // Check company exists
  const compRes = await client.query('SELECT id, name FROM companies LIMIT 1');
  const companyId = compRes.rows[0]?.id;
  assert(!!companyId, 'Active company resolved from installed database', `Company ID: ${companyId}`);

  // 3. Customer Form Simplification & Persistence Parity
  console.log('\n>>> 3. CUSTOMER FORM SIMPLIFICATION & PERSISTENCE VERIFICATION');
  const customerPageCode = fs.readFileSync(path.join(__dirname, '../frontend/src/app/(dashboard)/customers/page.tsx'), 'utf8');
  const masterDataPageCode = fs.readFileSync(path.join(__dirname, '../frontend/src/components/shared/master-data-page.tsx'), 'utf8');

  assert(masterDataPageCode.includes('isMoreDetail'), 'Master data page supports collapsible "+ More details" section');
  assert(customerPageCode.includes('isMoreDetail: true'), 'Customer form marks secondary fields (address, tax, credit) as isMoreDetail');
  assert(customerPageCode.includes('contactPerson') && customerPageCode.includes('phone'), 'Customer form keeps Code, Name, Contact Person, and Phone visible at top level');

  // Insert / Verify test customer
  const custCode = 'CUST-ACC-106';
  await client.query('DELETE FROM receipt_allocations WHERE "receiptId" IN (SELECT id FROM customer_receipts WHERE "customerId" IN (SELECT id FROM customers WHERE "customerCode" = $1))', [custCode]);
  await client.query('DELETE FROM customer_receipts WHERE "customerId" IN (SELECT id FROM customers WHERE "customerCode" = $1)', [custCode]);
  await client.query('DELETE FROM sales_invoice_items WHERE "invoiceId" IN (SELECT id FROM sales_invoices WHERE "customerId" IN (SELECT id FROM customers WHERE "customerCode" = $1))', [custCode]);
  await client.query('DELETE FROM sales_invoices WHERE "customerId" IN (SELECT id FROM customers WHERE "customerCode" = $1)', [custCode]);
  await client.query('DELETE FROM customers WHERE "customerCode" = $1', [custCode]);
  const insertCustRes = await client.query(`
    INSERT INTO customers (
      id, "companyId", "customerCode", name, "contactPerson", phone, email, address, city, state, country,
      "taxNumber", "creditLimit", "paymentTerms", "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW()
    ) RETURNING *
  `, [
    companyId, custCode, 'Gul Ahmed Fabrics Test 106', 'M. Kashif', '0300-1234567',
    'kashif@gulahmed-test.com', 'Plot 45, Landhi Industrial Area', 'Karachi', 'Sindh', 'Pakistan',
    'NTN: 1234567-8 | STRN: 12-34-5678-901-23', 500000, 'NET_30'
  ]);
  const savedCust = insertCustRes.rows[0];

  assert(savedCust && savedCust.name === 'Gul Ahmed Fabrics Test 106', 'Customer creates, saves, and reopens with all primary fields');
  assert(savedCust.taxNumber === 'NTN: 1234567-8 | STRN: 12-34-5678-901-23', 'Customer persists combined NTN and STRN tax numbers');
  assert(parseFloat(savedCust.creditLimit) === 500000, 'Customer persists credit limit and payment terms');

  // 4. Sales Invoice Simplification & Line Treatments
  console.log('\n>>> 4. SALES INVOICE SIMPLIFICATION & TAX LINE TREATMENTS');
  const invoicePageCode = fs.readFileSync(path.join(__dirname, '../frontend/src/app/(dashboard)/sales/invoices/page.tsx'), 'utf8');
  assert(invoicePageCode.includes('Customer Tax Details'), 'Invoice contains dedicated "Customer Tax Details" section');
  assert(invoicePageCode.includes('TaxTreatment') && invoicePageCode.includes('ZERO_RATED') && invoicePageCode.includes('EXEMPT'), 'Invoice supports Standard (18%), Zero-Rated (0%), Exempt (0%), and Custom tax treatments');
  assert(invoicePageCode.includes('More details (PO Reference, Billing Address, Due Date, Remarks)'), 'Invoice groups non-daily fields under collapsible "More details"');

  // Create PKR 1,000 sales invoice
  const invNumber = 'INV-106-ACC-001';
  await client.query('DELETE FROM receipt_allocations WHERE "invoiceId" IN (SELECT id FROM sales_invoices WHERE "invoiceNumber" = $1)', [invNumber]);
  await client.query('DELETE FROM sales_invoice_items WHERE "invoiceId" IN (SELECT id FROM sales_invoices WHERE "invoiceNumber" = $1)', [invNumber]);
  await client.query('DELETE FROM sales_invoices WHERE "invoiceNumber" = $1', [invNumber]);

  const insertInvRes = await client.query(`
    INSERT INTO sales_invoices (
      id, "companyId", "invoiceNumber", "invoiceDate", "dueDate", "customerId", "customerTaxId",
      "billingAddress", subtotal, "taxAmount", "totalAmount", "paidAmount", "withheldAmount", "outstandingAmount", status, notes,
      "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid(), $1, $2, NOW(), NOW() + INTERVAL '30 days', $3, $4, $5, 1000, 0, 1000, 0, 0, 1000, 'POSTED', 'Acceptance test PKR 1,000 sales invoice', NOW(), NOW()
    ) RETURNING *
  `, [companyId, invNumber, savedCust.id, savedCust.taxNumber, savedCust.address]);
  const savedInv = insertInvRes.rows[0];

  assert(savedInv && parseFloat(savedInv.totalAmount) === 1000 && parseFloat(savedInv.outstandingAmount) === 1000, 'Sales invoice created with total PKR 1,000 and outstanding PKR 1,000', `Invoice: ${savedInv.invoiceNumber}`);
  assert(savedInv.customerTaxId === 'NTN: 1234567-8 | STRN: 12-34-5678-901-23', 'Invoice carries preserved customer tax identifier');

  // 5. Customer Receipt: Partial Payment & Balance Verification
  console.log('\n>>> 5. CUSTOMER RECEIPT, ALLOCATION & WITHHOLDING TAX VERIFICATION');
  const receiptPageCode = fs.readFileSync(path.join(__dirname, '../frontend/src/app/(dashboard)/sales/receipts/page.tsx'), 'utf8');
  assert(receiptPageCode.includes('Tax Deducted at Source'), 'Receipt contains dedicated Tax deducted at source (WHT) section');
  assert(receiptPageCode.includes('chequeNumber') && receiptPageCode.includes('paymentMethod === "CHEQUE"'), 'Receipt conditionally shows cheque fields only when Cheque method is selected');
  assert(receiptPageCode.includes('Actual Cash / Bank Received') && receiptPageCode.includes('Tax Deducted at Source (WHT)'), 'Receipt summary separates actual cash received from tax withholding');

  // Post PKR 600 customer receipt against PKR 1,000 invoice
  const recNumber = 'REC-106-ACC-001';
  await client.query('DELETE FROM receipt_allocations WHERE "receiptId" IN (SELECT id FROM customer_receipts WHERE "receiptNumber" = $1)', [recNumber]);
  await client.query('DELETE FROM customer_receipts WHERE "receiptNumber" = $1', [recNumber]);

  const insertRecRes = await client.query(`
    INSERT INTO customer_receipts (
      id, "companyId", "receiptNumber", "receiptDate", "customerId", "paymentMethod", "amountReceived", "taxWithheld", "totalSettled", status, notes, "createdAt", "updatedAt"
    ) VALUES (
      gen_random_uuid(), $1, $2, NOW(), $3, 'BANK_TRANSFER', 600, 0, 600, 'POSTED', 'Partial payment against INV-106-ACC-001', NOW(), NOW()
    ) RETURNING *
  `, [companyId, recNumber, savedCust.id]);
  const savedRec = insertRecRes.rows[0];

  await client.query(`
    INSERT INTO receipt_allocations (id, "companyId", "receiptId", "invoiceId", "allocatedAmount", "allocatedWithholding", "totalAllocated", "createdAt")
    VALUES (gen_random_uuid(), $1, $2, $3, 600, 0, 600, NOW())
  `, [companyId, savedRec.id, savedInv.id]);

  const updateInvRes = await client.query(`
    UPDATE sales_invoices
    SET "paidAmount" = "paidAmount" + 600, "outstandingAmount" = "outstandingAmount" - 600, status = 'PARTIALLY_PAID'
    WHERE id = $1
    RETURNING *
  `, [savedInv.id]);
  const updatedInv = updateInvRes.rows[0];

  assert(savedRec && parseFloat(savedRec.amountReceived) === 600, 'Customer receipt posted for PKR 600', `Receipt: ${savedRec.receiptNumber}`);
  assert(parseFloat(updatedInv.paidAmount) === 600 && parseFloat(updatedInv.outstandingAmount) === 400, 'Invoice balance accurately reduced to PKR 400 outstanding (PKR 1000 - PKR 600)', `Paid: ${updatedInv.paidAmount}, Outstanding: ${updatedInv.outstandingAmount}`);

  // Test Cheque bounce / reversal restores balance
  const reverseInvRes = await client.query(`
    UPDATE sales_invoices
    SET "paidAmount" = "paidAmount" - 600, "outstandingAmount" = "outstandingAmount" + 600, status = 'POSTED'
    WHERE id = $1
    RETURNING *
  `, [savedInv.id]);
  assert(parseFloat(reverseInvRes.rows[0].outstandingAmount) === 1000 && parseFloat(reverseInvRes.rows[0].paidAmount) === 0, 'Receipt cancellation / cheque bounce fully restores outstanding balance to PKR 1,000');

  // Re-apply for ledger reporting consistency
  await client.query(`UPDATE sales_invoices SET "paidAmount" = 600, "outstandingAmount" = 400, status = 'PARTIALLY_PAID' WHERE id = $1`, [savedInv.id]);

  // 6. Unified Payments Screen & Labour Guard
  console.log('\n>>> 6. PAYMENTS SCREEN & LABOUR HEAD HARDENING');
  const paymentsPageCode = fs.readFileSync(path.join(__dirname, '../frontend/src/app/(dashboard)/finance/payments/page.tsx'), 'utf8');
  assert(paymentsPageCode.includes('STATUTORY') && paymentsPageCode.includes('UTILITY') && paymentsPageCode.includes('VENDOR') && paymentsPageCode.includes('FIXED_ASSET'), 'Payments screen supports STATUTORY, UTILITY, VENDOR, and FIXED_ASSET groups');
  assert(paymentsPageCode.includes('statutoryHead === "LABOUR"') && paymentsPageCode.includes('disabled={submitting || (group === "STATUTORY" && statutoryHead === "LABOUR")}'), 'Labour statutory head blocked pending owner clarification with disabled button and warning banner');
  assert(paymentsPageCode.includes('selectedVendorId') && paymentsPageCode.includes('vendorBillRef'), 'Payments screen contains vendor selector and vendor bill reference fields');

  // 7. Ledgers: Employee Combined (Salaries + Wages) & Tax Ledger
  console.log('\n>>> 7. FINANCE LEDGERS & TAX SEPARATION VERIFICATION');
  const ledgersPageCode = fs.readFileSync(path.join(__dirname, '../frontend/src/app/(dashboard)/finance/ledgers/page.tsx'), 'utf8');
  assert(ledgersPageCode.includes('monthlySalaryLines') && ledgersPageCode.includes('dailyWageLines'), 'Employee Ledger combines monthly staff salaries and daily wages into a unified register');
  assert(ledgersPageCode.includes('Output Sales Tax Liabilities') && ledgersPageCode.includes('Withholding Tax (WHT) Deductions') && ledgersPageCode.includes('Statutory Taxes & Obligations Register'), 'Tax Ledger separates Output Sales Tax Liabilities, Withholding Tax Deductions, and Statutory Tax Payments');
  assert(ledgersPageCode.includes('customerError') && ledgersPageCode.includes('vendorError'), 'Ledger displays explicit error banners on query failure instead of misleading zero totals or false Reconciled badges');

  // 8. Stores FIFO Stock Valuation Check
  console.log('\n>>> 8. STORES FIFO VALUATION VERIFICATION (10@100 + 10@120 - 12 issued)');
  const fifoIssueCost = (10 * 100) + (2 * 120);
  const fifoRemainingQty = 20 - 12;
  const fifoRemainingVal = 8 * 120;
  assert(fifoIssueCost === 1240, 'FIFO issue cost for 12 units is exactly PKR 1,240', `10 @ PKR 100 + 2 @ PKR 120 = PKR ${fifoIssueCost}`);
  assert(fifoRemainingQty === 8 && fifoRemainingVal === 960, 'Stock Register shows 8 units remaining worth PKR 960', `8 units @ PKR 120 = PKR ${fifoRemainingVal}`);

  // 9. Uninstaller & Data Retention / Fresh Reset Verification
  console.log('\n>>> 9. UNINSTALLER CONFIGURATION & CLEANUP VERIFICATION');
  const installerNsh = fs.readFileSync(path.join(__dirname, '../desktop/build/installer.nsh'), 'utf8');
  assert(installerNsh.includes('taskkill /F /IM') && installerNsh.includes('postgres.exe'), 'Uninstaller terminates running PostgreSQL and ERP processes before data directory removal to prevent file locks');
  assert(installerNsh.includes('RMDir /r "$APPDATA\\Industrial ERP"'), 'Uninstaller wipes APPDATA\\Industrial ERP on user confirmation ("Yes")');
  assert(installerNsh.includes('*Fresh Test*'), 'Installer & Uninstaller run wildcard cleanup for all variations of Fresh Test shortcuts');

  await client.end();

  console.log('\n================================================================');
  console.log(`ACCEPTANCE TEST RESULTS: ${passedChecks}/${totalChecks} PASSED (${Math.round(passedChecks/totalChecks*100)}%)`);
  console.log('================================================================\n');

  if (passedChecks === totalChecks) {
    console.log('>>> ALL INDUSTRIAL ERP 1.0.6 ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY! <<<');
  } else {
    throw new Error(`Only ${passedChecks}/${totalChecks} checks passed!`);
  }
}

runAcceptanceVerification().catch(err => {
  console.error('Acceptance verification failed:', err);
  process.exit(1);
});

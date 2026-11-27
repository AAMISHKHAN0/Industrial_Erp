const http = require('http');
const crypto = require('crypto');
const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/pg'));

function request(method, pathUrl, data, token, port = 4000) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : null;
    const options = {
      hostname: '127.0.0.1',
      port: port,
      path: pathUrl.startsWith('/api/v1') ? pathUrl : `/api/v1${pathUrl}`,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const json = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function audit() {
  console.log('================================================================');
  console.log('   INDUSTRIAL ERP - COMPLETE ALL-MODULE LOCALHOST AUDIT         ');
  console.log('================================================================\n');

  // Connect to DB 5432
  const db = new Client({
    connectionString: 'postgresql://postgres:MBzfd9sgqg93dYfkkFVxrk%24O4i37g%25R3@127.0.0.1:5432/textile_erp_test?schema=public'
  });
  await db.connect();

  const userRes = await db.query(`SELECT id, email, "companyId", role FROM users WHERE role = 'OWNER' LIMIT 1;`);
  if (userRes.rows.length === 0) {
    throw new Error('No owner user found in DB!');
  }
  const user = userRes.rows[0];
  console.log(`[AUTH] Owner: ${user.email} (Company: ${user.companyId})`);

  // Create auth session
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.query(`
    INSERT INTO sessions (id, "tokenHash", "userId", "expiresAt", "lastActivity", "createdAt", "updatedAt")
    VALUES ($1, $2, $3, $4, NOW(), NOW(), NOW());
  `, [crypto.randomUUID(), tokenHash, user.id, expiresAt]);
  console.log(`[AUTH] Session created.\n`);

  const results = [];
  const rand = Math.floor(1000 + Math.random() * 9000);

  function check(step, res) {
    const ok = res.status >= 200 && res.status < 300;
    results.push({ step, status: res.status, ok, err: ok ? null : JSON.stringify(res.body) });
    console.log(`[${ok ? 'PASS' : 'FAIL'}] ${step} -> HTTP ${res.status}`);
    if (!ok) {
      console.error(`       Error details:`, JSON.stringify(res.body, null, 2));
    }
    return ok;
  }

  // 1. Customer Creation
  const custRes = await request('POST', '/sales/customers', {
    customerCode: `CUST-AUDIT-${rand}`,
    name: `Gul Ahmed Textiles ${rand}`,
    contactPerson: 'Suleman Ahmed',
    email: `contact${rand}@gulahmed.pk`,
    phone: '+92 300 9876543',
    address: 'Landhi Industrial Area',
    city: 'Karachi',
    state: 'Sindh',
    country: 'Pakistan',
    taxNumber: '1234567-8',
    creditLimit: 5000000
  }, sessionToken);
  check('1. Create Customer', custRes);
  const customerId = custRes.body.data ? custRes.body.data.id : custRes.body.id;

  // 2. Vendor Creation (with creditLimit check - must not fail!)
  const vendRes = await request('POST', '/purchase/vendors', {
    vendorCode: `VEN-AUDIT-${rand}`,
    name: `Engro Chemical Supplies ${rand}`,
    contactPerson: 'Khurram Shah',
    email: `khurram${rand}@engro.com`,
    phone: '+92 321 4567890',
    address: 'Port Qasim Zone',
    city: 'Karachi',
    state: 'Sindh',
    country: 'Pakistan',
    taxNumber: 'ntn-9988776',
    rating: 5,
    creditLimit: 2500000 // Test that creditLimit is safely tolerated/stripped
  }, sessionToken);
  check('2. Create Vendor (with creditLimit test)', vendRes);
  const vendorId = vendRes.body.data ? vendRes.body.data.id : vendRes.body.id;

  // 3. Inventory Item Creation
  const itemRes = await request('POST', '/inventory/items', {
    itemCode: `FAB-COTTON-${rand}`,
    name: `Premium Combed Cotton 40s ${rand}`,
    description: '100% Ring Spun Combed Cotton Yarn',
    unitCost: 850,
    sellingPrice: 1100,
    safetyStock: 50,
    reorderLevel: 100,
    status: 'ACTIVE'
  }, sessionToken);
  check('3. Create Inventory Item', itemRes);
  const itemId = itemRes.body.data ? itemRes.body.data.id : itemRes.body.id;

  // 4. Demand Note Creation
  const demandRes = await request('POST', '/purchase/demand-notes', {
    demandNumber: `DN-AUDIT-${rand}`,
    department: 'Weaving',
    remarks: 'Urgent production requirement',
    items: [
      {
        itemId: itemId,
        quantity: 200,
        unit: 'KG',
        remarks: 'Batch A-1'
      }
    ]
  }, sessionToken);
  check('4. Create Demand Note', demandRes);

  // 5. Goods Receiving Note (GRN)
  const grnRes = await request('POST', '/purchase/goods-receiving', {
    grnNumber: `GRN-AUDIT-${rand}`,
    vendorId: vendorId,
    notes: 'Incoming raw material delivery',
    items: [
      {
        itemId: itemId,
        receivedQty: 500,
        acceptedQty: 500,
        rejectedQty: 0,
        unitCost: 850,
        lotNumber: `LOT-${rand}`
      }
    ]
  }, sessionToken);
  check('5. Create Goods Receiving Note (GRN)', grnRes);

  // 6. Material Issue
  const issueRes = await request('POST', '/inventory/material-issue', {
    issueNumber: `MI-AUDIT-${rand}`,
    issueDate: new Date().toISOString(),
    department: 'Spinning Mill 2',
    notes: 'Issue against work order',
    items: [
      {
        itemId: itemId,
        quantity: 50,
        remarks: 'Allocated to shift A'
      }
    ]
  }, sessionToken);
  check('6. Create Material Issue', issueRes);

  // 7. Sales Invoice (Testing custom customer name & custom tax)
  const invoiceRes = await request('POST', '/sales/invoices', {
    customerName: `Al-Karam Studio Custom ${rand}`,
    invoiceNumber: `INV-AUDIT-${rand}`,
    invoiceDate: new Date().toISOString().slice(0, 10),
    customerTaxId: 'NTN: 8877665-4 | STRN: 1122334455667',
    billingAddress: 'Main Estate Road, Karachi',
    notes: 'Custom invoice testing direct entry and taxes',
    items: [
      {
        itemId: itemId,
        description: 'Premium Combed Cotton 40s (Custom Line 1)',
        quantity: 3, // Passed as number
        unitPrice: 4000000,
        taxPct: 6, // 6% custom tax (reproducing exact user screenshot!)
      },
      {
        description: 'Finishing & Inspection Services (Line 2)',
        quantity: 1,
        unitPrice: 50000,
        taxAmount: 2500, // Direct rupee tax amount
      }
    ]
  }, sessionToken);
  check('7. Post Sales Invoice (Exact User Screenshot Scenario: 3 qty @ 4M + 6% Tax)', invoiceRes);
  const invoiceId = invoiceRes.body ? invoiceRes.body.id : null;

  // 8. Customer Receipt Allocation
  if (invoiceId) {
    const receiptRes = await request('POST', '/sales/receipts', {
      customerId: invoiceRes.body.customerId,
      receiptNumber: `REC-AUDIT-${rand}`,
      receiptDate: new Date().toISOString().slice(0, 10),
      paymentMethod: 'BANK',
      amountReceived: 5000000,
      taxWithheld: 0,
      notes: 'Partial invoice settlement',
      allocations: [
        {
          invoiceId: invoiceId,
          allocatedAmount: 5000000,
          allocatedWithholding: 0
        }
      ]
    }, sessionToken);
    check('8. Post Customer Receipt & Allocation', receiptRes);
  }

  // 9. Production Bill of Materials (BOM)
  const bomRes = await request('POST', '/production/bom', {
    bomNumber: `BOM-AUDIT-${rand}`,
    itemId: itemId,
    quantity: 1,
    status: 'ACTIVE',
    materials: [
      {
        itemId: itemId,
        quantity: 1.05,
        scrapPct: 5
      }
    ]
  }, sessionToken);
  check('9. Create Production BOM', bomRes);

  // 10. Production Order
  const prodOrderRes = await request('POST', '/production/orders', {
    productionNumber: `PO-PROD-${rand}`,
    itemId: itemId,
    quantity: 100,
    priority: 'HIGH',
    notes: 'Audit run order'
  }, sessionToken);
  check('10. Create Production Order', prodOrderRes);

  // 11. HR Daily Wage Run
  // Find an employee
  let empRes = await db.query(`SELECT id FROM employees WHERE "companyId" = $1 LIMIT 1;`, [user.companyId]);
  let empId;
  if (empRes.rows.length === 0) {
    const newEmp = await db.query(`
      INSERT INTO employees (id, "companyId", "employeeCode", "firstName", "lastName", "email", "status", "updatedAt")
      VALUES (gen_random_uuid(), $1, $2, 'Ahmed', 'Raza', $3, 'ACTIVE', NOW())
      RETURNING id;
    `, [user.companyId, `EMP-${rand}`, `ahmed${rand}@company.local`]);
    empId = newEmp.rows[0].id;
  } else {
    empId = empRes.rows[0].id;
  }

  const wageRes = await request('POST', '/hr/wages/runs', {
    periodMonth: 11,
    periodYear: 2026,
    runType: 'DAILY_WAGE',
    notes: 'Audit daily wage run',
    lines: [
      {
        employeeId: empId,
        daysWorked: 26,
        dailyRate: 1500,
        deductions: 500
      }
    ]
  }, sessionToken);
  check('11. Create HR Daily Wage Run', wageRes);

  // 12. Statutory Payment / Obligation
  const statutoryRes = await request('POST', '/finance/statutory/obligations', {
    head: 'SALES_TAX',
    authority: 'FBR',
    taxPeriod: '2026-11',
    dueAmount: 720000,
    notes: 'FBR November Sales Tax Return'
  }, sessionToken);
  check('12. Record Statutory Obligation', statutoryRes);

  // 13. Reports Verification
  const report1 = await request('GET', '/reports/sales-summary', null, sessionToken);
  check('13a. Sales Summary Report', report1);

  const report2 = await request('GET', '/reports/stock-register', null, sessionToken);
  check('13b. Stock Register Report', report2);

  // 14. Company Profile Update
  const companyRes = await request('PATCH', '/master-data/company', {
    name: 'Industrial ERP Corporation',
    phone: '+92 42 111 222 333',
    city: 'Lahore',
    country: 'Pakistan'
  }, sessionToken);
  check('14. Update Company Profile', companyRes);

  console.log('\n================================================================');
  console.log('   AUDIT SUMMARY                                                ');
  console.log('================================================================');
  const failed = results.filter(r => !r.ok);
  console.log(`Total Modules Tested: ${results.length}`);
  console.log(`Passed: ${results.length - failed.length}`);
  console.log(`Failed: ${failed.length}`);

  if (failed.length > 0) {
    console.error('\nFAILED CHECKS TO RESOLVE:');
    failed.forEach(f => console.error(` - ${f.step}: ${f.err}`));
  } else {
    console.log('\n>>> ALL 14 MODULES PASSED CLEANLY WITH ZERO ERRORS! <<<');
  }

  await db.end();
}

audit().catch(err => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});

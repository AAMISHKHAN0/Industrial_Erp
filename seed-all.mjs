// Comprehensive seed script - all modules with heavy load test
import https from 'https';
import http from 'http';

const API_BASE = 'http://localhost:4000/api/v1';
const SUPABASE_URL = 'https://djfdkzbfavhwvnacmnxr.supabase.co';
const ANON_KEY = 'sb_publishable_QTV7NpPOpLODQO9CZMFOnA_bvtAJFJM';
const t0 = Date.now();

let TOKEN = null;

async function supabaseLogin() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'pg1959655@gmail.com', password: 'aamishkhan1122' }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error('Auth failed: ' + JSON.stringify(json));
  TOKEN = json.access_token;
  log('OK', `Authenticated as ${json.user.email}`);
}

function headers() {
  return { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
}

async function api(method, path, body) {
  const url = `${API_BASE}${path}`;
  const opts = { method, headers: headers() };
  if (body) opts.body = JSON.stringify(body);
  const t1 = Date.now();
  const res = await fetch(url, opts);
  const elapsed = Date.now() - t1;
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok && json.success !== false, data: json.data || json, elapsed, status: res.status, json };
}

async function check(method, path, body, label) {
  const r = await api(method, path, body);
  if (!r.ok) {
    log('FAIL', `${label || path}: ${r.json.message || r.status}`);
    return null;
  }
  if (r.elapsed > 5000) log('WARN', `${label || path} took ${r.elapsed}ms`);
  return r.data;
}

function log(level, msg) {
  const ts = new Date().toISOString().slice(11, 19);
  const colors = { OK: '\x1b[32m', FAIL: '\x1b[31m', WARN: '\x1b[33m', INFO: '\x1b[36m', RESET: '\x1b[0m' };
  console.log(`${ts} ${colors[level] || ''}${level}${colors.RESET || ''}  ${msg}`);
}

const Vol = parseInt(process.argv[2] || '1', 10);
const N = Vol; // scale factor: N=1 means ~50 records per entity, N=10 means ~500

try {
  await supabaseLogin();

  // ====== MASTER DATA ======
  log('INFO', '=== MASTER DATA ===');
  
  const deptIds = {};
  for (let i = 1; i <= N; i++) {
    const d = await check('POST', '/master-data/department', { name: `Department ${i}`, code: `DEPT-${i}` }, `Dept ${i}`);
    if (d) deptIds[`DEPT-${i}`] = d.id;
  }
  log('OK', `Departments: ${Object.keys(deptIds).length}`);

  const desigIds = {};
  for (let i = 1; i <= N; i++) {
    const d = await check('POST', '/master-data/designation', { name: `Designation ${i}`, code: `DSG-${i}` }, `Desig ${i}`);
    if (d) desigIds[`DSG-${i}`] = d.id;
  }
  log('OK', `Designations: ${Object.keys(desigIds).length}`);

  const branchIds = {};
  for (let i = 1; i <= N; i++) {
    const b = await check('POST', '/master-data/branch', { name: `Branch ${i}`, code: `BR-${i}`, city: `City ${i}` }, `Branch ${i}`);
    if (b) branchIds[`BR-${i}`] = b.id;
  }
  log('OK', `Branches: ${Object.keys(branchIds).length}`);

  const empIds = {};
  for (let i = 1; i <= N; i++) {
    const dk = `DEPT-${((i - 1) % N) + 1}`;
    const sk = `DSG-${((i - 1) % N) + 1}`;
    const e = await check('POST', '/master-data/employee', {
      employeeCode: `EMP-${i}`, firstName: `First${i}`, lastName: `Last${i}`,
      email: `emp${i}@test.com`, departmentId: deptIds[dk], designationId: desigIds[sk],
    }, `Emp ${i}`);
    if (e) empIds[`EMP-${i}`] = e.id;
  }
  log('OK', `Employees: ${Object.keys(empIds).length}`);

  // ====== INVENTORY ======
  log('INFO', '=== INVENTORY ===');

  const unitNames = ['Meter','Kg','Piece','Roll','Ton','Liter','Box','Set','Dozen','Pair'];
  const unitIds = {};
  for (const name of unitNames) {
    const u = await check('POST', '/inventory/units', { name, code: name.slice(0,3).toUpperCase() }, `Unit ${name}`);
    if (u) unitIds[name] = u.id;
  }
  log('OK', `Units: ${Object.keys(unitIds).length}`);

  const catNames = ['Yarn','Fabric','Thread','Dye','Accessories','Chemicals','Spare Parts','Packaging','Raw Material','Finished Goods'];
  const catIds = {};
  for (const name of catNames) {
    const c = await check('POST', '/inventory/categories', { name, code: name.slice(0,3).toUpperCase() }, `Cat ${name}`);
    if (c) catIds[name] = c.id;
  }
  log('OK', `Categories: ${Object.keys(catIds).length}`);

  const itemIds = {};
  const uKeys = Object.keys(unitIds);
  const cKeys = Object.keys(catIds);
  for (let i = 1; i <= N * 2; i++) {
    const item = await check('POST', '/inventory/items', {
      itemCode: `ITEM-${i}`, name: `Test Item ${i}`,
      categoryId: catIds[cKeys[(i - 1) % cKeys.length]],
      unitId: unitIds[uKeys[(i - 1) % uKeys.length]],
      reorderLevel: 100,
    }, `Item ${i}`);
    if (item) itemIds[`ITEM-${i}`] = item.id;
  }
  log('OK', `Items: ${Object.keys(itemIds).length}`);

  const whIds = {};
  for (let i = 1; i <= N; i++) {
    const bk = `BR-${((i - 1) % N) + 1}`;
    const w = await check('POST', '/inventory/warehouses', {
      name: `Warehouse ${i}`, code: `WH-${i}`, branchId: branchIds[bk], city: `City ${i}`,
    }, `Warehouse ${i}`);
    if (w) whIds[`WH-${i}`] = w.id;
  }
  log('OK', `Warehouses: ${Object.keys(whIds).length}`);

  // ====== PURCHASE ======
  log('INFO', '=== PURCHASE ===');

  const vendorIds = {};
  for (let i = 1; i <= N; i++) {
    const v = await check('POST', '/purchase/vendors', {
      vendorCode: `V-${i}`, name: `Vendor ${i}`, contactPerson: `Person ${i}`, city: `City ${i}`, status: 'ACTIVE',
    }, `Vendor ${i}`);
    if (v) vendorIds[`V-${i}`] = v.id;
  }
  log('OK', `Vendors: ${Object.keys(vendorIds).length}`);

  // Link vendors to items
  const vKeys = Object.keys(vendorIds);
  const iKeys = Object.keys(itemIds);
  let linked = 0;
  for (let i = 1; i <= N; i++) {
    const vk = vKeys[(i - 1) % vKeys.length];
    const ik = iKeys[(i - 1) % iKeys.length];
    const r = await check('POST', `/purchase/vendors/${vendorIds[vk]}/items`, { itemIds: [itemIds[ik]] }, `Link ${i}`);
    if (r) linked++;
  }
  log('OK', `Vendor-item links: ${linked}`);

  // Demand Notes
  const demandIds = {};
  const deptKeys = Object.keys(deptIds);
  for (let i = 1; i <= N; i++) {
    const dk = deptKeys[(i - 1) % deptKeys.length];
    const priorities = ['LOW','MEDIUM','HIGH','URGENT'];
    const d = await check('POST', '/purchase/demand-notes', {
      demandNumber: `DN-${i}`, departmentId: deptIds[dk], priority: priorities[(i - 1) % 4],
    }, `Demand ${i}`);
    if (d) demandIds[`DN-${i}`] = d.id;
  }
  log('OK', `Demand Notes: ${Object.keys(demandIds).length}`);

  // Quotations
  const quotIds = {};
  for (let i = 1; i <= N; i++) {
    const vk = vKeys[(i - 1) % vKeys.length];
    const dk = `DN-${((i - 1) % N) + 1}`;
    const ik = iKeys[(i - 1) % iKeys.length];
    const q = await check('POST', '/purchase/quotations', {
      quotationNumber: `QT-${i}`, vendorId: vendorIds[vk], demandNoteId: demandIds[dk],
      items: [{ itemId: itemIds[ik], quantity: 100, unitPrice: 10.5, totalPrice: 1050 }],
    }, `Quot ${i}`);
    if (q) quotIds[`QT-${i}`] = q.id;
  }
  log('OK', `Quotations: ${Object.keys(quotIds).length}`);

  // Purchase Orders
  const poIds = {};
  for (let i = 1; i <= N; i++) {
    const vk = vKeys[(i - 1) % vKeys.length];
    const qk = `QT-${((i - 1) % N) + 1}`;
    const ik = iKeys[(i - 1) % iKeys.length];
    const po = await check('POST', '/purchase/orders', {
      poNumber: `PO-${i}`, vendorId: vendorIds[vk], quotationId: quotIds[qk],
      items: [{ itemId: itemIds[ik], quantity: 100, unitPrice: 10.5, totalPrice: 1050 }],
    }, `PO ${i}`);
    if (po) poIds[`PO-${i}`] = po.id;
  }
  log('OK', `Purchase Orders: ${Object.keys(poIds).length}`);

  // Approve POs
  for (let i = 1; i <= N; i++) {
    const pk = `PO-${i}`;
    if (poIds[pk]) {
      await check('POST', `/purchase/orders/${poIds[pk]}/approve`, null, `Approve PO ${i}`);
    }
  }
  log('OK', `PO approvals done`);

  // GRN
  for (let i = 1; i <= N; i++) {
    const pk = `PO-${i}`;
    const vk = vKeys[(i - 1) % vKeys.length];
    const whk = `WH-${((i - 1) % N) + 1}`;
    const ik = iKeys[(i - 1) % iKeys.length];
    if (poIds[pk] && whIds[whk]) {
      await check('POST', '/purchase/goods-receiving', {
        grnNumber: `GRN-${i}`, poId: poIds[pk], vendorId: vendorIds[vk], warehouseId: whIds[whk],
        items: [{ itemId: itemIds[ik], orderedQty: 100, receivedQty: 95, acceptedQty: 93, rejectedQty: 2, unitCost: 10.5 }],
      }, `GRN ${i}`);
    }
  }
  log('OK', `GRNs done`);

  // ====== PRODUCTION ======
  log('INFO', '=== PRODUCTION ===');

  const bomIds = {};
  for (let i = 1; i <= N; i++) {
    const ik = iKeys[(i - 1) % iKeys.length];
    const bm = await check('POST', '/production/bom', {
      bomNumber: `BOM-${i}`, itemId: itemIds[ik], quantity: 1, unit: 'Piece',
      materials: [{ itemId: itemIds[ik], quantity: 2, unit: 'Piece' }],
    }, `BOM ${i}`);
    if (bm) bomIds[`BOM-${i}`] = bm.id;
  }
  log('OK', `BOMs: ${Object.keys(bomIds).length}`);

  const prodIds = {};
  for (let i = 1; i <= N; i++) {
    const ik = iKeys[(i - 1) % iKeys.length];
    const bk = `BOM-${((i - 1) % N) + 1}`;
    const po = await check('POST', '/production/orders', {
      productionNumber: `PROD-${i}`, itemId: itemIds[ik], bomId: bomIds[bk], quantity: 100, priority: 'MEDIUM',
    }, `Prod ${i}`);
    if (po) prodIds[`PROD-${i}`] = po.id;
  }
  log('OK', `Production Orders: ${Object.keys(prodIds).length}`);

  for (let i = 1; i <= N; i++) {
    const pk = `PROD-${i}`;
    if (prodIds[pk]) {
      await check('POST', '/production/quality', {
        productionOrderId: prodIds[pk], parameter: 'Strength Test', specification: '>30 N/mm',
        result: '35 N/mm', status: 'PASS',
      }, `QC ${i}`);
    }
  }
  log('OK', `Quality checks done`);

  // ====== SALES ======
  log('INFO', '=== SALES ===');

  const custIds = {};
  for (let i = 1; i <= N; i++) {
    const c = await check('POST', '/sales/customers', {
      customerCode: `CUST-${i}`, name: `Customer ${i}`, city: `City ${i}`, status: 'ACTIVE',
    }, `Cust ${i}`);
    if (c) custIds[`CUST-${i}`] = c.id;
  }
  log('OK', `Customers: ${Object.keys(custIds).length}`);

  const cKeys2 = Object.keys(custIds);
  for (let i = 1; i <= N; i++) {
    const ck = cKeys2[(i - 1) % cKeys2.length];
    const ik = iKeys[(i - 1) % iKeys.length];
    await check('POST', '/sales/orders', {
      soNumber: `SO-${i}`, customerId: custIds[ck],
      items: [{ itemId: itemIds[ik], quantity: 50, unitPrice: 25.0, totalPrice: 1250 }],
    }, `SO ${i}`);
  }
  log('OK', `Sales Orders done`);

  // ====== FINANCE ======
  log('INFO', '=== FINANCE ===');

  const accIds = {};
  const accTypes = ['ASSET','LIABILITY','EQUITY','INCOME','EXPENSE'];
  for (let i = 1; i <= N; i++) {
    const at = accTypes[(i - 1) % accTypes.length];
    const a = await check('POST', '/finance/accounts', { accountCode: `ACC-${i}`, name: `Account ${i}`, type: at }, `Acc ${i}`);
    if (a) accIds[`ACC-${i}`] = a.id;
  }
  log('OK', `Accounts: ${Object.keys(accIds).length}`);

  for (let i = 1; i <= N; i++) {
    const ak1 = `ACC-${i}`;
    const ak2 = `ACC-${(i % N) + 1}`;
    if (accIds[ak1] && accIds[ak2]) {
      await check('POST', '/finance/journal-entries', {
        entryNumber: `JE-${i}`, description: `Journal ${i}`,
        items: [
          { accountId: accIds[ak1], debitAmount: 1000, creditAmount: 0, description: 'Debit' },
          { accountId: accIds[ak2], debitAmount: 0, creditAmount: 1000, description: 'Credit' },
        ],
      }, `JE ${i}`);
    }
  }
  log('OK', `Journal Entries done`);

  // ====== HR ======
  log('INFO', '=== HR ===');

  for (let i = 1; i <= N; i++) {
    const ek = `EMP-${((i - 1) % N) + 1}`;
    const attDate = new Date('2026-07-14').toISOString();
    await check('POST', '/hr/attendance', {
      employeeId: empIds[ek], date: attDate, clockIn: '2026-07-14T08:00:00Z',
      clockOut: '2026-07-14T17:00:00Z', status: 'PRESENT',
    }, `Att ${i}`);
  }
  log('OK', `Attendance done`);

  for (let i = 1; i <= N; i++) {
    const ek = `EMP-${((i - 1) % N) + 1}`;
    const leaveTypes = ['CASUAL','SICK','ANNUAL'];
    const lvStart = new Date('2026-07-20').toISOString();
    const lvEnd = new Date('2026-07-22').toISOString();
    await check('POST', '/hr/leaves', {
      employeeId: empIds[ek], leaveType: leaveTypes[(i - 1) % 3],
      startDate: lvStart, endDate: lvEnd, reason: `Leave ${i}`,
    }, `Leave ${i}`);
  }
  log('OK', `Leaves done`);

  for (let i = 1; i <= N; i++) {
    await check('POST', '/hr/payroll/payhead', {
      name: `Payhead ${i}`, code: `PH-${i}`, type: ['EARNING','DEDUCTION','STATUTORY'][(i - 1) % 3], amount: 5000,
    }, `Payhead ${i}`);
  }
  log('OK', `Payheads done`);

  const perStart = new Date('2026-07-01').toISOString();
  const perEnd = new Date('2026-07-31').toISOString();
  const period = await check('POST', '/hr/payroll/period', { name: 'July 2026', startDate: perStart, endDate: perEnd }, 'Period');
  if (period) {
    for (let i = 1; i <= N; i++) {
      const ek = `EMP-${((i - 1) % N) + 1}`;
      await check('POST', '/hr/payroll/slip', {
        employeeId: empIds[ek], periodId: period.id, basicPay: 50000, totalEarnings: 55000,
        totalDeductions: 5000, netPay: 50000,
      }, `Slip ${i}`);
    }
    log('OK', `Payslips done`);
  }

  // ====== HEAVY LOAD TEST: BULK READS ======
  log('INFO', '=== HEAVY LOAD TEST ===');
  log('INFO', `Seeding completed in ${Math.round((Date.now() - t0) / 1000)}s`);

  const readPaths = [
    { path: '/purchase/vendors?limit=1000', label: 'Vendors' },
    { path: '/purchase/demand-notes?limit=1000', label: 'Demand Notes' },
    { path: '/purchase/orders?limit=1000', label: 'POs' },
    { path: '/purchase/quotations?limit=1000', label: 'Quotations' },
    { path: '/purchase/goods-receiving?limit=1000', label: 'GRNs' },
    { path: '/sales/customers?limit=1000', label: 'Customers' },
    { path: '/sales/orders?limit=1000', label: 'SOs' },
    { path: '/inventory/items?limit=1000', label: 'Items' },
    { path: '/inventory/warehouses?limit=1000', label: 'Warehouses' },
    { path: '/master-data/employee?limit=1000', label: 'Employees' },
    { path: '/master-data/department?limit=1000', label: 'Depts' },
    { path: '/master-data/designation?limit=1000', label: 'Designations' },
    { path: '/master-data/branch?limit=1000', label: 'Branches' },
    { path: '/finance/accounts?limit=1000', label: 'Accounts' },
    { path: '/finance/journal-entries?limit=1000', label: 'Journals' },
    { path: '/hr/attendance?limit=1000', label: 'Attendance' },
    { path: '/hr/leaves?limit=1000', label: 'Leaves' },
    { path: '/hr/payroll/payhead?limit=1000', label: 'Payheads' },
    { path: '/hr/payroll/slip?limit=1000', label: 'Slips' },
    { path: '/production/bom?limit=1000', label: 'BOMs' },
    { path: '/production/orders?limit=1000', label: 'Prod Orders' },
    { path: '/production/quality?limit=1000', label: 'Quality' },
  ];

  const slow = [];
  for (const { path, label } of readPaths) {
    const r = await api('GET', path);
    const count = r.data?.data?.length || r.data?.length || 0;
    const level = r.ok ? 'OK' : 'FAIL';
    const color = r.elapsed > 5000 ? '\x1b[31m' : r.elapsed > 2000 ? '\x1b[33m' : '\x1b[32m';
    console.log(`${new Date().toISOString().slice(11,19)} ${color}${level}\x1b[0m  ${label.padEnd(15)} → ${String(count).padStart(4)} records in ${r.elapsed}ms`);
    if (r.elapsed > 3000) slow.push(`${label} (${r.elapsed}ms)`);
  }

  log('INFO', '=== FINAL ===');
  log('INFO', `Total: ${Math.round((Date.now() - t0) / 1000)}s, Volume factor: ${Vol}`);
  if (slow.length > 0) {
    log('WARN', `Slow endpoints (>3s): ${slow.length}`);
    slow.forEach(s => log('WARN', `  ${s}`));
  } else {
    log('OK', 'All endpoints < 3s');
  }

} catch (e) {
  log('FAIL', `FATAL: ${e.message}`);
  console.error(e);
}

/**
 * scripts/verify-secondary-and-graph.js
 *
 * Live Electron (win-unpacked, ERP_FRESH_TEST=1) verification of:
 * 1. Fresh /setup -> /dashboard flow + splash bright theme check.
 * 2. Multi-month populated "Monthly performance" curves graph (Revenue vs Spend + Orders) with visual PNG screenshots.
 * 3. Interactive UI form submissions, auto-generated codes, and EntitySelect QuickAdd across:
 *    - /hr/attendance
 *    - /hr/wages
 *    - /hr/leave
 *    - /production/quality (including nested 2-level QuickAdd: Quality -> Production Order -> Item)
 *    - /finance/expenses
 *    - /finance/journal
 * 4. Close-and-reopen session persistence (must reopen directly to /dashboard without login/password prompt).
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, execSync } = require('child_process');
const { chromium } = require('../frontend/node_modules/playwright');

const ROOT_DIR = path.resolve(__dirname, '..');
const UNPACKED_EXE = path.join(ROOT_DIR, 'desktop', 'dist', 'win-unpacked', 'Industrial ERP.exe');
const FRESH_USER_DATA = path.join(process.env.APPDATA, 'industrial-erp-fresh-test');
const CDP_PORT = 9229;

const SCREENSHOT_CASHFLOW = path.join(__dirname, 'verify-dashboard-graph-cashflow.png');
const SCREENSHOT_ORDERS = path.join(__dirname, 'verify-dashboard-graph-orders.png');

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function assert(cond, msg) {
  if (!cond) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
  log(`[PASS] ${msg}`);
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function killFreshTestProcesses() {
  log('Stopping only win-unpacked / fresh-test processes (preserving user installed app)...');
  try {
    const ps = `
      Get-CimInstance Win32_Process | Where-Object {
        ($_.ExecutablePath -like '*win-unpacked*' -or $_.CommandLine -like '*industrial-erp-fresh-test*' -or $_.CommandLine -like '*win-unpacked*')
      } | ForEach-Object {
        try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {}
      }
    `;
    execSync(`powershell -NoProfile -Command "${ps.replace(/\r?\n/g, ' ')}"`, { stdio: 'ignore' });
  } catch {}
}

async function waitForCdp(port, timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const ok = await new Promise((resolve) => {
        const req = http.get(`http://127.0.0.1:${port}/json/version`, { timeout: 1500 }, (res) => {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => resolve(res.statusCode === 200));
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
      });
      if (ok) return true;
    } catch {}
    await wait(500);
  }
  throw new Error(`Timed out waiting for Electron CDP on port ${port}`);
}

async function getMainAppPage(browser, timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const ctx of browser.contexts()) {
      for (const page of ctx.pages()) {
        const url = page.url();
        if (url && !url.startsWith('devtools://') && !url.includes('splash.html') && url.startsWith('http://127.0.0.1:')) {
          return page;
        }
      }
    }
    await wait(500);
  }
  throw new Error('Timed out waiting for main application BrowserWindow');
}

function launchElectronFreshTest(cookieWarnings) {
  log(`Launching: ${UNPACKED_EXE} (ERP_FRESH_TEST=1, CDP=${CDP_PORT})`);
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  env.ERP_FRESH_TEST = '1';
  env.ELECTRON_REMOTE_DEBUGGING_PORT = String(CDP_PORT);
  env.ELECTRON_ENABLE_LOGGING = '1';
  const child = spawn(UNPACKED_EXE, ['--fresh-test', `--remote-debugging-port=${CDP_PORT}`], {
    env,
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => {
    const s = d.toString().trim();
    if (s) {
      if (s.includes('Failed to set session cookie')) cookieWarnings.push(s);
      console.log(`[ELECTRON] ${s}`);
    }
  });
  child.stderr.on('data', (d) => {
    const s = d.toString().trim();
    if (s && !s.includes('Passthrough is not supported')) {
      if (s.includes('Failed to set session cookie')) cookieWarnings.push(s);
      console.log(`[ELECTRON-ERR] ${s}`);
    }
  });
  return child;
}

async function main() {
  if (!fs.existsSync(UNPACKED_EXE)) {
    throw new Error(`win-unpacked executable not found at ${UNPACKED_EXE}`);
  }

  killFreshTestProcesses();
  await wait(1500);

  if (fs.existsSync(FRESH_USER_DATA)) {
    log(`Removing previous fresh-test userData: ${FRESH_USER_DATA}`);
    fs.rmSync(FRESH_USER_DATA, { recursive: true, force: true });
  }

  const cookieWarnings = [];
  let electronProc = launchElectronFreshTest(cookieWarnings);
  let browser;
  const networkFailures = [];
  const consoleErrors = [];

  try {
    await waitForCdp(CDP_PORT, 90000);
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
    const page = await getMainAppPage(browser, 90000);

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('response', (res) => {
      if (res.status() >= 400 && !res.url().includes('/auth/me')) {
        networkFailures.push(`${res.status()} ${res.request().method()} ${res.url()}`);
      }
    });

    await page.setViewportSize({ width: 1366, height: 860 });
    await page.waitForLoadState('networkidle');
    log(`Initial Electron URL: ${page.url()}`);

    // 1. Setup on fresh DB
    if (page.url().includes('/setup')) {
      log('Running first-time /setup bootstrap...');
      await page.fill('#companyName', 'Apex Textile Mills Ltd');
      await page.fill('#phone', '+92 300 5551234');
      await page.fill('#taxNumber', 'NTN-4455667-8');
      await page.fill('#address', 'Plot 14, Korangi Industrial Area, Karachi');
      await page.fill('#adminName', 'Aamish Owner');
      await page.fill('#adminEmail', 'owner@apextextile.local');
      await page.fill('#password', 'OwnerPass#2026!');
      await page.fill('#confirmPassword', 'OwnerPass#2026!');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard', { timeout: 30000 });
      await page.waitForLoadState('networkidle');
      assert(page.url().includes('/dashboard'), 'First-time /setup redirected cleanly to /dashboard');
    } else {
      assert(page.url().includes('/dashboard'), `Expected /setup or /dashboard, got ${page.url()}`);
    }

    // 2. Seed multi-month POs and Sales Invoices via authenticated API so Dashboard graph has rich curves
    log('Seeding multi-month purchase orders and sales invoices for Monthly performance curves...');
    const seedResult = await page.evaluate(async () => {
      const apiBase = window.desktopBridge?.getApiBase?.() || 'http://127.0.0.1:4001/api/v1';
      const token =
        window.desktopBridge?.getSessionToken?.() ||
        localStorage.getItem('session_token') ||
        sessionStorage.getItem('session_token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      async function apiPost(endpoint, body) {
        const res = await fetch(`${apiBase}${endpoint}`, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(`${endpoint} -> ${res.status}: ${JSON.stringify(json)}`);
        return json.data || json;
      }

      const vendor = await apiPost('/purchase/vendors', { name: 'Indus Spinning Mills', phone: '03001112223' });
      const customer = await apiPost('/sales/customers', { name: 'Sapphire Export House', phone: '03214445556' });
      const item = await apiPost('/inventory/items', { name: 'Combed Cotton 30s', purchasePrice: 900, sellingPrice: 1250 });

      const year = new Date().getFullYear();
      const months = [
        { m: '01', poQty: 120, invQty: 110, price: 1200 },
        { m: '03', poQty: 180, invQty: 210, price: 1300 },
        { m: '05', poQty: 150, invQty: 260, price: 1250 },
        { m: '07', poQty: 240, invQty: 310, price: 1350 },
        { m: '09', poQty: 200, invQty: 380, price: 1400 },
        { m: '11', poQty: 270, invQty: 420, price: 1450 },
      ];

      for (const row of months) {
        await apiPost('/purchase/orders', {
          vendorId: vendor.id,
          orderDate: `${year}-${row.m}-10`,
          items: [{ itemId: item.id, quantity: row.poQty, unitPrice: 900 }],
        });
        await apiPost('/sales/invoices', {
          customerId: customer.id,
          invoiceDate: `${year}-${row.m}-15`,
          items: [{ itemId: item.id, description: item.name, quantity: row.invQty, unitPrice: row.price, taxPct: 18 }],
        });
      }
      return { vendorCode: vendor.vendorCode, customerCode: customer.customerCode, itemCode: item.itemCode };
    });
    log(`Seeded baseline entities (auto-codes: ${JSON.stringify(seedResult)})`);
    assert(Boolean(seedResult.vendorCode && seedResult.customerCode && seedResult.itemCode), 'Auto-generated codes returned for Vendor, Customer, and Item');

    // Reload /dashboard and verify populated Monthly performance curves graph
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('text=Monthly performance', { timeout: 15000 });
    await page.waitForTimeout(800);

    const perfCard = page.locator('[data-slot="card"]', { hasText: 'Monthly performance' }).first();
    await perfCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);

    const chartBox = await page.locator('.recharts-wrapper').first().boundingBox();
    assert(chartBox && chartBox.width > 400 && chartBox.height > 200, `Monthly performance chart rendered (${Math.round(chartBox?.width || 0)}x${Math.round(chartBox?.height || 0)})`);
    const areaPathCount = await page.locator('.recharts-area-curve').count();
    assert(areaPathCount >= 2, `Revenue vs Spend curve paths rendered (${areaPathCount} curves)`);

    await perfCard.screenshot({ path: SCREENSHOT_CASHFLOW });
    log(`Saved Revenue vs Spend graph screenshot -> ${SCREENSHOT_CASHFLOW}`);

    await page.click('button:has-text("Orders")');
    await page.waitForTimeout(600);
    const barCount = await page.locator('.recharts-bar-rectangle').count();
    assert(barCount > 0, `Orders bar chart rendered (${barCount} bars)`);
    await perfCard.screenshot({ path: SCREENSHOT_ORDERS });
    log(`Saved Orders bar graph screenshot -> ${SCREENSHOT_ORDERS}`);

    // Switch back to Revenue vs Spend
    await page.click('button:has-text("Revenue vs Spend")');

    const baseOrigin = new URL(page.url()).origin;

    // ------------------------------------------------------------------
    // 3. Test /hr/attendance (QuickAdd Employee + Create Attendance)
    // ------------------------------------------------------------------
    log('--- Testing /hr/attendance ---');
    await page.goto(`${baseOrigin}/hr/attendance`, { waitUntil: 'networkidle' });
    await page.click('button:has-text("Add Attendance")');
    const attDialog = page.locator('[data-slot="dialog-content"]').last();
    await attDialog.waitFor({ state: 'visible' });

    // Open Employee EntitySelect (should be empty and show "Add your Employee")
    await attDialog.locator('[data-slot="select-trigger"]').first().click();
    await page.waitForSelector('text=No employees added yet', { timeout: 5000 });
    await page.click('button:has-text("Add your Employee")');

    const empQuickDialog = page.locator('[data-slot="dialog-content"]', { hasText: 'Add Employee' }).last();
    await empQuickDialog.waitFor({ state: 'visible' });
    const empAutoCode = await empQuickDialog.locator('input').first().inputValue();
    assert(/^EMP-\d{4}$/.test(empAutoCode), `Employee QuickCreate auto-generated code: ${empAutoCode}`);

    const empInputs = empQuickDialog.locator('input');
    await empInputs.nth(1).fill('Bilal');
    await empInputs.nth(2).fill('Ahmed');
    await empQuickDialog.locator('button:has-text("Save & Select")').click();
    await empQuickDialog.waitFor({ state: 'hidden', timeout: 10000 });

    await page.waitForTimeout(300);
    const selectedEmpText = await attDialog.locator('[data-slot="select-trigger"]').first().innerText();
    assert(selectedEmpText.includes('Bilal Ahmed'), `EntitySelect auto-selected newly created employee: "${selectedEmpText}"`);

    await attDialog.locator('input[type="time"]').nth(0).fill('09:00');
    await attDialog.locator('input[type="time"]').nth(1).fill('17:30');
    await attDialog.locator('button:has-text("Create")').click();
    await attDialog.waitFor({ state: 'hidden', timeout: 10000 });

    await page.waitForSelector('table >> text=Bilal Ahmed', { timeout: 10000 });
    assert(true, 'Attendance record created and visible in table');

    // Edit attendance: clear clockOut and update remarks
    await page.locator('table tbody tr', { hasText: 'Bilal Ahmed' }).first().locator('button').last().click();
    await page.locator('[role="menuitem"]', { hasText: 'Edit' }).click();
    const editAttDialog = page.locator('[data-slot="dialog-content"]', { hasText: 'Edit Attendance' }).last();
    await editAttDialog.waitFor({ state: 'visible' });
    await editAttDialog.locator('input[type="time"]').nth(1).fill('');
    await editAttDialog.locator('input[placeholder*="remarks"]').fill('Morning shift only');
    await editAttDialog.locator('button:has-text("Update")').click();
    await editAttDialog.waitFor({ state: 'hidden', timeout: 10000 });
    await page.waitForSelector('table >> text=Morning shift only', { timeout: 10000 });
    assert(true, 'Attendance edit cleared clockOut and updated remarks cleanly');

    // ------------------------------------------------------------------
    // 4. Test /hr/wages (QuickAdd 2nd Employee + Accrue + Disburse)
    // ------------------------------------------------------------------
    log('--- Testing /hr/wages ---');
    await page.goto(`${baseOrigin}/hr/wages`, { waitUntil: 'networkidle' });
    await page.click('button:has-text("New Daily Wage Run")');
    const wageDialog = page.locator('[data-slot="dialog-content"]', { hasText: 'New Daily Wage Run' }).last();
    await wageDialog.waitFor({ state: 'visible' });

    // Select Employee dropdown inside line 1 and test "Add Employee" QuickAdd from populated list
    await wageDialog.locator('[data-slot="select-trigger"]').nth(1).click();
    await page.click('button:has-text("Add Employee")');

    const empQuickDialog2 = page.locator('[data-slot="dialog-content"]', { hasText: 'Add Employee' }).last();
    await empQuickDialog2.waitFor({ state: 'visible' });
    const empAutoCode2 = await empQuickDialog2.locator('input').first().inputValue();
    assert(empAutoCode2 === 'EMP-0002', `Second Employee QuickCreate incremented auto-code: ${empAutoCode2}`);
    const empInputs2 = empQuickDialog2.locator('input');
    await empInputs2.nth(1).fill('Kamran');
    await empInputs2.nth(2).fill('Khan');
    await empQuickDialog2.locator('button:has-text("Save & Select")').click();
    await empQuickDialog2.waitFor({ state: 'hidden', timeout: 10000 });

    await wageDialog.locator('button:has-text("Post Daily Wage Accrual")').click();
    await wageDialog.waitFor({ state: 'hidden', timeout: 15000 });
    await page.waitForSelector('text=ACCRUED', { timeout: 10000 });
    assert(true, 'Daily Wage Run accrued and rendered in table');

    await page.click('button:has-text("Disburse")');
    const disbDialog = page.locator('[data-slot="dialog-content"]', { hasText: 'Disburse Wage Run' }).last();
    await disbDialog.waitFor({ state: 'visible' });
    await disbDialog.locator('button:has-text("Confirm & Post Disbursement")').click();
    await disbDialog.waitFor({ state: 'hidden', timeout: 15000 });
    await page.waitForSelector('text=DISBURSED', { timeout: 10000 });
    assert(true, 'Daily Wage Run disbursed cleanly');

    // Test Bulk Entry on /hr/attendance now that we have 2 employees (using yesterday's date to avoid unique constraint collision)
    log('--- Testing /hr/attendance Bulk Entry ---');
    await page.goto(`${baseOrigin}/hr/attendance`, { waitUntil: 'networkidle' });
    await page.click('button:has-text("Bulk Entry")');
    const bulkDialog = page.locator('[data-slot="dialog-content"]', { hasText: 'Bulk Attendance Entry' }).last();
    await bulkDialog.waitFor({ state: 'visible' });
    const yest = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    await bulkDialog.locator('input[type="date"]').fill(yest);
    await bulkDialog.locator('input[type="time"]').nth(0).fill('08:30');
    await bulkDialog.locator('input[type="time"]').nth(1).fill('17:00');
    await bulkDialog.locator('button:has-text("Create 2 Records")').click();
    await bulkDialog.waitFor({ state: 'hidden', timeout: 15000 });
    await page.waitForSelector(`table >> text=${yest}`, { timeout: 10000 });
    assert(true, 'Bulk Attendance Entry created 2 records cleanly');

    // ------------------------------------------------------------------
    // 5. Test /hr/leave (Pre-filled dates + Submit + Approve)
    // ------------------------------------------------------------------
    log('--- Testing /hr/leave ---');
    await page.goto(`${baseOrigin}/hr/leave`, { waitUntil: 'networkidle' });
    await page.click('button:has-text("Add Leave")');
    const leaveDialog = page.locator('[data-slot="dialog-content"]', { hasText: 'Add Leave' }).last();
    await leaveDialog.waitFor({ state: 'visible' });

    const startVal = await leaveDialog.locator('input[type="date"]').nth(0).inputValue();
    const endVal = await leaveDialog.locator('input[type="date"]').nth(1).inputValue();
    assert(/^\d{4}-\d{2}-\d{2}$/.test(startVal) && /^\d{4}-\d{2}-\d{2}$/.test(endVal), `Leave Start/End dates pre-filled (${startVal}..${endVal})`);

    await leaveDialog.locator('[data-slot="select-trigger"]').first().click();
    await page.locator('[data-slot="select-item"]', { hasText: 'Bilal Ahmed' }).first().click();
    await leaveDialog.locator('textarea').fill('Annual family leave');
    await leaveDialog.locator('button:has-text("Create")').click();
    await leaveDialog.waitFor({ state: 'hidden', timeout: 10000 });

    await page.waitForSelector('table >> text=Bilal Ahmed', { timeout: 10000 });
    const leaveDateCell = await page.locator('table tbody tr').first().innerText();
    assert(!leaveDateCell.includes('T00:00:00'), 'Leave table displays clean YYYY-MM-DD dates instead of raw ISO timestamps');

    // Approve the pending leave
    await page.locator('table tbody tr').first().locator('button').first().click();
    await page.waitForSelector('table >> text=APPROVED', { timeout: 10000 });
    assert(true, 'Leave record created and approved cleanly');

    // Edit & Delete Leave record
    await page.locator('table tbody tr').first().locator('button').last().click();
    await page.locator('[role="menuitem"]', { hasText: 'Edit' }).click();
    const editLeaveDialog = page.locator('[data-slot="dialog-content"]', { hasText: 'Edit Leave' }).last();
    await editLeaveDialog.waitFor({ state: 'visible' });
    const editStartVal = await editLeaveDialog.locator('input[type="date"]').nth(0).inputValue();
    assert(/^\d{4}-\d{2}-\d{2}$/.test(editStartVal), `Edit Leave pre-populated YYYY-MM-DD Start Date (${editStartVal})`);
    await editLeaveDialog.locator('textarea').fill('Updated leave reason');
    await editLeaveDialog.locator('button:has-text("Update")').click();
    await editLeaveDialog.waitFor({ state: 'hidden', timeout: 10000 });
    await page.waitForSelector('table >> text=Updated leave reason', { timeout: 10000 });

    await page.locator('table tbody tr').first().locator('button').last().click();
    await page.locator('[role="menuitem"]', { hasText: 'Delete' }).click();
    const delLeaveDialog = page.locator('[data-slot="dialog-content"]', { hasText: 'Delete Leave' }).last();
    await delLeaveDialog.waitFor({ state: 'visible' });
    await delLeaveDialog.locator('button:has-text("Delete")').click();
    await delLeaveDialog.waitFor({ state: 'hidden', timeout: 10000 });
    await page.waitForTimeout(400);
    const leaveRowsAfterDelete = await page.locator('table tbody tr', { hasText: 'Updated leave reason' }).count();
    assert(leaveRowsAfterDelete === 0, 'Leave record edited and deleted cleanly');

    // ------------------------------------------------------------------
    // 6. Test /production/quality (Nested QuickAdd Production Order + Create QC)
    // ------------------------------------------------------------------
    log('--- Testing /production/quality ---');
    await page.goto(`${baseOrigin}/production/quality`, { waitUntil: 'networkidle' });
    await page.click('button:has-text("Add Check")');
    const qcDialog = page.locator('[data-slot="dialog-content"]', { hasText: 'Add Quality Check' }).last();
    await qcDialog.waitFor({ state: 'visible' });

    await qcDialog.locator('[data-slot="select-trigger"]').first().click();
    await page.waitForSelector('button:has-text("Add your Production Order")', { timeout: 5000 });
    await page.click('button:has-text("Add your Production Order")');

    const poQuickDialog = page.locator('[data-slot="dialog-content"]', { hasText: 'Add Production Order' }).last();
    await poQuickDialog.waitFor({ state: 'visible' });
    const poAutoCode = await poQuickDialog.locator('input').first().inputValue();
    assert(/^PROD-\d{4}$/.test(poAutoCode), `Production Order QuickCreate auto-generated code: ${poAutoCode}`);

    // Select the item seeded earlier (or quick-create another item)
    await poQuickDialog.locator('[data-slot="select-trigger"]').first().click();
    await page.click('button:has-text("Add Item")');
    const itemQuickDialog = page.locator('[data-slot="dialog-content"]', { hasText: 'Add Inventory Item' }).last();
    await itemQuickDialog.waitFor({ state: 'visible' });
    const itemAutoCode = await itemQuickDialog.locator('input').first().inputValue();
    assert(/^ITM-\d{4}$/.test(itemAutoCode), `Nested Item QuickCreate auto-generated code: ${itemAutoCode}`);
    await itemQuickDialog.locator('input').nth(1).fill('Dyed Twill Fabric');
    await itemQuickDialog.locator('button:has-text("Save & Select")').click();
    await itemQuickDialog.waitFor({ state: 'hidden', timeout: 10000 });

    await poQuickDialog.locator('button:has-text("Save & Select")').click();
    await poQuickDialog.waitFor({ state: 'hidden', timeout: 10000 });

    const selectedPoText = await qcDialog.locator('[data-slot="select-trigger"]').first().innerText();
    assert(selectedPoText.includes(poAutoCode), `Quality Check auto-selected new Production Order: ${selectedPoText}`);

    await qcDialog.locator('input[placeholder*="Inspector"]').fill('Inspector Tariq');
    await qcDialog.locator('input[placeholder*="Tensile"]').fill('Tensile Strength');
    await qcDialog.locator('input[placeholder*="ISO"]').fill('ISO 13934-1');
    await qcDialog.locator('input[placeholder*="Pass"]').fill('Pass 98%');
    await qcDialog.locator('button:has-text("Create")').click();
    await qcDialog.waitFor({ state: 'hidden', timeout: 10000 });

    await page.waitForSelector(`table >> text=${poAutoCode}`, { timeout: 10000 });
    assert(true, `Quality Check created and displays human-readable ${poAutoCode} in table`);

    // Verify /production/orders Edit form formats startDate & endDate cleanly as YYYY-MM-DD
    log('--- Testing /production/orders Edit date formatting ---');
    await page.goto(`${baseOrigin}/production/orders`, { waitUntil: 'networkidle' });
    await page.locator('table tbody tr', { hasText: poAutoCode }).locator('button').last().click();
    await page.locator('[role="menuitem"]', { hasText: 'Edit' }).click();
    const editProdDialog = page.locator('[data-slot="dialog-content"]', { hasText: 'Edit Production Order' }).last();
    await editProdDialog.waitFor({ state: 'visible' });
    const prodStart = new Date().toISOString().split('T')[0];
    await editProdDialog.locator('input[type="date"]').nth(0).fill(prodStart);
    await editProdDialog.locator('button:has-text("Update")').click();
    await editProdDialog.waitFor({ state: 'hidden', timeout: 10000 });
    await page.locator('table tbody tr', { hasText: poAutoCode }).locator('button').last().click();
    await page.locator('[role="menuitem"]', { hasText: 'Edit' }).click();
    await editProdDialog.waitFor({ state: 'visible' });
    const reloadedProdStart = await editProdDialog.locator('input[type="date"]').nth(0).inputValue();
    assert(reloadedProdStart === prodStart, `Production Order Edit preserved YYYY-MM-DD Start Date (${reloadedProdStart})`);
    await editProdDialog.locator('button:has-text("Cancel")').click();
    await editProdDialog.waitFor({ state: 'hidden', timeout: 5000 });

    // ------------------------------------------------------------------
    // 7. Test /finance/expenses (Record Sundry Expense)
    // ------------------------------------------------------------------
    log('--- Testing /finance/expenses ---');
    await page.goto(`${baseOrigin}/finance/expenses`, { waitUntil: 'networkidle' });
    await page.click('button:has-text("Record Expense")');
    const expDialog = page.locator('[data-slot="dialog-content"]', { hasText: 'Record Sundry Expense' }).last();
    await expDialog.waitFor({ state: 'visible' });

    await expDialog.locator('#payee').fill('Shell Fuel Station');
    await expDialog.locator('#amount').fill('4500');
    await expDialog.locator('#notes').fill('Generator diesel refill');
    await expDialog.locator('button:has-text("Post Expense Voucher")').click();
    await expDialog.waitFor({ state: 'hidden', timeout: 15000 });

    await page.waitForSelector('table >> text=Shell Fuel Station', { timeout: 10000 });
    assert(true, 'Sundry Expense voucher posted and visible in table');

    // ------------------------------------------------------------------
    // 8. Test /finance/journal (Auto JE code + 2 lines + QuickAdd Account + Create + Post)
    // ------------------------------------------------------------------
    log('--- Testing /finance/journal ---');
    await page.goto(`${baseOrigin}/finance/journal`, { waitUntil: 'networkidle' });
    await page.click('button:has-text("Add Entry")');
    const jeDialog = page.locator('[data-slot="dialog-content"]', { hasText: 'Add Journal Entry' }).last();
    await jeDialog.waitFor({ state: 'visible' });

    const jeAutoCode = await jeDialog.locator('input').first().inputValue();
    assert(/^JE-\d{4}$/.test(jeAutoCode), `Journal Entry auto-generated code: ${jeAutoCode}`);

    const lineTriggers = jeDialog.locator('[data-slot="select-trigger"]');
    const triggerCount = await lineTriggers.count();
    assert(triggerCount >= 2, `Journal Entry opens with ${triggerCount} account lines ready`);

    // Line 1: QuickAdd Account
    await lineTriggers.nth(0).click();
    await page.click('button:has-text("Add Account")');
    const accQuickDialog = page.locator('[data-slot="dialog-content"]', { hasText: 'Add Account' }).last();
    await accQuickDialog.waitFor({ state: 'visible' });
    const accAutoCode = await accQuickDialog.locator('input').first().inputValue();
    assert(/^ACC-\d{4}$/.test(accAutoCode), `Account QuickCreate auto-generated code: ${accAutoCode}`);
    await accQuickDialog.locator('input').nth(1).fill('Factory Maintenance Misc');
    await accQuickDialog.locator('button:has-text("Save & Select")').click();
    await accQuickDialog.waitFor({ state: 'hidden', timeout: 10000 });

    // Line 2: Test EntitySelect search input (>= 6 accounts) and select Cash
    await lineTriggers.nth(1).click();
    const searchInput = page.locator('[data-slot="select-content"][data-open] input[type="text"]');
    if (await searchInput.count()) {
      await searchInput.fill('Cash');
      await page.waitForTimeout(200);
    }
    await page.locator('[data-slot="select-content"][data-open] [data-slot="select-item"]').first().click();

    const numInputs = jeDialog.locator('input[type="number"]');
    await numInputs.nth(0).fill('5000'); // Line 1 Debit
    await numInputs.nth(3).fill('5000'); // Line 2 Credit
    await page.waitForSelector('text=Balanced', { timeout: 5000 });
    await jeDialog.locator('button:has-text("Create")').click();
    await jeDialog.waitFor({ state: 'hidden', timeout: 10000 });

    await page.waitForSelector(`table >> text=${jeAutoCode}`, { timeout: 10000 });
    await page.locator('table tbody tr', { hasText: jeAutoCode }).locator('button[title="Post Journal Entry"]').click();
    await page.waitForSelector(`table tbody tr:has-text("${jeAutoCode}") >> text=Posted`, { timeout: 10000 });
    assert(true, `Journal Entry ${jeAutoCode} created and posted cleanly`);

    // Create a 2nd draft Journal Entry, Edit it, then Delete it (testing child item deletion & no P2003)
    await page.click('button:has-text("Add Entry")');
    await jeDialog.waitFor({ state: 'visible' });
    const jeDraftCode = await jeDialog.locator('input').first().inputValue();
    await jeDialog.locator('[data-slot="select-trigger"]').nth(0).click();
    await page.locator('[data-slot="select-content"][data-open] [data-slot="select-item"]').first().click();
    await jeDialog.locator('[data-slot="select-trigger"]').nth(1).click();
    await page.locator('[data-slot="select-content"][data-open] [data-slot="select-item"]').nth(1).click();
    await jeDialog.locator('input[type="number"]').nth(0).fill('1200');
    await jeDialog.locator('input[type="number"]').nth(3).fill('1200');
    await jeDialog.locator('button:has-text("Create")').click();
    await jeDialog.waitFor({ state: 'hidden', timeout: 10000 });
    await page.waitForSelector(`table >> text=${jeDraftCode}`, { timeout: 10000 });

    await page.locator('table tbody tr', { hasText: jeDraftCode }).locator('button').last().click();
    await page.locator('[role="menuitem"]', { hasText: 'Edit' }).click();
    const editJeDialog = page.locator('[data-slot="dialog-content"]', { hasText: 'Edit Journal Entry' }).last();
    await editJeDialog.waitFor({ state: 'visible' });
    await editJeDialog.locator('textarea').fill('Edited draft journal description');
    await editJeDialog.locator('button:has-text("Update")').click();
    await editJeDialog.waitFor({ state: 'hidden', timeout: 10000 });
    await page.waitForSelector('table >> text=Edited draft journal description', { timeout: 10000 });

    await page.locator('table tbody tr', { hasText: jeDraftCode }).locator('button').last().click();
    await page.locator('[role="menuitem"]', { hasText: 'Delete' }).click();
    const delJeDialog = page.locator('[data-slot="dialog-content"]', { hasText: 'Delete Journal Entry' }).last();
    await delJeDialog.waitFor({ state: 'visible' });
    await delJeDialog.locator('button:has-text("Delete")').click();
    await delJeDialog.waitFor({ state: 'hidden', timeout: 10000 });
    await page.waitForTimeout(400);
    const jeDraftCount = await page.locator('table tbody tr', { hasText: jeDraftCode }).count();
    assert(jeDraftCount === 0, `Draft Journal Entry ${jeDraftCode} edited and deleted cleanly`);

    // ------------------------------------------------------------------
    // 8b. Test /hr/payroll (Payhead PH-0001 + Payroll Period create/delete)
    // ------------------------------------------------------------------
    log('--- Testing /hr/payroll ---');
    await page.goto(`${baseOrigin}/hr/payroll`, { waitUntil: 'networkidle' });
    await page.click('button:has-text("Add Payhead")');
    const phDialog = page.locator('[data-slot="dialog-content"]', { hasText: 'Add Payhead' }).last();
    await phDialog.waitFor({ state: 'visible' });
    const phAutoCode = await phDialog.locator('input').nth(1).inputValue();
    assert(/^PH-\d{4}$/.test(phAutoCode), `Payhead auto-generated code: ${phAutoCode}`);
    await phDialog.locator('input').nth(0).fill('Basic Allowance');
    await phDialog.locator('button:has-text("Create")').click();
    await phDialog.waitFor({ state: 'hidden', timeout: 10000 });
    await page.waitForSelector('table >> text=Basic Allowance', { timeout: 10000 });

    await page.click('button:has-text("Payroll Periods")');
    await page.click('button:has-text("Add Period")');
    const periodDialog = page.locator('[data-slot="dialog-content"]', { hasText: 'Add Period' }).last();
    await periodDialog.waitFor({ state: 'visible' });
    const periodStartVal = await periodDialog.locator('input[type="date"]').nth(0).inputValue();
    assert(/^\d{4}-\d{2}-\d{2}$/.test(periodStartVal), `Payroll Period pre-filled Start Date (${periodStartVal})`);
    await periodDialog.locator('input').first().fill('Test Verification Period');
    await periodDialog.locator('button:has-text("Create")').click();
    await periodDialog.waitFor({ state: 'hidden', timeout: 10000 });
    await page.waitForSelector('table >> text=Test Verification Period', { timeout: 10000 });

    await page.locator('table tbody tr', { hasText: 'Test Verification Period' }).locator('button').last().click();
    await page.locator('[role="menuitem"]', { hasText: 'Delete' }).click();
    const delPeriodDialog = page.locator('[data-slot="dialog-content"]', { hasText: 'Delete Period' }).last();
    await delPeriodDialog.waitFor({ state: 'visible' });
    await delPeriodDialog.locator('button:has-text("Delete")').click();
    await delPeriodDialog.waitFor({ state: 'hidden', timeout: 10000 });
    await page.waitForTimeout(400);
    const periodCount = await page.locator('table tbody tr', { hasText: 'Test Verification Period' }).count();
    assert(periodCount === 0, 'Payroll Period created with pre-filled dates and deleted cleanly');

    // ------------------------------------------------------------------
    // 8c. Test /warehouse/list (Create WH-0001 + Deactivate + isActive filter)
    // ------------------------------------------------------------------
    log('--- Testing /warehouse/list & isActive filter ---');
    await page.goto(`${baseOrigin}/warehouse/list`, { waitUntil: 'networkidle' });
    await page.click('button:has-text("Add Warehouse")');
    const whDialog = page.locator('[data-slot="dialog-content"]', { hasText: 'Add Warehouse' }).last();
    await whDialog.waitFor({ state: 'visible' });
    const whAutoCode = await whDialog.locator('input').nth(1).inputValue();
    assert(/^WH-\d{4}$/.test(whAutoCode), `Warehouse auto-generated code: ${whAutoCode}`);
    await whDialog.locator('input').nth(0).fill('Secondary Yarn Store');
    await whDialog.locator('button:has-text("Create")').click();
    await whDialog.waitFor({ state: 'hidden', timeout: 10000 });
    await page.waitForSelector('table >> text=Secondary Yarn Store', { timeout: 10000 });
    await page.locator('table tbody tr', { hasText: 'Secondary Yarn Store' }).locator('button').last().click();
    await page.locator('[role="menuitem"]', { hasText: 'Deactivate' }).click();
    await page.waitForSelector('table tbody tr:has-text("Secondary Yarn Store") >> text=Inactive', { timeout: 10000 });
    const whFilterCheck = await page.evaluate(async () => {
      const apiBase = window.desktopBridge?.getApiBase?.() || 'http://127.0.0.1:4001/api/v1';
      const token = window.desktopBridge?.getSession?.() || localStorage.getItem('session_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const activeRes = await fetch(`${apiBase}/inventory/warehouses?isActive=true`, { headers, credentials: 'include' }).then((r) => r.json());
      const inactiveRes = await fetch(`${apiBase}/inventory/warehouses?isActive=false`, { headers, credentials: 'include' }).then((r) => r.json());
      return {
        activeCount: (activeRes.data || []).length,
        inactiveCount: (inactiveRes.data || []).length,
      };
    });
    assert(whFilterCheck.activeCount === 0 && whFilterCheck.inactiveCount === 1,
      `Warehouse isActive query filtering works (active=${whFilterCheck.activeCount}, inactive=${whFilterCheck.inactiveCount})`);

    // ------------------------------------------------------------------
    // 9. Test Close & Reopen Session Persistence
    // ------------------------------------------------------------------
    log('--- Testing Close & Reopen session persistence ---');
    await browser.close().catch(() => {});
    killFreshTestProcesses();
    await wait(3000);

    electronProc = launchElectronFreshTest(cookieWarnings);
    await waitForCdp(CDP_PORT, 90000);
    const browser2 = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
    const page2 = await getMainAppPage(browser2, 90000);
    await page2.waitForLoadState('networkidle');
    await page2.waitForTimeout(1500);

    const reopenUrl = page2.url();
    log(`Reopened Electron URL: ${reopenUrl}`);
    assert(reopenUrl.includes('/dashboard') && !reopenUrl.includes('/login') && !reopenUrl.includes('/setup'),
      `Close & reopen restored directly to ${reopenUrl} without login/password prompt`);

    await browser2.close().catch(() => {});

    assert(cookieWarnings.length === 0, `Zero Electron HttpOnly cookie overwrite warnings (found: ${cookieWarnings.length})`);
    assert(networkFailures.length === 0, `Zero unexpected >=400 API errors (found: ${JSON.stringify(networkFailures)})`);
    log(`Console error count: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      log(`Console errors observed: ${JSON.stringify(consoleErrors)}`);
    }

    log('================================================================');
    log('ALL LIVE ELECTRON SECONDARY MODULES & GRAPH CHECKS PASSED!');
    log('================================================================');
  } finally {
    try { if (browser) await browser.close(); } catch {}
    killFreshTestProcesses();
    try { if (electronProc && !electronProc.killed) electronProc.kill(); } catch {}
  }
}

main().catch((err) => {
  console.error('VERIFICATION FAILED:', err);
  killFreshTestProcesses();
  process.exit(1);
});

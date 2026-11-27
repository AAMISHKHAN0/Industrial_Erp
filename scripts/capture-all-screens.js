const path = require('path');
const fs = require('fs');
const { chromium } = require('../frontend/node_modules/playwright');

const SCREENSHOT_DIR = 'C:\\Users\\Aamishkhan\\.gemini\\antigravity\\brain\\a1129e7e-edf2-42bb-855c-d43af8897bee\\screenshots';

async function capture() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  console.log('Launching browser for UI verification...');
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  const page = await context.newPage();

  console.log('Navigating to login page...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Fill login
  console.log('Logging in as admin@industrialerp.local...');
  await page.fill('input[type="email"]', 'admin@industrialerp.local');
  await page.fill('input[type="password"]', 'Admin#2026!');
  await page.click('button[type="submit"]');

  await page.waitForURL('**/dashboard', { timeout: 15000 }).catch(async () => {
    console.log('URL did not transition automatically to /dashboard, current URL:', page.url());
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle' });
  });

  await page.waitForTimeout(2000);

  // 1. Dashboard
  console.log('Capturing 01_dashboard.png...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_dashboard.png'), fullPage: true });

  // 2. Navigation / More menu
  console.log('Opening More menu for navigation screenshot...');
  // Find "More" button or trigger in sidebar/header
  const moreButton = await page.$('button:has-text("More"), a:has-text("More")');
  if (moreButton) {
    await moreButton.click();
    await page.waitForTimeout(500);
  }
  console.log('Capturing 02_navigation_menu.png...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_navigation_menu.png'), fullPage: false });

  const screens = [
    { name: '03_stores_grn.png', url: 'http://localhost:3000/purchase/goods-receiving' },
    { name: '04_stores_material_issue.png', url: 'http://localhost:3000/inventory/material-issue' },
    { name: '05_stores_stock_register.png', url: 'http://localhost:3000/inventory/stock-ledger' },
    { name: '06_sales_invoices.png', url: 'http://localhost:3000/sales/invoices' },
    { name: '07_sales_customer_receipts.png', url: 'http://localhost:3000/sales/receipts' },
    { name: '08_payroll_daily_wages.png', url: 'http://localhost:3000/hr/wages' },
    { name: '09_payroll_monthly_salaries.png', url: 'http://localhost:3000/hr/payroll' },
    { name: '10_accounts_sundry_expenses.png', url: 'http://localhost:3000/finance/expenses' },
    { name: '11_accounts_outgoing_payments.png', url: 'http://localhost:3000/finance/payments' },
    { name: '12_accounts_5tab_ledgers.png', url: 'http://localhost:3000/finance/ledgers' }
  ];

  for (const s of screens) {
    console.log(`Navigating to ${s.url}...`);
    try {
      await page.goto(s.url, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, s.name), fullPage: true });
      console.log(`Captured ${s.name} successfully.`);
    } catch (err) {
      console.error(`Error capturing ${s.name}:`, err.message);
      // Fallback simple screenshot
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, s.name) });
    }
  }

  await browser.close();
  console.log('All screenshots captured successfully in:', SCREENSHOT_DIR);
}

capture().catch(err => {
  console.error('Fatal capture error:', err);
  process.exit(1);
});

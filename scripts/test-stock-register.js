const { chromium } = require('../frontend/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/login');
  await page.fill('input[type="email"]', 'admin@industrialerp.local');
  await page.fill('input[type="password"]', 'Admin#2026!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');

  await page.goto('http://localhost:3000/inventory/stock-ledger');
  await page.waitForTimeout(2000);

  const text = await page.textContent('body');
  console.log('Stock register page text snippet:', text.slice(0, 1500));

  const tableRows = await page.locator('table tbody tr').allInnerTexts();
  console.log('Table rows:', tableRows);

  await browser.close();
})().catch(e => console.error(e));

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

  await page.goto('http://localhost:3000/finance/ledgers');
  await page.waitForTimeout(2000);

  const title = await page.title();
  const url = page.url();
  console.log('Current URL:', url, 'Title:', title);

  const tabs = await page.locator('[role="tab"]').allInnerTexts();
  console.log('Found tabs:', tabs);

  const buttons = await page.locator('button').allInnerTexts();
  console.log('Found buttons sample:', buttons.slice(0, 15));

  await browser.close();
})().catch(e => console.error(e));

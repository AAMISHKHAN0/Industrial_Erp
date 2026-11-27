const fs = require('fs');
const { chromium } = require('../frontend/node_modules/playwright');

const CHROME_EXE = fs.existsSync('C:\\Users\\Aamishkhan\\AppData\\Local\\ms-playwright\\chromium-1248\\chrome-win64\\chrome.exe')
  ? 'C:\\Users\\Aamishkhan\\AppData\\Local\\ms-playwright\\chromium-1248\\chrome-win64\\chrome.exe'
  : 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function test(port) {
  console.log(`\n=== Testing port ${port} ===`);
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME_EXE,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  await page.goto(`http://localhost:${port}/login`);
  await page.fill('input[type="email"]', 'owner@digitalerena.local');
  await page.fill('input[type="password"]', 'Admin#2026!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });

  await page.goto(`http://localhost:${port}/customers`);
  await page.waitForTimeout(2000);
  console.log(`Page URL:`, page.url());

  const addBtn = page.locator('button:has-text("Add Customer")');
  const count = await addBtn.count();
  console.log(`Add Customer buttons found: ${count}`);

  if (count > 0) {
    await addBtn.first().click();
    await page.waitForTimeout(1000);
    const labels = await page.locator('label').allInnerTexts();
    console.log(`Form labels on port ${port}:`, labels);
    const inputs = await page.locator('input, textarea').evaluateAll(els => els.map(e => ({ name: e.name, id: e.id, placeholder: e.placeholder })));
    console.log(`Form inputs on port ${port}:`, inputs);
  }

  await browser.close();
}

async function run() {
  await test(3000);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

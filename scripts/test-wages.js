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

  await page.goto('http://localhost:3000/hr/wages');
  await page.waitForTimeout(1000);
  await page.click('button:has-text("New Daily Wage Run")');
  await page.waitForTimeout(600);

  // Worker Select
  const workerBtn = page.locator('div[role="dialog"] button:has-text("Select Worker")');
  if (await workerBtn.isVisible()) {
    await workerBtn.click();
    await page.waitForTimeout(300);
    const workers = await page.locator('[role="option"]:visible').allInnerTexts();
    console.log('Workers:', workers);
    await page.locator('[role="option"]:visible').first().click();
    await page.waitForTimeout(300);
  }

  // Days worked & Rate
  const inputs = await page.$$('div[role="dialog"] table tbody input[type="number"]');
  console.log('Number inputs in wage table:', inputs.length);
  if (inputs.length >= 3) {
    await inputs[0].fill('3'); // days worked
    await inputs[1].fill('1000'); // daily rate
    await inputs[2].fill('0'); // deductions
  }

  await page.click('div[role="dialog"] button:has-text("Post Daily Wage Accrual")');
  await page.waitForTimeout(2500);
  console.log('Daily Wage Accrual Posted!');

  // Check table row for Disburse
  const disburseBtn = page.locator('table tbody tr:first-child button:has-text("Disburse")').first();
  console.log('Disburse button visible:', await disburseBtn.isVisible());
  if (await disburseBtn.isVisible()) {
    await disburseBtn.click();
    await page.waitForTimeout(600);
    console.log('Disburse dialog buttons:', await page.locator('div[role="dialog"] button').allInnerTexts());
    await page.click('div[role="dialog"] button:has-text("Confirm & Post Disbursement")');
    await page.waitForTimeout(2000);
    console.log('Disbursement posted successfully!');
  }

  await browser.close();
})().catch(e => console.error(e));

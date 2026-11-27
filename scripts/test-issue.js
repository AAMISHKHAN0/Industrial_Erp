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

  await page.goto('http://localhost:3000/inventory/material-issue');
  await page.waitForTimeout(1000);

  await page.click('button:has-text("Issue Material")');
  await page.waitForTimeout(600);

  // Demand Note Trigger
  const demandTrigger = page.locator('div[role="dialog"] button:has-text("Select demand note")');
  console.log('demandTrigger count:', await demandTrigger.count());
  if (await demandTrigger.count() > 0) {
    await demandTrigger.click();
    await page.waitForTimeout(300);
    const demands = await page.locator('[role="option"]:visible').allInnerTexts();
    console.log('Visible demands:', demands);
    await page.locator('[role="option"]:visible').first().click();
    await page.waitForTimeout(500);
  }

  // Warehouse Trigger
  const whTrigger = page.locator('div[role="dialog"] button:has-text("Select warehouse")');
  console.log('whTrigger count:', await whTrigger.count());
  if (await whTrigger.count() > 0) {
    await whTrigger.click();
    await page.waitForTimeout(300);
    const whs = await page.locator('[role="option"]:visible').allInnerTexts();
    console.log('Visible warehouses:', whs);
    await page.locator('[role="option"]:visible').first().click();
    await page.waitForTimeout(800);
  }

  // Check lines populated
  const tableRows = await page.locator('div[role="dialog"] table tbody tr').count();
  console.log(`Populated demand items rows: ${tableRows}`);

  // Confirm issue
  const confirmBtn = page.locator('div[role="dialog"] button:has-text("Confirm & Post Issue")');
  console.log('confirmBtn visible:', await confirmBtn.isVisible(), 'enabled:', await confirmBtn.isEnabled());

  if (await confirmBtn.isEnabled()) {
    await confirmBtn.click();
    await page.waitForTimeout(2500);
    console.log('Material Issue Posted!');
  }

  await browser.close();
})().catch(e => console.error(e));

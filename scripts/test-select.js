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
  console.log('Logged in!');

  await page.goto('http://localhost:3000/purchase/goods-receiving');
  await page.waitForTimeout(1000);
  await page.click('button:has-text("Add GRN")');
  await page.waitForTimeout(600);
  await page.click('button:has-text("Direct GRN")');
  await page.waitForTimeout(500);

  // Warehouse
  await page.locator('div[role="dialog"] button[role="combobox"]').first().click();
  await page.waitForTimeout(300);
  await page.locator('[role="option"]:visible').first().click();
  await page.waitForTimeout(300);

  // Vendor
  await page.locator('div[role="dialog"] button[role="combobox"]').nth(1).click();
  await page.waitForTimeout(300);
  await page.locator('[role="option"]:visible').first().click();
  await page.waitForTimeout(300);

  // Item select for line item
  const itemTrigger = page.locator('div[role="dialog"] div:has-text("Add inventory item") button[role="combobox"]').first();
  console.log('Item trigger visible:', await itemTrigger.isVisible());
  if (await itemTrigger.isVisible()) {
    await itemTrigger.click();
    await page.waitForTimeout(300);
    await page.locator('[role="option"]:visible').first().click();
    await page.waitForTimeout(300);
    await page.locator('div[role="dialog"] button:has-text("Add Line Item")').click();
    await page.waitForTimeout(500);
    console.log('Added line item to GRN!');
  }

  const numInputs = await page.$$('div[role="dialog"] table tbody input[type="number"]');
  console.log('Found number inputs in GRN table:', numInputs.length);
  if (numInputs.length >= 4) {
    await numInputs[0].fill('10');
    await numInputs[1].fill('10');
    await numInputs[3].fill('100');
    console.log('Filled qty=10, accepted=10, cost=100');
  }

  await page.click('div[role="dialog"] button:has-text("Post GRN to Stock")');
  await page.waitForTimeout(2000);
  console.log('Post GRN clicked!');

  await browser.close();
})().catch(e => console.error('Error:', e));

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

  await page.goto('http://localhost:3000/purchase/goods-receiving');
  await page.waitForTimeout(1000);
  await page.click('button:has-text("Add GRN")');
  await page.waitForTimeout(500);
  await page.click('button:has-text("Direct GRN")');
  await page.waitForTimeout(500);

  // Look for all buttons in dialog
  const btns = await page.locator('div[role="dialog"] button').allInnerTexts();
  console.log('All buttons in dialog:', btns);

  const itemTrigger = page.locator('div[role="dialog"] button:has-text("Add inventory item")');
  console.log('itemTrigger count:', await itemTrigger.count());
  if (await itemTrigger.count() > 0) {
    await itemTrigger.click();
    await page.waitForTimeout(500);
    const visibleOpts = await page.locator('[role="option"]:visible').allInnerTexts();
    console.log('Visible options under Add inventory item:', visibleOpts);
  }

  await browser.close();
})().catch(e => console.error(e));

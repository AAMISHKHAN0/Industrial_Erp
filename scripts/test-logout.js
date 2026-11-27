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

  await page.goto('http://localhost:3000/finance/payments');
  await page.waitForTimeout(1000);

  // Profile button
  const trigger = page.locator('button:has-text("AD")').first();
  console.log('trigger visible:', await trigger.isVisible());
  await trigger.click();
  await page.waitForTimeout(500);

  const menuItems = await page.locator('[role="menuitem"]:visible').allInnerTexts();
  console.log('Visible menu items after profile click:', menuItems);

  await page.locator('[role="menuitem"]:has-text("Logout")').click();
  await page.waitForTimeout(1500);
  console.log('After logout, URL:', page.url());

  await browser.close();
})().catch(e => console.error('Error:', e));

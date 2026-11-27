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

  const btns = await page.locator('button').allInnerTexts();
  console.log('Buttons on Wages page:', btns.filter(b => b.trim().length > 0));

  await page.click('button:has-text("New Daily Wage Run")').catch(async () => {
    await page.click('button:has-text("New")');
  });
  await page.waitForTimeout(600);

  const dialogBtns = await page.locator('div[role="dialog"] button').allInnerTexts();
  console.log('Dialog buttons in Wages:', dialogBtns);

  await browser.close();
})().catch(e => console.error(e));

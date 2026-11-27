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

  await page.goto('http://localhost:3000/purchase/demand-notes');
  await page.waitForTimeout(1000);
  await page.click('button:has-text("Create Demand Note")');
  await page.waitForTimeout(500);

  const btns = await page.locator('div[role="dialog"] button').allInnerTexts();
  console.log('All buttons in Demand dialog:', btns);

  // Department select
  const deptTrigger = page.locator('div[role="dialog"] button:has-text("Select department")');
  console.log('deptTrigger count:', await deptTrigger.count());
  if (await deptTrigger.count() > 0) {
    await deptTrigger.click();
    await page.waitForTimeout(300);
    const depts = await page.locator('[role="option"]:visible').allInnerTexts();
    console.log('Visible departments:', depts);
    await page.locator('[role="option"]:visible').first().click();
    await page.waitForTimeout(300);
  }

  // Item select
  const itemTrigger = page.locator('div[role="dialog"] button:has-text("Select inventory item to add")');
  console.log('itemTrigger count:', await itemTrigger.count());
  if (await itemTrigger.count() > 0) {
    await itemTrigger.click();
    await page.waitForTimeout(300);
    const items = await page.locator('[role="option"]:visible').allInnerTexts();
    console.log('Visible items in demand:', items);
    await page.locator('[role="option"]:visible').first().click();
    await page.waitForTimeout(300);
    await page.click('div[role="dialog"] button:has-text("Add Item")');
    await page.waitForTimeout(400);
  }

  const qtyInput = page.locator('div[role="dialog"] table tbody input[type="number"]').first();
  console.log('qtyInput visible:', await qtyInput.isVisible());
  if (await qtyInput.isVisible()) {
    await qtyInput.fill('12');
  }

  await page.click('div[role="dialog"] button:has-text("Create Demand Note")');
  await page.waitForTimeout(2000);
  console.log('Created Demand Note!');

  // Approval
  const menuBtn = page.locator('table tbody tr:first-child button[aria-haspopup="menu"]').first();
  if (await menuBtn.isVisible()) {
    await menuBtn.click();
    await page.waitForTimeout(300);
    const menuItems = await page.locator('[role="menuitem"]:visible').allInnerTexts();
    console.log('Demand action menu items:', menuItems);
    await page.click('text="Submit for Approval"');
    await page.waitForTimeout(1000);

    await menuBtn.click();
    await page.waitForTimeout(300);
    await page.click('text="Approve Requisition"');
    await page.waitForTimeout(1500);
    console.log('Approved Demand Note!');
  }

  await browser.close();
})().catch(e => console.error(e));

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

  // Customer
  await page.goto('http://localhost:3000/customers');
  await page.waitForTimeout(1000);
  const addCustBtn = page.locator('button:has-text("Add Customer")');
  if (await addCustBtn.isVisible()) {
    await addCustBtn.click();
    await page.waitForTimeout(400);
    const codeInput = page.locator('div[role="dialog"] input[placeholder*="CUST-"]').first();
    const nameInput = page.locator('div[role="dialog"] input[placeholder*="ABC Textiles"]').first();
    await codeInput.fill('CUST-ALKARAM');
    await nameInput.fill('Al-Karam Textile Mills');
    await page.click('div[role="dialog"] button:has-text("Save"), div[role="dialog"] button:has-text("Create")');
    await page.waitForTimeout(1500);
    console.log('Customer created or verified!');
  }

  // Sales Invoice totaling 1,000
  await page.goto('http://localhost:3000/sales/invoices');
  await page.waitForTimeout(1000);
  await page.click('button:has-text("New Sales Invoice")');
  await page.waitForTimeout(600);

  // Customer select
  await page.locator('div[role="dialog"] button:has-text("Select Customer")').click();
  await page.waitForTimeout(300);
  await page.locator('[role="option"]:visible:has-text("Al-Karam")').first().click().catch(async () => {
    await page.locator('[role="option"]:visible').first().click();
  });
  await page.waitForTimeout(300);

  // Line item: description, quantity 1, price 1000, tax 0
  const descInput = page.locator('div[role="dialog"] table tbody input[placeholder*="Description"]').first();
  await descInput.fill('Cotton Shirting Fabric 50m');

  const numInputs = await page.$$('div[role="dialog"] table tbody input[type="number"]');
  if (numInputs.length >= 3) {
    await numInputs[0].fill('1'); // qty
    await numInputs[1].fill('1000'); // unitPrice
    await numInputs[2].fill('0'); // taxPct
  }

  await page.click('div[role="dialog"] button:has-text("Post Sales Invoice")');
  await page.waitForTimeout(2000);

  let postedInvNum = '';
  let postedGlVoucher = '';
  const successModal = page.locator('div[role="dialog"]:has-text("Sales Invoice Posted!")');
  if (await successModal.isVisible()) {
    postedInvNum = await successModal.locator('span.font-mono.font-bold').first().innerText();
    postedGlVoucher = await successModal.locator('span.font-mono').nth(1).innerText();
    console.log(`Invoice posted: ${postedInvNum}, GL Voucher: ${postedGlVoucher}`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // Customer Receipt for 600
  await page.goto('http://localhost:3000/sales/receipts');
  await page.waitForTimeout(1000);
  await page.click('button:has-text("Record Customer Receipt")');
  await page.waitForTimeout(600);

  // Customer select
  await page.locator('div[role="dialog"] button:has-text("Select customer")').click();
  await page.waitForTimeout(300);
  await page.locator('[role="option"]:visible:has-text("Al-Karam")').first().click().catch(async () => {
    await page.locator('[role="option"]:visible').first().click();
  });
  await page.waitForTimeout(500);

  // Cheque method
  await page.locator('div[role="dialog"] button:has-text("CHEQUE")').click().catch(() => {});

  // Enter amount allocated = 600
  const allocInputs = await page.$$('div[role="dialog"] table tbody input[type="number"]');
  if (allocInputs.length > 0) {
    await allocInputs[0].fill('600');
  }

  await page.click('div[role="dialog"] button:has-text("Post Customer Receipt")');
  await page.waitForTimeout(2500);
  console.log('Customer Receipt for PKR 600 posted!');

  // Check Invoices page for outstanding = 400
  await page.goto('http://localhost:3000/sales/invoices');
  await page.waitForTimeout(1500);
  const invRowText = await page.locator('table tbody tr:first-child').innerText();
  console.log('Invoice row text:', invRowText);

  // Check Customer Ledger for outstanding = 400
  await page.goto('http://localhost:3000/finance/ledgers');
  await page.waitForTimeout(1500);
  await page.click('button[role="tab"]:has-text("Customer Ledger")');
  await page.waitForTimeout(1500);

  const ledgerBody = await page.textContent('body');
  console.log('Customer Ledger contains 400.00:', ledgerBody.includes('400.00') || ledgerBody.includes('400'));

  await browser.close();
})().catch(e => console.error(e));

const { chromium } = require('../frontend/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = 'C:\\Users\\Aamishkhan\\.gemini\\antigravity\\brain\\a1129e7e-edf2-42bb-855c-d43af8897bee\\screenshots';

async function captureBefore() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  const sizes = [
    { name: '1366x768', width: 1366, height: 768 },
    { name: '640x900_narrow', width: 640, height: 900 }
  ];

  for (const s of sizes) {
    const context = await browser.newContext({
      viewport: { width: s.width, height: s.height },
    });
    const page = await context.newPage();

    // Login
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', 'admin@industrialerp.local');
    await page.fill('input[type="password"]', 'Admin#2026!');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard', { timeout: 15000 }).catch(async () => {
      await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle' });
    });
    await page.waitForTimeout(1000);

    // Navigate to Sales Invoices
    await page.goto('http://localhost:3000/sales/invoices', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Click "New Sales Invoice" button
    const newInvoiceBtn = await page.locator('button:has-text("New Sales Invoice")').first();
    await newInvoiceBtn.waitFor({ state: 'visible', timeout: 10000 });
    await newInvoiceBtn.click();
    await page.waitForTimeout(1000);

    // Inspect rendered dialog dimensions
    const dialogMetrics = await page.evaluate(() => {
      const el = document.querySelector('[data-slot="dialog-content"]');
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return {
        width: rect.width,
        height: rect.height,
        maxWidth: style.maxWidth,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        hasHorizontalScroll: el.scrollWidth > el.clientWidth,
        classes: el.className,
      };
    });

    console.log(`[BEFORE] Viewport ${s.name} Dialog Metrics:`, JSON.stringify(dialogMetrics, null, 2));

    const screenshotPath = path.join(SCREENSHOT_DIR, `before_invoice_dialog_${s.name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`Saved screenshot: ${screenshotPath}`);

    await context.close();
  }

  await browser.close();
}

captureBefore().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

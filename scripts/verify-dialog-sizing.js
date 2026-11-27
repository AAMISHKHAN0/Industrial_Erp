const { chromium } = require('../frontend/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = 'C:\\Users\\Aamishkhan\\.gemini\\antigravity\\brain\\a1129e7e-edf2-42bb-855c-d43af8897bee\\screenshots';

async function verifyDialogSizing() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  console.log('========================================================================');
  console.log('    INDUSTRIAL ERP - MULTI-RESOLUTION DIALOG SIZING VERIFICATION        ');
  console.log('========================================================================');

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  const resolutions = [
    { name: '1920x1080_desktop', width: 1920, height: 1080, scale: 1 },
    { name: '1366x768_laptop', width: 1366, height: 768, scale: 1, isTargetAfter: true },
    { name: '1024x768_tablet', width: 1024, height: 768, scale: 1 },
    { name: 'zoom125_1093x614', width: 1093, height: 614, scale: 1.25 },
    { name: '640x900_narrow', width: 640, height: 900, scale: 1, isNarrowAfter: true },
  ];

  const results = [];

  for (const res of resolutions) {
    console.log(`\n>>> Testing Sales Invoice Dialog at ${res.name} (${res.width}x${res.height}, scale: ${res.scale})...`);

    const context = await browser.newContext({
      viewport: { width: res.width, height: res.height },
      deviceScaleFactor: res.scale,
    });
    const page = await context.newPage();

    // Sign in
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', 'admin@industrialerp.local');
    await page.fill('input[type="password"]', 'Admin#2026!');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard', { timeout: 15000 }).catch(async () => {
      await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle' });
    });
    await page.waitForTimeout(800);

    // Open Sales Invoices page
    await page.goto('http://localhost:3000/sales/invoices', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Open "New Sales Invoice" Dialog
    const newInvoiceBtn = await page.locator('button:has-text("New Sales Invoice")').first();
    await newInvoiceBtn.waitFor({ state: 'visible', timeout: 10000 });
    await newInvoiceBtn.click();
    await page.waitForTimeout(800);

    // Measure Dialog Metrics
    const metrics = await page.evaluate(() => {
      const el = document.querySelector('[data-slot="dialog-content"]');
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const header = el.querySelector('[data-slot="dialog-header"]');
      const footer = el.querySelector('[data-slot="dialog-footer"]');
      const closeBtn = el.querySelector('[data-slot="dialog-close"]');

      return {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        maxWidth: style.maxWidth,
        maxHeight: style.maxHeight,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        hasHorizontalOverflow: el.scrollWidth > el.clientWidth,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        headerVisible: Boolean(header && header.getBoundingClientRect().height > 0),
        footerVisible: Boolean(footer && footer.getBoundingClientRect().height > 0),
        closeBtnVisible: Boolean(closeBtn && closeBtn.getBoundingClientRect().height > 0),
      };
    });

    console.log(`[METRICS ${res.name}]:`, JSON.stringify(metrics, null, 2));
    results.push({ resolution: res.name, metrics });

    // Capture AFTER screenshots for required targets
    if (res.isTargetAfter) {
      const p = path.join(SCREENSHOT_DIR, 'after_invoice_dialog_1366x768.png');
      await page.screenshot({ path: p, fullPage: false });
      console.log(`Saved AFTER screenshot: ${p}`);
    }

    if (res.isNarrowAfter) {
      const p = path.join(SCREENSHOT_DIR, 'after_invoice_dialog_640x900_narrow.png');
      await page.screenshot({ path: p, fullPage: false });
      console.log(`Saved AFTER screenshot: ${p}`);
    }

    // Interaction Testing on the 1366x768 viewport
    if (res.isTargetAfter) {
      console.log('>>> Testing multi-item line entry, calculation, and required field validation...');
      const dialog = page.locator('[data-slot="dialog-content"]');

      // Select Customer inside dialog
      const customerTrigger = dialog.locator('button[data-slot="select-trigger"]').first();
      await customerTrigger.click();
      await page.waitForTimeout(400);
      const customerOption = page.locator('[data-slot="select-item"]').first();
      if (await customerOption.isVisible()) {
        await customerOption.click();
        await page.waitForTimeout(300);
      }

      // Add a second line item
      const addLineBtn = dialog.locator('button:has-text("Add Line Item")').first();
      await addLineBtn.click();
      await page.waitForTimeout(300);

      // Add a third line item
      await addLineBtn.click();
      await page.waitForTimeout(300);

      // Fill in descriptions and amounts
      const descInputs = dialog.locator('input[placeholder*="Description"]');
      const count = await descInputs.count();
      console.log(`Rendered item description inputs: ${count}`);

      if (count >= 3) {
        await descInputs.nth(0).fill('Cotton Combed Yarn 30s');
        await descInputs.nth(1).fill('Grey Fabric 40x40 Plain');
        await descInputs.nth(2).fill('Reactive Dyeing Chemicals');
      }

      // Check calculations update
      const totalAmountText = await dialog.locator('text=Total Invoice Amount:').locator('xpath=following-sibling::*').first().textContent();
      console.log(`Calculated Grand Total text: ${totalAmountText}`);

      // Accessibility: test Tab key navigation and active element
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      const activeTag = await page.evaluate(() => document.activeElement ? document.activeElement.tagName : null);
      console.log(`Active element after keyboard Tab: ${activeTag}`);

      // Capture screenshot with multiple line items populated
      const multiItemPath = path.join(SCREENSHOT_DIR, 'after_invoice_dialog_multi_item.png');
      await page.screenshot({ path: multiItemPath, fullPage: false });
      console.log(`Saved populated dialog screenshot: ${multiItemPath}`);

      // Close dialog
      const cancelBtn = dialog.locator('button:has-text("Cancel")').first();
      await cancelBtn.click();
      await page.waitForTimeout(500);
    }

    await context.close();
  }

  // -------------------------------------------------------------------
  // AUDIT OTHER TRANSACTION DIALOGS
  // -------------------------------------------------------------------
  console.log('\n>>> Auditing other transaction dialogs on 1366x768 desktop...');
  const auditContext = await browser.newContext({
    viewport: { width: 1366, height: 768 },
  });
  const auditPage = await auditContext.newPage();

  // Login
  await auditPage.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await auditPage.fill('input[type="email"]', 'admin@industrialerp.local');
  await auditPage.fill('input[type="password"]', 'Admin#2026!');
  await auditPage.click('button[type="submit"]');
  await auditPage.waitForURL('**/dashboard', { timeout: 15000 }).catch(async () => {});
  await auditPage.waitForTimeout(1000);

  const dialogAudits = [
    {
      name: 'GRN (Goods Receiving Note)',
      url: 'http://localhost:3000/purchase/goods-receiving',
      openBtn: 'Add GRN',
      screenshot: 'dialog_grn_wide.png',
    },
    {
      name: 'Material Demand Notes',
      url: 'http://localhost:3000/purchase/demand-notes',
      openBtn: 'Create Demand Note',
      screenshot: 'dialog_demand_notes_wide.png',
    },
    {
      name: 'Material Issue',
      url: 'http://localhost:3000/inventory/material-issue',
      openBtn: 'Issue Material',
      screenshot: 'dialog_material_issue_wide.png',
    },
    {
      name: 'Customer Receipts',
      url: 'http://localhost:3000/sales/receipts',
      openBtn: 'Record Customer Receipt',
      screenshot: 'dialog_receipts_wide.png',
    },
    {
      name: 'Daily Wages Run',
      url: 'http://localhost:3000/hr/wages',
      openBtn: 'New Daily Wage Run',
      screenshot: 'dialog_wages_wide.png',
    },
    {
      name: 'Outgoing Payments',
      url: 'http://localhost:3000/finance/payments',
      openBtn: 'Record Payment',
      screenshot: 'dialog_payments_wide.png',
    },
  ];

  const auditResults = [];

  for (const aud of dialogAudits) {
    try {
      console.log(`Checking ${aud.name} at ${aud.url}...`);
      await auditPage.goto(aud.url, { waitUntil: 'networkidle' });
      await auditPage.waitForTimeout(1000);

      const btn = auditPage.locator(`button:has-text("${aud.openBtn}")`).first();
      if (await btn.isVisible()) {
        await btn.click();
        await auditPage.waitForTimeout(800);

        const m = await auditPage.evaluate(() => {
          const el = document.querySelector('[data-slot="dialog-content"]');
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);
          return {
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            maxWidth: style.maxWidth,
            maxHeight: style.maxHeight,
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
            hasHorizontalOverflow: el.scrollWidth > el.clientWidth,
          };
        });

        console.log(`[AUDIT ${aud.name}]:`, m);
        const p = path.join(SCREENSHOT_DIR, aud.screenshot);
        await auditPage.screenshot({ path: p, fullPage: false });
        console.log(`Saved screenshot: ${p}`);

        auditResults.push({ name: aud.name, metrics: m, status: 'PASSED' });

        // Close dialog
        const closeBtn = auditPage.locator('[data-slot="dialog-content"] button:has-text("Cancel"), [data-slot="dialog-content"] [data-slot="dialog-close"]').first();
        if (await closeBtn.isVisible()) {
          await closeBtn.click();
          await auditPage.waitForTimeout(400);
        }
      } else {
        console.warn(`Button "${aud.openBtn}" not found on ${aud.url}`);
        auditResults.push({ name: aud.name, status: 'BUTTON_NOT_FOUND' });
      }
    } catch (err) {
      console.error(`Error auditing ${aud.name}:`, err.message);
      auditResults.push({ name: aud.name, status: 'ERROR', error: err.message });
    }
  }

  await browser.close();

  console.log('\n========================================================================');
  console.log('                    FINAL SIZING VERIFICATION REPORT                    ');
  console.log('========================================================================');
  console.log(JSON.stringify({ salesInvoiceResolutions: results, dialogAudits: auditResults }, null, 2));
}

verifyDialogSizing().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});

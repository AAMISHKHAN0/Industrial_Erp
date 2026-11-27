const { chromium } = require('../frontend/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = 'C:\\Users\\Aamishkhan\\.gemini\\antigravity\\brain\\a1129e7e-edf2-42bb-855c-d43af8897bee\\screenshots';

async function verifyStaffRestrictions() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Logging in as staff_1795338268307@digitalerena.local...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'staff_1795338268307@digitalerena.local');
  await page.fill('input[type="password"]', 'Admin#2026!');
  await page.click('button[type="submit"]');

  await page.waitForURL('**/dashboard', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const sidebarText = await page.innerText('aside');
  const hasRoleManagementInSidebar = sidebarText.includes('Role Management');
  console.log('Staff sidebar has "Role Management"?:', hasRoleManagementInSidebar);

  console.log('Testing direct navigation to /role-management as staff...');
  await page.goto('http://localhost:3000/role-management', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const pageText = await page.innerText('body');
  const hasAccessDenied = pageText.includes('Access Denied');
  console.log('Staff receives "Access Denied" on /role-management?:', hasAccessDenied);

  const screenshotPathStaff = path.join(SCREENSHOT_DIR, 'evidence-staff-access-denied.png');
  await page.screenshot({ path: screenshotPathStaff, fullPage: true });
  console.log('Saved staff restriction screenshot:', screenshotPathStaff);

  await browser.close();

  if (hasRoleManagementInSidebar) {
    throw new Error('FAILED: Staff sidebar should NOT display Role Management!');
  }
  if (!hasAccessDenied) {
    throw new Error('FAILED: Staff should receive Access Denied when opening /role-management directly!');
  }

  console.log('>>> STAFF RESTRICTION VERIFICATION PASSED! <<<');
}

verifyStaffRestrictions().catch(err => {
  console.error(err);
  process.exit(1);
});

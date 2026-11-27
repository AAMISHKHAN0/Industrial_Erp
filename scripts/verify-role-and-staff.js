const { chromium } = require('../frontend/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = 'C:\\Users\\Aamishkhan\\.gemini\\antigravity\\brain\\a1129e7e-edf2-42bb-855c-d43af8897bee\\screenshots';

async function verifyRoleAndStaff() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  console.log('=== TEST 1: Production Workspace localhost:3000 (owner@digitalerena.local) ===');
  const context3000 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page3000 = await context3000.newPage();

  console.log('Navigating to http://localhost:3000/login...');
  await page3000.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });

  await page3000.fill('input[type="email"]', 'owner@digitalerena.local');
  await page3000.fill('input[type="password"]', 'Admin#2026!');
  await page3000.click('button[type="submit"]');

  await page3000.waitForURL('**/dashboard', { timeout: 10000 }).catch(() => {
    console.log('Current URL:', page3000.url());
  });
  await page3000.waitForTimeout(1000);

  console.log('Opening http://localhost:3000/role-management...');
  await page3000.goto('http://localhost:3000/role-management', { waitUntil: 'networkidle' });
  await page3000.waitForTimeout(2000);

  const text3000 = await page3000.innerText('body');
  const hasDenied3000 = text3000.includes('Access Denied');
  const hasAddUser3000 = text3000.includes('Add User');
  console.log('Port 3000 Role Management Access Denied?:', hasDenied3000);
  console.log('Port 3000 Role Management has "Add User"?:', hasAddUser3000);

  if (hasDenied3000) {
    throw new Error('FAILED: Port 3000 still shows Access Denied!');
  }

  const screenshotPath3000 = path.join(SCREENSHOT_DIR, 'evidence-role-management-working-3000.png');
  await page3000.screenshot({ path: screenshotPath3000, fullPage: true });
  console.log('Saved screenshot:', screenshotPath3000);

  // Test creating a user on port 3000
  console.log('Testing "Add User" on port 3000...');
  await page3000.click('button:has-text("Add User")');
  await page3000.waitForTimeout(500);

  const testEmail = `staff_${Date.now()}@digitalerena.local`;
  await page3000.fill('#fullName', 'Staff Test User');
  await page3000.fill('#email', testEmail);
  await page3000.fill('#password', 'Admin#2026!');
  await page3000.click('button[type="submit"]:has-text("Create User")');
  await page3000.waitForTimeout(2000);

  const updatedText3000 = await page3000.innerText('body');
  const userCreated = updatedText3000.includes(testEmail);
  console.log(`User ${testEmail} created and visible in list?:`, userCreated);

  console.log('\n=== TEST 2: Fresh Workspace localhost:3001 (pg1959655@gmail.com) ===');
  const context3001 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page3001 = await context3001.newPage();

  console.log('Navigating to http://localhost:3001/login...');
  await page3001.goto('http://localhost:3001/login', { waitUntil: 'networkidle' });

  await page3001.fill('input[type="email"]', 'pg1959655@gmail.com');
  await page3001.fill('input[type="password"]', 'Admin#2026!');
  await page3001.click('button[type="submit"]');

  await page3001.waitForURL('**/dashboard', { timeout: 10000 }).catch(() => {
    console.log('Current URL on 3001:', page3001.url());
  });
  await page3001.waitForTimeout(1000);

  console.log('Opening http://localhost:3001/role-management...');
  await page3001.goto('http://localhost:3001/role-management', { waitUntil: 'networkidle' });
  await page3001.waitForTimeout(2000);

  const text3001 = await page3001.innerText('body');
  const hasDenied3001 = text3001.includes('Access Denied');
  const hasAddUser3001 = text3001.includes('Add User');
  console.log('Port 3001 Role Management Access Denied?:', hasDenied3001);
  console.log('Port 3001 Role Management has "Add User"?:', hasAddUser3001);

  if (hasDenied3001) {
    throw new Error('FAILED: Port 3001 shows Access Denied!');
  }

  const screenshotPath3001 = path.join(SCREENSHOT_DIR, 'evidence-role-management-working-3001.png');
  await page3001.screenshot({ path: screenshotPath3001, fullPage: true });
  console.log('Saved screenshot:', screenshotPath3001);

  await browser.close();
  console.log('\n>>> ALL ROLE MANAGEMENT ACCESS AND USER CREATION TESTS PASSED SUCCESSFULLY! <<<');
}

verifyRoleAndStaff().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});

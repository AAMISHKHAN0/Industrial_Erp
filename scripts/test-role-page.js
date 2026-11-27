const { chromium } = require('../frontend/node_modules/playwright');

async function testRoleManagement() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('response', res => {
    if (res.url().includes('/api/') || res.url().includes('/auth/')) {
      console.log('NETWORK RESPONSE:', res.status(), res.url());
    }
  });

  console.log('Navigating to login...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });

  console.log('Logging in as owner@digitalerena.local...');
  await page.fill('input[type="email"]', 'owner@digitalerena.local');
  await page.fill('input[type="password"]', 'Admin#2026!');
  await page.click('button[type="submit"]');

  await page.waitForTimeout(2000);
  console.log('Current URL after login:', page.url());

  console.log('Navigating to /role-management...');
  await page.goto('http://localhost:3000/role-management', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  console.log('Current URL after role-management:', page.url());
  const bodyText = await page.innerText('body');
  console.log('Has Access Denied?:', bodyText.includes('Access Denied'));
  console.log('Has Only administrators?:', bodyText.includes('Only administrators'));
  console.log('Has Users table?:', bodyText.includes('Users') && bodyText.includes('Add User'));

  await browser.close();
}

testRoleManagement().catch(console.error);

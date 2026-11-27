const { chromium } = require('../frontend/node_modules/playwright');

async function main() {
  console.log('--- Launching browser to reproduce network requests and 401s ---');
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  page.on('request', req => {
    const url = req.url();
    if (url.includes('/api/') || url.includes(':4000')) {
      const headers = req.headers();
      console.log(`[REQ] ${req.method()} ${url}`);
      console.log(`      auth: ${headers['authorization'] || '(none)'}`);
      console.log(`      cookie: ${headers['cookie'] || '(none)'}`);
    }
  });

  page.on('response', async res => {
    const url = res.url();
    if (url.includes('/api/') || url.includes(':4000')) {
      console.log(`[RES] ${res.status()} ${url}`);
      if (res.status() >= 400) {
        try {
          const text = await res.text();
          console.log(`      ERROR BODY: ${text}`);
        } catch {}
      }
    }
  });

  console.log('\n>>> Navigating to http://localhost:3000/login...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });

  console.log('\n>>> Submitting credentials...');
  await page.fill('input[type="email"]', 'admin@industrialerp.local');
  await page.fill('input[type="password"]', 'Admin#2026!');
  await page.click('button[type="submit"]');

  await page.waitForTimeout(4000);

  console.log('\n>>> Current URL after login:', page.url());

  console.log('\n>>> Navigating to /dashboard explicitly...');
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle' }).catch(e => console.log('goto error:', e.message));

  await page.waitForTimeout(3000);
  console.log('\n>>> Current URL after dashboard navigation:', page.url());

  console.log('\n>>> Reloading dashboard...');
  await page.reload({ waitUntil: 'networkidle' }).catch(e => console.log('reload error:', e.message));
  await page.waitForTimeout(3000);
  console.log('\n>>> Current URL after reload:', page.url());

  await browser.close();
}

main().catch(console.error);

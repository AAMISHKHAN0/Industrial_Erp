const { chromium } = require('../frontend/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const CHROME_EXE = fs.existsSync('C:\\Users\\Aamishkhan\\AppData\\Local\\ms-playwright\\chromium-1248\\chrome-win64\\chrome.exe')
  ? 'C:\\Users\\Aamishkhan\\AppData\\Local\\ms-playwright\\chromium-1248\\chrome-win64\\chrome.exe'
  : 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const SHORTCUT_PATH = 'C:\\Users\\Aamishkhan\\Desktop\\Industrial ERP.lnk';

async function main() {
  console.log('Starting app from shortcut...');
  delete process.env.ELECTRON_RUN_AS_NODE;
  execFileSync('powershell.exe', ['-NoProfile', '-Command', `Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue; Start-Process '${SHORTCUT_PATH}'`]);

  console.log('Waiting 12 seconds for full app boot...');
  await new Promise(r => setTimeout(r, 12000));

  console.log('Launching browser...');
  const browser = await chromium.launch({ executablePath: CHROME_EXE, headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('[BROWSER CONSOLE]', msg.type(), msg.text()));
  page.on('request', req => console.log('[BROWSER REQ]', req.method(), req.url()));
  page.on('response', res => console.log('[BROWSER RES]', res.status(), res.url()));
  page.on('requestfailed', req => console.log('[BROWSER FAILED]', req.url(), req.failure()?.errorText));

  console.log('Navigating to http://localhost:3000/login...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });

  console.log('Filling credentials...');
  await page.fill('input[type="email"]', 'admin@industrialerp.local');
  await page.fill('input[type="password"]', 'Admin#2026!');
  
  console.log('Clicking submit...');
  await page.click('button[type="submit"]');

  console.log('Waiting 5 seconds...');
  await page.waitForTimeout(5000);

  console.log('Current URL:', page.url());
  await page.screenshot({ path: path.join(__dirname, 'test-login-result.png') });

  await browser.close();

  // Terminate app
  execFileSync('powershell.exe', ['-NoProfile', '-Command', "Get-Process | Where-Object { $_.ProcessName -match 'Industrial|electron' } | Stop-Process -Force -ErrorAction SilentlyContinue"]);
}

main().catch(console.error);

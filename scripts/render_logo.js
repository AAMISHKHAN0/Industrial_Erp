const { chromium } = require('../frontend/node_modules/playwright');
const path = require('path');

async function render() {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true
  });
  const page = await browser.newPage({
    viewport: { width: 1024, height: 1024 },
    deviceScaleFactor: 1
  });

  const svgContent = `
    <svg width="1024" height="1024" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" fill="#2563eb"/>
      <path d="M10 30V10H18C22.5 10 26 11.5 28 14.5C30 17.5 30 22.5 28 25.5 26 28.5 22.5 30 18 30H10ZM16 24H18C20.5 24 22.5 23 23.5 21 24.5 19 24.5 15 23.5 13 22.5 11 20.5 10 18 10H16V24Z" fill="white"/>
    </svg>
  `;

  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: transparent; overflow: hidden; margin: 0; padding: 0; }
        #icon { display: block; width: 1024px; height: 1024px; }
      </style>
    </head>
    <body>
      <div id="icon">${svgContent}</div>
    </body>
    </html>
  `);

  const element = await page.$('#icon');
  const outPath = path.resolve(__dirname, 'icon_1024.png');
  await element.screenshot({ path: outPath, omitBackground: true });
  await browser.close();
  console.log('Rendered icon_1024.png successfully at ' + outPath);
}

render().catch(err => {
  console.error(err);
  process.exit(1);
});

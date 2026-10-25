import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('ERR', e.message));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, { timeout: 60000 });
await page.waitForTimeout(900);
await page.evaluate(() => { const c = window.__ZH.controls; c.minDistance = .2; c.maxDistance = 3000; c.maxPolarAngle = Math.PI; });

// 站在梓荫阁平台东南角，人眼高 8.0+1.6=9.6，环视四周
const eye = [110.5, 9.6, -35.2];
const dirs = [
  ['s', [110.5, 9.2, 10]],
  ['sw', [60, 2, 20]],
  ['w', [40, 6, -40]],
  ['nw', [60, 6, -80]],
  ['n', [110, -20, -100]],
  ['ne', [160, 4, -80]],
  ['e', [175, 4, -35]],
  ['se', [170, 4, 10]],
];
for (const [name, t] of dirs) {
  await page.evaluate(([p, tg]) => window.__ZH.setViewNow(p, tg), [eye, t]);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `/tmp/b5view_${name}.png` });
}
// 平台俯视（看树冠覆盖）
await page.evaluate(() => window.__ZH.setViewNow([110.5, 26, -30], [110.5, 8, -41]));
await page.waitForTimeout(600);
await page.screenshot({ path: '/tmp/b5view_above.png' });
await browser.close();
console.log('ok');

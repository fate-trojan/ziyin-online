import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, { timeout: 90000 });
await page.evaluate(() => { const c = window.__ZH.controls; c.minDistance = .2; c.maxDistance = 3000; c.maxPolarAngle = Math.PI; });
await page.waitForTimeout(600);
const shots = [
  ['aerial', [35, 430, 20], [35, 0, 19]],
  ['hilltop', [90, 90, -5], [90, 4, -40]],
  ['overview', [160, 34, 10], [100, 8, -42]],
  ['aline', [46, 2.8, -43], [96, 4, -42]],
  ['wugong', [52, 4, -44], [70, 3.5, -46.5]],
  ['hall', [108, 7, -47], [100, 5, -56]],
  ['pavilion', [98, 14, -30], [111, 12, -39]],
  ['rock', [131, 5.5, -36], [122, 4.2, -41.5]],
  ['stairs', [96, 12, -52], [110, 8, -39]],
];
for (const [name, pos, target] of shots) {
  await page.evaluate(([p, t]) => window.__ZH.setViewNow(p, t), [pos, target]);
  await page.waitForTimeout(650);
  await page.screenshot({ path: `/tmp/b5_${name}.png` });
}
console.log('ERRORS:', JSON.stringify(errs.slice(0, 12), null, 1));
await browser.close();

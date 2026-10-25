import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, null, { timeout: 90000 });
await page.waitForTimeout(500);
const shots = [
  ['aerial', [190, 130, 240], [-20, 0, 60]],
  ['dianjiao', [10, 36, -8], [-77, 20, -76]],
  ['dachengmen', [-28, 9, 92], [-28, 4, 61]],
  ['zhufeng', [58, 10, 152], [22, 5, 122]],
  ['north', [-20, 30, -92], [-90, 8, -145]],
  ['academy', [-30, 28, 55], [-118, 8, 110]],
];
for (const [name, pos, tgt] of shots) {
  await page.evaluate(([p, t]) => window.__ZH.setViewNow(p, t), [pos, tgt]);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `screenshots/v2-${name}.png` });
}
console.log('errors', errs);
await browser.close();

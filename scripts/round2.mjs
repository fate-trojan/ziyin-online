import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('ERR', e.message));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, null, { timeout: 60000 });
await page.waitForTimeout(800);
await page.evaluate(() => { const c = window.__ZH.controls; c.minDistance = .2; c.maxDistance = 3000; c.maxPolarAngle = Math.PI; });
const shots = [
  ['r2_a', [-28, 60, 160], [-28, 5, 15]],
  ['r2_b', [-28, 45, 120], [-28, 8, 0]],
  ['r2_c', [-28, 32, 95], [-28, 8, 10]],
];
for (const [name, p, t] of shots) {
  await page.evaluate(([p, t]) => window.__ZH.setViewNow(p, t), [p, t]);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `screenshots/${name}.png` });
}
console.log('ok');
await browser.close();

import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('ERR', e.message));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, null, { timeout: 60000 });
await page.waitForTimeout(600);
await page.evaluate(() => { const c = window.__ZH.controls; c.minDistance = .2; c.maxDistance = 3000; c.maxPolarAngle = Math.PI; });
const views = [
  ['south_inside', [0, 1.7, 120], [0, 3, 180]],
  ['academy_inside', [-55, 1.7, 100], [-150, 10, 118]],
  ['east_inside', [120, 1.7, 60], [190, 4, 40]],
  ['north_inside', [-20, 1.7, -150], [-20, 3.5, -220]],
];
for (const [name, p, t] of views) {
  await page.evaluate(([p, t]) => window.__ZH.setViewNow(p, t), [p, t]);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `screenshots/fogin_${name}.png` });
}
await page.evaluate(() => window.__ZH.setViewNow([0, 190, 190], [0, 0, 20]));
await page.waitForTimeout(800);
await page.screenshot({ path: 'screenshots/fogin_top.png' });
await page.evaluate(() => window.__ZH.setMode('night'));
await page.waitForTimeout(2600);
await page.evaluate(() => window.__ZH.setViewNow([0, 1.7, 120], [0, 3, 180]));
await page.waitForTimeout(800);
await page.screenshot({ path: 'screenshots/fogin_south_night.png' });
console.log('ok');
await browser.close();

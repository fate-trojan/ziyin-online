import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, { timeout: 90000 });
await page.evaluate(() => { const c = window.__ZH.controls; c.minDistance = .2; c.maxDistance = 3000; c.maxPolarAngle = Math.PI; });
await page.waitForTimeout(500);
for (const [name, pos, target] of [
  ['b_down', [113, 15, -36], [102, 4, -52]],
  ['b_top', [104, 40, -43], [106, 5, -46]],
  ['c_road', [126, 12, -33], [132, 1, -22]],
  ['d_road', [104, 12, -18], [90, 0, -21]],
]) {
  await page.evaluate(([p, t]) => window.__ZH.setViewNow(p, t), [pos, target]);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `/tmp/b5x_${name}.png` });
}
await browser.close();

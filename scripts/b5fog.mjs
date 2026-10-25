import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('ERR', e.message));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, { timeout: 60000 });
await page.waitForTimeout(900);
await page.evaluate(() => { const c = window.__ZH.controls; c.minDistance = .2; c.maxDistance = 3000; c.maxPolarAngle = Math.PI; });

const shots = [
  ['fog_se', [300, 110, 90], [100, 20, -40]],
  ['fog_n', [40, 90, -230], [95, 20, -45]],
  ['fog_top', [100, 190, 60], [100, 0, -50]],
  ['stair_now', [96, 8, -50], [104, 6, -40]],
];
for (const [name, pos, target] of shots) {
  await page.evaluate(([p, t]) => window.__ZH.setViewNow(p, t), [pos, target]);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `/tmp/b5fog_${name}.png` });
}
await browser.close();
console.log('ok');

import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('ERR', e.message));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, { timeout: 60000 });
await page.waitForTimeout(900);
await page.evaluate(() => { const c = window.__ZH.controls; c.minDistance = .2; c.maxDistance = 3000; c.maxPolarAngle = Math.PI; });

const shots = [
  ['nw1', [103, 9.4, -42], [96, 6.5, -56]],
  ['nw2', [105, 9.4, -40], [98, 5.5, -54]],
  ['nw3', [104, 9.4, -38], [99, 6, -52]],
  ['nw_air', [104, 22, -36], [103, 6, -46]],
];
for (const [name, pos, target] of shots) {
  await page.evaluate(([p, t]) => window.__ZH.setViewNow(p, t), [pos, target]);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `/tmp/b5nw_${name}.png` });
}
await browser.close();
console.log('ok');

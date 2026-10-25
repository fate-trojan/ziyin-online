import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('ERR', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, { timeout: 60000 });
await page.waitForTimeout(700);
await page.evaluate(() => { const c = window.__ZH.controls; c.minDistance = .2; c.maxDistance = 3000; c.maxPolarAngle = Math.PI; });

const shots = [
  ['aerial_se', [165, 48, 2], [95, 4, -33]],
  ['hill_top', [88, 58, -6], [104, 8, -43]],
  ['d_line2', [84, 8, -4], [90, .5, -25]],
  ['b_stair2', [117, 11, -53], [107, 6, -44]],
  ['c_top', [126, 20, -22], [112, 8, -38]],
];
for (const [name, pos, target] of shots) {
  await page.evaluate(([p, t]) => window.__ZH.setViewNow(p, t), [pos, target]);
  await page.waitForTimeout(650);
  await page.screenshot({ path: `/tmp/b5z_${name}.png` });
}
await browser.close();
console.log('ok');

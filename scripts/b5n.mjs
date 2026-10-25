import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('ERR', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, { timeout: 60000 });
await page.waitForTimeout(900);
await page.evaluate(() => { const c = window.__ZH.controls; c.minDistance = .2; c.maxDistance = 3000; c.maxPolarAngle = Math.PI; });

const shots = [
  ['aerial', [172, 58, 2], [102, 6, -38]],
  ['wall_s', [108, 6.5, -24], [108, 6.2, -34]],
  ['wall_e', [130, 8, -31], [117, 6, -41]],
  ['stairB', [100, 4.0, -57.5], [106, 6.5, -40]],
  ['stairZ', [111, 7.5, -59], [116, 6, -46]],
  ['rockF', [137, 3.2, -37], [125, 4, -37]],
  ['pav_s', [111, 15, -13], [111, 9, -40]],
];
for (const [name, pos, target] of shots) {
  await page.evaluate(([p, t]) => window.__ZH.setViewNow(p, t), [pos, target]);
  await page.waitForTimeout(650);
  await page.screenshot({ path: `/tmp/b5n_${name}.png` });
}
await browser.close();
console.log('ok');

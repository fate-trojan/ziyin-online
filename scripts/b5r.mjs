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
  ['aerial', [176, 62, 6], [102, 6, -38]],
  ['c_steps', [139, 12, -13], [119, 5, -32]],
  ['stairB', [112, 8.5, -62], [106, 4.5, -44]],
  ['stairB_low', [110, 2.2, -50.5], [105.5, 4.0, -46]],
  ['stairB_top', [113, 9.5, -46], [106, 6.5, -38]],
  ['rock', [141, 7.5, -33], [127, 3.2, -33]],
  ['pav4', [128, 5.0, -12], [121, 1.5, -23.5]],
  ['fude', [68, 4.0, -67], [92, 1.6, -60]],
  ['fude_e', [88, 3.2, -68], [92, 1.4, -60]],
];
for (const [name, pos, target] of shots) {
  await page.evaluate(([p, t]) => window.__ZH.setViewNow(p, t), [pos, target]);
  await page.waitForTimeout(650);
  await page.screenshot({ path: `/tmp/b5r_${name}.png` });
}
await browser.close();
console.log('ok');

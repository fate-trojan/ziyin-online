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
  ['fude_w', [68, 4.0, -66], [94, 1.6, -60]],
  ['fude_e', [96, 3.6, -67], [96, 1.4, -59]],
  ['fude_air', [88, 26, -84], [94, 1, -57]],
  ['stairB_s', [114, 6.5, -58], [103, 5, -44]],
  ['rock_old', [139, 5.5, -40], [125, 3.2, -37]],
  ['pav_spot', [130, 4.2, -12], [128, 1.2, -23]],
];
for (const [name, pos, target] of shots) {
  await page.evaluate(([p, t]) => window.__ZH.setViewNow(p, t), [pos, target]);
  await page.waitForTimeout(650);
  await page.screenshot({ path: `/tmp/b5q_${name}.png` });
}
await browser.close();
console.log('ok');

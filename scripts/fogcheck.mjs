import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('ERR', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, null, { timeout: 60000 });
await page.waitForTimeout(800);
await page.evaluate(() => {
  const c = window.__ZH.controls;
  c.minDistance = 0.2; c.maxDistance = 3000; c.maxPolarAngle = Math.PI;
});

const views = [
  ['south_gate_out', [-28, 1.7, 150], [-28, 3.0, 210]],
  ['west_out', [-60, 1.7, 20], [-140, 3.0, 20]],
  ['east_track_out', [130, 1.7, 20], [220, 3.0, 20]],
  ['north_out', [-20, 1.7, -140], [-20, 3.2, -240]],
  ['academy_view', [-38, 1.7, 118], [-110, 6, 120]],
];
for (const [name, p, t] of views) {
  await page.evaluate(([p, t]) => window.__ZH.setViewNow(p, t), [p, t]);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `screenshots/fog_${name}.png` });
}
// 园内俯视，确认雾没有漫进校园
await page.evaluate(() => window.__ZH.setViewNow([0, 190, 190], [0, 0, 20]));
await page.waitForTimeout(900);
await page.screenshot({ path: 'screenshots/fog_top_day.png' });
// 夜间
await page.evaluate(() => window.__ZH.setMode('night'));
await page.waitForTimeout(2600);
await page.evaluate(() => window.__ZH.setViewNow([-28, 1.7, 138], [-28, 3.0, 200]));
await page.waitForTimeout(900);
await page.screenshot({ path: 'screenshots/fog_south_night.png' });
await page.evaluate(() => window.__ZH.setViewNow([0, 190, 190], [0, 0, 20]));
await page.waitForTimeout(900);
await page.screenshot({ path: 'screenshots/fog_top_night.png' });
console.log('ok');
await browser.close();

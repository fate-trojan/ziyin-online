import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('ERR', e.message));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, null, { timeout: 60000 });
await page.waitForTimeout(600);
await page.evaluate(() => window.__ZH.setMode('night'));
await page.waitForTimeout(2500);
await page.screenshot({ path: 'screenshots/n1.png' });
const spots = [[-28, 100], [-28, 40], [80, 69], [95, -60], [-70, 118], [22, 108], [-28, 136]];
for (let i = 0; i < spots.length; i++) {
  await page.evaluate(([x, z]) => window.__ZH.teleport(x, z), spots[i]);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `screenshots/n${i + 2}.png` });
}
console.log('light', await page.evaluate(() => window.__ZH.player.group.children.length));
await browser.close();

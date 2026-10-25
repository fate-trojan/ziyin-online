import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 900, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('ERR', e.message));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, null, { timeout: 60000 });
await page.waitForTimeout(500);
await page.evaluate(() => {
  window.__ZH.teleport(-28, 100);
  const p = window.__ZH.player.group.position;
  window.__ZH.controls.target.set(p.x, p.y + 1.0, p.z);
  window.__ZH.camera.position.set(p.x - .4, p.y + 1.45, p.z - 3.6);
  window.__ZH.controls.update();
});
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/puppet-face.png' });
await browser.close();

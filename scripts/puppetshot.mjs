import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, null, { timeout: 60000 });
await page.waitForTimeout(600);
// 站到中轴开阔处，拉近看模型正面
await page.evaluate(() => {
  window.__ZH.teleport(-28, 100);
  const p = window.__ZH.player.group.position;
  window.__ZH.controls.target.set(p.x, p.y + 1.0, p.z);
  window.__ZH.camera.position.set(p.x + .6, p.y + 1.5, p.z + 4.2);
  window.__ZH.controls.update();
});
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/puppet-front.png' });
// 侧面
await page.evaluate(() => {
  const p = window.__ZH.player.group.position;
  window.__ZH.camera.position.set(p.x + 4.2, p.y + 1.5, p.z + .2);
  window.__ZH.controls.update();
});
await page.waitForTimeout(400);
await page.screenshot({ path: 'screenshots/puppet-side.png' });
// 夜景全景
await page.evaluate(() => {
  const p = window.__ZH.player.group.position;
  window.__ZH.setMode('night');
  window.__ZH.controls.target.set(p.x, p.y + 1.2, p.z);
  window.__ZH.camera.position.set(p.x, p.y + 4.2, p.z + 9.2);
});
await page.waitForTimeout(2800);
await page.screenshot({ path: 'screenshots/puppet-night.png' });
console.log('errors', errs);
await browser.close();

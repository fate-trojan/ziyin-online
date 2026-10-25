import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, null, { timeout: 60000 });
await page.waitForTimeout(700);
const snap = () => page.evaluate(() => {
  const c = window.__ZH.camera.position, t = window.__ZH.controls.target;
  return {
    camRel: [+(c.x - t.x).toFixed(2), +(c.y - t.y).toFixed(2), +(c.z - t.z).toFixed(2)],
    bodyYaw: +window.__ZH.player.group.rotation.y.toFixed(2),
    camYaw: +Math.atan2(c.x - t.x, c.z - t.z).toFixed(2),
    dist: +c.distanceTo(t).toFixed(2),
  };
});
console.log('spawn', await snap());
await page.screenshot({ path: 'screenshots/turn-0.png' });
await page.keyboard.down('w'); await page.waitForTimeout(1400);
console.log('w', await snap());
await page.screenshot({ path: 'screenshots/turn-1-forward.png' });
await page.keyboard.up('w');
await page.keyboard.down('a'); await page.waitForTimeout(1600);
console.log('a', await snap());
await page.screenshot({ path: 'screenshots/turn-2-left.png' });
await page.keyboard.up('a');
await page.waitForTimeout(300);
console.log('idle', await snap());
console.log('errors', errs);
await browser.close();

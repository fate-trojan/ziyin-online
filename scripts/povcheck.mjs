import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, null, { timeout: 60000 });
await page.waitForTimeout(700);
console.log('view', await page.evaluate(() => ({
  cam: window.__ZH.camera.position.toArray().map(n => +n.toFixed(2)),
  tgt: window.__ZH.controls.target.toArray().map(n => +n.toFixed(2)),
  dist: +window.__ZH.camera.position.distanceTo(window.__ZH.controls.target).toFixed(2),
  pos: window.__ZH.pos().map(n => +n.toFixed(2)),
})));
await page.screenshot({ path: 'screenshots/pov-day.png' });
const p0 = await page.evaluate(() => window.__ZH.pos());
await page.keyboard.down('w'); await page.waitForTimeout(900); await page.keyboard.up('w');
const p1 = await page.evaluate(() => window.__ZH.pos());
await page.screenshot({ path: 'screenshots/pov-moved.png' });
console.log('moved', p0.map(n=>+n.toFixed(2)), '->', p1.map(n=>+n.toFixed(2)));
await page.evaluate(() => window.__ZH.setMode('night'));
await page.waitForTimeout(2600);
await page.screenshot({ path: 'screenshots/pov-night.png' });
console.log('errors', errs);
await browser.close();

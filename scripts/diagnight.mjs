import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('ERR', e.message));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, null, { timeout: 60000 });
await page.waitForTimeout(500);
console.log('spawn', await page.evaluate(() => window.__ZH.pos()));
await page.evaluate(() => window.__ZH.setTime(21));
await page.waitForTimeout(3000);
console.log('info', await page.evaluate(() => ({
  night: window.__ZH.env.night, exp: window.__ZH.renderer.toneMappingExposure,
  fog: window.__ZH.scene.fog.density, cam: window.__ZH.camera.position.toArray(),
  fogColor: window.__ZH.scene.fog.color.getHexString(),
  mode: window.__ZH.state.mode, bloom: window.__ZH.post.bloom.strength, thr: window.__ZH.post.bloom.threshold,
})));
await page.screenshot({ path: 'screenshots/diag-night-bloom.png' });
await page.evaluate(() => { window.__ZH.post.bloom.enabled = false; });
await page.waitForTimeout(400);
await page.screenshot({ path: 'screenshots/diag-night-nobloom.png' });
// teleport to wide-open lawn far from axis
await page.evaluate(() => { window.__ZH.teleport(120, 100); });
await page.waitForTimeout(800);
await page.screenshot({ path: 'screenshots/diag-night-field.png' });
await browser.close();

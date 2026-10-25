import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader'] });

// desktop
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, null, { timeout: 60000 });
await page.waitForTimeout(800);
await page.screenshot({ path: 'screenshots/char-start.png' });

const before = await page.evaluate(() => ({
  pos: window.__ZH.pos().map(n => +n.toFixed(2)),
  cam: window.__ZH.camera.position.toArray().map(n => +n.toFixed(2)),
  target: window.__ZH.controls.target.toArray().map(n => +n.toFixed(2)),
  viewBar: !!document.getElementById('viewBar'),
  joyHidden: document.getElementById('joy').classList.contains('hidden'),
}));
await page.keyboard.down('w');
await page.waitForTimeout(1200);
await page.keyboard.up('w');
await page.keyboard.down('d');
await page.waitForTimeout(700);
await page.keyboard.up('d');
await page.waitForTimeout(300);
const after = await page.evaluate(() => ({
  pos: window.__ZH.pos().map(n => +n.toFixed(2)),
  cam: window.__ZH.camera.position.toArray().map(n => +n.toFixed(2)),
}));
await page.screenshot({ path: 'screenshots/char-moved.png' });

// night lantern look
await page.evaluate(() => window.__ZH.setMode('night'));
await page.waitForTimeout(2500);
await page.screenshot({ path: 'screenshots/char-night.png' });

console.log('before', JSON.stringify(before));
console.log('after ', JSON.stringify(after));
await ctx.close();

// randomized spawn across reloads
const spawns = [];
const sctx = await browser.newContext({ viewport: { width: 900, height: 600 } });
for (let i = 0; i < 4; i++) {
  const p = await sctx.newPage();
  await p.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__READY__, null, { timeout: 60000 });
  spawns.push(await p.evaluate(() => window.__ZH.pos().map(n => +n.toFixed(1))));
  await p.close();
}
console.log('spawns', JSON.stringify(spawns));
console.log('errors', errs);
await sctx.close();

// mobile
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const mp = await mctx.newPage();
const merrs = [];
mp.on('pageerror', e => merrs.push(e.message));
await mp.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await mp.waitForFunction(() => window.__READY__, null, { timeout: 60000 });
await mp.waitForTimeout(800);
await mp.screenshot({ path: 'screenshots/char-mobile.png' });
console.log('mobile joy visible', await mp.evaluate(() => !document.getElementById('joy').classList.contains('hidden')), 'errors', merrs);
await mctx.close();
await browser.close();

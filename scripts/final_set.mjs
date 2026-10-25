import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader'] });
// clean comparison set
const p = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
const errs=[]; p.on('pageerror', e=>errs.push(e.message));
await p.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__READY__, { timeout: 60000 });
await p.addStyleTag({ content: '#panel,#topbar,#brand,#viewBar,#hint,#bottomInfo,#compass,#labels,#mobileHint{display:none!important} #app::after{display:none!important}' });
await p.evaluate(() => window.__ZH.setTime(11.5));
await p.waitForTimeout(700);
const shots = {
  gate_front: [[-28,5.2,186],[-28,9,136]],
  gate_axis: [[-28,16,168],[-28,7,60]],
  overview: [[-28,135,285],[-28,18,40]],
  hall: [[10,30,58],[-40,10,-16]],
  hill: [[150,50,-20],[60,12,-100]],
  track: [[196,100,150],[72,0,8]],
  core: [[80,100,210],[-10,18,20]],
  observatory: [[10,60,30],[-100,18,-62]],
  academy: [[-5,48,195],[-89,12,110]],
  gym: [[106,10,-88],[106,6,-124]],
};
for (const [name,[q,t]] of Object.entries(shots)) {
  await p.evaluate(([q,t]) => window.__ZH.setViewNow(q,t), [q,t]);
  await p.waitForTimeout(550);
  await p.screenshot({ path: `/tmp/fset_${name}.png` });
}
await p.evaluate(() => { window.__ZH.setViewNow([-28,5.2,186],[-28,9,136]); window.__ZH.setTime(21); });
await p.waitForTimeout(1400);
await p.screenshot({ path: '/tmp/fset_gate_night.png' });
await p.close();
// UI screenshots
const u = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
await u.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await u.waitForFunction(() => window.__READY__, { timeout: 60000 });
await u.waitForTimeout(900);
await u.screenshot({ path: '/tmp/fset_ui_gate_day.png' });
await u.evaluate(() => window.__ZH.setTime(21));
await u.waitForTimeout(1300);
await u.screenshot({ path: '/tmp/fset_ui_gate_night.png' });
await u.evaluate(() => { window.__ZH.setTime(11.5); window.__ZH.setViewNow([150,50,-20],[60,12,-100]); });
await u.waitForTimeout(800);
await u.screenshot({ path: '/tmp/fset_ui_hill.png' });
await u.close();
// mobile
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const m = await ctx.newPage();
await m.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await m.waitForFunction(() => window.__READY__, { timeout: 60000 });
await m.waitForTimeout(900);
await m.screenshot({ path: '/tmp/fset_mobile_day.png' });
await m.locator('.label[data-id="dacheng"]').click({ force: true });
await m.waitForTimeout(1100);
await m.screenshot({ path: '/tmp/fset_mobile_info.png' });
await m.evaluate(() => window.__ZH.setTime(21));
await m.waitForTimeout(900);
await m.screenshot({ path: '/tmp/fset_mobile_night.png' });
await m.evaluate(() => window.__ZH.setTime(11.5));
await m.waitForTimeout(400);
await m.locator('#panel .panel-head').click();
await m.waitForTimeout(700);
await m.screenshot({ path: '/tmp/fset_mobile_panel.png' });
console.log('errors', errs);
await browser.close();

import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', m => { if (['error','warning'].includes(m.type())) logs.push(m.type()+': '+m.text()); });
page.on('pageerror', e => logs.push('PAGEERROR: '+e.message));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, { timeout: 60000 });
await page.waitForTimeout(700);
await page.screenshot({ path: '/tmp/zh_final_day.png' });
// night
await page.evaluate(() => window.__ZH.setMode('night'));
await page.waitForTimeout(2600);
await page.screenshot({ path: '/tmp/zh_final_night.png' });
// day + winter film
await page.evaluate(() => { window.__ZH.setMode('day'); });
await page.waitForTimeout(2200);
await page.evaluate(() => { window.__ZH.setStyle('film'); window.__ZH.setSeason('autumn'); });
await page.waitForTimeout(700);
await page.screenshot({ path: '/tmp/zh_final_autumn.png' });
// low density
await page.evaluate(() => {
  const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
  set('treeDensity', 20); set('peopleDensity', 8); set('buildDensity', 15);
});
await page.waitForTimeout(700);
await page.screenshot({ path: '/tmp/zh_final_low.png' });
const state = await page.evaluate(() => ({ ...window.__ZH.state, calls: window.__ZH.renderer.info.render.calls }));
// view presets
for (const v of ['pan','dacheng','ziyin','track','axis']) {
  await page.evaluate(v => window.__ZH.setView(v), v);
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `/tmp/zh_view_${v}.png` });
}
// info card
await page.evaluate(() => window.__ZH.select('dacheng'));
await page.waitForTimeout(1400);
await page.screenshot({ path: '/tmp/zh_info.png' });
console.log(JSON.stringify({ state, logs: logs.slice(0,8) }, null, 2));
await browser.close();

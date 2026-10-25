import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
const logs = [];
page.on('pageerror', e => logs.push('PAGEERROR: '+e.message));
page.on('console', m => { if (m.type()==='error' && !m.text().includes('404')) logs.push('ERR: '+m.text()); });
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, { timeout: 60000 });
await page.waitForTimeout(900);
await page.screenshot({ path: '/tmp/final_day.png' });
const start = await page.evaluate(() => ({ state: window.__ZH.state, mem: window.__ZH.renderer.info.memory, cam: window.__ZH.camera.position.toArray(), target: window.__ZH.controls.target.toArray() }));
// night toggle
await page.locator('#dayNight button[data-mode="night"]').click();
await page.waitForTimeout(3500);
const night = await page.evaluate(() => ({ mode: window.__ZH.state.mode, time: window.__ZH.state.time, out: document.getElementById('timeOut').textContent, active: document.querySelector('#dayNight .active')?.dataset.mode }));
await page.screenshot({ path: '/tmp/final_night.png' });
await page.locator('#dayNight button[data-mode="day"]').click();
await page.waitForTimeout(3200);
// time slider to 18.4
await page.evaluate(() => { const el = document.getElementById('timeSlider'); el.value = 184; el.dispatchEvent(new Event('input', {bubbles:true})); });
await page.waitForTimeout(600);
const dusk = await page.evaluate(() => ({ mode: window.__ZH.state.mode, out: document.getElementById('timeOut').textContent }));
await page.evaluate(() => { const el = document.getElementById('timeSlider'); el.value = 100; el.dispatchEvent(new Event('input', {bubbles:true})); });
await page.waitForTimeout(500);
// view presets via UI
for (const v of ['axis','gate','dacheng','pan','academy','ziyin','track']) {
  await page.locator(`#viewBar button[data-view="${v}"]`).click();
  await page.waitForTimeout(1700);
  const c = await page.evaluate(() => ({ p: window.__ZH.camera.position.toArray().map(n=>+n.toFixed(1)), t: window.__ZH.controls.target.toArray().map(n=>+n.toFixed(1)) }));
  await page.screenshot({ path: `/tmp/final_view_${v}.png` });
  console.log(v, JSON.stringify(c));
}
// label info
await page.locator('.label[data-id="dacheng"]').click({ force: true });
await page.waitForTimeout(900);
const info = await page.evaluate(() => ({ hidden: document.getElementById('infoCard').classList.contains('hidden'), title: document.getElementById('infoTitle').textContent, desc: document.getElementById('infoDesc').textContent.slice(0,20) }));
await page.screenshot({ path: '/tmp/final_info.png' });
// density response
await page.evaluate(() => { const el = document.getElementById('treeDensity'); el.value = 25; el.dispatchEvent(new Event('input', {bubbles:true})); const e2 = document.getElementById('peopleDensity'); e2.value = 10; e2.dispatchEvent(new Event('input',{bubbles:true})); const e3 = document.getElementById('buildDensity'); e3.value = 20; e3.dispatchEvent(new Event('input',{bubbles:true})); });
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/final_low.png' });
const after = await page.evaluate(() => ({ state: window.__ZH.state, time: document.getElementById('timeOut').textContent, treeCounts: window.__ZH.campus.nature.types.camphor?.count }));
console.log(JSON.stringify({ start, night, dusk, info, after, logs }, null, 2));
await browser.close();

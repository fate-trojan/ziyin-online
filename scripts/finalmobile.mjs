import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const logs = [];
page.on('pageerror', e => logs.push('PAGEERROR: '+e.message));
page.on('console', m => { if (m.type()==='error' && !m.text().includes('404')) logs.push('ERR: '+m.text()); });
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, { timeout: 60000 });
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/fm_day.png' });
const info0 = await page.evaluate(() => ({ labels: [...document.querySelectorAll('.label')].filter(e=>getComputedStyle(e).opacity>0.5).map(e=>e.dataset.id), topbar: [...document.querySelectorAll('#topbar .icon-btn')].map(e=>getComputedStyle(e).display), overflow: document.documentElement.scrollWidth, w: innerWidth }));
// click hall label
await page.locator('.label[data-id="dacheng"]').click({ force: true });
await page.waitForTimeout(1200);
const info = await page.evaluate(() => ({ hidden: document.getElementById('infoCard').classList.contains('hidden'), title: document.getElementById('infoTitle').textContent, rect: document.getElementById('infoCard').getBoundingClientRect().toJSON() }));
await page.screenshot({ path: '/tmp/fm_info.png' });
// sheet open
await page.locator('#panel .panel-head').click();
await page.waitForTimeout(700);
await page.screenshot({ path: '/tmp/fm_panel.png' });
// night
await page.locator('#dayNight button[data-mode="night"]').click();
await page.waitForTimeout(3500);
const night = await page.evaluate(() => ({ mode: window.__ZH.state.mode, time: window.__ZH.state.time, out: document.getElementById('timeOut').textContent }));
await page.screenshot({ path: '/tmp/fm_night.png' });
console.log(JSON.stringify({ info0, info, night, logs }, null, 2));
await browser.close();

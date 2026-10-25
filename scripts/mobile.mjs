import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
const page = await ctx.newPage();
const logs = [];
page.on('pageerror', e => logs.push('PAGEERROR: '+e.message));
page.on('console', m => { if (m.type()==='error') logs.push('ERR: '+m.text()); });
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, { timeout: 60000 });
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/zh_mobile_day.png' });
const dims = await page.evaluate(() => ({ w: innerWidth, h: innerHeight, panelOpen: document.getElementById('panel').classList.contains('open'), fov: window.__ZH.camera.fov, overflow: document.documentElement.scrollWidth }));
await page.locator('#panel .panel-head').click();
await page.waitForTimeout(700);
await page.screenshot({ path: '/tmp/zh_mobile_panel.png' });
// close sheet, select a landmark via label
await page.locator('#panel .panel-head').click();
await page.waitForTimeout(500);
const label = page.locator('.label.primary').first();
await label.click({ force: true }).catch(()=>{});
await page.waitForTimeout(900);
await page.screenshot({ path: '/tmp/zh_mobile_info.png' });
// night
await page.locator('#dayNight button[data-mode="night"]').click();
await page.waitForTimeout(2200);
await page.screenshot({ path: '/tmp/zh_mobile_night.png' });
console.log(JSON.stringify({ dims, logs: logs.slice(0,5) }, null, 2));
await browser.close();

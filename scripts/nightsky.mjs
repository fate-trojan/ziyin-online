import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('ERR', e.message));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, null, { timeout: 60000 });
await page.waitForTimeout(600);
await page.evaluate(() => window.__ZH.setMode('night'));
await page.waitForTimeout(2600);
// 小人视角（含地面与远处建筑）
await page.evaluate(() => window.__ZH.teleport(-28, 100));
await page.waitForTimeout(800);
await page.screenshot({ path: 'screenshots/night_ground.png' });
// 抬头看天顶
await page.evaluate(() => window.__ZH.setViewNow([-28, 1.7, 100], [-28, 60, 96]));
await page.waitForTimeout(900);
await page.screenshot({ path: 'screenshots/night_up.png' });
// 平视地平线（泮池方向）
await page.evaluate(() => window.__ZH.setViewNow([-28, 1.7, 100], [-28, 4.2, 60]));
await page.waitForTimeout(900);
await page.screenshot({ path: 'screenshots/night_horizon.png' });
// 俯视全园
await page.evaluate(() => window.__ZH.setViewNow([0, 190, 190], [0, 0, 20]));
await page.waitForTimeout(900);
await page.screenshot({ path: 'screenshots/night_top.png' });
console.log('night', await page.evaluate(() => window.__ZH.env.night));
await browser.close();

import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, { timeout: 60000 });
await page.waitForTimeout(900);
await page.screenshot({ path: '/tmp/hero_day.png' });
// overview
await page.evaluate(() => window.__ZH.setViewNow([-28,135,285],[-28,18,40]));
await page.waitForTimeout(700);
await page.screenshot({ path: '/tmp/hero_overview.png' });
// hill
await page.evaluate(() => window.__ZH.setViewNow([150,50,-20],[60,12,-100]));
await page.waitForTimeout(700);
await page.screenshot({ path: '/tmp/hero_hill.png' });
// night at gate
await page.evaluate(() => { window.__ZH.setViewNow([-28,26,204],[-28,8,136]); window.__ZH.setTime(21); });
await page.waitForTimeout(1600);
await page.screenshot({ path: '/tmp/hero_night.png' });
// night overview
await page.evaluate(() => window.__ZH.setViewNow([-28,135,285],[-28,18,40]));
await page.waitForTimeout(700);
await page.screenshot({ path: '/tmp/hero_night_overview.png' });
console.log('done');
await browser.close();

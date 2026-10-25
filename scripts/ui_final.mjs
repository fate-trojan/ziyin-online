import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, { timeout: 60000 });
await page.waitForTimeout(900);
await page.screenshot({ path: '/tmp/ui_gate_day.png' });
await page.evaluate(() => window.__ZH.setTime(21));
await page.waitForTimeout(1300);
await page.screenshot({ path: '/tmp/ui_gate_night.png' });
await page.evaluate(() => { window.__ZH.setTime(11.5); window.__ZH.setViewNow([150,50,-20],[60,12,-100]); });
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/ui_hill.png' });
// clean gym front with corridor
await page.addStyleTag({ content: '#panel,#topbar,#brand,#viewBar,#hint,#bottomInfo,#compass,#labels,#mobileHint{display:none!important} #app::after{display:none!important}' });
await page.evaluate(() => window.__ZH.setViewNow([106,10,-88],[106,6,-124]));
await page.waitForTimeout(700);
await page.screenshot({ path: '/tmp/clean_gym_front.png' });
// clean hall after lattice refinement
await page.evaluate(() => window.__ZH.setViewNow([10,30,58],[-40,10,-16]));
await page.waitForTimeout(600);
await page.screenshot({ path: '/tmp/clean_hall2.png' });
console.log('ui final done');
await browser.close();

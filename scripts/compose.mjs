import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, { timeout: 60000 });
await page.waitForTimeout(1200);
const views = {
  a: [[140, 140, 360], [-8, 52, 10]],
  b: [[150, 170, 390], [-8, 48, 8]],
  c: [[120, 115, 330], [-10, 38, 18]],
  d: [[200, 120, 360], [-4, 26, 0]],
  e: [[170, 145, 330], [-8, 40, 10]],
};
for (const [name, [pos,target]] of Object.entries(views)) {
  await page.evaluate(([p,t]) => window.__ZH.setViewNow(p,t), [pos,target]);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `/tmp/comp_${name}.png` });
}
await browser.close();

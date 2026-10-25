import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, { timeout: 60000 });
await page.waitForTimeout(800);
const views = {
  f: [[150, 140, 390], [-8, 100, 5]],
  g: [[170, 120, 380], [-8, 85, 10]],
  h: [[120, 100, 300], [-10, 60, 20]],
  i: [[160, 120, 350], [-8, 70, 12]],
};
for (const [name, [pos,target]] of Object.entries(views)) {
  await page.evaluate(([p,t]) => window.__ZH.setViewNow(p,t), [pos,target]);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `/tmp/comp_${name}.png` });
}
await browser.close();

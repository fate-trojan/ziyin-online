import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, { timeout: 60000 });
await page.waitForTimeout(1000);
const views = {
  A: [[-10, 105, 245], [-28, 18, 30]],
  B: [[40, 110, 225], [-5, 20, 20]],
  C: [[80, 100, 210], [-10, 18, 20]],
  D: [[-60, 95, 225], [-25, 18, 25]],
  E: [[20, 90, 190], [-20, 16, 20]],
};
for (const [name, [pos,target]] of Object.entries(views)) {
  await page.evaluate(([p,t]) => window.__ZH.setViewNow(p,t), [pos,target]);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `/tmp/comp_${name}.png` });
}
await browser.close();

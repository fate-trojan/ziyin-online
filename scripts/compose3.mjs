import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, { timeout: 60000 });
await page.waitForTimeout(800);
const views = {
  j: [[90, 75, 220], [-20, 18, 20]],
  k: [[60, 90, 200], [-30, 12, 10]],
  l: [[110, 60, 210], [-15, 20, 25]],
  m: [[150, 100, 260], [-10, 25, 20]],
  n: [[70, 55, 170], [-25, 14, 15]],
};
for (const [name, [pos,target]] of Object.entries(views)) {
  await page.evaluate(([p,t]) => window.__ZH.setViewNow(p,t), [pos,target]);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `/tmp/comp_${name}.png` });
}
await browser.close();

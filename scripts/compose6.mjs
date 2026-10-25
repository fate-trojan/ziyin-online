import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, { timeout: 60000 });
await page.waitForTimeout(900);
const views = {
  X: [[-28, 95, 230], [-28, 18, 25]],
  Y: [[-28, 120, 260], [-28, 18, 20]],
  Z: [[-50, 90, 210], [-28, 18, 20]],
  W: [[0, 90, 200], [-28, 18, 20]],
};
for (const [name, [pos,target]] of Object.entries(views)) {
  await page.evaluate(([p,t]) => window.__ZH.setViewNow(p,t), [pos,target]);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `/tmp/comp_${name}.png` });
}
await browser.close();

import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, { timeout: 60000 });
await page.waitForTimeout(1000);
const views = {
  p: [[95, 70, 180], [-25, 16, 18]],
  q: [[-130, 80, 210], [-20, 18, 20]],
  r: [[10, 75, 200], [-25, 18, 20]],
  s: [[120, 90, 210], [-10, 20, 10]],
  t: [[-80, 60, 160], [-30, 15, 15]],
};
for (const [name, [pos,target]] of Object.entries(views)) {
  await page.evaluate(([p,t]) => window.__ZH.setViewNow(p,t), [pos,target]);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `/tmp/comp_${name}.png` });
}
await browser.close();

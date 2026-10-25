import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, { timeout: 60000 });
await page.waitForTimeout(700);
for (const [name, pos, target] of [
  ['hill_se',[150,50,-20],[60,12,-100]],
  ['hill_s',[62,45,0],[62,12,-100]],
  ['hill_close',[100,30,-55],[62,14,-104]],
  ['fude',[160,45,-70],[106,6,-122]],
  ['honglang',[30,20,-5],[0,3,-34]],
]) {
  await page.evaluate(([p,t]) => window.__ZH.setViewNow(p,t), [pos,target]);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `/tmp/zh_h_${name}.png` });
}
await page.evaluate(() => window.__ZH.select('lin'));
await page.waitForTimeout(1200);
await page.screenshot({ path: '/tmp/zh_h_info.png' });
await browser.close();

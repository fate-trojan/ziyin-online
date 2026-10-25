import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, { timeout: 60000 });
await page.waitForTimeout(700);
await page.evaluate(() => window.__ZH.setTime(21));
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/zh_night2.png' });
for (const [name, pos, target] of [
  ['pan',[0,16,104],[-28,2,70]],
  ['dacheng',[10,30,58],[-40,10,-16]],
  ['ziyin',[128,38,-34],[62,8,-94]],
  ['track',[158,50,72],[72,0,8]],
  ['axis',[-28,58,215],[-28,12,62]],
  ['gate',[-28,26,204],[-28,8,136]],
  ['academy',[-20,34,178],[-89,8,108]],
]) {
  await page.evaluate(([p,t]) => window.__ZH.setViewNow(p,t), [pos,target]);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `/tmp/zh_v_${name}.png` });
}
await browser.close();

import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, { timeout: 60000 });
await page.evaluate(() => window.__ZH.setTime(11.5));
await page.waitForTimeout(700);
const shots = {
  gate_front: [[-28,5.2,186],[-28,9,136]],
  gate_axis: [[-28,16,168],[-28,7,60]],
  overview: [[-28,135,285],[-28,18,40]],
  hall: [[10,30,58],[-40,10,-16]],
  hill: [[150,50,-20],[60,12,-100]],
  track: [[196,100,150],[72,0,8]],
  core: [[80,100,210],[-10,18,20]],
  observatory: [[10,60,30],[-100,18,-62]],
};
for (const [name,[p,t]] of Object.entries(shots)) {
  await page.evaluate(([p,t]) => window.__ZH.setViewNow(p,t), [p,t]);
  await page.waitForTimeout(650);
  await page.screenshot({ path: `/tmp/cmp_${name}.png` });
}
// night gate
await page.evaluate(() => { window.__ZH.setViewNow([-28,5.2,186],[-28,9,136]); window.__ZH.setTime(21); });
await page.waitForTimeout(1300);
await page.screenshot({ path: '/tmp/cmp_gate_night.png' });
console.log('done');
await browser.close();

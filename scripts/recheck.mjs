import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
const errs=[]; page.on('pageerror', e=>errs.push(e.message));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, { timeout: 60000 });
await page.addStyleTag({ content: '#panel,#topbar,#brand,#viewBar,#hint,#bottomInfo,#compass,#labels,#mobileHint{display:none!important} #app::after{display:none!important}' });
await page.evaluate(() => window.__ZH.setTime(11.5));
await page.waitForTimeout(700);
const shots = {
  gate_axis: [[-28,16,168],[-28,7,60]],
  overview: [[-28,135,285],[-28,18,40]],
  hall: [[10,30,58],[-40,10,-16]],
  academy: [[-5,48,195],[-89,12,110]],
  observatory: [[10,60,30],[-100,18,-62]],
  gate_mid: [[-28,18,120],[-28,8,10]],
};
for (const [name,[p,t]] of Object.entries(shots)) {
  await page.evaluate(([p,t]) => window.__ZH.setViewNow(p,t), [p,t]);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `/tmp/re_${name}.png` });
}
console.log('errors', errs);
await browser.close();

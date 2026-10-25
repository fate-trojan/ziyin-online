import { chromium } from 'playwright-core';
const tag = process.argv[2] || 'now';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
const errs=[]; page.on('pageerror', e=>errs.push(e.message)); page.on('console', m=>{ if(m.type()==='error') errs.push('C '+m.text()); });
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, { timeout: 60000 });
await page.addStyleTag({ content: '#panel,#topbar,#brand,#viewBar,#hint,#bottomInfo,#compass,#labels,#mobileHint{display:none!important} #app::after{display:none!important}' });
await page.evaluate(() => { window.__ZH.controls.maxDistance = 900; window.__ZH.controls.minDistance = .5; window.__ZH.setTime(11.5); });
await page.waitForTimeout(700);
const shots = {
  front: [[-118, 4, 145], [-118, 10, 124]],  // 对应 51.37 教学楼正立面
  air:   [[-100, 85, 160], [-118, 2, 106]],  // 对应 47.09 航拍
  top:   [[-118, 130, 150], [-118, 0, 107]], // 俯视定位
  sw:    [[-136, 16, 148], [-147, 3, 141]],  // 西南角小亭子与植被
  overview: [[-28, 135, 285], [-28, 18, 40]], // 全局回归：已锁定对象
};
for (const [name,[p,t]] of Object.entries(shots)) {
  await page.evaluate(([p,t]) => window.__ZH.setViewNow(p,t), [p,t]);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `/tmp/b7_${tag}_${name}.png` });
}
console.log('errors', errs);
await browser.close();

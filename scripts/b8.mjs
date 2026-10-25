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
  stand:  [[62, 9, 58], [28, 4.5, 58]],      // 对应 52.29 司令台正面（面朝跑道）
  stand_air: [[-8, 34, 30], [28, 3, 58]],     // 对应 51.33 航拍
  stand_side: [[28, 8, -2], [28, 3, -11]],     // 台西段：水平平台与西墙相连
  stand_west: [[20, 5, -34], [28, 3, -11]],    // 西墙视角：楼梯平台抵西墙
  courts: [[80, 190, 69], [80, 0, 69]],       // 跑道+西侧球场群
  ne:     [[170, 62, -55], [110, 0, 15]],     // 对应 45.05 操场东北角
  dorm:   [[30, 26, 10], [30, 6, -38]],       // 宿舍（45.05）
  pov:    [[44, 2.4, 58], [28, 5, 58]],       // 跑道上的平视
  overview: [[-28, 135, 285], [-28, 18, 40]], // 全局回归
};
for (const [name,[p,t]] of Object.entries(shots)) {
  await page.evaluate(([p,t]) => window.__ZH.setViewNow(p,t), [p,t]);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `/tmp/b8_${tag}_${name}.png` });
}
console.log('errors', errs);
await browser.close();

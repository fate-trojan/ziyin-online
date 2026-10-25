import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('ERR', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, { timeout: 60000 });
await page.waitForTimeout(700);
await page.evaluate(() => { const c = window.__ZH.controls; c.minDistance = .2; c.maxDistance = 3000; c.maxPolarAngle = Math.PI; });

const shots = [
  // B 红木楼梯：自东侧高处俯看整段
  ['b_stair_side', [130, 16, -60], [103, 6, -47]],
  // B 楼梯下段：站在纪念堂台基东侧，仰视上行
  ['b_stair_up', [105.5, 2.6, -51.5], [111, 9, -42]],
  // C 东线下山：自东南侧看
  ['c_down', [139, 9, -36], [127, 3.5, -31]],
  // C 线到 D 线拐角
  ['cd_corner', [140, 7, -14], [130, 1.5, -23]],
  // D 南线贴跑道一段：自跑道内北望
  ['d_line', [96, 3.2, -13], [95, .8, -24]],
  // D 线西段与 A 线西端
  ['a_west', [30, 4, -36], [42, 1, -38]],
  // 3m 铁栅栏与 D 线间距
  ['fence', [70, 6, -8], [75, .5, -23]],
  // 富的廊与纪念堂接合
  ['fude_hall', [90, 8, -72], [104, 4, -58]],
  // 山体整体：南向看向山（含 D 线、栅栏、跑道）
  ['hill_south', [90, 16, 6], [92, 6, -38]],
];
for (const [name, pos, target] of shots) {
  await page.evaluate(([p, t]) => window.__ZH.setViewNow(p, t), [pos, target]);
  await page.waitForTimeout(650);
  await page.screenshot({ path: `/tmp/b5y_${name}.png` });
}
await browser.close();
console.log('ok');

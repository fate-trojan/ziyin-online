import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('ERR', e.message));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, null, { timeout: 60000 });
await page.waitForTimeout(800);
await page.evaluate(() => { const c = window.__ZH.controls; c.minDistance = .2; c.maxDistance = 3000; c.maxPolarAngle = Math.PI; });
const tag = process.argv[2] || 'a';
const shots = [
  ['r4_bridge_e', [-31, 1.8, -44.6], [-45, 2.0, -45]],
  ['r4_bridge_w', [-58, 1.9, -45.4], [-45, 2.0, -45]],
  ['r4_bridge2', [70, 1.9, -52], [58, 2.0, -54.4]],
  ['r4_obs', [-30, 26, -40], [-77, 22, -76]],
  ['r4_obs2', [30, 34, -45], [-77, 24, -76]],
  ['r4_fude', [110, 1.9, -54], [70, 1.6, -59]],
  ['r4_ziyin', [138, 30, -14], [120, 15, -34]],
  ['r4_gym_s', [28, 10, -38], [28, 5.5, -85]],
  ['r4_gym_w', [-28, 13, -52], [28, 5.5, -85]],
  ['r4_tower', [-58, 32, -44], [-88, 27, -88]],
  ['r4_dome', [-38, 26, -40], [-66, 24, -65]],
  ['r4_dome_s', [-66, 24, -32], [-66, 22, -65]],
  ['r4_fude_e', [106, 5, -56], [64, 3, -60]],
  ['r4_fude_n', [86, 12, -80], [86, 4, -58]],
  ['b1_pond_top', [-28, 44, 91], [-28, 0, 90]],
  ['b1_pond_gate', [-28, 18, 122], [-28, 2, 88]],
  ['b1_pond_e', [12, 3.5, 90], [-46, 1.2, 90]],
  ['b2_gate_front', [-28, 6, 126], [-28, 4, 140]],
  ['b2_gate_wide', [-28, 40, 108], [-28, 0, 140]],
  ['b2_gate_back', [-28, 11, 118], [-28, 4, 142]],
  ['b2_axis_north', [-28, 22, 112], [-28, 8, 62]],
  ['b2_redcorridor', [-8, 26, 10], [-30, 0, -8]],
  ['b3_gym_sw', [-16, 18, -48], [28, 7, -85]],
  ['b3_gym_s', [56, 11, -46], [28, 7, -85]],
  ['b3_wing_join', [-6, 20, -70], [-25, 6, -99]],
  ['b3_gym_river', [80, 24, -48], [30, 7, -85]],
  ['b3_wing_roof', [-25, 36, -68], [-25, 8, -99]],
  ['b3_wing_s', [-25, 6, -72], [-25, 6, -99]],
  ['b4_gym_entrance', [28, 8, -58], [28, 6, -83]],
  ['b4_gym_roof3', [28, 34, -66], [16, 12, -84]],
  ['b4_science', [-96, 34, -108], [-90, 8, -102]],
  ['b4_science_joint', [-90, 32, -104], [-84, 8, -96]],
  ['b4_complex', [-78, 40, -144], [-70, 10, -152]],
  ['b6_qin', [-82, 20, -36], [-72, 8, -44]],
  ['b6_cor_b', [-56, 12, -24], [-54, 6, -46]],
  ['b6_cor_e', [-40, 14, -46], [-56, 8, -40]],
  ['b6_shuba', [-90, 12, -30], [-80, 7, -38]],
];
for (const [name, p, t] of shots) {
  await page.evaluate(([p, t]) => window.__ZH.setViewNow(p, t), [p, t]);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `screenshots/${name}_${tag}.png` });
}
// Space 跳跃验证
await page.evaluate(() => window.__ZH.follow());
await page.waitForTimeout(600);
const y0 = await page.evaluate(() => window.__ZH.pos()[1]);
await page.mouse.click(600, 450);
await page.keyboard.press('Space');
await page.waitForTimeout(700);
const p1 = await page.evaluate(() => window.__ZH.phys());
await page.waitForTimeout(700);
const p2 = await page.evaluate(() => window.__ZH.phys());
console.log('JUMP', y0.toFixed(3), JSON.stringify(p1), JSON.stringify(p2));
console.log('ok');
await browser.close();

// 游戏内截图：node gameview.mjs <posX,posY,posZ> <tgtX,tgtY,tgtZ> <out.png> [time] [ui]
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire('/Users/chenxuhang/myproject/work/zhenhai-campus/package.json');
const { chromium } = require('playwright-core');

const pos = process.argv[2].split(',').map(Number);
const tgt = process.argv[3].split(',').map(Number);
const out = process.argv[4];
const time = Number(process.argv[5] || 12);
const HIDE = process.argv[6] !== 'ui';

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: false,
  args: ['--window-position=1180,30', '--window-size=1280,820', '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'],
});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await page.goto('http://127.0.0.1:5174/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__ || window.__READY, null, { timeout: 90000 });
await page.waitForTimeout(1200);
await page.evaluate(([p, t, time, hide]) => {
  const zh = window.__ZH;
  zh.setTime(time);
  zh.controls.minDistance = .1; zh.controls.maxDistance = 2000;
  if (hide) {
    for (const s of ['#hud', '#labels', '#panel', '#topbar', '#dock', '.hud', '.topbar', '.panel', '#info', '#dayNight', '#season', '#stat', '#tips'])
      document.querySelectorAll(s).forEach(e => { e.style.display = 'none'; });
  }
  zh.setViewNow(p, t);
}, [pos, tgt, time, HIDE]);
await page.waitForTimeout(900);
await page.locator('#scene').screenshot({ path: out });
console.log('shot', out, pos, '->', tgt);
await browser.close();

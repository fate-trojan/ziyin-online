// B 站视频截帧：node bili.mjs <startSec> <count> <outDir> [BV号或URL] [stepSec=1]
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire('/Users/chenxuhang/myproject/work/ziyin-online/package.json');
const { chromium } = require('playwright-core');

const START = Number(process.argv[2] || 0);
const COUNT = Number(process.argv[3] || 30);
const OUT = process.argv[4] || '/tmp/zhenhai-video/probe';
const ARG4 = process.argv[5] || 'BV1NT42117VK';
const URL = ARG4.startsWith('http') ? ARG4 : `https://www.bilibili.com/video/${ARG4}`;
const STEP = Number(process.argv[6] || 1);
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: false,
  args: ['--window-position=1180,30', '--window-size=1280,820', '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('video', { timeout: 45000 });
// 关掉可能的登录弹层
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
const closeBtn = page.locator('.bpx-player-ctrl-btn, .bili-mini-close-icon, .close-icon').first();
try { await closeBtn.click({ timeout: 800 }); } catch {}
await page.addStyleTag({ content: '.bpx-player-control-wrap,.bpx-player-dm-wrap,.bpx-player-login-tip,.bpx-player-ending-wrap,.bpx-player-video-btn,.bpx-player-state-wrap,.bili-mini-mask{display:none!important}' });
// 登录/试看提示不在固定类名里，按文案定位后移除，避免遮挡画面底部
await page.evaluate(() => {
  for (const el of document.querySelectorAll('#bilibili-player *')) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (r.width > 150 && r.height < 80 && cs.position !== 'static' && /登录|免费享/.test(el.textContent || '')) el.remove();
  }
});
await page.waitForTimeout(800);

const info = await page.evaluate(async () => {
  const v = document.querySelector('video');
  v.muted = true;
  const t0 = Date.now();
  while ((!v.duration || v.duration === Infinity) && Date.now() - t0 < 20000) await new Promise(r => setTimeout(r, 300));
  return {
    title: document.title,
    duration: v.duration,
    w: v.videoWidth, h: v.videoHeight,
    rect: (() => { const r = v.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })(),
  };
});
fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify({ ...info, start: START, count: COUNT, step: STEP }, null, 2));
console.log(JSON.stringify(info));

for (let i = 0; i < COUNT; i++) {
  const t = START + i * STEP;
  if (info.duration && t > info.duration - 1) break;
  await page.evaluate(async (t) => {
    const v = document.querySelector('video');
    if (!v.paused) v.pause();
    v.muted = true;
    await new Promise((res) => {
      let done = false;
      const fin = () => { if (!done) { done = true; res(); } };
      v.addEventListener('seeked', fin, { once: true });
      try { v.currentTime = t; } catch { fin(); }
      setTimeout(fin, 2500);
    });
    if (v.readyState < 2) await new Promise((r) => { v.addEventListener('loadeddata', r, { once: true }); setTimeout(r, 2000); });
  }, t);
  await page.waitForTimeout(120);
  // 走 canvas 取原生帧：不受播放器浮层（登录/试看提示）影响，也避免视频元素截图黑屏
  const dataUrl = await page.evaluate(() => {
    const v = document.querySelector('video');
    const c = document.createElement('canvas');
    c.width = v.videoWidth || 640;
    c.height = v.videoHeight || 360;
    c.getContext('2d').drawImage(v, 0, 0);
    return c.toDataURL('image/png');
  });
  fs.writeFileSync(path.join(OUT, `t${String(Math.round(t * 10)).padStart(6, '0')}.png`), Buffer.from(dataUrl.split(',')[1], 'base64'));
}
console.log('captured', COUNT, '->', OUT);
await browser.close();

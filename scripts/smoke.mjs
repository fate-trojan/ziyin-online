import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader'] });
for (const mode of ['desktop','mobile']) {
  const ctx = await browser.newContext(mode==='mobile' ? { viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true } : { viewport:{width:1600,height:1000} });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__READY__, { timeout: 60000 });
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => ({
    active: document.querySelector('#viewBar button[data-view].active')?.dataset.view,
    cam: window.__ZH.camera.position.toArray().map(n=>+n.toFixed(1)),
    target: window.__ZH.controls.target.toArray().map(n=>+n.toFixed(1)),
    labels: [...document.querySelectorAll('.label')].filter(e=>getComputedStyle(e).opacity>0.5).map(e=>e.dataset.id),
    mem: window.__ZH.renderer.info.memory,
    panelOpen: document.getElementById('panel').classList.contains('open'),
  }));
  console.log(mode, JSON.stringify(r), 'errors', errs);
  await ctx.close();
}
await browser.close();

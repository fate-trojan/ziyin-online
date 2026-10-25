import { chromium } from 'playwright-core';
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader','--disable-gpu-sandbox']
});
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
const logs=[];
page.on('console', m => logs.push('CONSOLE '+m.type()+': '+m.text()));
page.on('pageerror', e => logs.push('PAGEERROR '+e.message+'\n'+e.stack));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
try { await page.waitForFunction(() => window.__READY__, { timeout: 60000 }); } catch(e) { logs.push('READY TIMEOUT'); }
await page.waitForTimeout(2500);
const info = await page.evaluate(() => ({
  ready: window.__READY__,
  info: window.__ZH ? window.__ZH.rendererInfo() : null,
  gl: (()=>{ const c=document.querySelector('canvas'); const gl=c.getContext('webgl2')||c.getContext('webgl'); return gl? gl.getParameter(gl.VERSION): 'none'; })()
}));
console.log(JSON.stringify(info,null,2));
await page.screenshot({ path: '/tmp/zh_day1.png' });
console.log(logs.slice(0,40).join('\n'));
await browser.close();

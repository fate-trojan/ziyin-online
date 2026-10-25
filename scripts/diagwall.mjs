import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('ERR', e.message));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, null, { timeout: 60000 });
await page.waitForTimeout(600);
await page.evaluate(() => { const c = window.__ZH.controls; c.minDistance = .2; c.maxDistance = 3000; c.maxPolarAngle = Math.PI; });
const info = await page.evaluate(() => {
  const c = window.__ZH.campus;
  let wall = null;
  c.group.traverse(o => { if (o.isMesh && o.material === c.fogWallMat) wall = o; });
  if (wall) {
    wall.geometry.computeBoundingBox();
    const bb = wall.geometry.boundingBox;
    c.fogWallMat.color.set(0xff0000);
    return { found: true, verts: wall.geometry.attributes.position.count, bb: [bb.min.toArray(), bb.max.toArray()], visible: wall.visible, opacity: c.fogWallMat.opacity, hasMap: !!c.fogWallMat.map, mapImg: c.fogWallMat.map.image.width };
  }
  return { found: false };
});
console.log(JSON.stringify(info));
await page.evaluate(() => window.__ZH.setViewNow([-28, 1.7, 130], [-28, 3.0, 200]));
await page.waitForTimeout(900);
await page.screenshot({ path: 'screenshots/diag_wall_red.png' });
await browser.close();

import { chromium } from 'playwright-core';
import fs from 'fs';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('ERR', e.message));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, { timeout: 60000 });
await page.waitForTimeout(1500);
const views = {
  core: [[-6, 26, 42], [-38, 10, -14]],
  pan: [[-4, 14, 104], [-28, 2, 69]],
  hill: [[128, 38, -34], [62, 8, -94]],
  gate: [[-28, 14, 192], [-28, 5, 142]],
  track: [[158, 50, 72], [72, 0, 8]],
  aerial: [[70, 170, 240], [-8, 8, 20]],
};
for (const [name, [pos, target]] of Object.entries(views)) {
  await page.evaluate(([p,t]) => window.__ZH.setView(p,t), [pos,target]);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `/tmp/zh_${name}.png` });
}
const data = await page.evaluate(() => {
  const z = window.__ZH;
  const out = { roofTexture: null, normals: [], meshCounts: {} };
  try { out.roofTexture = z.mats.roof.map.image.toDataURL('image/png'); } catch(e) { out.roofTexture = 'ERR '+e.message; }
  let count=0;
  z.scene.traverse(o => {
    if (o.isMesh && o.material) {
      const mats = Array.isArray(o.material)?o.material:[o.material];
      if (mats.some(m => m === z.mats.roof) && count < 5 && o.geometry.attributes.normal) {
        const n=o.geometry.attributes.normal;
        out.normals.push({ name: o.parent?.parent?.name||'', y0:n.getY(0), y1:n.getY(1), y2:n.getY(2), count:n.count, color: mats[0].color?.getHexString(), side:mats[0].side });
        count++;
      }
    }
  });
  const info = z.renderer.info;
  out.meshCounts = { sceneChildren: z.scene.children.length, calls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures };
  return out;
});
fs.writeFileSync('/tmp/rooftexture.png', Buffer.from(data.roofTexture.split(',')[1], 'base64'));
delete data.roofTexture;
console.log(JSON.stringify(data,null,2));
await browser.close();

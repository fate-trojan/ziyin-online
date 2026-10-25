import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl','--ignore-gpu-blocklist','--use-angle=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 900, height: 600 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, null, { timeout: 90000 });
await page.waitForTimeout(500);
const res = await page.evaluate(() => {
  const zh = window.__ZH, c = zh.campus;
  const S = 2; // grid step
  const x0 = -175, x1 = 245, z0 = -200, z1 = 200;
  const nx = Math.ceil((x1 - x0) / S), nz = Math.ceil((z1 - z0) / S);
  const idx = (i, j) => i * nz + j;
  const free = new Uint8Array(nx * nz);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const x = x0 + i * S, z = z0 + j * S;
    free[idx(i, j)] = c.isBlocked(x, z) ? 0 : 1;
  }
  const si = Math.round((zh.spawn.x - x0) / S), sj = Math.round((zh.spawn.z - z0) / S);
  const seen = new Uint8Array(nx * nz);
  const q = [idx(si, sj)]; seen[q[0]] = 1;
  let count = 0;
  while (q.length) {
    const cur = q.pop(); count++;
    const i = Math.floor(cur / nz), j = cur % nz;
    for (const [di, dj] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
      const k = idx(a, b);
      if (seen[k] || !free[k]) continue;
      seen[k] = 1; q.push(k);
    }
  }
  const totalFree = free.reduce((s, v) => s + v, 0);
  const lm = [];
  for (const l of c.landmarks) {
    const [lx, , lz] = l.pos;
    // 找该地标 4~18m 内最近的可达点
    let best = 1e9, bestPt = null;
    for (let r = 4; r <= 20; r += 2) {
      for (let a = 0; a < 16; a++) {
        const px = lx + Math.cos(a / 16 * Math.PI * 2) * r;
        const pz = lz + Math.sin(a / 16 * Math.PI * 2) * r;
        const i = Math.round((px - x0) / S), j = Math.round((pz - z0) / S);
        if (i < 0 || j < 0 || i >= nx || j >= nz) continue;
        const k = idx(i, j);
        if (seen[k]) { if (r < best) { best = r; bestPt = [px, pz]; } }
      }
      if (bestPt) break;
    }
    lm.push({ id: l.id, name: l.name, reachable: !!bestPt, dist: bestPt ? best : null });
  }
  return { reach: count, totalFree, lm };
});
console.log('reachable cells', res.reach, '/', res.totalFree, '=', (res.reach / res.totalFree * 100).toFixed(1) + '%');
console.log('unreachable landmarks', res.lm.filter(x => !x.reachable));
console.log('reachable landmarks', res.lm.filter(x => x.reachable).map(x => x.id).join(','));
console.log('errors', errs);
await browser.close();

import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader'] });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, { timeout: 60000 });
const out = await page.evaluate(() => {
  const c = window.__ZH.campus;
  const h = (x, z) => +c.hillHeight(x, z).toFixed(2);
  const grid = [];
  for (let z = -60; z <= -28; z += 4) {
    const row = [];
    for (let x = 88; x <= 120; x += 4) row.push(`${x}:${h(x, z)}`);
    grid.push(`z=${z}  ${row.join('  ')}`);
  }
  const trees = (c.nature.allTrees || []).filter(t => Math.hypot(t.x - 101, t.z + 40) < 14)
    .map(t => `${t.type}(${t.x.toFixed(1)},${t.z.toFixed(1)})`).slice(0, 60);
  return { grid, trees, count: (c.nature.allTrees || []).length };
});
console.log(out.grid.join('\n'));
console.log('trees near platform west (r<14):', out.trees.length);
console.log(out.trees.join(' '));
console.log('all trees', out.count);
await browser.close();

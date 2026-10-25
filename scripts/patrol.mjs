// navmesh + A* 自动巡视 + 每秒截图（滚动保留 60 秒）+ 穿模/卡住遥测
// 用法: node scripts/patrol.mjs [分钟数，默认 10]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

/* ---------- 可调参数 ---------- */
const MINUTES = Number(process.argv[2] || 10);
const URL = 'http://127.0.0.1:5174/';
const OUT = '/tmp/zhenhai-patrol';
const ROLL = path.join(OUT, 'roll');
const FLAG = path.join(OUT, 'flagged');
const EVENTS = path.join(OUT, 'events.jsonl');
const KEEP_MS = 60_000;       // 截图保留 60 秒
const SHOT_MS = 1_000;        // 每秒一张
const NAV_STEP = 1.0;         // navmesh 栅格边长（米）
const ARRIVE = 1.2;           // 路径点到达判定（米）
const STUCK_MS = 3_000;       // 卡住超时
const REPLAN_MS = 25_000;     // 单条路径最长执行时间
const RUN_MS = MINUTES * 60_000;

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(ROLL, { recursive: true });
fs.mkdirSync(FLAG, { recursive: true });
const log = (type, data = {}) => fs.appendFileSync(EVENTS, JSON.stringify({ type, t: Date.now(), ...data }) + '\n');

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: false,
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--window-position=40,40', '--disable-background-timer-throttling'],
});
const ctx = await browser.newContext({ viewport: { width: 960, height: 600 } });
const page = await ctx.newPage();
const consoleIssues = [];
const seenConsole = new Set();
page.on('pageerror', (e) => { if (!seenConsole.has(e.message)) { seenConsole.add(e.message); consoleIssues.push('pageerror: ' + e.message); log('pageerror', { msg: e.message }); } });
page.on('console', (m) => {
  if (m.type() !== 'error' && m.type() !== 'warning') return;
  const txt = m.type() + ': ' + m.text();
  if (seenConsole.has(txt)) return;
  seenConsole.add(txt); consoleIssues.push(txt); log('console', { level: m.type(), msg: m.text() });
});

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__READY__, null, { timeout: 90000 });
await page.waitForTimeout(600);
await page.mouse.click(480, 300);

const state = () => page.evaluate(() => {
  const zh = window.__ZH, p = zh.pos(), ph = zh.phys(), cam = zh.camera;
  const d = new zh.THREE.Vector3(); cam.getWorldDirection(d);
  return {
    p, ph: { y: ph.y, gy: ph.gy, vy: ph.vy, onGround: ph.onGround, freeCam: ph.freeCam },
    face: zh.player.group.rotation.y,
    cam: cam.position.toArray(), dir: d.toArray(),
    blocked: zh.campus.isBlocked(p[0], p[2]),
    camBlocked: zh.campus.isBlocked(cam.position.x, cam.position.z) &&
      !(zh.campus.onlyFencesBlocked(cam.position.x, cam.position.z) &&
        cam.position.y - zh.campus.groundY(cam.position.x, cam.position.z) > 3.2),
    camNearWall: zh.campus.nearBoundary(cam.position.x, cam.position.z, 1.2),
    inBounds: zh.campus.inBounds(p[0], p[2]),
  };
});

const aim = (x, z, dist = 4.0) => page.evaluate(([x, z, dist]) => {
  const zh = window.__ZH, cam = zh.camera, t = zh.controls.target;
  const b = Math.atan2(x - t.x, z - t.z);
  cam.position.set(t.x - Math.sin(b) * dist, t.y + 1.2, t.z - Math.cos(b) * dist);
  zh.controls.update();
  return b;
}, [x, z, dist]);

/* ---------- 浏览器内生成 navmesh：栅格 → 贪心合并矩形 + 邻接 ---------- */
const nav = await page.evaluate(([step]) => {
  const c = window.__ZH.campus;
  const x0 = -200, z0 = -210, nx = Math.ceil(440 / step), nz = Math.ceil(430 / step);
  const free = new Uint8Array(nx * nz);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const x = x0 + (i + .5) * step, z = z0 + (j + .5) * step;
    // 高台/台阶顶面（台基、司令台）不在平地寻路范围内，避免直线撞台阶卡死
    free[i * nz + j] = !c.isBlocked(x, z) && c.inBounds(x, z) && c.groundY(x, z) <= .4 ? 1 : 0;
  }
  // 腐蚀一格，避免 navmesh 贴墙贴缝、路径点落在碰撞边界上导致小人蹭墙卡死
  const free2 = new Uint8Array(nx * nz);
  for (let i = 1; i < nx - 1; i++) for (let j = 1; j < nz - 1; j++) {
    const k = i * nz + j;
    if (free[k] && free[k + nz] && free[k - nz] && free[k + 1] && free[k - 1]) free2[k] = 1;
  }
  free.set(free2);
  const rectOf = new Int32Array(nx * nz).fill(-1);
  const rects = [];
  // 逐条格边采样，避免栅栏正好从两格中心中间穿过时被误判为可通行
  const openI = new Uint8Array(nx * nz); // 本格 → i+1
  const openJ = new Uint8Array(nx * nz); // 本格 → j+1
  const edgeClear = (x1, z1, x2, z2) => {
    for (const t of [.2, .5, .8]) {
      if (c.isBlocked(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t)) return false;
    }
    return true;
  };
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const k = i * nz + j;
    if (!free[k]) continue;
    const x = x0 + (i + .5) * step, z = z0 + (j + .5) * step;
    if (i + 1 < nx && free[k + nz] && edgeClear(x, z, x + step, z)) openI[k] = 1;
    if (j + 1 < nz && free[k + 1] && edgeClear(x, z, x, z + step)) openJ[k] = 1;
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = i * nz + j;
    if (!free[k] || rectOf[k] >= 0) continue;
    let i2 = i;
    while (i2 + 1 < nx && rectOf[(i2 + 1) * nz + j] < 0 && openI[i2 * nz + j]) i2++;
    let j2 = j;
    grow: while (j2 + 1 < nz) {
      for (let a = i; a <= i2; a++) {
        const kk = a * nz + j2 + 1;
        if (!free[kk] || rectOf[kk] >= 0 || !openJ[a * nz + j2]) break grow;
      }
      j2++;
    }
    const id = rects.length;
    rects.push([i, i2, j, j2]);
    for (let a = i; a <= i2; a++) for (let b = j; b <= j2; b++) rectOf[a * nz + b] = id;
  }
  const adj = rects.map(() => new Set());
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const r = rectOf[i * nz + j];
    if (r < 0) continue;
    if (i + 1 < nx && openI[i * nz + j]) { const r2 = rectOf[(i + 1) * nz + j]; if (r2 >= 0 && r2 !== r) { adj[r].add(r2); adj[r2].add(r); } }
    if (j + 1 < nz && openJ[i * nz + j]) { const r2 = rectOf[i * nz + j + 1]; if (r2 >= 0 && r2 !== r) { adj[r].add(r2); adj[r2].add(r); } }
  }
  const b64 = (arr) => {
    let s = ''; const CH = 0x8000;
    for (let i = 0; i < arr.length; i += CH) s += String.fromCharCode.apply(null, arr.subarray(i, i + CH));
    return btoa(s);
  };
  return {
    x0, z0, nx, nz, step, rects,
    adj: adj.map(s => [...s]),
    freeB64: b64(free),
    landmarks: c.landmarks.map(l => [l.pos[0], l.pos[2]]),
  };
}, [NAV_STEP]);

const { x0, z0, nx, nz, step, rects, landmarks } = nav;
const free = Uint8Array.from(Buffer.from(nav.freeB64, 'base64'));
const adj = nav.adj;
const centers = rects.map(([i0, i1, j0, j1]) => [
  x0 + ((i0 + i1) / 2 + .5) * step,
  z0 + ((j0 + j1) / 2 + .5) * step,
]);
const rectFreeAt = (x, z) => {
  const i = Math.floor((x - x0) / step), j = Math.floor((z - z0) / step);
  return (i < 0 || j < 0 || i >= nx || j >= nz) ? 0 : free[i * nz + j];
};
const los = (x1, z1, x2, z2) => {
  const d = Math.hypot(x2 - x1, z2 - z1);
  const n = Math.ceil(d / .35);
  for (let k = 1; k < n; k++) {
    const t = k / n;
    if (!rectFreeAt(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t)) return false;
  }
  return true;
};
const rectAt = (x, z) => {
  for (let r = 0; r < rects.length; r++) {
    const [i0, i1, j0, j1] = rects[r];
    if (x > x0 + i0 * step && x < x0 + (i1 + 1) * step && z > z0 + j0 * step && z < z0 + (j1 + 1) * step) return r;
  }
  let best = 0, bd = Infinity;
  for (let r = 0; r < rects.length; r++) {
    const [cx, cz] = centers[r];
    const d = (cx - x) ** 2 + (cz - z) ** 2;
    if (d < bd) { bd = d; best = r; }
  }
  return best;
};
const nearLandmark = centers.map(([cx, cz]) => {
  let d = 99;
  for (const [lx, lz] of landmarks) d = Math.min(d, Math.hypot(cx - lx, cz - lz));
  return d;
});

/* ---------- A*（矩形图） ---------- */
function astar(s, g) {
  const N = rects.length;
  const gs = new Float64Array(N).fill(Infinity);
  const came = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const heap = [];
  const push = (r, f) => {
    heap.push([f, r]);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]]; i = p;
    }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
      }
    }
    return top;
  };
  const h = (r) => Math.hypot(centers[r][0] - centers[g][0], centers[r][1] - centers[g][1]);
  gs[s] = 0; push(s, h(s));
  while (heap.length) {
    const [, r] = pop();
    if (closed[r]) continue;
    closed[r] = 1;
    if (r === g) break;
    for (const n of adj[r]) {
      if (closed[n]) continue;
      const w = Math.hypot(centers[n][0] - centers[r][0], centers[n][1] - centers[r][1]);
      const ng = gs[r] + w;
      if (ng < gs[n]) { gs[n] = ng; came[n] = r; push(n, ng + h(n)); }
    }
  }
  if (came[g] < 0 && g !== s) return null;
  const chain = [];
  for (let r = g; r !== -1; r = came[r]) { chain.push(r); if (r === s) break; }
  chain.reverse();
  // 视线拉直（漏斗式）：只保留能直达的拐点
  const pts = chain.map(r => centers[r]);
  const out = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = i + 1;
    while (j + 1 < pts.length && los(pts[i][0], pts[i][1], pts[j + 1][0], pts[j + 1][1])) j++;
    out.push(pts[j]);
    i = j;
  }
  return out;
}

/* ---------- 巡视状态 ---------- */
const st0 = await state();
let startRect = rectAt(st0.p[0], st0.p[2]);
// 全图连通分量：若出生点被困在跑道内圈等小连通区，换到最大的可行走分量再巡视
const compIds = new Int32Array(rects.length).fill(-1);
const comps = [];
for (let s = 0; s < rects.length; s++) {
  if (compIds[s] >= 0) continue;
  const id = comps.length, q = [s];
  compIds[s] = id;
  for (let h = 0; h < q.length; h++) for (const n of adj[q[h]]) if (compIds[n] < 0) { compIds[n] = id; q.push(n); }
  comps.push(q);
}
let mainComp = comps[0] || [];
for (const c of comps) if (c.length > mainComp.length) mainComp = c;
const startCompSize = comps[compIds[startRect]] ? comps[compIds[startRect]].length : 0;
if (startCompSize < mainComp.length * .8) {
  let best = mainComp[0], bd = Infinity;
  for (const r of mainComp) {
    const [cx, cz] = centers[r];
    const d = cx * cx + cz * cz;
    if (d < bd) { bd = d; best = r; }
  }
  const [tx, tz] = centers[best];
  await page.evaluate(([x, z]) => {
    const zh = window.__ZH, gy = zh.campus.groundY(x, z);
    zh.player.group.position.set(x, gy, z);
    zh.controls.target.set(x, gy + 1.62, z);
    zh.camera.position.set(x, gy + 2.6, z + 4);
    zh.controls.update();
  }, [tx, tz]);
  startRect = best;
  log('teleport', { from: st0.p, to: [tx, tz], startCompSize, mainSize: mainComp.length });
}
// 只巡视与（新）出生点连通的可达矩形
const reach = new Uint8Array(rects.length);
const rq = [startRect];
reach[startRect] = 1;
for (let h = 0; h < rq.length; h++) {
  for (const n of adj[rq[h]]) if (!reach[n]) { reach[n] = 1; rq.push(n); }
}
const reachable = rq;
const visited = new Uint8Array(rects.length);
const dead = new Uint8Array(rects.length);
let pathPts = [];
let targetRect = -1;
let lastPlan = 0;
let curPos = st0.p;
let prevPoint = st0.p;

function pickTarget(from) {
  let best = -1;
  for (let attempt = 0; attempt < 3 && best < 0; attempt++) {
    let bs = Infinity;
    for (const r of reachable) {
      if (visited[r] || dead[r]) continue;
      const [cx, cz] = centers[r];
      const d = Math.hypot(cx - from[0], cz - from[2]);
      const score = d * .5 + nearLandmark[r] * .8 + Math.random() * 14;
      if (score < bs) { bs = score; best = r; }
    }
    if (best < 0) { if (attempt === 0) visited.fill(0); else dead.fill(0); }
  }
  return best >= 0 ? best : startRect;
}

function markSegment(x1, z1, x2, z2) {
  const d = Math.hypot(x2 - x1, z2 - z1);
  const n = Math.max(1, Math.ceil(d / 2.5));
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const r = rectAt(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t);
    visited[r] = 1;
  }
}

const totalFree = reachable.length;
const start = Date.now();
let shots = 0, flags = 0, stuckCount = 0, jumpMax = 0, lastJump = 0, replanCount = 0;

log('start', { minutes: MINUTES, navStep: NAV_STEP, rects: rects.length, reachable: totalFree, start: st0.p, bounds: { x0, z0, nx, nz } });

/* ---------- 键盘（定时重发 keydown，防止页面失焦后游戏清空按键状态） ---------- */
const held = { w: false, shift: false };
let lastKeyAt = 0;
async function move(w, shift) {
  const now = Date.now();
  if (w && (!held.w || now - lastKeyAt > 800)) { await page.keyboard.down('w'); held.w = true; lastKeyAt = now; }
  if (!w && held.w) { await page.keyboard.up('w'); held.w = false; lastKeyAt = 0; }
  const s = !!(w && shift);
  if (s && !held.shift) { await page.keyboard.down('Shift'); held.shift = true; }
  if (!s && held.shift) { await page.keyboard.up('Shift'); held.shift = false; }
}

let lastPos = null, lastMoveT = Date.now();

/* ---------- navmesh 巡视 ---------- */
(async () => {
  while (Date.now() - start < RUN_MS) {
    const st = await state();
    curPos = st.p;

    if (!pathPts.length || Date.now() - lastPlan > REPLAN_MS) {
      if (targetRect < 0) targetRect = pickTarget(curPos);
      const startR = rectAt(curPos[0], curPos[2]);
      const plan = astar(startR, targetRect);
      replanCount++;
      if (!plan || !plan.length) {
        dead[targetRect] = 1;
        targetRect = -1;
        lastPlan = Date.now();
        log('unreachable', { from: curPos, rect: startR, goal: targetRect });
        await page.waitForTimeout(200);
        continue;
      }
      pathPts = plan;
      // 第一段从实际位置出发，减少贴墙绕行
      if (pathPts.length > 1 && los(curPos[0], curPos[2], pathPts[0][0], pathPts[0][1])) pathPts.shift();
      prevPoint = curPos;
      lastPlan = Date.now();
      log('plan', { from: curPos.map(v => +v.toFixed(1)), waypoints: pathPts.length, goal: pathPts[pathPts.length - 1]?.map(v => +v.toFixed(1)) });
      lastPos = null;
      continue;
    }

    const [tx, tz] = pathPts[0];
    const dist = Math.hypot(tx - curPos[0], tz - curPos[2]);
    await aim(tx, tz);
    await move(true, dist > 8);

    if (dist < ARRIVE) {
      markSegment(prevPoint[0], prevPoint[2], tx, tz);
      prevPoint = [tx, curPos[1], tz];
      pathPts.shift();
      lastPos = null;
      if (!pathPts.length) {
        visited[targetRect] = 1;
        targetRect = -1;
      }
    }

    // 卡住：3 秒没挪动 0.7m，判定该 navmesh 矩形不可达
    if (!lastPos || Math.hypot(curPos[0] - lastPos[0], curPos[2] - lastPos[2]) > .7) { lastPos = curPos; lastMoveT = Date.now(); }
    else if (Date.now() - lastMoveT > STUCK_MS) {
      stuckCount++;
      log('stuck', { at: curPos.map(v => +v.toFixed(2)), wp: [tx, tz], rect: targetRect, blocked: st.blocked, camBlocked: st.camBlocked, waypointsLeft: pathPts.length });
      await page.screenshot({ path: path.join(FLAG, `stuck-${Date.now()}.jpg`), type: 'jpeg', quality: 70 });
      if (targetRect >= 0) dead[targetRect] = 1;
      targetRect = -1;
      pathPts = [];
      await move(false, false);
      lastPos = null;
    }

    // 跳跃检查：每 60 秒一次
    if (Date.now() - lastJump > 60000) {
      lastJump = Date.now();
      await page.keyboard.press('Space');
      jumpMax = 0;
      for (let i = 0; i < 12; i++) { await page.waitForTimeout(100); const s = await state(); jumpMax = Math.max(jumpMax, s.ph.y - s.ph.gy); }
      log('jump', { maxRise: +jumpMax.toFixed(2), at: curPos.map(v => +v.toFixed(1)) });
    }
    await page.waitForTimeout(150);
  }
  await move(false, false);
  log('driveDone', { stuckCount, replanCount, visited: visited.reduce((s, v) => s + v, 0) });
})();

/* ---------- 每秒截图 + 滚动清理 ---------- */
(async () => {
  while (Date.now() - start < RUN_MS) {
    const t = Date.now();
    const file = path.join(ROLL, `${t}.jpg`);
    await page.screenshot({ path: file, type: 'jpeg', quality: 70 });
    shots++;
    const st = await state();
    const wp = pathPts[0] || [0, 0];
    log('tick', {
      shot: path.basename(file), p: st.p.map(v => +v.toFixed(2)), gy: +st.ph.gy.toFixed(2),
      blocked: st.blocked, camBlocked: st.camBlocked, camNearWall: st.camNearWall, inBounds: st.inBounds, onGround: st.ph.onGround,
      wp: [+wp[0].toFixed(1), +wp[1].toFixed(1)], rect: targetRect, visited: visited.reduce((s, v) => s + v, 0), free: totalFree,
    });

    const sunk = st.ph.y < st.ph.gy - 0.06;
    if (st.blocked || st.camBlocked || sunk || !st.inBounds) {
      flags++;
      const tags = [st.blocked && 'posBlocked', st.camBlocked && 'camBlocked', sunk && 'sunk', !st.inBounds && 'outOfBounds'].filter(Boolean).join('+');
      log('anomaly', { tags, p: st.p, gy: st.ph.gy, cam: st.cam });
      fs.copyFileSync(file, path.join(FLAG, `anomaly-${tags}-${t}.jpg`));
    }

    for (const f of fs.readdirSync(ROLL)) {
      const fp = path.join(ROLL, f);
      if (t - fs.statSync(fp).mtimeMs > KEEP_MS) fs.unlinkSync(fp);
    }
    await page.waitForTimeout(Math.max(100, SHOT_MS - (Date.now() - t)));
  }
  log('shotsDone', { shots, flags });
})();

setTimeout(async () => {
  const cells = visited.reduce((s, v) => s + v, 0);
  const summary = {
    shots, flags, stuckCount, replanCount,
    rects: rects.length, rectsVisited: cells, rectsReachable: totalFree,
    coverage: +(cells / totalFree * 100).toFixed(1), jumpMax, consoleIssues,
  };
  log('end', summary);
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
  try { await browser.close(); } catch { try { browser.process()?.kill('SIGKILL'); } catch {} }
  process.exit(0);
}, RUN_MS + 3000);

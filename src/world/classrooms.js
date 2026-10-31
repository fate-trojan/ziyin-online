import * as THREE from 'three';
import { tbox, tcyl, mergeGeometriesSafe } from '../util.js';

/*
 * 教学楼内景（NW/NE/SE 三栋 L 形楼）
 * 依据手绘草图：北长条 = 3 教室 + 两端双跑楼梯 + 南侧走廊；南块 = 单教室；
 * 红线所示黑板：北条教室黑板在东侧隔墙，南块黑板在西墙。
 * 所有尺寸取自 buildModernBlock 的实际方块：北条 26×7.5、南块 12×7.5，层高 3.45。
 */

const FH = 3.45;     // 层高
const CH = 3.29;     // 净墙高（楼板厚 0.16）
const IT = 0.14;     // 内隔墙厚
const WT = 0.30;     // 外墙厚
export const WALL_FILL = '#f2eee5'; // 立面贴图底色：内景已开真窗的墙面改绘为纯墙色

let _m = null;
function CM() {
  if (_m) return _m;
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({
    color, roughness: .92, metalness: .02, emissive: color, emissiveIntensity: .18, ...o,
  });
  _m = {
    wall: std(0xf1eee6, { emissiveIntensity: .26 }),
    tile: std(0xe9edea, { emissiveIntensity: .32, roughness: .55 }),
    wain: std(0xd9c8a4, { emissiveIntensity: .2 }),
    floor: std(0xa9a79d, { emissiveIntensity: .16, roughness: .78 }),
    floorBand: std(0x9b5a43, { emissiveIntensity: .16 }),
    ceil: std(0xf6f5f0, { emissiveIntensity: .3 }),
    board: std(0x2f4d3c, { emissiveIntensity: .22, roughness: .7 }),
    boardWood: std(0x7a5a36, { emissiveIntensity: .18 }),
    desk: std(0xc79a60, { emissiveIntensity: .2, roughness: .8 }),
    chair: std(0xb4875a, { emissiveIntensity: .2 }),
    steel: std(0x555b59, { emissiveIntensity: .12, metalness: .45, roughness: .5 }),
    frame: std(0x7a4530, { emissiveIntensity: .3, metalness: .1, roughness: .6 }),
    frameInner: std(0xefe9da, { emissiveIntensity: .3, metalness: .1, roughness: .6 }),
    sill: std(0xd7d5cc, { emissiveIntensity: .2 }),
    door: std(0xe8e6dd, { emissiveIntensity: .26, roughness: .65 }),
    doorFrame: std(0x92948f, { emissiveIntensity: .16, metalness: .25, roughness: .55 }),
    stair: std(0xb4b1a6, { emissiveIntensity: .16 }),
    tread: std(0x5f6462, { emissiveIntensity: .1, metalness: .3, roughness: .45 }),
    nosing: std(0xd7a52a, { emissiveIntensity: .35 }),
    rail: std(0x2c231b, { emissiveIntensity: .12 }),
    handrail: std(0xd08a26, { emissiveIntensity: .2, metalness: .3, roughness: .5 }),
    // 教学楼外廊：栏板木黄灰、扶手褐色（视频内景视角）
    railWood: std(0xb8b48f, { emissiveIntensity: .12, roughness: .85 }),
    railHand: std(0x6b4128, { emissiveIntensity: .16, metalness: .1, roughness: .6 }),
    curtain: std(0xc6ae86, { emissiveIntensity: .1, roughness: .95 }),
    notice: std(0xdfe6e3, { emissiveIntensity: .2 }),
    noticeFrame: std(0x4c6f86, { emissiveIntensity: .14 }),
    glass: new THREE.MeshStandardMaterial({
      color: 0xbfd4d8, transparent: true, opacity: .22, roughness: .12,
      metalness: .1, emissive: 0xa9c6cc, emissiveIntensity: .18, depthWrite: false,
    }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xfff6df }),
    lampBody: std(0xd8d6cc, { emissiveIntensity: .3 }),
    fan: std(0x3f4442, { emissiveIntensity: .1, metalness: .3 }),
    flag: std(0xbe2b2b, { emissiveIntensity: .24 }),
    flagStar: std(0xe8c34b, { emissiveIntensity: .3 }),
  };
  return _m;
}

class Batch {
  constructor(g) { this.g = g; this.groups = new Map(); }
  add(geo, mat, cast = true, receive = true) {
    let e = this.groups.get(mat);
    if (!e) { e = { geos: [], cast, receive }; this.groups.set(mat, e); }
    e.geos.push(geo);
  }
  box(mat, w, h, d, x, y, z, cast = true) {
    this.add(tbox(w, h, d, x, y, z), mat, cast, true);
  }
  flush() {
    for (const [mat, e] of this.groups) {
      if (!e.geos.length) continue;
      const mesh = new THREE.Mesh(mergeGeometriesSafe(e.geos), mat);
      mesh.castShadow = e.cast; mesh.receiveShadow = e.receive;
      this.g.add(mesh);
      e.geos.length = 0;
    }
    this.groups.clear();
  }
}

function collider(cols, x, z, hx, hz, y0, y1, pad = 0) {
  cols.push({ x, z, hx, hz, y0, y1, pad });
}
function walkRect(walks, x0, x1, z0, z1, y) {
  walks.push({ x0, x1, z0, z1, y });
}
function walkRamp(walks, x0, x1, z0, z1, yA, yB, axis = 'z') {
  walks.push({ x0, x1, z0, z1, yA, yB, axis });
}

/* 带真实窗洞的外墙（法线沿 z）。y0 为楼面标高 */
function windowWallX(B, M, o) {
  const { x0, x1, zc, t, y0, ops, sill = 1.0, head = 2.6, inward = 1, curtain = false, bottomMat } = o;
  const sorted = ops.slice().sort((a, b) => a[0] - b[0]);
  let cur = x0;
  for (const [a, b] of sorted) {
    if (a > cur + .001) B.box(M.wall, a - cur, CH, t, (cur + a) / 2, y0 + CH / 2, zc);
    B.box(bottomMat || M.tile, b - a, sill, t, (a + b) / 2, y0 + sill / 2, zc);
    B.box(M.wall, b - a, CH - head, t, (a + b) / 2, y0 + head + (CH - head) / 2, zc);
    // 玻璃与窗框
    const gw = b - a - .1, gh = head - sill - .1;
    B.box(M.glass, gw, gh, .02, (a + b) / 2, y0 + (sill + head) / 2, zc, false);
    for (const [fw, fh, fx, fy] of [
      [gw + .06, .06, (a + b) / 2, y0 + sill - .01],
      [gw + .06, .06, (a + b) / 2, y0 + head + .01],
      [.06, gh + .06, a + .02, y0 + (sill + head) / 2],
      [.06, gh + .06, b - .02, y0 + (sill + head) / 2],
    ]) B.box(M.frame, fw, fh, t + .05, fx, fy, zc);
    const n = Math.max(1, Math.round(gw / 1.5));
    for (let i = 1; i < n; i++) {
      B.box(M.frameInner, .05, gh, t + .04, a + .05 + (gw / n) * i, y0 + (sill + head) / 2, zc);
    }
    B.box(M.sill, b - a + .16, .05, .2, (a + b) / 2, y0 + sill - .03, zc + inward * (t / 2 + .08));
    if (curtain) {
      for (const cx of [a + .14, b - .14]) {
        B.box(M.curtain, .26, head - sill + .4, .09, cx, y0 + (sill + head) / 2 + .06, zc + inward * (t / 2 + .1));
      }
    }
    cur = b;
  }
  if (cur < x1 - .001) B.box(M.wall, x1 - cur, CH, t, (cur + x1) / 2, y0 + CH / 2, zc);
}

/* 带真实窗洞的外墙（法线沿 x） */
function windowWallZ(B, M, o) {
  const { z0, z1, xc, t, y0, ops, sill = 1.0, head = 2.6, inward = 1 } = o;
  const sorted = ops.slice().sort((a, b) => a[0] - b[0]);
  let cur = z0;
  for (const [a, b] of sorted) {
    if (a > cur + .001) B.box(M.wall, t, CH, a - cur, xc, y0 + CH / 2, (cur + a) / 2);
    B.box(M.tile, t, sill, b - a, xc, y0 + sill / 2, (a + b) / 2);
    B.box(M.wall, t, CH - head, b - a, xc, y0 + head + (CH - head) / 2, (a + b) / 2);
    const gw = b - a - .1, gh = head - sill - .1;
    B.box(M.glass, .02, gh, gw, xc, y0 + (sill + head) / 2, (a + b) / 2, false);
    for (const [fh, fw, fz, fy] of [
      [.06, gw + .06, (a + b) / 2, y0 + sill - .01],
      [.06, gw + .06, (a + b) / 2, y0 + head + .01],
      [gh + .06, .06, a + .02, y0 + (sill + head) / 2],
      [gh + .06, .06, b - .02, y0 + (sill + head) / 2],
    ]) B.box(M.frame, t + .05, fh, fw, xc, fy, fz);
    B.box(M.sill, .2, .05, b - a + .16, xc + inward * (t / 2 + .08), y0 + sill - .03, (a + b) / 2);
    cur = b;
  }
  if (cur < z1 - .001) B.box(M.wall, t, CH, z1 - cur, xc, y0 + CH / 2, (cur + z1) / 2);
}

function solidWallX(B, M, x0, x1, zc, t, y0) {
  B.box(M.wall, x1 - x0, CH, t, (x0 + x1) / 2, y0 + CH / 2, zc);
}
function lintelX(B, M, x0, x1, zc, t, y0, h = 2.15) {
  B.box(M.wall, x1 - x0, CH - h, t, (x0 + x1) / 2, y0 + h + (CH - h) / 2, zc);
}
function lintelZ(B, M, z0, z1, xc, t, y0, h = 2.15) {
  B.box(M.wall, t, CH - h, z1 - z0, xc, y0 + h + (CH - h) / 2, (z0 + z1) / 2);
}

/* 平开门：门扇开启 90°，白门带竖向观察窗 */
function doorAt(B, M, o) {
  const { dir, c, along, y, w = 1.3, h = 2.15, inward = -1, leaves = 1 } = o;
  const half = w / 2;
  if (dir === 'x') {
    for (const s of [-1, 1]) B.box(M.doorFrame, .09, h + .06, .12, along + s * (half - .02), y + h / 2, c);
    B.box(M.doorFrame, w + .1, .09, .12, along, y + h + .02, c);
    const lw = leaves === 2 ? (w - .12) / 2 : w - .08;
    const hinges = leaves === 2 ? [along - half + .05, along + half - .05] : [along - half + .04];
    for (const hx of hinges) {
      B.box(M.door, .045, h - .04, lw, hx, y + h / 2, c + inward * (lw / 2 + .02));
      B.box(M.glass, .06, .82, .14, hx, y + 1.58, c + inward * (lw - .26));
    }
  } else {
    for (const s of [-1, 1]) B.box(M.doorFrame, .12, h + .06, .09, c, y + h / 2, along + s * (half - .02));
    B.box(M.doorFrame, .12, .09, w + .1, c, y + h + .02, along);
    const lw = leaves === 2 ? (w - .12) / 2 : w - .08;
    const hinges = leaves === 2 ? [along - half + .05, along + half - .05] : [along - half + .04];
    for (const hz of hinges) {
      B.box(M.door, lw, h - .04, .045, c + inward * (lw / 2 + .02), y + h / 2, hz);
      B.box(M.glass, .14, .82, .06, c + inward * (lw - .26), y + 1.58, hz);
    }
  }
}

/* 墨绿黑板：贴在法线为 x 的墙上（side=+1 表示墙在教室东侧） */
function blackboardX(B, M, xw, z0, z1, y, side) {
  const zc = (z0 + z1) / 2, bw = z1 - z0;
  B.box(M.boardWood, .07, 1.34, bw + .16, xw - side * .035, y + 1.72, zc);
  B.box(M.board, .03, 1.1, bw, xw - side * .075, y + 1.72, zc);
  B.box(M.boardWood, .13, .07, bw + .24, xw - side * .11, y + 1.14, zc);
  // 国旗（黑板右上方）
  B.box(M.flag, .02, .34, .5, xw - side * .06, y + 2.62, zc + bw * .32);
  B.box(M.flagStar, .025, .07, .07, xw - side * .07, y + 2.69, zc + bw * .32 - .12);
  B.box(M.boardWood, .035, .62, .035, xw - side * .07, y + 2.6, zc + bw * .32 - .29);
}

function flagAtWallZ(B, M, zw, x, y, inward) { // 备用：贴在法线为 z 的墙上
  B.box(M.flag, .5, .34, .02, x, y, zw + inward * .06);
  B.box(M.flagStar, .07, .07, .025, x - .12, y + .06, zw + inward * .07);
}

function deskAt(B, M, o) {
  const { x, z, y, face } = o; // face=+1 表示学生朝 +x
  B.box(M.desk, .5, .05, 1.16, x, y + .75, z);
  for (const sx of [-.2, .2]) for (const sz of [-.52, .52]) {
    B.box(M.steel, .045, .72, .045, x + sx, y + .36, z + sz);
  }
  B.box(M.desk, .46, .22, 1.04, x, y + .63, z); // 桌斗
  for (const dz of [-.3, .3]) {
    const cx = x - face * .45, cy = y;
    for (const sx of [-.17, .17]) for (const sz of [-.17, .17]) {
      B.box(M.steel, .035, .44, .035, cx + sx, cy + .22, z + dz + sz);
    }
    B.box(M.chair, .42, .04, .42, cx, cy + .45, z + dz);
    B.box(M.chair, .045, .4, .42, cx - face * .21, cy + .68, z + dz);
  }
}

function teacherDesk(B, M, o) {
  const { x, z, y, face } = o;
  B.box(M.desk, .62, .05, 1.5, x, y + .76, z);
  B.box(M.desk, .58, .72, 1.44, x, y + .38, z);
  B.box(M.chair, .46, .05, .46, x + face * .55, y + .45, z);
  B.box(M.chair, .05, .42, .46, x + face * .78, y + .69, z);
}

function pendant(B, M, x, y, z, len = .95) {
  B.box(M.lampBody, len + .08, .07, .24, x, y - .02, z);
  B.box(M.lamp, len, .035, .16, x, y - .065, z, false);
}
function fan(B, M, x, y, z) {
  B.box(M.fan, .16, .1, .16, x, y, z);
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI / 3;
    B.add(tbox(.82, .025, .16, x, y - .03, z, a), M.fan, false, true);
  }
}

/* 单跑楼梯：从 (zLow,yLow) 升到 (zHigh,yHigh)
 * 踏步为薄板 + 斜底板，下方留净空（上层梯段不会压住下层梯段） */
function stairRun(B, M, walks, o) {
  const { x0, x1, zLow, yLow, zHigh, yHigh, n = 10, railX = null } = o;
  const dz = (zHigh - zLow) / n, dy = (yHigh - yLow) / n;
  const slab = .16;
  for (let i = 0; i < n; i++) {
    const za = zLow + dz * i, zb = zLow + dz * (i + 1);
    const top = yLow + dy * (i + 1);
    B.box(M.stair, x1 - x0, slab, Math.abs(dz), (x0 + x1) / 2, top - slab / 2, (za + zb) / 2);
    B.box(M.tread, x1 - x0, .035, Math.abs(dz), (x0 + x1) / 2, top + .018, (za + zb) / 2);
    B.box(M.nosing, x1 - x0, .04, .06, (x0 + x1) / 2, top + .022, zb - Math.sign(dz) * .03);
    walkRect(walks, x0, x1, Math.min(za, zb), Math.max(za, zb), top);
    if (railX !== null) {
      B.box(M.steel, .04, .9, .04, railX, top + .45, zb - Math.sign(dz) * .05);
    }
  }
  // 斜底板：贴踏步底，封住梯段下方但不填实
  const len = Math.hypot(zHigh - zLow, yHigh - yLow);
  const ang = Math.atan2(-(yHigh - yLow), zHigh - zLow);
  B.add(tbox(x1 - x0, .1, len, (x0 + x1) / 2, (yLow + yHigh) / 2 - .17, (zLow + zHigh) / 2, 0, ang, 0), M.stair);
  if (railX !== null) {
    B.add(tbox(.06, .07, len, railX, (yLow + yHigh) / 2 + .94, (zLow + zHigh) / 2, 0, ang, 0), M.handrail);
    B.box(M.rail, .09, .1, .09, railX, yLow + .98, zLow - Math.sign(dz) * .04);
  }
}

/* 入口台阶：3 级，单级 ≤0.35；首级紧贴墙面，走面逐级搭接不留空档 */
function entranceSteps(B, M, walks, x, zWall, y, width = 2.4) {
  for (let i = 0; i < 3; i++) {
    const top = y - i * .28;
    const z0 = zWall + i * .4, z1 = z0 + .42;
    B.box(M.stair, width, top, z1 - z0, x, top / 2, (z0 + z1) / 2);
    walkRect(walks, x - width / 2, x + width / 2, z0, z1, top);
  }
  walkRect(walks, x - .9, x + .9, zWall - .3, zWall + .02, y);
}

/* 在立面贴图上挖透明门洞：x 为建筑局部坐标，y 为相对立面底 fby 的绝对高度
 * mirror：背面立面绕 Y 转了 180°，贴图 u 方向与局部 x 相反
 * fill：给定时整面重绘为该墙色——内景已开真实门窗的墙面不再保留贴图上画出来的窗 */
export function punchFacade(g, which, w, h, fby, rects, mirror = false, fill = null, fillKeep = 0) {
  const mat = g.userData[which + 'Facade'];
  if (!mat || !mat.map || !mat.map.image) return;
  const paint = (old) => {
    const img = old.image;
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    const ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0);
    if (fill) {
      // fillKeep：自底保留的贴图高度（米，青砖墙裙），重绘白墙时不要盖掉
      const cut = fillKeep > 0 ? cv.height - (fillKeep / h) * cv.height : cv.height;
      ctx.fillStyle = fill; ctx.fillRect(0, 0, cv.width, cut);
    }
    const repX = old.repeat.x, offX = old.offset.x;
    for (const r of rects) {
      const ux0 = mirror ? 1 - (r.x1 + w / 2) / w : (r.x0 + w / 2) / w;
      const ux1 = mirror ? 1 - (r.x0 + w / 2) / w : (r.x1 + w / 2) / w;
      const u0 = ux0 * repX + offX, u1 = ux1 * repX + offX;
      const py0 = (1 - (r.y1 - fby) / h) * cv.height;
      const py1 = (1 - (r.y0 - fby) / h) * cv.height;
      ctx.clearRect(u0 * cv.width, py0, (u1 - u0) * cv.width, py1 - py0);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = old.colorSpace;
    tex.wrapS = old.wrapS; tex.wrapT = old.wrapT;
    tex.repeat.copy(old.repeat); tex.offset.copy(old.offset);
    tex.flipY = old.flipY; tex.anisotropy = old.anisotropy;
    tex.needsUpdate = true;
    return tex;
  };
  mat.map = paint(mat.map);
  if (fill) {
    // 纯墙色不带夜景画窗：关掉该立面的夜间自发光
    mat.emissiveMap = null;
    mat.emissiveIntensity = 0;
    mat.userData.baseEmissive = 0;
  } else if (mat.emissiveMap) mat.emissiveMap = paint(mat.emissiveMap);
  mat.alphaTest = .5;
  mat.transparent = false;
  mat.needsUpdate = true;
}

/* ------------------------------------------------------------------
 * 北长条：3 教室 + 两端双跑楼梯 + 南侧走廊
 * ------------------------------------------------------------------ */
export function decorateNorthBlock(ctx, g, opts) {
  const {
    by = .8, fby = 0, w = 26, d = 7.5, floors = 4,
    bbSide = 1, connectSide = 1, bare = false, // bare：毛坯房，室内不放任何家具/装饰
  } = opts;
  const M = CM(), B = new Batch(g), cols = [], walks = [];
  const FY = by + .06;
  const h = floors * FH + 1.2;
  const xN = w / 2, xS = -w / 2, zN = -d / 2, zS = d / 2;
  const stairW = 2.4, corridorD = 2.2;
  const corridorZ = zS - corridorD;          // 走廊与教室隔墙中心 1.55
  const roomX0 = xS + stairW, roomX1 = xN - stairW;
  const roomZ0 = zN + WT, roomZ1 = corridorZ - IT / 2;
  const corZ0 = corridorZ + IT / 2, corZ1 = zS - WT;
  const rw = (roomX1 - roomX0) / 3;
  const rb = [roomX0, roomX0 + rw, roomX0 + 2 * rw, roomX1];
  const connX = connectSide * (xN - 1.2);
  const roomDoors = [0, 1, 2].map((i) => [rb[i] + .6, rb[i] + 1.9]);
  const covered0 = connectSide > 0 ? xN - 8 : xS;
  const covered1 = connectSide > 0 ? xN : xS + 8;
  const corCov0 = Math.max(covered0, roomX0), corCov1 = Math.min(covered1, roomX1);
  const exposed0 = connectSide > 0 ? roomX0 : covered1;
  const exposed1 = connectSide > 0 ? covered0 : roomX1;
  const doorX = opts.doorX === undefined ? (exposed0 + exposed1) / 2 : opts.doorX;
  // 楼梯间净尺寸
  const east = { a: roomX1 + IT / 2, b: xN - WT };
  const west = { a: xS + WT, b: roomX0 - IT / 2 };
  const stairs = [
    { ...west, side: -1, sx: xS },
    { ...east, side: 1, sx: xN },
  ];

  // 走面：教室 + 走廊
  for (let f = 0; f < floors; f++) {
    const y = FY + f * FH;
    walkRect(walks, roomX0 - .1, roomX1 + .1, roomZ0 - .1, corZ1 + .1, y);
    // 楼板
    B.box(M.floor, roomX1 - roomX0 + .2, .16, corZ1 - roomZ0 + .2, (roomX0 + roomX1) / 2, y - .08, (roomZ0 + corZ1) / 2);
    // 走廊彩色分带（水磨石地面上的橙红导视带）
    if (!bare) B.box(M.floorBand, roomX1 - roomX0 - .2, .012, .28, (roomX0 + roomX1) / 2, y + .006, zS - WT - .42);
    // 教室隔墙（走廊侧）：留 1.3m 门洞
    for (let i = 0; i < 3; i++) {
      const x0 = rb[i], x1 = rb[i + 1];
      const [a, b] = roomDoors[i];
      if (a > x0 + .01) solidWallX(B, M, x0, a, corridorZ, IT, y);
      if (b < x1 - .01) solidWallX(B, M, b, x1, corridorZ, IT, y);
      lintelX(B, M, a, b, corridorZ, IT, y);
      if (!bare) doorAt(B, M, { dir: 'x', c: corridorZ, along: (a + b) / 2, y, w: 1.3, inward: -1 });
      // 走廊侧瓷砖墙裙
      if (a > x0 + .01) B.box(M.tile, a - x0 - .04, 1.05, .02, (x0 + a) / 2, y + .525, corZ0 + .012);
      if (b < x1 - .01) B.box(M.tile, x1 - b - .04, 1.05, .02, (b + x1) / 2, y + .525, corZ0 + .012);
      // 教室侧墙裙
      if (a > x0 + .01) B.box(M.tile, a - x0 - .04, 1.0, .02, (x0 + a) / 2, y + .5, roomZ1 - .012);
      if (b < x1 - .01) B.box(M.tile, x1 - b - .04, 1.0, .02, (b + x1) / 2, y + .5, roomZ1 - .012);
      if (!bare) {
        // 公告栏
        B.box(M.noticeFrame, 1.26, .86, .05, (x0 + x1) / 2, y + 1.95, corZ0 + .04);
        B.box(M.notice, 1.14, .74, .02, (x0 + x1) / 2, y + 1.95, corZ0 + .075, false);
        // 走廊吸顶灯
        pendant(B, M, x0 + rw * .28, y + CH - .02, zS - corridorD * .45, .95);
        pendant(B, M, x0 + rw * .72, y + CH - .02, zS - corridorD * .45, .95);
      }
    }
    // 教室隔墙（互相之间）
    for (const x of [rb[1], rb[2]]) {
      B.box(M.wall, IT, CH, roomZ1 - roomZ0, x, y + CH / 2, (roomZ0 + roomZ1) / 2);
      for (const s of [-1, 1]) {
        B.box(M.tile, .02, 1.0, roomZ1 - roomZ0 - .04, x + s * (IT / 2 + .012), y + .5, (roomZ0 + roomZ1) / 2);
      }
      collider(cols, x, (roomZ0 + roomZ1) / 2, IT / 2, (roomZ1 - roomZ0) / 2, y, y + CH, .2);
    }
    // 走廊 → 两端楼梯间：教室山墙（黑板墙）始终保留
    for (const s of [-1, 1]) {
      const xw = s < 0 ? roomX0 : roomX1;
      const zDoor0 = 2.45, zDoor1 = 3.35;
      // 靠中轴一端：墙只做到走廊隔墙，走廊整跨开敞连通梯间平台（BV1Ck4y117vU 65s 端部无墙）
      // 另一端：墙做到门框，留 0.9m 门
      const zEnd = s === connectSide ? corZ0 : zDoor0;
      B.box(M.wall, IT, CH, zEnd - roomZ0, xw, y + CH / 2, (roomZ0 + zEnd) / 2);
      collider(cols, xw, (roomZ0 + zEnd) / 2, IT / 2, (zEnd - roomZ0) / 2, y, y + CH, .22);
      if (s === connectSide) continue;
      B.box(M.wall, IT, CH, corZ1 - zDoor1, xw, y + CH / 2, (zDoor1 + corZ1) / 2);
      lintelZ(B, M, zDoor0, zDoor1, xw, IT, y);
      if (!bare) doorAt(B, M, { dir: 'z', c: xw, along: (zDoor0 + zDoor1) / 2, y, w: .9, inward: s });
      collider(cols, xw, (zDoor1 + corZ1) / 2, IT / 2, (corZ1 - zDoor1) / 2, y, y + CH, .22);
      collider(cols, xw, (zDoor0 + zDoor1) / 2, IT / 2, (zDoor1 - zDoor0) / 2, y + 2.15, y + FH, .22);
    }
    // 北外墙（教室窗 + 楼梯间窗）
    const northOps = [];
    for (let i = 0; i < 3; i++) northOps.push([rb[i] + .45, rb[i + 1] - .45]);
    windowWallX(B, M, { x0: roomX0, x1: roomX1, zc: zN + WT / 2, t: WT, y0: y, ops: northOps, sill: 1.0, head: 2.62, inward: 1, curtain: !bare });
    for (const st of stairs) {
      windowWallX(B, M, { x0: Math.min(st.a, st.b), x1: Math.max(st.a, st.b), zc: zN + WT / 2, t: WT, y0: y, ops: [[Math.min(st.a, st.b) + .2, Math.max(st.a, st.b) - .2]], sill: 1.55, head: 2.9, inward: 1 });
    }
    // 南外墙：外露走廊段（首层敞开外廊 + 方柱；二层及以上为开敞外廊 + 栏板）
    // 2026-10-25 用户指令：一楼靠花池一侧的墙拆掉，台阶做成长条形、与墙同长
    // 外廊外缘楼板（原外墙位置），承托栏板与通行
    B.box(M.floor, exposed1 - exposed0, .16, WT + .02, (exposed0 + exposed1) / 2, y - .08, zS - WT / 2);
    if (f === 0) {
      const nCol = Math.max(2, Math.round((exposed1 - exposed0) / 3.9));
      for (let i = 0; i <= nCol; i++) {
        const cx = exposed0 + (exposed1 - exposed0) * (i / nCol);
        if (Math.abs(cx - doorX) < 1.9) continue; // 原门位留空
        B.box(M.wall, .34, CH + .06, .34, cx, y - .06 + (CH + .06) / 2, zS - WT / 2);
        collider(cols, cx, zS - WT / 2, .17, .17, 0, y + CH, .25);
      }
      // 通长三级台阶：与拆掉的南墙同长，单级抬升 .28（≤.35 可直接走）
      const len = exposed1 - exposed0, xc = (exposed0 + exposed1) / 2;
      for (let i = 0; i < 3; i++) {
        const top = FY - .28 * i, z0 = zS + i * .4, z1 = z0 + .42;
        B.box(M.stair, len, top, z1 - z0, xc, top / 2, (z0 + z1) / 2);
        walkRect(walks, exposed0, exposed1, z0, z1, top);
      }
      walkRect(walks, exposed0, exposed1, zS - .3, zS + .02, FY);
    } else {
      // 二层及以上为开敞外廊：木黄灰栏板 + 褐色扶手（截图：走廊对面教学楼）
      const len = exposed1 - exposed0;
      const zr = zS - .07;
      B.box(M.railWood, len, .85, .1, (exposed0 + exposed1) / 2, y + .425, zr);
      B.box(M.railHand, len + .04, .1, .2, (exposed0 + exposed1) / 2, y + .93, zr);
      collider(cols, (exposed0 + exposed1) / 2, zr, len / 2, .1, y, y + 1.02, .12);
    }
    // 南外墙：被南块压住的走廊段（实墙）
    if (corCov1 > corCov0) {
      solidWallX(B, M, corCov0, corCov1, zS - WT / 2, WT, y);
      collider(cols, (corCov0 + corCov1) / 2, zS - WT / 2, (corCov1 - corCov0) / 2, WT / 2, f === 0 ? 0 : y, y + CH, .3);
      B.box(M.tile, corCov1 - corCov0 - .04, 1.05, .02, (corCov0 + corCov1) / 2, y + .525, corZ1 - WT / 2 - .012);
    }
    // 南外墙：两端楼梯间（连接侧留每层通道门）
    for (const st of stairs) {
      const x0 = Math.min(st.a, st.b), x1 = Math.max(st.a, st.b);
      if (st.side === connectSide) {
        const g0 = connX - .7, g1 = connX + .7;
        if (g0 > x0 + .02) solidWallX(B, M, x0, g0, zS - WT / 2, WT, y);
        if (g1 < x1 - .02) solidWallX(B, M, g1, x1, zS - WT / 2, WT, y);
        lintelX(B, M, g0, g1, zS - WT / 2, WT, y, 2.2);
        // 只画门框/门扇，门洞由立面贴图挖洞
        if (!bare) doorAt(B, M, { dir: 'x', c: zS - WT / 2, along: connX, y, w: 1.4, h: 2.15, inward: -1, leaves: 2 });
        collider(cols, (x0 + g0) / 2, zS - WT / 2, (g0 - x0) / 2, WT / 2, f === 0 ? 0 : y, y + CH, .3);
        collider(cols, (g1 + x1) / 2, zS - WT / 2, (x1 - g1) / 2, WT / 2, f === 0 ? 0 : y, y + CH, .3);
        collider(cols, connX, zS - WT / 2, .7, WT / 2, y + 2.2, y + FH, .3);
        // 通道门洞：楼板过道
        walkRect(walks, connX - .78, connX + .78, zS - WT - .3, zS + .45, y);
      } else {
        windowWallX(B, M, { x0, x1, zc: zS - WT / 2, t: WT, y0: y, ops: [[x0 + .2, x1 - .2]], sill: 1.05, head: 2.6, inward: -1 });
        collider(cols, (x0 + x1) / 2, zS - WT / 2, (x1 - x0) / 2, WT / 2, f === 0 ? 0 : y, y + CH, .3);
      }
    }
    // 东西山墙（楼梯间采光窗）；靠中轴端山墙南半面无墙（BV1Ck4y117vU 64s 立面）
    for (const s of [-1, 1]) {
      const xc = s < 0 ? xS + WT / 2 : xN - WT / 2;
      const inward = s < 0 ? 1 : -1;
      const open = s === connectSide;
      windowWallZ(B, M, {
        z0: zN + WT, z1: open ? 0 : zS - WT, xc, t: WT, y0: y,
        ops: [[-2.6, -1.15]], sill: 1.6, head: 2.9, inward,
      });
    }

    // 教室家具（毛坯房不摆放）
    if (!bare) for (let i = 0; i < 3; i++) {
      const x0 = rb[i] + IT / 2, x1 = rb[i + 1] - IT / 2;
      const xc = (x0 + x1) / 2, zc = (roomZ0 + roomZ1) / 2;
      const xw = bbSide > 0 ? x1 : x0;
      blackboardX(B, M, xw, zc - 1.75, zc + 1.75, y, bbSide);
      teacherDesk(B, M, { x: xw - bbSide * 1.1, z: zc, y, face: bbSide });
      for (let r = 0; r < 3; r++) {
        const dx = xw - bbSide * (1.95 + r * 1.55);
        for (const oz of [-1.79, -.6, .6, 1.79]) {
          deskAt(B, M, { x: dx, z: zc + oz, y, face: bbSide });
        }
      }
      pendant(B, M, xc - 1.4, y + CH - .02, zc, 1.05);
      pendant(B, M, xc + 1.4, y + CH - .02, zc, 1.05);
      fan(B, M, xc, y + CH - .34, zc);
    }

    // 楼梯间：南平台 + 北半平台 + 两跑；顶层只铺南平台，北侧为梯井
    for (const st of stairs) {
      const a = Math.min(st.a, st.b), b = Math.max(st.a, st.b), mid = (a + b) / 2;
      const zS0 = 2.42, zS1 = zS - WT - .02;
      const zN1 = -2.42, zN0 = zN + WT + .02;
      // 南平台（与走廊门相接，同时是下层 B 跑的到达面）
      B.box(M.floor, b - a, .16, zS1 - zS0, mid, y - .08, (zS0 + zS1) / 2);
      walkRect(walks, a, b, zS0, zS1 + .02, y);
      if (f === 0) {
        // 首层梯井铺实：防止从平台走进梯井跌落地面
        B.box(M.floor, b - a, .16, zS0 - zN0, mid, y - .08, (zN0 + zS0) / 2);
        walkRect(walks, a, b, zN0, zS0, y);
      }
      if (f < floors - 1) {
        // 北半平台
        B.box(M.floor, b - a, .16, zN1 - zN0, mid, y + FH / 2 - .08, (zN0 + zN1) / 2);
        walkRect(walks, a, b, zN0, zN1, y + FH / 2);
        // A 跑：南平台 → 北半平台（靠 x 前半）
        stairRun(B, M, walks, { x0: a, x1: mid, zLow: 2.45, yLow: y, zHigh: -2.45, yHigh: y + FH / 2, n: 10, railX: mid - .06 });
        // B 跑：北半平台 → 上一层南平台（靠 x 后半）
        stairRun(B, M, walks, { x0: mid, x1: b, zLow: -2.45, yLow: y + FH / 2, zHigh: 2.45, yHigh: y + FH, n: 10, railX: mid + .06 });
        // 梯段中央栏杆：只挡两跑之间，不挡南平台通行
        collider(cols, mid, 0, .06, 2.45, y, y + FH, .12);
      } else {
        // 顶层梯井：A 跑一侧为洞口，加栏板防止走下虚空
        B.box(M.rail, mid - a, .95, .07, (a + mid) / 2, y + .475, zS0 - .04);
        B.box(M.handrail, mid - a, .06, .1, (a + mid) / 2, y + .98, zS0 - .04);
        collider(cols, (a + mid) / 2, zS0 - .04, (mid - a) / 2, .06, y, y + CH, .1);
      }
    }
    // 走廊/教室顶部天花；楼梯间只在顶层封顶
    B.box(M.ceil, roomX1 - roomX0 + .1, .16, corZ1 - roomZ0 + .1, (roomX0 + roomX1) / 2, y + CH - .08, (roomZ0 + corZ1) / 2);
    if (f === floors - 1) {
      for (const st of stairs) {
        const a = Math.min(st.a, st.b), b = Math.max(st.a, st.b);
        B.box(M.ceil, b - a, .16, zS - WT - (zN + WT), (a + b) / 2, y + CH - .08, (zN + WT + zS - WT) / 2);
      }
    }
  }

  // 人物碰撞：外墙整周（自地面起，覆盖 0.8m 石基座；pad 盖住基座外沿）
  collider(cols, 0, zN + WT / 2, w / 2, WT / 2, 0, by + h, .45);
  for (const s of [-1, 1]) {
    const xc = s < 0 ? xS + WT / 2 : xN - WT / 2;
    if (s !== connectSide) {
      collider(cols, xc, 0, WT / 2, d / 2, 0, by + h, .45);
      continue;
    }
    // 靠中轴端山墙：北半面整面挡人；南半面首层门洞高度留空，可从院内进入
    collider(cols, xc, zN / 2, WT / 2, -zN / 2, 0, by + h, .45);
    collider(cols, xc, zS / 2, WT / 2, zS / 2, FY + CH, by + h, .45);
  }
  // 靠中轴端首层门洞：门槛楼板 + 室外三级石阶（院内可直接走入梯间）
  {
    const sd = connectSide, xo = sd > 0 ? xN : xS, zl = zS - WT;
    B.box(M.floor, WT + .02, .16, zl, xo - sd * (WT / 2 - .01), FY - .08, zl / 2);
    walkRect(walks, Math.min(xo - WT, xo + sd * .012), Math.max(xo - WT, xo + sd * .012), 0, zl, FY);
    for (let i = 0; i < 3; i++) {
      const top = FY - .215 * (i + 1);
      const xa = xo + sd * .38 * i, xb = xo + sd * .38 * (i + 1);
      B.box(M.stair, .38, top, zl, (xa + xb) / 2, top / 2, zl / 2);
      walkRect(walks, Math.min(xa, xb), Math.max(xa, xb), .02, zl - .02, top);
    }
  }
  // 走廊教室隔墙 + 门洞过梁（按层）
  for (let f = 0; f < floors; f++) {
    const y = FY + f * FH;
    for (let i = 0; i < 3; i++) {
      const x0 = rb[i], x1 = rb[i + 1], [a, b] = roomDoors[i];
      if (a > x0 + .01) collider(cols, (x0 + a) / 2, corridorZ, (a - x0) / 2, IT / 2, y, y + CH, .22);
      if (b < x1 - .01) collider(cols, (b + x1) / 2, corridorZ, (x1 - b) / 2, IT / 2, y, y + CH, .22);
      collider(cols, (a + b) / 2, corridorZ, (b - a) / 2, IT / 2, y + 2.15, y + FH, .22);
    }
  }

  // 基座外沿走面（防止走进 0.8m 石台）
  walkRect(walks, xS - WT - .05, xN + WT + .05, zN - WT - .05, zN + WT, by);
  walkRect(walks, xS - WT - .05, xN + WT + .05, zS - WT, zS + WT + .05, by);
  walkRect(walks, xS - WT - .05, xS + WT, zN + WT, zS - WT, by);
  walkRect(walks, xN - WT, xN + WT + .05, zN + WT, zS - WT, by);

  // 首层外廊整段 + 每层通向南块楼梯间的门洞 + 上层走廊窗，在立面贴图上挖洞（立面贴图自 fby 起算）
  const frontHoles = [{ x0: exposed0, x1: exposed1, y0: FY - .02, y1: FY + FH - .4 }];
  for (let f = 0; f < floors; f++) {
    frontHoles.push({ x0: connX - .7, x1: connX + .7, y0: FY + f * FH, y1: FY + f * FH + 2.2 });
  }
  for (let f = 1; f < floors; f++) {
    const y = FY + f * FH;
    // 开敞外廊：整段立面挖通，露出栏板与走廊
    frontHoles.push({ x0: exposed0, x1: exposed1, y0: y - .02, y1: y + CH + .1 });
  }
  punchFacade(g, 'front', w, h, fby, frontHoles, false, WALL_FILL, 4.0);

  // 其他窗贯通：北立面教室窗 + 两端楼梯间窗、两端山墙窗，外立面贴图同位置挖洞
  const backHoles = [];
  for (let f = 0; f < floors; f++) {
    const y = FY + f * FH;
    for (let i = 0; i < 3; i++) {
      backHoles.push({ x0: rb[i] + .39, x1: rb[i + 1] - .39, y0: y + .94, y1: y + 2.68 });
    }
    for (const st of stairs) {
      const a = Math.min(st.a, st.b), b = Math.max(st.a, st.b);
      backHoles.push({ x0: a + .14, x1: b - .14, y0: y + 1.49, y1: y + 2.96 });
    }
  }
  punchFacade(g, 'back', w, h, fby, backHoles, true, WALL_FILL, 4.0);
  const sideWin = [];
  for (let f = 0; f < floors; f++) {
    const y = FY + f * FH;
    sideWin.push({ x0: -2.66, x1: -1.09, y0: y + 1.54, y1: y + 2.96 });
  }
  // 靠中轴端山墙南半面门洞（贯通到室外）
  const doorHole = { x0: 0, x1: zS - WT, y0: FY, y1: FY + (floors - 1) * FH + CH };
  const sp = g.userData.sidePlanes;
  if (sp) {
    sp.right.material = sp.right.material.clone();
    g.userData.rightFacade = sp.right.material;
    g.userData.leftFacade = sp.left.material;
    // 山墙同样保留贴图画窗（四面做法一致），只把真实窗洞挖透
    punchFacade(g, 'right', d, h, by, connectSide > 0 ? sideWin.concat(doorHole) : sideWin, true);
    punchFacade(g, 'left', d, h, by, connectSide < 0 ? sideWin.concat(doorHole) : sideWin, false);
  }

  B.flush();
  g.userData.interior = { colliders: cols, walk: walks };
  return g;
}

/* ------------------------------------------------------------------
 * 南块：单教室（12×7.5），北墙与北条楼梯平台相连
 * ------------------------------------------------------------------ */
export function decorateSouthBlock(ctx, g, opts) {
  const {
    by = .8, fby = 0, w = 12, d = 7.5, floors = 4,
    bbSide = -1, connectX = 0, sharedW = 8, bare = false,
  } = opts;
  const M = CM(), B = new Batch(g), cols = [], walks = [];
  const FY = by + .06;
  const h = floors * FH + 1.2;
  const xN = w / 2, xS = -w / 2, zN = -d / 2, zS = d / 2;
  const ix0 = xS + WT, ix1 = xN - WT, iz0 = zN + WT, iz1 = zS - WT;
  const sign = Math.sign(connectX) || 1;   // 通道门所在侧（贴北条楼梯间）
  // 北墙只有 sharedW 与北条相接，其余部分为外露外墙
  const ex0 = sign > 0 ? xN - (w - sharedW) : xS;
  const ex1 = sign > 0 ? xN : xS + (w - sharedW);
  const gx0 = connectX - .8, gx1 = connectX + .8;
  const mainW = 1.8;
  const m0 = -mainW / 2, m1 = mainW / 2;

  for (let f = 0; f < floors; f++) {
    const y = FY + f * FH;
    const fy0 = f === 0 ? 0 : y;            // 首层碰撞自地面起，盖住 0.8m 基座
    walkRect(walks, ix0 - .1, ix1 + .1, iz0 - .1, iz1 + .1, y);
    B.box(M.floor, ix1 - ix0, .16, iz1 - iz0, (ix0 + ix1) / 2, y - .08, (iz0 + iz1) / 2);
    if (!bare) B.box(M.floorBand, ix1 - ix0 - .2, .012, .3, (ix0 + ix1) / 2, y + .006, iz1 - .6);
    // 南墙：首层主门 + 两侧窗，上层两樘大窗
    if (f === 0) {
      windowWallX(B, M, { x0: xS, x1: m0, zc: zS - WT / 2, t: WT, y0: y, ops: [[xS + .55, m0 - .55]], sill: 1.0, head: 2.62, inward: -1, curtain: !bare });
      windowWallX(B, M, { x0: m1, x1: xN, zc: zS - WT / 2, t: WT, y0: y, ops: [[m1 + .55, xN - .55]], sill: 1.0, head: 2.62, inward: -1, curtain: !bare });
      lintelX(B, M, m0, m1, zS - WT / 2, WT, y, 2.7);
      if (!bare) doorAt(B, M, { dir: 'x', c: zS - WT / 2, along: 0, y, w: mainW, h: 2.66, inward: -1, leaves: 2 });
      entranceSteps(B, M, walks, 0, zS, FY, 2.6);
      collider(cols, (xS + m0) / 2, zS - WT / 2, (m0 - xS) / 2, WT / 2, 0, y + CH, .45);
      collider(cols, (m1 + xN) / 2, zS - WT / 2, (xN - m1) / 2, WT / 2, 0, y + CH, .45);
      collider(cols, 0, zS - WT / 2, mainW / 2, WT / 2, y + 2.7, y + FH, .3);
      B.box(M.tile, m0 - ix0, 1.0, .02, (ix0 + m0) / 2, y + .5, iz1 - .012);
      B.box(M.tile, ix1 - m1, 1.0, .02, (m1 + ix1) / 2, y + .5, iz1 - .012);
    } else {
      windowWallX(B, M, {
        x0: xS, x1: xN, zc: zS - WT / 2, t: WT, y0: y,
        ops: [[xS + .55, -1.6], [1.6, xN - .55]], sill: 1.0, head: 2.62, inward: -1, curtain: !bare,
      });
      collider(cols, 0, zS - WT / 2, w / 2, WT / 2, fy0, y + CH, .3);
    }
    // 北墙：每层都留通道门；外露段开窗
    if (sign > 0) {
      if (gx0 > xS + .01) solidWallX(B, M, xS, gx0, zN + WT / 2, WT, y);
      if (gx1 < ex0 - .01) solidWallX(B, M, gx1, ex0, zN + WT / 2, WT, y);
      windowWallX(B, M, {
        x0: ex0, x1: xN, zc: zN + WT / 2, t: WT, y0: y,
        ops: [[ex0 + .45, xN - .45]], sill: 1.0, head: 2.62, inward: 1, curtain: !bare,
      });
    } else {
      windowWallX(B, M, {
        x0: xS, x1: ex1, zc: zN + WT / 2, t: WT, y0: y,
        ops: [[xS + .45, ex1 - .45]], sill: 1.0, head: 2.62, inward: 1, curtain: !bare,
      });
      if (ex1 < gx0 - .01) solidWallX(B, M, ex1, gx0, zN + WT / 2, WT, y);
      if (gx1 < xN - .01) solidWallX(B, M, gx1, xN, zN + WT / 2, WT, y);
    }
    lintelX(B, M, gx0, gx1, zN + WT / 2, WT, y, 2.2);
    if (!bare) doorAt(B, M, { dir: 'x', c: zN + WT / 2, along: connectX, y, w: 1.4, h: 2.15, inward: 1, leaves: 2 });
    walkRect(walks, connectX - .78, connectX + .78, zN - .45, zN + WT + .3, y);
    collider(cols, (xS + gx0) / 2, zN + WT / 2, (gx0 - xS) / 2, WT / 2, fy0, y + CH, .45);
    collider(cols, (gx1 + xN) / 2, zN + WT / 2, (xN - gx1) / 2, WT / 2, fy0, y + CH, .45);
    collider(cols, connectX, zN + WT / 2, .8, WT / 2, y + 2.2, y + FH, .28);
    // 东墙窗、西墙实墙（黑板）+ 山墙碰撞
    windowWallZ(B, M, { z0: zN + WT, z1: zS - WT, xc: xN - WT / 2, t: WT, y0: y, ops: [[-1.9, .9]], sill: 1.0, head: 2.62, inward: -1 });
    collider(cols, xN - WT / 2, 0, WT / 2, d / 2, fy0, y + CH, .45);
    collider(cols, xS + WT / 2, 0, WT / 2, d / 2, fy0, y + CH, .45);
    // 西侧山墙实墙（黑板墙；此前只做了 1m 墙裙，上半段透空）
    B.box(M.wall, WT, CH, iz1 - iz0, xS + WT / 2, y + CH / 2, (iz0 + iz1) / 2);
    B.box(M.tile, .02, 1.0, iz1 - iz0 - .04, ix0 + .012, y + .5, 0);
    // 黑板（西墙）+ 家具（毛坯房不摆放）
    if (!bare) {
      const zc = 0, xw = ix0;
      blackboardX(B, M, xw, zc - 2.1, zc + 2.1, y, bbSide);
      teacherDesk(B, M, { x: xw - bbSide * 1.1, z: zc, y, face: bbSide });
      for (let r = 0; r < 5; r++) {
        const dx = xw - bbSide * (2.5 + r * 1.45);
        for (const oz of [-1.79, -.6, .6, 1.79]) {
          deskAt(B, M, { x: dx, z: zc + oz, y, face: bbSide });
        }
      }
      for (const lx of [-2.6, 2.6]) {
        pendant(B, M, lx, y + CH - .02, zc, 1.05);
        fan(B, M, lx * .7, y + CH - .34, zc);
      }
    }
    B.box(M.ceil, w - .5, .16, d - .5, 0, y + CH - .08, 0);
  }
  // 基座外沿走面
  walkRect(walks, xS - WT - .05, xN + WT + .05, zN - WT - .05, zN + WT + .02, by);
  walkRect(walks, xS - WT - .05, xN + WT + .05, zS - WT, zS + WT + .05, by);
  walkRect(walks, xS - WT - .05, xS + WT, zN + WT, zS - WT, by);
  walkRect(walks, xN - WT, xN + WT + .05, zN + WT, zS - WT, by);

  // 主门洞 + 南墙窗 + 东侧山墙窗贯通：外立面贴图同位置挖洞
  const frontHoles = [{ x0: m0, x1: m1, y0: FY, y1: FY + 2.7 }];
  for (let f = 0; f < floors; f++) {
    const y = FY + f * FH;
    if (f === 0) {
      frontHoles.push({ x0: xS + .49, x1: m0 - .49, y0: y + .94, y1: y + 2.68 });
      frontHoles.push({ x0: m1 + .49, x1: xN - .49, y0: y + .94, y1: y + 2.68 });
    } else {
      frontHoles.push({ x0: xS + .49, x1: -1.54, y0: y + .94, y1: y + 2.68 });
      frontHoles.push({ x0: 1.54, x1: xN - .49, y0: y + .94, y1: y + 2.68 });
    }
  }
  punchFacade(g, 'front', w, h, fby, frontHoles, false, WALL_FILL, 4.0);
  const back = [];
  for (let f = 0; f < floors; f++) {
    const y = FY + f * FH;
    back.push({ x0: connectX - .7, x1: connectX + .7, y0: y, y1: y + 2.2 });
    if (sign > 0) back.push({ x0: ex0 + .39, x1: xN - .39, y0: y + .94, y1: y + 2.68 });
    else back.push({ x0: xS + .39, x1: ex1 - .39, y0: y + .94, y1: y + 2.68 });
  }
  punchFacade(g, 'back', w, h, fby, back, true, WALL_FILL, 4.0);
  const sp = g.userData.sidePlanes;
  if (sp) {
    sp.right.material = sp.right.material.clone();
    g.userData.rightFacade = sp.right.material;
    const side = [];
    for (let f = 0; f < floors; f++) {
      const y = FY + f * FH;
      side.push({ x0: -1.96, x1: .96, y0: y + .94, y1: y + 2.68 });
    }
    punchFacade(g, 'right', d, h, by, side, true);
    // 西山墙实墙（黑板墙）无窗：仅把贴图换成墙色，去掉画出来的窗
    g.userData.leftFacade = sp.left.material;
    punchFacade(g, 'left', d, h, by, [], false, WALL_FILL, 4.0);
  }

  B.flush();
  g.userData.interior = { colliders: cols, walk: walks };
  return g;
}

/* ------------------------------------------------------------------
 * 外廊教室的一跨南墙：门 + 窗 + 瓷砖墙裙 + 窗帘（室内在 inward 一侧）
 * 门洞两侧整段墙做碰撞，门洞只留过梁
 * ------------------------------------------------------------------ */
function bayWall(B, M, cols, o) {
  const {
    x0, x1, zc, t = WT, y, door0, door1, win0 = null, win1 = null,
    sill = .95, head = 2.6, h = 2.2, inward = -1, curtain = true,
  } = o;
  const cx = (a, b) => (a + b) / 2;
  const full = (a, b) => {
    if (b - a > .01) B.box(M.wall, b - a, CH, t, cx(a, b), y + CH / 2, zc);
  };
  full(x0, door0);
  if (win0 === null) {
    full(door1, x1);
  } else {
    full(door1, win0);
    full(win1, x1);
    B.box(M.tile, win1 - win0, sill, t, cx(win0, win1), y + sill / 2, zc);
    B.box(M.wall, win1 - win0, CH - head, t, cx(win0, win1), y + head + (CH - head) / 2, zc);
  }
  lintelX(B, M, door0, door1, zc, t, y, h);
  doorAt(B, M, { dir: 'x', c: zc, along: cx(door0, door1), y, w: door1 - door0 - .04, h, inward });
  if (win0 !== null) {
    const gw = win1 - win0 - .08, gh = head - sill - .08;
    const wx = cx(win0, win1), wy = y + (sill + head) / 2;
    B.box(M.glass, gw, gh, .02, wx, wy, zc, false);
    for (const [fw, fh, fx, fy] of [
      [gw + .06, .06, wx, y + sill - .01],
      [gw + .06, .06, wx, y + head + .01],
      [.06, gh + .06, win0 + .02, wy],
      [.06, gh + .06, win1 - .02, wy],
    ]) B.box(M.frame, fw, fh, .12, fx, fy, zc);
    const n = Math.max(1, Math.round(gw / 1.5));
    for (let i = 1; i < n; i++) B.box(M.frame, .05, gh, .11, win0 + .04 + (gw / n) * i, wy, zc);
    B.box(M.sill, win1 - win0 + .16, .05, .2, wx, y + sill - .03, zc + inward * (t / 2 + .08));
    if (curtain) {
      for (const cxx of [win0 + .14, win1 - .14]) {
        B.box(M.curtain, .26, head - sill + .4, .09, cxx, y + (sill + head) / 2 + .06, zc + inward * (t / 2 + .1));
      }
    }
  }
  // 瓷砖墙裙（室内侧）
  const strip = (a, b, hh, yy) => {
    if (b - a > .05) B.box(M.tile, b - a, hh, .02, cx(a, b), yy, zc + inward * (t / 2 + .012));
  };
  strip(x0 + .02, door0 - .02, 1.0, y + .5);
  if (win0 === null) strip(door1 + .02, x1 - .02, 1.0, y + .5);
  else {
    strip(door1 + .02, win0 - .02, 1.0, y + .5);
    strip(win0, win1, sill, y + sill / 2);
    strip(win1 + .02, x1 - .02, 1.0, y + .5);
  }
  // 碰撞：门两侧整段 + 门过梁
  if (door0 - x0 > .01) collider(cols, cx(x0, door0), zc, (door0 - x0) / 2, t / 2, y, y + CH, .18);
  if (x1 - door1 > .01) collider(cols, cx(door1, x1), zc, (x1 - door1) / 2, t / 2, y, y + CH, .18);
  collider(cols, cx(door0, door1), zc, (door1 - door0) / 2, t / 2, y + h, y + CH, .18);
}

/* ------------------------------------------------------------------
 * 蛟川书院主楼（73×34，5 层，南侧连续外廊，基座 2.6m）
 * 依据草图：一排 6 间教室；两座双跑楼梯位于第 1/2、5/6 间之间；
 * 黑板都在教室东墙。楼前双石阶（x=±4.0）上外廊，再经门进入教室/楼梯间。
 * 北墙贴主体北立面，教室占满全进深；首层栏板在副楼北门处留缺口。
 * ------------------------------------------------------------------ */
export function decorateAcademy(ctx, g, opts = {}) {
  const { by = 2.6, fby = by, w = 73, d = 34, floors = 5, corridorD = 2.2, corridorGaps = null } = opts;
  const M = CM(), B = new Batch(g), cols = [], walks = [];
  const FY = by + .11;                       // 外廊板顶 = 各层楼面
  const h = floors * FH + 1.2;
  const zF = d / 2 - corridorD;              // 教室南墙外皮（立面位置）
  const zC = zF - WT / 2;                    // 南墙中心
  const zS1 = zC - WT / 2;                   // 南墙内皮
  const zN = -d / 2 + WT / 2, zN1 = zN + WT / 2; // 北墙中心 / 内皮（贴主楼北立面）
  const zc = (zN1 + zS1) / 2;                // 教室进深中线
  const xW = -w / 2 + WT, xE = w / 2 - WT;
  // 首层栏板缺口：楼梯口 + 副楼北门（与 buildModernBlock 的 corridorGaps 同一组）
  const gaps = (corridorGaps || [[-6.8, -1.2], [1.2, 6.8]]).slice().sort((a, b) => a[0] - b[0]);
  const stairW = 3.0;
  const rw = (xE - xW - 2 * stairW - 7 * IT) / 6;
  const order = ['room', 'stair', 'room', 'room', 'room', 'room', 'stair', 'room'];
  const segs = [];
  let xs = xW;
  for (let i = 0; i < order.length; i++) {
    const wd = order[i] === 'room' ? rw : stairW;
    segs.push({ kind: order[i], x0: xs, x1: xs + wd, mid: xs + wd / 2 });
    xs += wd + (i < order.length - 1 ? IT : 0);
  }
  const zPlaS = 11.9;   // 楼梯南平台北边界
  const zHalfS = 7.9;   // 半平台南边界
  const holes = [];

  for (let f = 0; f < floors; f++) {
    const y = FY + f * FH;
    // 教室之间的隔墙 + 北墙（封闭草图未画的北半部）
    for (let i = 0; i < segs.length - 1; i++) {
      const px = (segs[i].x1 + segs[i + 1].x0) / 2;
      B.box(M.wall, IT, CH, zS1 - zN1, px, y + CH / 2, (zN1 + zS1) / 2);
      for (const s of [-1, 1]) {
        B.box(M.tile, .02, 1.0, zS1 - zN1 - .04, px + s * (IT / 2 + .012), y + .5, (zN1 + zS1) / 2);
      }
      collider(cols, px, (zN1 + zS1) / 2, IT / 2, (zS1 - zN1) / 2, y, y + CH, .18);
    }
    B.box(M.wall, xE - xW, CH, WT, 0, y + CH / 2, zN);
    B.box(M.tile, xE - xW - .02, 1.0, .02, 0, y + .5, zN1 + .012);
    collider(cols, 0, zN, (xE - xW) / 2, WT / 2, y, y + CH, .18);

    for (const s of segs) {
      if (s.kind === 'room') {
        B.box(M.floor, s.x1 - s.x0, .16, zF - zN1, s.mid, y - .08, (zN1 + zF) / 2);
        walkRect(walks, s.x0, s.x1, zN1, zF, y);
        B.box(M.floorBand, s.x1 - s.x0 - .2, .012, .26, s.mid, y + .006, zS1 - .32);
        const d0 = s.x0 + .85, d1 = d0 + 1.1;
        const win0 = d1 + .5, win1 = s.x1 - .25;
        bayWall(B, M, cols, { x0: s.x0, x1: s.x1, zc: zC, y, door0: d0, door1: d1, win0, win1, inward: -1 });
        holes.push({ x0: d0, x1: d1, y0: y, y1: y + 2.2 });
        holes.push({ x0: win0, x1: win1, y0: y + .95, y1: y + 2.6 });
        // 黑板（东墙）+ 讲桌 + 5 排双人桌（朝东）
        blackboardX(B, M, s.x1, zc - 2.1, zc + 2.1, y, 1);
        teacherDesk(B, M, { x: s.x1 - 1.2, z: zc, y, face: 1 });
        for (let r = 0; r < 5; r++) {
          const dx = s.x1 - (1.95 + r * 1.55);
          for (const oz of [-1.75, 1.75]) deskAt(B, M, { x: dx, z: zc + oz, y, face: 1 });
        }
        pendant(B, M, s.mid - 2.4, y + CH - .02, zc, 1.05);
        pendant(B, M, s.mid + 2.4, y + CH - .02, zc, 1.05);
        fan(B, M, s.mid, y + CH - .34, zc - 1.6);
        fan(B, M, s.mid, y + CH - .34, zc + 1.6);
        B.box(M.ceil, s.x1 - s.x0, .16, zS1 - zN1, s.mid, y + CH - .08, zc);
      } else {
        // 楼梯间：南平台 + 北半平台 + 双跑；顶层只留南平台，北侧为梯井
        B.box(M.floor, s.x1 - s.x0, .16, zF - zPlaS, s.mid, y - .08, (zPlaS + zF) / 2);
        walkRect(walks, s.x0, s.x1, zPlaS, zF, y);
        const d0 = s.mid - .55, d1 = s.mid + .55;
        bayWall(B, M, cols, { x0: s.x0, x1: s.x1, zc: zC, y, door0: d0, door1: d1, win0: null, inward: -1, curtain: false });
        holes.push({ x0: d0, x1: d1, y0: y, y1: y + 2.2 });
        if (f < floors - 1) {
          B.box(M.floor, s.x1 - s.x0, .16, zHalfS - zN1, s.mid, y + FH / 2 - .08, (zN1 + zHalfS) / 2);
          walkRect(walks, s.x0, s.x1, zN1, zHalfS, y + FH / 2);
          stairRun(B, M, walks, { x0: s.x0, x1: s.mid, zLow: zPlaS, yLow: y, zHigh: zHalfS, yHigh: y + FH / 2, n: 10, railX: s.mid - .06 });
          stairRun(B, M, walks, { x0: s.mid, x1: s.x1, zLow: zHalfS, yLow: y + FH / 2, zHigh: zPlaS, yHigh: y + FH, n: 10, railX: s.mid + .06 });
          collider(cols, s.mid, (zPlaS + zHalfS) / 2, .06, (zPlaS - zHalfS) / 2, y, y + FH, .12);
        } else {
          // 顶层梯井：A 跑一侧为洞口，加栏板；B 跑一侧是下行梯段，保持通行
          B.box(M.rail, s.mid - s.x0, .95, .07, (s.x0 + s.mid) / 2, y + .475, zPlaS - .04);
          B.box(M.handrail, s.mid - s.x0 + .04, .06, .1, (s.x0 + s.mid) / 2, y + .98, zPlaS - .04);
          collider(cols, (s.x0 + s.mid) / 2, zPlaS - .04, (s.mid - s.x0) / 2, .06, y, y + CH, .1);
          B.box(M.ceil, s.x1 - s.x0, .16, zS1 - zN1, s.mid, y + CH - .08, zc);
        }
      }
    }
    // 外廊：灰水磨石面层 + 分带 + 走面 + 栏板/端头碰撞
    B.box(M.floor, w - .2, .012, corridorD - .12, 0, y + .006, zF + corridorD / 2);
    B.box(M.floorBand, w - .5, .012, .26, 0, y + .006, d / 2 - .55);
    walkRect(walks, -w / 2 + .05, w / 2 - .05, zF, d / 2 - .1, y);
    // 首层栏板在楼梯口与副楼北门处留缺口；上层连续
    let spans;
    if (f === 0) {
      spans = [];
      let cur = -w / 2;
      for (const [a, b] of gaps) {
        if (a > cur + .05) spans.push([cur, a]);
        cur = Math.max(cur, b);
      }
      if (cur < w / 2 - .05) spans.push([cur, w / 2]);
    } else {
      spans = [[-w / 2, w / 2]];
    }
    for (const [a, b] of spans) collider(cols, (a + b) / 2, d / 2 - .06, (b - a) / 2, .06, y, y + 1.2, .12);
    for (const s of [-1, 1]) collider(cols, s * (w / 2 - .04), (zF + d / 2) / 2, .05, (d / 2 - zF) / 2, y, y + 1.2, .06);
  }

  // 楼前双石阶（buildModernBlock 已建实体）：13 级走面，顶端与基座外沿搭接
  const sw = Math.min(5.6, w * .1), sd = 6 / 13, sh = by / 13;
  for (const s of [-1, 1]) {
    const cx0 = s * (sw / 2 + 1.2);
    for (let i = 0; i < 13; i++) {
      walkRect(walks, cx0 - sw / 2, cx0 + sw / 2, d / 2 + .15 + sd * i, d / 2 + .15 + sd * (i + 1), by - sh * i);
    }
  }
  walkRect(walks, -6.8, 6.8, d / 2 - .1, d / 2 + .45, by);

  // 基座四周碰撞（南面在石阶处留口）
  const bx = w / 2 + .45, bz = d / 2 + .45;
  collider(cols, 0, -bz, bx, .22, 0, by, .1);
  collider(cols, -bx, 0, .22, bz, 0, by, .1);
  collider(cols, bx, 0, .22, bz, 0, by, .1);
  for (const [a, b] of [[-bx, -6.8], [-1.2, 1.2], [6.8, bx]]) {
    if (b - a > .05) collider(cols, (a + b) / 2, bz, (b - a) / 2, .22, 0, by, .1);
  }
  // 石阶侧墙与花池
  for (const s of [-1, 1]) collider(cols, s * (sw + 1.2), d / 2 + 3.3, .18, 3.1, 0, by + .6, .1);
  collider(cols, 0, d / 2 + 3.2, 1.1, 2.9, 0, by, .1);

  // 外廊东/西端封墙的全高碰撞（同时补上两端教室缺失的侧墙）
  for (const s of [-1, 1]) collider(cols, s * (w / 2 - .15), .25, .15, (d + .5) / 2, by, by + h, .1);

  // 外廊方柱（跳过楼梯口与副楼北门）
  const bays = Math.max(4, Math.round(w / 3.7));
  for (let i = 0; i <= bays; i++) {
    const cxx = -w / 2 + w * i / bays;
    if (gaps.some(([g0, g1]) => cxx > g0 - .2 && cxx < g1 + .2)) continue;
    collider(cols, cxx, d / 2 - .17, .17, .17, 0, by + h, .18);
  }

  punchFacade(g, 'front', w, h, fby, holes, false, WALL_FILL);
  // 东西山墙无窗：左右共享同一材质，整面换成墙色即可（去掉画出来的窗）
  const spA = g.userData.sidePlanes;
  if (spA) {
    g.userData.leftFacade = spA.left.material;
    punchFacade(g, 'left', d, h, fby, [], false, WALL_FILL);
  }

  B.flush();
  g.userData.interior = { colliders: cols, walk: walks };
  return g;
}

/* 沿 x 的墙，可开多个门/窗洞（用于书院办公室与副楼） */
function annexWall(B, M, cols, o) {
  const { x0, x1, zc, t = WT, y, inward = 1, openings = [], curtain = true } = o;
  const ops = openings.slice().sort((a, b) => a.x0 - b.x0);
  const solid = (a, b) => {
    if (b - a < .02) return;
    B.box(M.wall, b - a, CH, t, (a + b) / 2, y + CH / 2, zc);
    B.box(M.tile, b - a - .02, 1.0, .02, (a + b) / 2, y + .5, zc + inward * (t / 2 + .012));
    collider(cols, (a + b) / 2, zc, (b - a) / 2, t / 2, y, y + CH, .18);
  };
  let cur = x0;
  for (const p of ops) { solid(cur, p.x0); cur = Math.max(cur, p.x1); }
  solid(cur, x1);
  for (const p of ops) {
    if (p.door) {
      B.box(M.wall, p.x1 - p.x0, CH - 2.2, t, (p.x0 + p.x1) / 2, y + 2.2 + (CH - 2.2) / 2, zc);
      collider(cols, (p.x0 + p.x1) / 2, zc, (p.x1 - p.x0) / 2, t / 2, y + 2.2, y + CH, .18);
      doorAt(B, M, { dir: 'x', c: zc, along: (p.x0 + p.x1) / 2, y, w: p.x1 - p.x0 - .04, h: 2.2, inward });
      continue;
    }
    const sill = p.sill == null ? 1.0 : p.sill, head = p.head == null ? 2.6 : p.head;
    B.box(M.tile, p.x1 - p.x0, sill, t, (p.x0 + p.x1) / 2, y + sill / 2, zc);
    B.box(M.wall, p.x1 - p.x0, CH - head, t, (p.x0 + p.x1) / 2, y + head + (CH - head) / 2, zc);
    const gw = p.x1 - p.x0 - .08, gh = head - sill - .08;
    const wx = (p.x0 + p.x1) / 2, wy = y + (sill + head) / 2;
    B.box(M.glass, gw, gh, .02, wx, wy, zc, false);
    for (const [fw, fh, fx, fy] of [
      [gw + .06, .06, wx, y + sill - .01],
      [gw + .06, .06, wx, y + head + .01],
      [.06, gh + .06, p.x0 + .02, wy],
      [.06, gh + .06, p.x1 - .02, wy],
    ]) B.box(M.frame, fw, fh, .12, fx, fy, zc);
    const n = Math.max(1, Math.round(gw / 1.5));
    for (let i = 1; i < n; i++) B.box(M.frame, .05, gh, .11, p.x0 + .04 + (gw / n) * i, wy, zc);
    B.box(M.sill, p.x1 - p.x0 + .16, .05, .2, wx, y + sill - .03, zc + inward * (t / 2 + .08));
    if (curtain && p.curtain !== false) {
      for (const cxx of [p.x0 + .14, p.x1 - .14]) {
        B.box(M.curtain, .26, head - sill + .4, .09, cxx, wy + .06, zc + inward * (t / 2 + .1));
      }
    }
    collider(cols, (p.x0 + p.x1) / 2, zc, (p.x1 - p.x0) / 2, t / 2, y, y + CH, .18);
  }
}

/* ------------------------------------------------------------------
 * 蛟川书院东西副楼（16×10，3 层，黑板东墙）及独立办公室（32×10，4F，黑板东墙）。
 * 草图两个小方块：单一大间 + 西端梯核；副楼南门，基座 2.6m 与主楼外廊同层，
 * 北墙开一门直连主楼首层外廊（门槛走面补齐），南门 9 级台阶下到院内。
 * ------------------------------------------------------------------ */
export function decorateAnnex(ctx, g, opts = {}) {
  const {
    by = .8, w = 32, d = 10, floors = 4, bbSide = 1, stairSide = -1,
    entry = 'front', coreZ1 = null, northDoorX = null,
  } = opts;
  const M = CM(), B = new Batch(g), cols = [], walks = [];
  const h = floors * FH + 1.2;
  const xW = -w / 2 + WT, xE = w / 2 - WT;
  const zS1 = d / 2 - WT, zN1 = -d / 2 + WT;
  const zc = (zN1 + zS1) / 2;
  const zF = d / 2, zN = -d / 2;
  const coreW = 3.2;
  const coreX0 = stairSide < 0 ? xW : xE - coreW;
  const coreX1 = coreX0 + coreW;
  const mid = (coreX0 + coreX1) / 2;
  const cz1 = coreZ1 == null ? zS1 : coreZ1;
  const coreS = stairSide < 0 ? zF : cz1; // 梯核南边界（办公室占满进深，副楼只占北段）
  const zPlatS = cz1 - 2.0;
  const zLandS = zN1 + 1.15;
  const run = zPlatS - zLandS;
  const southEntry = entry === 'front';
  const zEntry = southEntry ? d / 2 - WT / 2 : -(d / 2 - WT / 2);
  const inward = southEntry ? -1 : 1;
  // 梯核是否贴入口立面：南门时梯核在西才贴；北门时梯核贯通进深、必贴北立面，可开梯核窗
  const coreTouchesEntry = southEntry ? stairSide < 0 : true;
  // 房间范围：办公室一整块；副楼绕梯核呈 L 形
  const rooms = stairSide < 0
    ? [{ x0: coreX1, x1: xE, z0: zN1, z1: zS1 }]
    : [
      { x0: xW, x1: coreX0, z0: zN1, z1: zS1 },
      { x0: coreX0, x1: xE, z0: cz1, z1: zS1 },
    ];
  // 门贴梯核东侧；梯核在东（退到北半）时门放入口立面西端
  const doorX0 = stairSide < 0 ? coreX1 + .3 : xW + 2.0;
  const doorX1 = doorX0 + 1.5;
  const winX0 = doorX1 + .5;
  const winX1 = (southEntry || stairSide < 0) ? xE - 1.0 : coreX0 - .3;
  const swX0 = coreX0 + .55, swX1 = coreX1 - .55; // 梯核采光窗（入口立面，各层同位置）
  const holes = [];
  const holesBack = [];
  // 北门（首层）与主楼外廊连接：门洞 2.2m，门槛走面从主楼廊边补到副楼地板
  const ndW = 2.2;
  const ndX0 = northDoorX == null ? 0 : northDoorX - ndW / 2;
  const ndX1 = northDoorX == null ? 0 : northDoorX + ndW / 2;
  const zBr0 = -zF - .7, zBr1 = zN1; // 主楼廊边 → 副楼北墙内皮

  for (let f = 0; f < floors; f++) {
    const y = by + f * FH;
    // 房间地板 / 天花（入口侧铺到外墙外皮，门洞处不留走面缺口）
    for (const r of rooms) {
      const z0s = (!southEntry && r.z0 === zN1) ? -zF : r.z0;
      B.box(M.floor, r.x1 - r.x0, .16, zF - z0s, (r.x0 + r.x1) / 2, y - .075, (z0s + zF) / 2);
      if (r.z1 === zS1) {
        B.box(M.floorBand, r.x1 - r.x0 - .2, .012, .26, (r.x0 + r.x1) / 2, y + .006, zS1 - .3);
      }
      walkRect(walks, r.x0, r.x1, z0s, zF, y);
      B.box(M.ceil, r.x1 - r.x0, .16, zS1 - r.z0, (r.x0 + r.x1) / 2, y + CH - .08, (r.z0 + zS1) / 2);
    }
    // 进深方向的两道外墙
    for (const [zz, inw] of [[zEntry, inward], [-zEntry, -inward]]) {
      const isEntry = zz === zEntry;
      if (isEntry) {
        const ops = [];
        if (f === 0) ops.push({ x0: doorX0, x1: doorX1, door: true });
        ops.push({ x0: winX0, x1: winX1, sill: 1.0, head: 2.6 });
        if (coreTouchesEntry) ops.push({ x0: swX0, x1: swX1, sill: 1.0, head: 2.6, curtain: false });
        annexWall(B, M, cols, { x0: xW, x1: xE, zc: zz, y, inward: inw, openings: ops });
        if (f === 0) holes.push({ x0: doorX0, x1: doorX1, y0: y, y1: y + 2.2 });
        holes.push({ x0: winX0, x1: winX1, y0: y + 1.0, y1: y + 2.6 });
        if (coreTouchesEntry) holes.push({ x0: swX0, x1: swX1, y0: y + 1.0, y1: y + 2.6 });
      } else {
        const ops = [];
        if (f === 0 && northDoorX != null) ops.push({ x0: ndX0, x1: ndX1, door: true });
        annexWall(B, M, cols, { x0: xW, x1: xE, zc: zz, y, inward: inw, openings: ops });
        if (f === 0 && northDoorX != null) holesBack.push({ x0: ndX0, x1: ndX1, y0: y, y1: y + 2.2 });
      }
    }
    // 山墙（东西两侧）
    for (const s of [-1, 1]) {
      B.box(M.wall, WT, CH, zS1 - zN1, s * (w / 2 - WT / 2), y + CH / 2, zc);
      B.box(M.tile, .02, 1.0, zS1 - zN1 - .02, s * (w / 2 - WT + .012), y + .5, zc);
      collider(cols, s * (w / 2 - WT / 2), zc, WT / 2, (zS1 - zN1) / 2, y, y + CH, .18);
    }
    // 梯核隔墙
    if (stairSide < 0) {
      const px = coreX1 + IT / 2;
      const dz0 = zS1 - 1.5, dz1 = zS1 - .4;
      B.box(M.wall, IT, CH, dz0 - zN1, px, y + CH / 2, (zN1 + dz0) / 2);
      collider(cols, px, (zN1 + dz0) / 2, IT / 2, (dz0 - zN1) / 2, y, y + CH, .15);
      B.box(M.wall, IT, CH, zS1 - dz1, px, y + CH / 2, (dz1 + zS1) / 2);
      collider(cols, px, (dz1 + zS1) / 2, IT / 2, (zS1 - dz1) / 2, y, y + CH, .15);
      B.box(M.wall, IT, CH - 2.2, dz1 - dz0, px, y + 2.2 + (CH - 2.2) / 2, (dz0 + dz1) / 2);
      collider(cols, px, (dz0 + dz1) / 2, IT / 2, (dz1 - dz0) / 2, y + 2.2, y + CH, .15);
      B.box(M.tile, .02, 1.0, zS1 - zN1 - .02, px + (xE - coreX1) / Math.abs(xE - coreX1) * (IT / 2 + .012), y + .5, zc);
    } else {
      const px = coreX0 - IT / 2;
      B.box(M.wall, IT, CH, cz1 - zN1, px, y + CH / 2, (zN1 + cz1) / 2);
      collider(cols, px, (zN1 + cz1) / 2, IT / 2, (cz1 - zN1) / 2, y, y + CH, .15);
      B.box(M.tile, .02, 1.0, cz1 - zN1 - .02, px - IT / 2 - .012, y + .5, (zN1 + cz1) / 2);
      const dx0 = coreX0 + 1.0, dx1 = dx0 + 1.1;
      const pz = cz1 + IT / 2;
      B.box(M.wall, dx0 - coreX0, CH, IT, (coreX0 + dx0) / 2, y + CH / 2, pz);
      collider(cols, (coreX0 + dx0) / 2, pz, (dx0 - coreX0) / 2, IT / 2, y, y + CH, .15);
      B.box(M.wall, xE - dx1, CH, IT, (dx1 + xE) / 2, y + CH / 2, pz);
      collider(cols, (dx1 + xE) / 2, pz, (xE - dx1) / 2, IT / 2, y, y + CH, .15);
      B.box(M.wall, dx1 - dx0, CH - 2.2, IT, (dx0 + dx1) / 2, y + 2.2 + (CH - 2.2) / 2, pz);
      collider(cols, (dx0 + dx1) / 2, pz, (dx1 - dx0) / 2, IT / 2, y + 2.2, y + CH, .15);
      B.box(M.tile, xE - coreX0 - .02, 1.0, .02, (coreX0 + xE) / 2, y + .5, pz + IT / 2 + .012);
    }
    // 梯核：南平台 + 北半平台 + 双跑；顶层收梯井
    B.box(M.floor, coreW, .16, coreS - zPlatS, mid, y - .075, (zPlatS + coreS) / 2);
    walkRect(walks, coreX0, coreX1, zPlatS, coreS, y);
    if (f === 0) {
      // 首层梯井铺实：避免露出基座石材贴图，也防止从平台走进梯井跌落
      B.box(M.floor, coreW, .16, zPlatS - zN1, mid, y - .075, (zN1 + zPlatS) / 2);
      walkRect(walks, coreX0, coreX1, zN1, zPlatS, y);
    }
    if (f < floors - 1) {
      B.box(M.floor, coreW, .16, zLandS - zN1, mid, y + FH / 2 - .08, (zN1 + zLandS) / 2);
      walkRect(walks, coreX0, coreX1, zN1, zLandS, y + FH / 2);
      stairRun(B, M, walks, { x0: coreX0, x1: mid, zLow: zPlatS, yLow: y, zHigh: zLandS, yHigh: y + FH / 2, n: 10, railX: mid - .06 });
      stairRun(B, M, walks, { x0: mid, x1: coreX1, zLow: zLandS, yLow: y + FH / 2, zHigh: zPlatS, yHigh: y + FH, n: 10, railX: mid + .06 });
      collider(cols, mid, (zPlatS + zLandS) / 2, .06, run / 2, y, y + FH, .12);
    } else {
      B.box(M.rail, mid - coreX0, .95, .07, (coreX0 + mid) / 2, y + .475, zPlatS - .04);
      B.box(M.handrail, mid - coreX0 + .04, .06, .1, (coreX0 + mid) / 2, y + .98, zPlatS - .04);
      collider(cols, (coreX0 + mid) / 2, zPlatS - .04, (mid - coreX0) / 2, .06, y, y + CH, .1);
      B.box(M.ceil, coreW, .16, coreS - zN1, mid, y + CH - .08, (zN1 + coreS) / 2);
    }
    // 黑板、讲桌、课桌、灯扇
    if (f >= 0) {
      const bbX = bbSide > 0 ? xE : xW;
      blackboardX(B, M, bbX, zc - 2.1, zc + 2.1, y, bbSide);
      const cx = (rooms[0].x0 + rooms[0].x1) / 2;
      teacherDesk(B, M, { x: bbX - bbSide * 1.2, z: zc, y, face: bbSide });
      const nRows = Math.max(3, Math.floor((rooms[0].x1 - rooms[0].x0 - 2.6) / 1.55));
      for (let r = 0; r < nRows; r++) {
        const dx = bbX - bbSide * (1.95 + r * 1.55);
        for (const oz of [-1.75, 1.75]) {
          if (Math.abs(oz) + .58 < (zS1 - zN1) / 2) deskAt(B, M, { x: dx, z: zc + oz, y, face: bbSide });
        }
      }
      pendant(B, M, cx - 2.0, y + CH - .02, zc, 1.05);
      pendant(B, M, cx + 2.0, y + CH - .02, zc, 1.05);
      fan(B, M, cx, y + CH - .34, zc - 1.7);
      fan(B, M, cx, y + CH - .34, zc + 1.7);
    }
  }

  // 入口台阶（按基座高定级数，每级 ≤.32m）+ 基座外沿窄走面
  const cxE = (doorX0 + doorX1) / 2, sw = doorX1 - doorX0 + .7;
  const zOut = southEntry ? 1 : -1;
  const nStep = Math.max(4, Math.ceil(by / .32));
  const rise = by / nStep;
  for (let i = 0; i < nStep; i++) {
    const top = by - i * rise;
    const za = zOut * (d / 2 + .45 + .45 * i), zb = zOut * (d / 2 + .45 + .45 * (i + 1));
    B.box(M.stair, sw, .2, .45, cxE, top - .1, (za + zb) / 2);
    walkRect(walks, cxE - sw / 2, cxE + sw / 2, Math.min(za, zb), Math.max(za, zb), top);
  }
  const rimZ = zOut * (d / 2 + .45);
  walkRect(walks, cxE - sw / 2, cxE + sw / 2, Math.min(zOut * d / 2, rimZ), Math.max(zOut * d / 2, rimZ), by);
  const runLen = nStep * .45;
  for (const s of [-1, 1]) collider(cols, cxE + s * (sw / 2 + .06), zOut * (d / 2 + .45 + runLen / 2), .06, runLen / 2, 0, by + 1.0, .05);
  // 北门门槛：补齐主楼外廊边到副楼北墙内皮的走面与地板
  if (northDoorX != null) {
    B.box(M.floor, ndW + .4, .16, zBr1 - zBr0, northDoorX, by - .075, (zBr0 + zBr1) / 2);
    walkRect(walks, ndX0 - .2, ndX1 + .2, zBr0, zBr1, by);
  }
  // 基座四周碰撞（入口台阶处留口；有北门时北侧门槛处也留口）
  const bx = w / 2 + .45, bz = d / 2 + .45;
  collider(cols, -bx, 0, .22, bz, 0, by, .1);
  collider(cols, bx, 0, .22, bz, 0, by, .1);
  if (northDoorX != null) {
    if (ndX0 - .1 > -bx) collider(cols, (-bx + ndX0 - .1) / 2, -zOut * bz, (ndX0 - .1 + bx) / 2, .22, 0, by, .1);
    if (bx > ndX1 + .1) collider(cols, (ndX1 + .1 + bx) / 2, -zOut * bz, (bx - ndX1 - .1) / 2, .22, 0, by, .1);
  } else {
    collider(cols, 0, -zOut * bz, bx, .22, 0, by, .1);
  }
  if (cxE - sw / 2 > -bx + .05) collider(cols, (-bx + cxE - sw / 2) / 2, zOut * bz, (cxE - sw / 2 + bx) / 2, .22, 0, by, .1);
  if (bx > cxE + sw / 2 + .05) collider(cols, (cxE + sw / 2 + bx) / 2, zOut * bz, (bx - cxE - sw / 2) / 2, .22, 0, by, .1);

  punchFacade(g, southEntry ? 'front' : 'back', w, h, by, holes, !southEntry, WALL_FILL);
  if (holesBack.length) punchFacade(g, 'back', w, h, by, holesBack, true, WALL_FILL);
  // 东西山墙无窗：左右共享同一材质，整面换成墙色即可（去掉画出来的窗）
  const spB = g.userData.sidePlanes;
  if (spB) {
    g.userData.leftFacade = spB.left.material;
    punchFacade(g, 'left', d, h, by, [], false, WALL_FILL);
  }

  B.flush();
  g.userData.interior = { colliders: cols, walk: walks };
  return g;
}

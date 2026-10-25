import * as THREE from 'three';
import { addBox, mulberry32, tbox, tcyl } from '../util.js';
import { addMerged } from './detail.js';

/**
 * 首层内景（只做视频可见内容）：书吧书架/阅览桌/吊灯（BV1SkF8edEmn 56–59s）、
 * 林则徐坐像/浮雕墙/讲台/格栅/玻璃门（BV1HnZTBNESa 0–41s）；坐标为建筑局部坐标。
 */

let _M = null;
function IM() {
  if (_M) return _M;
  const std = (o) => new THREE.MeshStandardMaterial(o);
  _M = {
    shelfWood: std({ color: 0xa8814f, roughness: .7 }),
    bookTan: std({ color: 0x8f8676, roughness: .82 }),
    bookBrown: std({ color: 0x6a3430, roughness: .84 }),
    bookGreen: std({ color: 0x55604d, roughness: .82 }),
    bookCream: std({ color: 0xd9cdb2, roughness: .85 }),
    lampShade: std({ color: 0xf4efe2, emissive: 0xffd9a0, emissiveIntensity: .75, roughness: .55, side: THREE.DoubleSide }),
    lampMetal: std({ color: 0x3a3530, metalness: .5, roughness: .5 }),
    lampBulb: new THREE.MeshBasicMaterial({ color: 0xffe8c2 }),
    glassDoor: new THREE.MeshStandardMaterial({ color: 0x9fb6b8, transparent: true, opacity: .26, roughness: .16, metalness: .1, side: THREE.DoubleSide }),
    bustBronze: std({ color: 0x392d23, metalness: .26, roughness: .6 }),
    bustDark: std({ color: 0x1e1712, metalness: .22, roughness: .65 }),
  };
  return _M;
}

/* ---------------- 书吧 ---------------- */

function fillBooks(rowGeoms, x0, x1, y, z, rnd, greenTail) {
  let x = x0;
  while (x < x1 - .04) {
    const w = .034 + rnd() * .034;
    const h = .25 + rnd() * .075;
    const d = .16 + rnd() * .05;
    let gi;
    if (greenTail && x > x1 - .62) gi = 2;
    else {
      const r = rnd();
      gi = r < .58 ? 0 : r < .80 ? 1 : r < .92 ? 2 : 3;
    }
    const tilt = rnd() < .06 ? (rnd() - .5) * .12 : 0;
    rowGeoms[gi].push(tbox(w, h, d, x + w / 2, y + h / 2, z, 0, 0, tilt));
    x += w + .004;
  }
}

function buildShelf(parent, x, y, z, ry, seed, greenTail = false) {
  const M = IM();
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  const W = 2.3, H = 2.3, D = .42, T = .06;
  const rows = 5;
  const rowH = (H - .12) / rows;
  const frame = [
    tbox(W, T, D, 0, T / 2, 0),
    tbox(W, T, D, 0, H - T / 2, 0),
    tbox(T, H, D, -(W / 2 - T / 2), H / 2, 0),
    tbox(T, H, D, W / 2 - T / 2, H / 2, 0),
    tbox(W - .12, H - .12, .03, 0, H / 2, -D / 2 + .015),
  ];
  for (let i = 1; i < rows; i++) frame.push(tbox(W - .12, .035, D - .05, 0, .06 + rowH * i, 0));
  addMerged(g, frame, M.shelfWood);

  const rnd = mulberry32(seed);
  const bookGeoms = [[], [], [], []];
  for (let i = 0; i < rows; i++) {
    const base = .06 + rowH * i + (i ? .035 : 0);
    fillBooks(bookGeoms, -W / 2 + .08, W / 2 - .08, base + .01, .06, rnd, greenTail && i > 1);
  }
  const bookMats = [M.bookTan, M.bookBrown, M.bookGreen, M.bookCream];
  for (let i = 0; i < 4; i++) {
    if (bookGeoms[i].length) addMerged(g, bookGeoms[i], bookMats[i], { cast: false });
  }
  parent.add(g);
  return g;
}

function chairInto(woodGeos, darkGeos, cx, cz, ry) {
  const co = Math.cos(ry), si = Math.sin(ry);
  const put = (arr, w, h, d, lx, ly, lz) => {
    arr.push(tbox(w, h, d, cx + lx * co + lz * si, ly, cz - lx * si + lz * co, ry));
  };
  put(woodGeos, .46, .06, .46, 0, .44, 0);
  put(woodGeos, .46, .5, .05, 0, .68, -.21);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(darkGeos, .04, .44, .04, sx * .19, .22, sz * .19);
}

function buildTable(parent, mats, x, z, floorY) {
  const g = new THREE.Group();
  g.position.set(x, floorY, z);
  const W = 2.4, D = 1.1, H = .76;
  const woodGeos = [tbox(W, .07, D, 0, H - .035, 0)];
  const darkGeos = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    darkGeos.push(tbox(.07, H - .07, .07, sx * (W / 2 - .1), (H - .07) / 2, sz * (D / 2 - .09)));
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    chairInto(woodGeos, darkGeos, sx * W * .28, sz * (D / 2 + .34), sz > 0 ? Math.PI : 0);
  }
  addMerged(g, woodGeos, mats.wood);
  addMerged(g, darkGeos, mats.woodDark);
  parent.add(g);
  return g;
}

function addPendant(g, x, y, z) {
  const M = IM();
  const cordH = 3.66 - y;
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, cordH, 6), M.lampMetal);
  cord.position.set(x, y + cordH / 2, z);
  g.add(cord);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(.07, .34, .28, 16, 1, true), M.lampShade);
  shade.position.set(x, y, z);
  shade.castShadow = false;
  g.add(shade);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(.34, .02, 6, 18), M.lampMetal);
  rim.rotation.x = Math.PI / 2; rim.position.set(x, y - .14, z); g.add(rim);
  const bulb = new THREE.Mesh(new THREE.CircleGeometry(.26, 16), M.lampBulb);
  bulb.rotation.x = Math.PI / 2; bulb.position.set(x, y - .15, z); g.add(bulb);
  const l = new THREE.PointLight(0xffd2a0, 13, 12, 2);
  l.position.set(x, y - .28, z);
  g.add(l);
}

function buildDoor(g, mats, w, h, z, base) {
  const M = IM();
  const half = w / 2;
  const doorGeos = [
    tbox(.16, h, .4, -half, base + h / 2, z),
    tbox(.16, h, .4, half, base + h / 2, z),
    tbox(w + .32, .16, .4, 0, base + h + .08, z),
  ];
  addMerged(g, doorGeos, mats.woodDark);
  addBox(g, mats.stone, w + .3, .06, .36, 0, base - .02, z);
  // 两扇内开玻璃门（贴墙不挡路）
  for (const s of [-1, 1]) {
    const leaf = new THREE.Group();
    leaf.position.set(s * half, base, z - .16);
    leaf.rotation.y = -s * 1.22;
    const lh = h - .12;
    const fr = [
      tbox(1.9, .08, .04, -s * .95, .06, 0),
      tbox(1.9, .08, .04, -s * .95, lh - .06, 0),
      tbox(.07, lh, .04, -s * 1.9, lh / 2, 0),
      tbox(.07, lh, .04, -s * .02, lh / 2, 0),
    ];
    addMerged(leaf, fr, mats.woodDark);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.78, lh - .2), M.glassDoor);
    pane.position.set(-s * .95, lh / 2, 0);
    leaf.add(pane);
    g.add(leaf);
  }
}

// 双扇门：深木框 + 两扇向室内（或室外）开启；open 为开启角，默认约 85°
function buildFramedDoor(parent, mats, { w = 1.9, h = 2.7, x = 0, y = 0, z = 0, ry = 0, glass = false, open = 1.48 }) {
  const M = IM();
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (ry) g.rotation.y = ry;
  addMerged(g, [
    tbox(.14, h, .24, -(w / 2 - .07), h / 2, 0),
    tbox(.14, h, .24, (w / 2 - .07), h / 2, 0),
    tbox(w, .16, .24, 0, h - .08, 0),
  ], mats.woodDark);
  for (const s of [-1, 1]) {
    const leaf = new THREE.Group();
    leaf.position.set(s * (w / 2 - .08), 0, 0);
    leaf.rotation.y = -s * open;
    const lw = w / 2 - .12, lh = h - .2;
    if (glass) {
      addMerged(leaf, [
        tbox(lw, .07, .05, -s * lw / 2, .05, 0),
        tbox(lw, .07, .05, -s * lw / 2, lh - .05, 0),
        tbox(.06, lh, .05, -s * (lw - .03), lh / 2, 0),
        tbox(.06, lh, .05, -s * .03, lh / 2, 0),
      ], mats.woodDark);
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(lw - .1, lh - .14), M.glassDoor);
      pane.position.set(-s * lw / 2, lh / 2, 0);
      leaf.add(pane);
    } else {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(lw, lh, .06), mats.wood);
      panel.position.set(-s * lw / 2, lh / 2, 0);
      panel.castShadow = true;
      leaf.add(panel);
      const slats = [];
      for (let i = 1; i < 4; i++) slats.push(tbox(lw - .1, .028, .07, -s * lw / 2, lh * i / 4, 0));
      addMerged(leaf, slats, mats.woodDark);
    }
    g.add(leaf);
  }
  parent.add(g);
  return g;
}

export function decorateBookBar(ctx, g, { by = .4, w = 14, d = 16, db = 13.6, bz = -1.2 } = {}) {
  const { mats } = ctx;
  const fy = .52;
  const wt = .32;

  // 天花
  addBox(g, mats.plasterCool, w - wt, .12, db - wt, 0, 3.72, bz);
  // 北墙内侧白抹灰（外侧保留青灰砖）
  {
    const hgt = 3.66 - fy;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w - wt - .02, hgt), mats.plaster);
    p.position.set(0, fy + hgt / 2, bz - db / 2 + wt + .003);
    p.receiveShadow = true; g.add(p);
  }
  // 深木踢脚（内墙四周）
  const sk = [];
  sk.push(tbox(w - wt - .02, .15, .04, 0, fy + .075, -8 + wt + .02));
  sk.push(tbox(.04, .15, db - wt - .02, -(w / 2 - wt / 2) + .02, fy + .075, bz));
  sk.push(tbox(.04, .15, db - wt - .02, w / 2 - wt / 2 - .02, fy + .075, bz));
  addMerged(g, sk, mats.woodDark);

  // 南门（4m 宽，门后是玻璃塔）
  buildDoor(g, mats, 4.0, 2.82, 5.44 - .16, fy);
  // 东北角入口：东墙北端双扇玻璃门（正对室外三级半圆石阶），向室外开启
  {
    const dz = -5.3, dw = 1.8, dy = .44;
    addBox(g, mats.stone, .76, .1, dw + .12, 6.97, dy - .05, dz);
    buildFramedDoor(g, mats, { w: dw, h: 2.7, x: w / 2 - wt / 2, y: dy, z: dz, ry: -Math.PI / 2, glass: true });
  }

  // 书架：北墙 3、西墙 2、东墙 1
  buildShelf(g, -4.6, fy, -7.46, 0, 11);
  buildShelf(g, 0, fy, -7.46, 0, 23, true);
  buildShelf(g, 4.6, fy, -7.46, 0, 37);
  buildShelf(g, -6.46, fy, -4.6, Math.PI / 2, 41);
  buildShelf(g, -6.46, fy, -1.4, Math.PI / 2, 53);
  buildShelf(g, 6.46, fy, -3.5, -Math.PI / 2, 67);

  // 阅览桌 4 张（中轴留空）
  for (const [tx, tz] of [[-3.3, 1.6], [3.3, 1.6], [-3.3, -2.6], [3.3, -2.6]]) buildTable(g, mats, tx, tz, fy);

  // 吊灯 3 盏（常亮暖光）
  addPendant(g, -3.3, 2.85, 0);
  addPendant(g, 3.3, 2.85, 0);
  addPendant(g, 0, 2.85, -4.6);
  // 白天补光（室内无窗，仅靠吊灯会过暗）
  const fill = new THREE.PointLight(0xffe6c8, 9, 17, 1.7);
  fill.position.set(0, 3.15, 2.2);
  g.add(fill);

  const colliders = [
    { x: 0, z: -8 + wt / 2, hx: w / 2 + .16, hz: wt / 2 },
    { x: -4.5, z: 5.6 - wt / 2, hx: 2.5, hz: wt / 2 },
    { x: 4.5, z: 5.6 - wt / 2, hx: 2.5, hz: wt / 2 },
    { x: -(w / 2 - wt / 2), z: bz, hx: wt / 2, hz: db / 2 },
    // 东墙按东北角门洞（局部 z -6.2..-4.4）分两段
    { x: w / 2 - wt / 2, z: -7.1, hx: wt / 2, hz: .9 },
    { x: w / 2 - wt / 2, z: .6, hx: wt / 2, hz: 5.0 },
    { x: -4.6, z: -7.46, hx: 1.15, hz: .21 },
    { x: 0, z: -7.46, hx: 1.15, hz: .21 },
    { x: 4.6, z: -7.46, hx: 1.15, hz: .21 },
    { x: -6.46, z: -4.6, hx: .21, hz: 1.15 },
    { x: -6.46, z: -1.4, hx: .21, hz: 1.15 },
    { x: 6.46, z: -3.5, hx: .21, hz: 1.15 },
    { x: -3.3, z: 1.6, hx: 1.2, hz: 1.15 },
    { x: 3.3, z: 1.6, hx: 1.2, hz: 1.15 },
    { x: -3.3, z: -2.6, hx: 1.2, hz: 1.15 },
    { x: 3.3, z: -2.6, hx: 1.2, hz: 1.15 },
  ];
  // 南端玻璃塔 14 根钢柱
  for (let i = 0; i <= 7; i++) colliders.push({ x: -w / 2 + i * (w / 7), z: d / 2 - .07, hx: .1, hz: .1 });
  for (const s of [-1, 1]) for (const off of [-1.05, 0, 1.05]) {
    colliders.push({ x: s * (w / 2 - .09), z: d / 2 - 2.4 / 2 + off, hx: .1, hz: .1 });
  }

  const walk = [
    { x0: -7.3, x1: 7.3, z0: -8.3, z1: 8.3, y: .40 },
    { x0: -6.6, x1: 6.6, z0: 5.5, z1: 8.0, y: .49 },
    { x0: -6.68, x1: 6.68, z0: -7.68, z1: 5.7, y: fy },
    { x0: -1.7, x1: 1.7, z0: 8.3, z1: 10.4, yA: .40, yB: .10, axis: 'z' },
    { x0: -2.2, x1: 2.2, z0: 8.3, z1: 10.4, y: .10 },
    // 东北角门洞门槛（与室外三级石阶顶同高 .44）
    { x0: 6.55, x1: 7.45, z0: -6.2, z1: -4.4, y: .44 },
  ];

  g.userData.interior = { colliders, walk };
  return g.userData.interior;
}

/* ---------------- 林则徐纪念堂 ---------------- */

function buildSeatedStatue(parent, mats, x, floorY, z) {
  const M = IM();
  const g = new THREE.Group();
  g.position.set(x, floorY, z);
  // 浅灰石座（BV1HnZTBNESa 0–41s：全身坐像置于两级约 2.3×1.1m 石台）
  addBox(g, mats.stone, 2.24, .5, 1.04, 0, .25, 0);
  addBox(g, mats.stone, 2.36, .08, 1.16, 0, .54, 0);
  const b = M.bustBronze, dk = M.bustDark;
  const mesh = (geo, px, py, pz, mat = b, parent = g) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(px, py, pz);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m); return m;
  };
  const limb = (a, c, r1, r2) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...c);
    const v = B.clone().sub(A), len = v.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, len, 10), b);
    m.position.copy(A).add(B).multiplyScalar(.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize());
    m.castShadow = true; g.add(m); return m;
  };
  const top = .58;
  // 袍摆：下摆外张、腰收（视频：长袍垂至座面）
  const prof = [[.46, .02], [.53, .12], [.5, .28], [.43, .5], [.37, .68], [.35, .8]];
  mesh(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y + top)), 26), 0, 0, 0);
  // 双腿：膝自袍前凸出、小腿垂下、足踏座面
  for (const s of [-1, 1]) {
    mesh(new THREE.SphereGeometry(.16, 14, 12), s * .21, top + .6, .36).scale.set(.95, 1, 1.15);
    limb([s * .21, top + .52, .42], [s * .21, top + .08, .46], .11, .095);
    mesh(new THREE.BoxGeometry(.19, .1, .28), s * .21, top + .05, .5);
  }
  // 上身、肩、领口
  mesh(new THREE.CylinderGeometry(.34, .32, .62, 18), 0, top + .98, -.02);
  mesh(new THREE.SphereGeometry(.4, 20, 12), 0, top + 1.27, -.03).scale.set(1, .5, .72);
  mesh(new THREE.CylinderGeometry(.14, .17, .12, 14), 0, top + 1.34, 0, dk);
  // 头
  const head = new THREE.Group();
  head.position.set(0, top + 1.5, -.02);
  g.add(head);
  mesh(new THREE.SphereGeometry(.175, 24, 20), 0, 0, 0, b, head).scale.set(1, 1.12, .98);
  mesh(new THREE.SphereGeometry(.178, 20, 12, 0, Math.PI * 2, 0, Math.PI * .56), 0, -.004, -.012, dk, head).scale.set(1.01, 1.03, 1.01);
  for (const s of [-1, 1]) {
    mesh(new THREE.SphereGeometry(.022, 8, 6), s * .062, .012, .166, dk, head);
    mesh(new THREE.SphereGeometry(.042, 10, 8), s * .172, -.02, 0, b, head).scale.set(.7, 1, .9);
    const brow = mesh(new THREE.BoxGeometry(.075, .02, .035), s * .062, .062, .158, dk, head);
    brow.rotation.z = -s * .12;
    const mus = mesh(new THREE.CylinderGeometry(.009, .013, .12, 6), s * .04, -.068, .162, dk, head);
    mus.rotation.z = s * .28; mus.rotation.x = .12;
  }
  mesh(new THREE.CylinderGeometry(0, .036, .07, 4), 0, 0, .175, b, head).rotation.x = Math.PI / 2;
  // 脑后发辫
  mesh(new THREE.CylinderGeometry(.03, .038, .3, 8), 0, -.24, -.23, dk, head).rotation.x = -.16;
  // 双臂：肘略外张，两手落于膝上（视频 20–40s）
  for (const s of [-1, 1]) {
    limb([s * .33, top + 1.24, .02], [s * .4, top + .96, .12], .1, .08);
    limb([s * .4, top + .96, .12], [s * .27, top + .72, .34], .08, .065);
    mesh(new THREE.SphereGeometry(.07, 10, 8), s * .26, top + .7, .4);
  }
  // 衣襟、腰带
  mesh(new THREE.BoxGeometry(.035, .46, .02), .1, top + .98, .335, dk);
  mesh(new THREE.CylinderGeometry(.335, .335, .07, 18), 0, top + .72, -.01, dk);
  parent.add(g);
  return g;
}

// 像后米色浮雕墙：只做视频可辨的炮台、炮身、炮轮与铭文带大形
function buildLinRelief(parent, mats, z, floorY) {
  const g = new THREE.Group();
  g.position.set(.35, floorY, z);
  const cream = new THREE.MeshStandardMaterial({ color: 0xcfc3a8, roughness: .96 });
  const cream2 = new THREE.MeshStandardMaterial({ color: 0xb8aa8b, roughness: .94 });
  const W = 3.7, H = 2.72;
  addBox(g, cream, W, H, .06, 0, H / 2, 0);
  addMerged(g, [
    tbox(W + .14, .09, .12, 0, H + .045, .01),
    tbox(W + .14, .09, .12, 0, -.045, .01),
    tbox(.09, H, .12, -W / 2 - .025, H / 2, .01),
    tbox(.09, H, .12, W / 2 + .025, H / 2, .01),
  ], cream2);
  addBox(g, cream2, 1.5, .16, .1, -1.05, .3, .06);
  addBox(g, cream2, 1.2, .16, .1, -1.05, .47, .06);
  addBox(g, cream2, .9, .16, .1, -1.05, .64, .06);
  // 炮身/炮轮做浅浮雕（只凸出 2cm，避免在像侧形成悬浮圆管）
  addBox(g, cream2, 1.0, .14, .02, -1.15, 1.02, .035);
  addBox(g, cream2, .055, .3, .02, -.62, .82, .035);
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, .02, 16), cream2);
  wheel.position.set(-.62, .99, .035); wheel.rotation.x = Math.PI / 2; g.add(wheel);
  for (let i = 0; i < 4; i++) addBox(g, cream2, .5, .02, .03, 1.2, 1.86 - i * .09, .06);
  addBox(g, cream2, .03, 1.1, .03, 1.72, 1.2, .06);
  parent.add(g);
}

function buildLectern(parent, mats, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 1.13, z);
  const wood = new THREE.MeshStandardMaterial({ color: 0x8c4d3d, roughness: .7 });
  const w = .95, d = .6, h = 1.02;
  addBox(g, wood, w, .07, d, 0, h - .035, 0);
  addBox(g, wood, w - .2, .44, d - .18, 0, .62, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    addBox(g, wood, .07, h - .07, .07, sx * (w / 2 - .055), (h - .07) / 2, sz * (d / 2 - .055));
  }
  parent.add(g);
}

function buildScreen(parent, mats, x, z, ry, w = 2.4, h = 2.2) {
  const g = new THREE.Group();
  g.position.set(x, 1.13 + h / 2, z);
  g.rotation.y = ry;
  const t = .09;
  const fr = [
    tbox(w, t, .12, 0, h / 2, 0),
    tbox(w, t, .12, 0, -h / 2, 0),
    tbox(t, h, .12, -w / 2, 0, 0),
    tbox(t, h, .12, w / 2, 0, 0),
    tbox(w - t, .06, .09, 0, 0, 0),
  ];
  addMerged(g, fr, mats.woodDark);
  // 背衬深绿（视频 0–41s 格栅后为暗绿展陈），前面加细格栅条
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(w - .12, h - .12), new THREE.MeshBasicMaterial({ color: 0x46524a }));
  pane.position.z = -.015;
  g.add(pane);
  const bars = [];
  const iw2 = w - .16, ih2 = h - .16;
  for (let i = 1; i < 5; i++) bars.push(tbox(.028, ih2, .05, -iw2 / 2 + i * iw2 / 5, 0, 0));
  for (let j = 1; j < 7; j++) bars.push(tbox(iw2, .028, .05, 0, -ih2 / 2 + j * ih2 / 7, 0));
  addMerged(g, bars, mats.woodDark);
  parent.add(g);
  return g;
}

export function decorateLinZexu(ctx, g, { TY = 1.0, W = 8, D = 6, bz = -1.2, fz = 1.8, dx = -2.6, dw = 1.6, dh = 2.4 } = {}) {
  const { mats } = ctx;
  const fy = 1.13;
  const wt = .3;

  // 白抹灰内墙（外侧仍由 buildLinZexu 的深木墙壳承担）
  const iw = W - wt * 2;
  const id = D - wt * 2;
  const hgt = 4.18 - fy;
  const wall = (w, h, x, y, z, ry) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mats.plaster);
    p.position.set(x, y, z); p.rotation.y = ry;
    p.receiveShadow = true; g.add(p);
  };
  // 东墙（世界东侧 = 后墙）北段开门：白墙分两段 + 门洞上方补墙
  const c0 = dx - dw / 2, c1 = dx + dw / 2;
  const bx = -W / 2 + wt, bw = W - wt * 2;
  wall(c0 - bx, hgt, (bx + c0) / 2, fy + hgt / 2, bz - D / 2 + wt + .003, 0);
  wall(bx + bw - c1, hgt, (c1 + bx + bw) / 2, fy + hgt / 2, bz - D / 2 + wt + .003, 0);
  wall(dw, hgt - dh, dx, fy + dh + (hgt - dh) / 2, bz - D / 2 + wt + .003, 0);
  wall(id, hgt, -W / 2 + wt + .003, fy + hgt / 2, bz, Math.PI / 2);
  wall(id, hgt, W / 2 - wt - .003, fy + hgt / 2, bz, -Math.PI / 2);
  wall((iw - 2.4) / 2, hgt, -1.2 - (iw - 2.4) / 4, fy + hgt / 2, bz + D / 2 - wt - .003, Math.PI);
  wall((iw - 2.4) / 2, hgt, 1.2 + (iw - 2.4) / 4, fy + hgt / 2, bz + D / 2 - wt - .003, Math.PI);
  wall(2.4, 4.3 - 4.03, 0, (4.03 + 4.3) / 2, bz + D / 2 - wt - .003, Math.PI);
  // 深木檐口
  const cor = [];
  cor.push(tbox(W - .02, .15, .12, 0, 4.1, bz - D / 2 + .06));
  cor.push(tbox(W - .02, .15, .12, 0, 4.1, bz + D / 2 - .06));
  for (const s of [-1, 1]) cor.push(tbox(.12, .15, D - .02, s * (W / 2 - .06), 4.1, bz));
  addMerged(g, cor, mats.woodDark);

  // 全身坐像 + 像后浮雕墙 + 木讲台 + 通高格栅 + 东墙（后墙）北段门
  buildLinRelief(g, mats, bz - D / 2 + wt + .002, fy);
  buildSeatedStatue(g, mats, 0, fy, -3.38);
  buildLectern(g, mats, -2.9, -2.2);
  buildScreen(g, mats, -W / 2 + wt + .04, -2.0, Math.PI / 2, 2.6, 3.0);
  buildFramedDoor(g, mats, { w: dw, h: dh, x: dx, y: fy, z: bz - D / 2 + wt / 2, ry: Math.PI });

  // 常亮灯：塑像重点 + 入口补光（避开后墙，防止浮雕过曝）
  const l1 = new THREE.PointLight(0xffc98a, 6, 8, 2);
  l1.position.set(0, 3.4, -1.2); g.add(l1);
  const l2 = new THREE.PointLight(0xffd8b0, 3.2, 8, 2);
  l2.position.set(0, 3.2, 1.0); g.add(l2);

  const colliders = [
    // 东墙（后墙）分两段，北段留出门洞
    { x: (-W / 2 + c0) / 2, z: bz - D / 2 + wt / 2, hx: (c0 + W / 2) / 2, hz: wt / 2 },
    { x: (c1 + W / 2) / 2, z: bz - D / 2 + wt / 2, hx: (W / 2 - c1) / 2, hz: wt / 2 },
    { x: W / 2 - wt / 2, z: bz, hx: wt / 2, hz: D / 2 },
    { x: -W / 2 + wt / 2, z: bz, hx: wt / 2, hz: D / 2 },
    { x: -2.6, z: bz + D / 2 - wt / 2, hx: 1.4, hz: wt / 2 },
    { x: 2.6, z: bz + D / 2 - wt / 2, hx: 1.4, hz: wt / 2 },
    { x: 0, z: -3.38, hx: 1.18, hz: .52 },   // 坐像石座
    { x: -2.9, z: -2.2, hx: .5, hz: .33 },   // 木讲台
    { x: -1.13, z: 1.5, hx: .12, hz: .56 },  // 内开粉红玻璃门扇
    { x: 1.13, z: 1.5, hx: .12, hz: .56 },
  ];
  // 4 根檐柱
  for (const x of [-3.5, -1.75, 1.75, 3.5]) colliders.push({ x, z: fz + .55, hx: .21, hz: .21 });
  // 前沿低石栏、两侧块石墙
  for (const s of [-1, 1]) {
    colliders.push({ x: s * 3.15, z: 4.2, hx: 1.25, hz: .1 });
    colliders.push({ x: s * 6.2, z: 3.4, hx: .35, hz: 1.6 });
  }

  const walk = [
    { x0: -7.1, x1: 7.1, z0: -4.6, z1: 4.6, y: 1.12 },
    { x0: -3.7, x1: 3.7, z0: -3.85, z1: 1.8, y: fy },
    { x0: -1.6, x1: 1.6, z0: 4.5, z1: 4.875, y: 1.0 },
    { x0: -1.6, x1: 1.6, z0: 4.875, z1: 5.25, y: .75 },
    { x0: -1.6, x1: 1.6, z0: 5.25, z1: 5.625, y: .5 },
    { x0: -1.6, x1: 1.6, z0: 5.625, z1: 6.0, y: .25 },
  ];

  g.userData.interior = { colliders, walk };
  return g.userData.interior;
}

/* ---------------- 体艺馆东翼：篮球馆 ---------------- */

/**
 * 东翼通高大厅（局部 34×17m）：南北三级蓝看台（BV1ygCfYpE3x 90–93s）+ 居中 22×13 枫木球场（94–109s）
 * + 三门（西北门 3.6m、西南门对称、东墙东北门）；坐标为建筑局部坐标。
 */
export function decorateGymEastWing(ctx, g, {
  W = 34, D = 17, fy = .94,
  doorX = 13.6, doorW = 3.6, doorH = 2.66,
  eastZ = -5.6, eastW = 2.6, eastH = 2.66,
} = {}) {
  const { mats } = ctx;
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const iw = W / 2 - .5;          // 内墙面 16.5
  const ih = D / 2 - .5;          // 内墙面 8.0
  const ceil = 10.3;
  const blueSeat = std({ color: 0x3f5c78, roughness: .72 });
  const silverPanel = std({ color: 0xbfc5c2, metalness: .52, roughness: .46 });
  const steel = std({ color: 0xd2d7d4, metalness: .62, roughness: .36 });
  const steelDark = std({ color: 0x565f60, metalness: .5, roughness: .5 });
  const hallFloor = std({ color: 0x8f3b30, roughness: .93 });
  const winLit = std({ color: 0xe4edf0, emissive: 0xd9e9f2, emissiveIntensity: .5, roughness: .3 });
  const boardMat = std({ color: 0xe9eff1, transparent: true, opacity: .62, roughness: .3 });
  const rimMat = std({ color: 0xd9652a, metalness: .45, roughness: .42 });
  const netMat = std({ color: 0xeef2f0, transparent: true, opacity: .5, roughness: .8, side: THREE.DoubleSide });

  /* ---------- 地坪：红色场地面层 + 木地板球场 ---------- */
  addBox(g, hallFloor, iw * 2 - .02, .16, ih * 2 - .02, 0, fy - .08, 0);
  const courtWood = std({ color: 0xc59a67, roughness: .78 });
  // 球场居中于南北蓝看台之间（端部看台取消）
  const CX = 0;
  addBox(g, courtWood, 22, .02, 13, CX, fy + .005, 0);
  {
    const seams = [];
    for (let z = -6.3; z <= 6.31; z += .65) seams.push(tbox(22, .004, .012, CX, fy + .017, z));
    addMerged(g, seams, std({ color: 0xa87f52, roughness: .8 }), { cast: false });
  }
  const LY = fy + .028;
  const line = (w, d, x, z) => addBox(g, mats.trackLine, w, .012, d, x, LY, z, 0, { cast: false });

  // 球场边线（22×13）、中线
  line(22, .06, CX, 6.47); line(22, .06, CX, -6.47);
  line(.06, 13, CX + 10.97, 0); line(.06, 13, CX - 10.97, 0);
  line(.06, 13, CX, 0);
  const ring = (x, z, r) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(r - .03, r + .03, 64), mats.trackLine);
    m.rotation.x = -Math.PI / 2; m.position.set(x, LY, z); g.add(m);
  };
  ring(CX, 0, 1.8);
  // 罚球区：4.9×5.8，罚球线距端线 5.8m
  for (const s of [-1, 1]) {
    const x0 = CX + s * 11, x1 = CX + s * 5.2;
    for (const zz of [-2.45, 2.45]) line(5.8, .06, (x0 + x1) / 2, zz);
    line(.06, 4.9, x1, 0);
    ring(x1, 0, 1.8);
  }
  // 三分弧（篮点距端线 1.4m、半径 6.75m）+ 端线两段短直线
  {
    const geos = [];
    for (const s of [-1, 1]) {
      const cx = CX + s * 9.6, cz = 0, r = 6.75;
      const a0 = s > 0 ? 2.007 : -1.134, a1 = s > 0 ? 4.276 : 1.134;
      const n = 16;
      for (let i = 0; i < n; i++) {
        const t0 = a0 + (a1 - a0) * i / n, t1 = a0 + (a1 - a0) * (i + 1) / n;
        const x0 = cx + Math.cos(t0) * r, z0 = cz + Math.sin(t0) * r;
        const x1 = cx + Math.cos(t1) * r, z1 = cz + Math.sin(t1) * r;
        geos.push(tbox(Math.hypot(x1 - x0, z1 - z0) + .012, .012, .06,
          (x0 + x1) / 2, LY, (z0 + z1) / 2, Math.atan2(-(z1 - z0), x1 - x0)));
      }
      const bx = CX + s * 11;
      for (const zz of [-6.1, 6.1]) {
        const ex = cx + Math.cos(s > 0 ? a0 : a1) * r;
        geos.push(tbox(Math.abs(bx - ex), .012, .06, (bx + ex) / 2, LY, zz));
      }
    }
    addMerged(g, geos, mats.trackLine, { cast: false });
  }

  /* ---------- 南北两侧三级蓝色看台（94–109s；台阶自场地向墙面逐级升高） ---------- */
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const z0 = s * (7.98 - i * .475), top = 1.71 - i * .28;
      addBox(g, mats.grayBeam, 16.0, top - fy, .475, 0, (fy + top) / 2, z0 - s * .2375);
      const bench = [];
      for (let x = -7.4; x <= 7.41; x += 1.0) {
        bench.push(tbox(.9, .07, .34, x, top + .39, z0 - s * .26));
        bench.push(tbox(.9, .34, .06, x, top + .59, z0 - s * .06));
      }
      addMerged(g, bench, blueSeat, { cast: false });
    }
    // 前沿银饰板（低矮，露出首排座椅）+ 前栏杆
    const zf = s * 6.54, zr = s * 6.48;
    const fas = [tbox(16.0, .30, .05, 0, fy + .15, zf)];
    for (let x = -7.9; x <= 7.91; x += .2) fas.push(tbox(.04, .26, .03, x, fy + .15, zf - s * .03));
    addMerged(g, fas, silverPanel);
    const rails = [tcyl(.024, .024, 16.0, 0, 2.10, zr, 8, 0, 0, Math.PI / 2)];
    for (let x = -7.8; x <= 7.81; x += 1.3) rails.push(tbox(.05, 1.16, .05, x, fy + .58, zr));
    addMerged(g, rails, steel);
  }

  /* ---------- 两组篮球架 ---------- */
  for (const s of [-1, 1]) {
    addBox(g, boardMat, .06, 1.05, 1.8, CX + s * 10.0, 3.42, 0, 0, { cast: false });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(.225, .022, 8, 20), rimMat);
    rim.rotation.x = Math.PI / 2; rim.position.set(CX + s * 9.6, 3.05, 0); g.add(rim);
    const net = new THREE.Mesh(new THREE.CylinderGeometry(.22, .14, .42, 12, 1, true), netMat);
    net.position.set(CX + s * 9.6, 2.83, 0); g.add(net);
    addBox(g, steelDark, 1.8, .1, .1, CX + s * 10.9, 3.62, 0);
    addBox(g, steelDark, .18, 3.2, .18, CX + s * 11.75, 2.54, 0);
    addBox(g, steelDark, .72, .16, .9, CX + s * 11.75, fy + .06, 0);
  }

  /* ---------- 内墙白色抹灰 + 带形高窗 ---------- */
  const wallPlane = (w, h, x, y, z, ry, mat = mats.plaster) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    p.position.set(x, y, z); p.rotation.y = ry;
    p.receiveShadow = true; g.add(p);
  };
  const zN = -ih + .004, zS = ih - .004;
  const bands = [[2.27, 2.66], [6.2, 2.0], [9.55, 1.5]]; // [中心 y, 高]
  // 南墙下段留西南门洞（与西北门对称，x −15.4…−11.8）
  for (const [cy, h] of bands.slice(1)) wallPlane(iw * 2, h, 0, cy, zS, Math.PI);
  wallPlane(1.1, 2.66, -15.95, 2.27, zS, Math.PI);
  wallPlane(28.3, 2.66, 2.35, 2.27, zS, Math.PI);
  // 北墙下段留西北门洞（3.6m）
  wallPlane(1.1, 2.66, -15.95, 2.27, zN, 0);
  wallPlane(28.3, 2.66, 2.35, 2.27, zN, 0);
  for (const [cy, h] of bands.slice(1)) wallPlane(iw * 2, h, 0, cy, zN, 0);
  // 带形窗：两层，宽度与室外窗带一致（W*.82）
  const gw = W * .82, gwHalf = gw / 2;
  for (const [zz, ry] of [[zN, 0], [zS, Math.PI]]) {
    for (const cy of [4.4, 8.0]) {
      wallPlane(gw, 1.6, 0, cy, zz, ry, winLit);
      wallPlane(iw - gwHalf, 1.6, -(gwHalf + iw) / 2, cy, zz, ry);
      wallPlane(iw - gwHalf, 1.6, (gwHalf + iw) / 2, cy, zz, ry);
      const fr = [];
      for (const yy of [cy - .8, cy + .8]) fr.push(tbox(gw, .07, .07, 0, yy, zz + (zz > 0 ? -.03 : .03)));
      for (let i = 1; i < 12; i++) {
        fr.push(tbox(.07, 1.6, .07, -gwHalf + i * gw / 12, cy, zz + (zz > 0 ? -.03 : .03)));
      }
      addMerged(g, fr, mats.plasterCool);
    }
  }
  // 东端山墙白抹灰：东北门洞 z −6.9…−4.3，下段分三段；西端加 12cm 厚抹灰层，
  // 盖住主馆东立面伸入馆内约 5cm 的四条壁柱（world x≈29.55）
  wallPlane(1.1, 2.66, iw - .004, 2.27, -7.45, -Math.PI / 2);
  wallPlane(12.3, 2.66, iw - .004, 2.27, 1.85, -Math.PI / 2);
  wallPlane(ih * 2, ceil - 3.6, iw - .004, (3.6 + ceil) / 2, 0, -Math.PI / 2);
  // 主馆一层与东翼打通：西端抹灰在通口 z −5…+8 下段让开（上段保留过梁）
  addBox(g, mats.plaster, .12, ceil - fy, 3.0, -iw + .06, (fy + ceil) / 2, -6.5, 0, { cast: false });
  addBox(g, mats.plaster, .12, ceil - 3.9, 13.0, -iw + .06, (3.9 + ceil) / 2, 1.5, 0, { cast: false });
  // 南墙高处深色记分牌（视频可见的暗色牌）
  addBox(g, std({ color: 0x3d4244, roughness: .6 }), 2.8, 1.05, .07, -6.0, 9.15, zS - .04);
  addBox(g, std({ color: 0x24302c, roughness: .5 }), 2.45, .72, .03, -6.0, 9.15, zS - .09);

  /* ---------- 蓝色器材软垫（南墙东段墙脚，避开南看台） ---------- */
  const matBlue = std({ color: 0x2f4a68, roughness: .82 });
  addBox(g, matBlue, 2.2, .72, .16, 10.0, fy + .36, 7.86);
  addBox(g, matBlue, 2.2, .72, .16, 12.4, fy + .36, 7.86);

  /* ---------- 天花：钢桁架 + 线性灯 ---------- */
  addBox(g, mats.plasterCool, iw * 2, .2, ih * 2, 0, ceil + .1, 0);
  {
    const tg = [];
    for (const tx of [-12, -6, 0, 6, 12]) {
      tg.push(tbox(.14, .14, ih * 2, tx, 9.42, 0));
      tg.push(tbox(.12, .12, ih * 2, tx, 10.14, 0));
      for (let z = -7.2; z <= 7.21; z += 1.8) {
        tg.push(tbox(.07, .72, .07, tx, 9.78, z));
        tg.push(tbox(.06, 1.95, .06, tx, 9.78, z + .9, 0, -.44));
      }
    }
    addMerged(g, tg, std({ color: 0x939c98, metalness: .4, roughness: .5 }), { cast: false });
  }
  for (const z of [-3.9, 0, 3.9]) {
    addBox(g, mats.lampWhite, 14, .09, .22, 0, 9.0, z, 0, { cast: false });
  }
  for (const [lx, ly, lz, it, ds] of [[0, 7.6, 0, 60, 32], [-9, 7.0, 0, 32, 22], [9, 7.0, 0, 32, 22]]) {
    const l = new THREE.PointLight(0xffe8cc, it, ds, 1.7);
    l.position.set(lx, ly, lz); g.add(l);
  }

  /* ---------- 可走面（含三门门槛与室外石阶） ---------- */
  const walk = [
    { x0: -iw + .05, x1: iw - .05, z0: -ih + .05, z1: ih - .05, y: fy },
  ];
  const addStoneSteps = (dir, cx, cz, w) => {
    // dir：n 北 / s 南 / e 东；自墙面（±.25）向外三级，h .70 → .47 → .235
    for (const [h, d0, d1] of [[.70, 0, 1], [.47, 1, 2], [.235, 2, 3]]) {
      if (dir === 'e') {
        addBox(g, mats.stone, d1 - d0, h, w, cx + .25 + (d0 + d1) / 2, h / 2, cz);
        walk.push({ x0: cx + .25 + d0, x1: cx + .25 + d1, z0: cz - w / 2, z1: cz + w / 2, y: h });
      } else {
        const s = dir === 'n' ? -1 : 1;
        const za = cz + s * (.25 + d0), zb = cz + s * (.25 + d1);
        addBox(g, mats.stone, w, h, d1 - d0, cx, h / 2, (za + zb) / 2);
        walk.push({ x0: cx - w / 2, x1: cx + w / 2, z0: Math.min(za, zb), z1: Math.max(za, zb), y: h });
      }
    }
  };

  /* ---------- 三门（西北加宽 / 西南对称 / 东北在东墙）+ 室外三级石阶 ---------- */
  buildFramedDoor(g, mats, {
    w: doorW, h: doorH, x: -doorX, y: fy, z: -D / 2 + .25, ry: 0, glass: true, open: 2.9,
  });
  buildFramedDoor(g, mats, {
    w: doorW, h: doorH, x: -doorX, y: fy, z: D / 2 - .25, ry: Math.PI, glass: true, open: 2.9,
  });
  buildFramedDoor(g, mats, {
    w: eastW, h: eastH, x: W / 2 - .25, y: fy, z: eastZ, ry: -Math.PI / 2, glass: true, open: 2.9,
  });
  addBox(g, mats.stone, doorW + .3, .05, .55, -doorX, fy - .025, -D / 2 + .25);
  addBox(g, mats.stone, doorW + .3, .05, .55, -doorX, fy - .025, D / 2 - .25);
  addBox(g, mats.stone, .55, .05, eastW + .3, W / 2 - .25, fy - .025, eastZ);
  addStoneSteps('n', -doorX, -D / 2 + .25, doorW + .8);
  addStoneSteps('s', -doorX, D / 2 - .25, doorW + .8);
  addStoneSteps('e', W / 2 - .25, eastZ, eastW + .8);
  const hwW = doorW / 2 + .35, hwE = eastW / 2 + .35;
  walk.push({ x0: -doorX - hwW, x1: -doorX + hwW, z0: -ih - .55, z1: -ih + .05, y: fy });
  walk.push({ x0: -doorX - hwW, x1: -doorX + hwW, z0: ih - .05, z1: ih + .55, y: fy });
  walk.push({ x0: iw - .05, x1: iw + .55, z0: eastZ - hwE, z1: eastZ + hwE, y: fy });

  /* ---------- 碰撞 ---------- */
  const colliders = [
    // 北墙（西北门洞 x −15.4…−11.8）、南墙（西南门洞对称）
    { x: -16.2, z: -8.25, hx: .8, hz: .25 },
    { x: 2.6, z: -8.25, hx: 14.4, hz: .25 },
    { x: -16.2, z: 8.25, hx: .8, hz: .25 },
    { x: 2.6, z: 8.25, hx: 14.4, hz: .25 },
    // 东墙（东北门洞 z −6.9…−4.3）、西墙（通主馆 z −5…+8 不设碰撞，仅留北段）
    { x: 16.75, z: -7.7, hx: .25, hz: .8 },
    { x: 16.75, z: 2.1, hx: .25, hz: 6.4 },
    { x: -16.75, z: -6.5, hx: .25, hz: 1.5 },
    // 南北两侧蓝看台、篮球架立柱、南墙器材垫
    { x: 0, z: -7.27, hx: 8.0, hz: .72 },
    { x: 0, z: 7.27, hx: 8.0, hz: .72 },
    { x: CX - 11.75, z: 0, hx: .25, hz: .25 },
    { x: CX + 11.75, z: 0, hx: .25, hz: .25 },
    { x: 11.2, z: 7.86, hx: 2.3, hz: .12 },
  ];

  g.userData.interior = { colliders, walk };
  return g.userData.interior;
}

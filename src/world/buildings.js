import * as THREE from 'three';
import {
  addBalustrade, addSteps, addStonePlinth, addLantern, addStele, addPlaque, addMerged, makeGlowSprite
} from './detail.js';
import { xieshanRoofGroup, hipRoofGroup, doubleEaveRoof } from './roofs.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { tbox, tcyl, addBox, addCyl, mergeGeometriesSafe, mulberry32, makeCanvas, canvasTexture } from '../util.js';
import { decorateBookBar, decorateLinZexu, decorateGymEastWing } from './interiors.js';
import { punchFacade } from './classrooms.js';

function meshBox(parent, mat, w, h, d, x, y, z, ry = 0) {
  return addBox(parent, mat, w, h, d, x, y, z, ry);
}

export function addWall(parent, mats, x1, z1, x2, z2, { h = 2.6, t = 0.42, cap = true, gate = null } = {}) {
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  if (len < 0.2) return;
  const ry = Math.atan2(dx, dz);
  const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
  const g = new THREE.Group();
  g.position.set(mx, 0, mz); g.rotation.y = ry;
  const body = new THREE.Mesh(new THREE.BoxGeometry(t, h, len), mats.plaster);
  body.position.y = h / 2; body.castShadow = true; body.receiveShadow = true; g.add(body);
  const base = new THREE.Mesh(new THREE.BoxGeometry(t + 0.18, 0.4, len), mats.stoneDark);
  base.position.y = 0.2; base.castShadow = true; base.receiveShadow = true; g.add(base);
  if (cap) {
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.14, len), mats.roof);
    c1.position.y = h + 0.08; c1.rotation.z = 0.07; c1.castShadow = true; g.add(c1);
    const c2 = c1.clone(); c2.rotation.z = -0.07; c2.position.x = -0.0; g.add(c2);
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, len), mats.ridge);
    ridge.position.y = h + 0.16; g.add(ridge);
  }
  parent.add(g);
  return g;
}

function addBrackets(parent, mats, width, z, y, count = 9) {
  const geoms = [];
  const step = width / count;
  for (let i = 0; i <= count; i++) {
    const x = -width / 2 + step * i;
    geoms.push(tbox(0.42, 0.22, 0.9, x, y, z, 0));
    geoms.push(tbox(0.72, 0.18, 1.15, x, y - 0.28, z, 0));
    geoms.push(tbox(0.26, 0.65, 0.26, x, y - 0.5, z + 0.15, 0, 0, 0.5));
  }
  addMerged(parent, geoms, mats.redBeam);
}

function addEaveRafters(parent, mats, width, z, y, count = 24) {
  const geoms = [];
  for (let i = 0; i <= count; i++) {
    const x = -width / 2 + width * i / count;
    geoms.push(tbox(0.1, 0.1, 1.3, x, y, z, 0));
  }
  addMerged(parent, geoms, mats.redDark);
}

function latticeDoor(parent, mats, w, h, x, y, z, { open = false, fold = false, glow = false, cols = 5, rows = 7, ry = 0 } = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (ry) g.rotation.y = ry;
  const frameMat = mats.woodDark;
  const t = 0.16;
  for (const [fw, fh, fx, fy] of [[w + .3, .18, 0, h / 2], [w + .3, .18, 0, -h / 2], [.18, h, -w / 2, 0], [.18, h, w / 2, 0]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, t), frameMat);
    b.position.set(fx, fy, 0); b.castShadow = true; g.add(b);
  }
  if (open) {
    // open double doors folded inward；fold 时完全贴内墙，保持门洞净空
    for (const s of [-1, 1]) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(w * 0.48, h * 0.94, 0.08), mats.wood);
      if (fold) {
        door.position.set(s * (w * .74), 0, -0.42);
      } else {
        door.position.set(s * w * 0.28, 0, -0.5);
        door.rotation.y = s * 1.15;
      }
      g.add(door);
    }
  } else {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glow ? mats.latticeEmissive : mats.lattice);
    panel.position.z = 0.02; g.add(panel);
  }
  parent.add(g);
  return g;
}

function addLatticeWall(parent, mats, w, h, x, y, z, { ry = 0, glow = false } = {}) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glow ? mats.latticeEmissive : mats.lattice);
  m.position.set(x, y, z); m.rotation.y = ry; parent.add(m);
  return m;
}

function addInteriorLight(parent, mats, x, y, z, base = 18, distance = 26, color = 0xffa45c) {
  const l = new THREE.PointLight(color, 0, distance, 1.8);
  l.position.set(x, y, z);
  l.userData.baseIntensity = base;
  parent.add(l);
  return l;
}

// ------------------------------------------------------------------
export function buildGate(ctx) {
  const { group, mats, nightEmitters, nightLights } = ctx;
  const g = new THREE.Group();
  const W = 23, D = 6.2;
  const pierH = 6.6, centerH = 7.8;
  // stone threshold and paving
  meshBox(g, mats.stoneDark, W + 2.2, 0.35, D + 1.8, 0, 0.17, 0);
  // four piers
  const pierXs = [-9.4, -3.15, 3.15, 9.4];
  for (const x of pierXs) {
    const h = Math.abs(x) > 6 ? 5.9 : centerH;
    const p = new THREE.Mesh(new THREE.BoxGeometry(2.5, h, D), mats.plasterCool);
    p.position.set(x, h / 2 + .3, 0); p.castShadow = true; p.receiveShadow = true; g.add(p);
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.75, 1.0, D + .3), mats.stone);
    base.position.set(x, .5, 0); base.castShadow = true; g.add(base);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(2.7, .26, D + .2), mats.stoneDark);
    cap.position.set(x, h + .3, 0); g.add(cap);
  }
  // side door leaves
  for (const x of [-6.3, 6.3]) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(3.4, 4.2, .16), mats.wood);
    door.position.set(x, 2.6, D / 2 - .05); g.add(door);
    // golden studs
    const geoms = [];
    for (let i = -1; i <= 1; i++) for (let j = 0; j < 4; j++) {
      geoms.push(tbox(0.1, 0.1, 0.08, x + i * .9, 1.25 + j * .9, D / 2 + .05, 0));
    }
    addMerged(g, geoms, mats.gold);
  }
  // main opening threshold
  meshBox(g, mats.stone, 6.0, .2, .8, 0, .4, D / 2 - .5);
  // plaque
  addPlaque(g, mats, mats.plaques.school, 0, 6.65, D / 2 + 0.16, { w: 6.2, h: 1.35 });
  // roofs
  const roofCenter = hipRoofGroup({ W: 13.5, D: 7.8, H: 3.0, tileMat: mats.roof, ridgeMat: mats.ridge, fasciaMat: mats.redDark, ridgeRatio: .42, cornerLift: 1.05 });
  roofCenter.position.y = centerH + .3;
  g.add(roofCenter);
  for (const s of [-1, 1]) {
    const roof = hipRoofGroup({ W: 8.2, D: 6.6, H: 2.15, tileMat: mats.roof, ridgeMat: mats.ridge, fasciaMat: mats.redDark, ridgeRatio: .38, cornerLift: .85 });
    roof.position.set(s * 7.7, 5.9 + .3, 0);
    g.add(roof);
  }
  // red lintel beams
  meshBox(g, mats.redBeam, 8.2, .58, .5, 0, 6.05, D / 2 + .25);
  meshBox(g, mats.redBeam, 5.4, .5, .5, -6.3, 5.25, D / 2 + .25);
  meshBox(g, mats.redBeam, 5.4, .5, .5, 6.3, 5.25, D / 2 + .25);
  // four red lanterns, as in the real gate
  for (const x of [-4.5, -1.5, 1.5, 4.5]) {
    const l = addLantern(g, mats, x, 5.0, D / 2 + .55, { scale: 1.0, glowTex: mats.glowTex, register: null });
    nightEmitters.push(l.children[0]);
    if (l.userData.glow) l.userData.glow.userData.nightOpacity = .5;
    nightEmitters.push(l.userData.glow);
  }
  // closed metal gate across the central opening
  const barGeos = [];
  for (let i = 0; i <= 12; i++) {
    const x = -3.0 + i * .5;
    barGeos.push(tbox(.06, 4.0, .06, x, 2.25, D / 2 + .16, 0));
  }
  for (const y of [.75, 1.9, 3.05, 4.15]) barGeos.push(tbox(6.1, .06, .06, 0, y, D / 2 + .16, 0));
  addMerged(g, barGeos, mats.darkMetal);
  const pl = addInteriorLight(g, mats, 0, 4, 1, 46, 38);
  nightLights.push(pl);
  for (const s of [-1, 1]) {
    const li = new THREE.PointLight(0xffb56d, 0, 34, 1.8);
    li.position.set(s * 7.0, 5.2, 11.2);
    li.userData.baseIntensity = 26;
    g.add(li); nightLights.push(li);
  }

  // 两侧单层附属房（左保安亭、右报刊亭，实景为灰瓦四坡顶白墙小屋）
  for (const s of [-1, 1]) {
    const sg = new THREE.Group();
    sg.position.set(s * 14.9, 0, -.5);
    const bw = 7.2, bd = 5.2, bh = 3.1;
    meshBox(sg, mats.stoneDark, bw + .5, .32, bd + .5, 0, .16, 0);
    meshBox(sg, mats.plasterCool, bw, bh, bd, 0, bh / 2, 0);
    // 南面开敞门廊：三根深色木柱 + 矮栏 + 格扇
    const cg = [];
    for (const x of [-bw / 2 + .5, 0, bw / 2 - .5]) cg.push(tbox(.24, bh, .24, x, bh / 2, bd / 2 + .08, 0));
    addMerged(sg, cg, mats.woodDark);
    meshBox(sg, mats.woodDark, bw - .6, .72, .12, 0, 1.05, bd / 2 + .16);
    addLatticeWall(sg, mats, bw * .34, 1.85, 0, 1.9, bd / 2 + .02);
    const roof = hipRoofGroup({ W: bw + 1.8, D: bd + 1.7, H: 1.35, tileMat: mats.roof, ridgeMat: mats.ridge, fasciaMat: mats.redDark, ridgeRatio: .62, cornerLift: .32 });
    roof.position.y = bh + .08; sg.add(roof);
    g.add(sg);
  }
  const gateLight = new THREE.PointLight(0xffb36b, 0, 28, 1.7);
  gateLight.position.set(0, 5.5, 2); gateLight.userData.baseIntensity = 16;
  g.add(gateLight); nightLights.push(gateLight);
  g.position.set(-28, 0, 138);
  group.add(g);
  return g;
}

function makeLion(mats) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, .55, 1.8), mats.stoneDark);
  base.position.y = .28; base.castShadow = true; g.add(base);
  const body = new THREE.Mesh(new THREE.SphereGeometry(.62, 9, 7), mats.stone);
  body.scale.set(.95, 1.15, 1.2); body.position.set(0, 1.25, -.1); body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.48, 10, 8), mats.stone);
  head.position.set(0, 2.0, .45); head.castShadow = true; g.add(head);
  const mane = new THREE.Mesh(new THREE.TorusGeometry(.44, .15, 6, 11), mats.stoneDark);
  mane.position.set(0, 2.0, .25); g.add(mane);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(.13, .26, 5), mats.stone);
    ear.position.set(s * .32, 2.4, .45); g.add(ear);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(.16, .2, 1.1, 6), mats.stone);
    leg.position.set(s * .3, .9, .35); g.add(leg);
    const paw = new THREE.Mesh(new THREE.BoxGeometry(.35, .18, .55), mats.stoneDark);
    paw.position.set(s * .3, .38, .55); g.add(paw);
  }
  return g;
}

// ------------------------------------------------------------------
/** 大成殿室内：参考视频中的祭坛居中、两壁圣迹图、蓝白天花、壁灯与长凳的布局，细节作简化 */
function buildDachengInterior(g, mats, nightEmitters, nightLights) {
  const bodyW = 30, bodyD = 20, floorY = 1.3, wallH = 7.6;
  const floorTop = floorY + .245;
  const ceilY = floorY + wallH - .425;
  const altarY = floorTop + .45;
  const wallIn = bodyW / 2 - .26;

  // 内墙红色抹灰（侧墙与后墙）
  const sideWallGeo = new THREE.PlaneGeometry(bodyD - .9, wallH - .2);
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(sideWallGeo, mats.interiorWall);
    m.position.set(s * wallIn, floorTop + (wallH - .2) / 2, 0);
    m.rotation.y = -s * Math.PI / 2;
    m.receiveShadow = true; g.add(m);
  }
  const back = new THREE.Mesh(new THREE.PlaneGeometry(bodyW - .9, wallH - .2), mats.interiorWall);
  back.position.set(0, floorTop + (wallH - .2) / 2, -bodyD / 2 + .26);
  back.receiveShadow = true; g.add(back);

  // 两壁圣迹图壁画带 + 上下木压条
  const murW = bodyD - 1.8, murH = 2.6, murY = floorTop + 2.3;
  const trim = [];
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(murW, murH), mats.mural);
    m.position.set(s * (wallIn - .02), murY, 0);
    m.rotation.y = -s * Math.PI / 2;
    m.receiveShadow = true; g.add(m);
    for (const y of [murY - murH / 2 - .09, murY + murH / 2 + .09]) {
      trim.push(tbox(.14, .18, murW + .3, s * (wallIn - .08), y, 0));
    }
  }

  // 靠墙长凳
  const bench = [];
  for (const s of [-1, 1]) {
    const bx = s * (wallIn - .36);
    bench.push(tbox(.55, .09, bodyD - 3.4, bx, floorTop + .42, 0));
    bench.push(tbox(.07, .3, bodyD - 3.4, s * (wallIn - .07), floorTop + .62, 0));
    for (let z = -6; z <= 6; z += 2.4) {
      for (const dx of [-.18, .18]) bench.push(tbox(.1, .42, .1, bx + dx, floorTop + .21, z));
    }
  }
  addMerged(g, trim.concat(bench), mats.woodDark);

  // 壁灯：壁画上下两排（白天也常亮，夜间另由灯笼与灯补光）
  const lamps = [];
  for (const s of [-1, 1]) {
    for (let z = -8; z <= 8; z += 2) {
      lamps.push(tbox(.14, .18, .3, s * (wallIn - .08), 5.45, z));
      lamps.push(tbox(.18, .12, .24, s * (wallIn - .04), 2.32, z));
    }
  }
  for (const x of [-5, -2.5, 0, 2.5, 5]) lamps.push(tbox(.3, .18, .14, x, 5.45, -bodyD / 2 + .34));
  addMerged(g, lamps, mats.wallLamp, { cast: false });

  // 天花：中部白灰顶，两侧蓝白椽花带，红梁压边
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(bodyW - 1.2, bodyD - 1.2), mats.plasterCool);
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, ceilY - .02, 0); g.add(ceil);
  for (const s of [-1, 1]) {
    const band = new THREE.Mesh(new THREE.PlaneGeometry(2.7, bodyD - 1.2), mats.coffer);
    band.rotation.x = Math.PI / 2;
    band.position.set(s * 13.3, ceilY - .03, 0);
    g.add(band);
  }
  const beams = [];
  for (const z of [-6.4, 0, 6.4]) beams.push(tbox(bodyW - .8, .4, .5, 0, ceilY - .22, z));
  for (const x of [-9, -3, 3, 9]) beams.push(tbox(.42, .4, bodyD - 1, x, ceilY - .22, 0));
  for (const z of [-9.6, 9.6]) beams.push(tbox(bodyW - .8, .44, .45, 0, ceilY - .23, z));
  for (const x of [-14.6, 14.6]) beams.push(tbox(.45, .44, bodyD - .9, x, ceilY - .23, 0));
  addMerged(g, beams, mats.redBeam);

  // 祭坛整体：台基、神龛、坐像、神位、香案与落地烛台一并移至殿内中心
  const altar = new THREE.Group();
  altar.position.z = 6.575;
  g.add(altar);

  // 祭坛台基：高 0.45m，两级石阶
  meshBox(altar, mats.stone, 17.2, .45, 6.57, 0, floorTop + .225, -6.575);
  addSteps(altar, mats.stone, 0, -3.29, 17.2, .45, 1.0, 2);

  // 神龛屏风：深色木框 + 米色竖板
  const shrineWood = [], shrineCream = [], shrineGold = [];
  shrineWood.push(tbox(10.8, 4.9, .26, 0, altarY + 2.45, -9.56));
  for (let i = 0; i < 7; i++) {
    const x = -3.9 + i * 1.3;
    if (i === 3) shrineGold.push(tbox(1.16, 4.2, .05, x, altarY + 2.2, -9.4));
    else shrineCream.push(tbox(1.16, 4.2, .05, x, altarY + 2.2, -9.4));
  }
  for (let i = 0; i <= 7; i++) shrineWood.push(tbox(.1, 4.5, .12, -4.55 + i * 1.3, altarY + 2.2, -9.4));
  shrineWood.push(tbox(10.8, .26, .4, 0, altarY + 4.85, -9.48));
  shrineWood.push(tbox(10.8, .2, .5, 0, altarY + .1, -9.52));
  shrineWood.push(tbox(.3, 4.9, .45, -5.35, altarY + 2.45, -9.5));
  shrineWood.push(tbox(.3, 4.9, .45, 5.35, altarY + 2.45, -9.5));
  shrineGold.push(tbox(10.9, .08, .12, 0, altarY + 4.99, -9.46));
  addMerged(altar, shrineWood, mats.woodDark);
  addMerged(altar, shrineCream, mats.shrinePanel);
  addMerged(altar, shrineGold, mats.gold);
  // 屏风后的暖光
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 4.6),
    new THREE.MeshBasicMaterial({ color: 0xffb36b, transparent: true, opacity: .09, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.position.set(0, altarY + 2.45, -9.3); altar.add(glow);

  // 孔子坐像
  const st = new THREE.Group();
  st.position.set(0, altarY, -7.6);
  const put = (mesh, y, z = 0) => { mesh.position.set(0, y, z); mesh.castShadow = true; st.add(mesh); return mesh; };
  put(new THREE.Mesh(new THREE.BoxGeometry(3.8, .35, 2.3), mats.woodDark), .175);
  put(new THREE.Mesh(new THREE.BoxGeometry(2.6, .6, 1.6), mats.bronze), .65, .18);   // 盘膝
  put(new THREE.Mesh(new THREE.CylinderGeometry(.6, 1.1, 1.3, 12), mats.bronze), 1.6);
  put(new THREE.Mesh(new THREE.CylinderGeometry(.5, .68, .9, 12), mats.bronze), 2.7);
  const shoulders = put(new THREE.Mesh(new THREE.SphereGeometry(.5, 12, 9), mats.bronze), 3.12);
  shoulders.scale.set(1.3, .55, .85);
  put(new THREE.Mesh(new THREE.SphereGeometry(.42, 12, 9), mats.bronze), 3.65, .05);
  put(new THREE.Mesh(new THREE.CylinderGeometry(.2, .24, .3, 10), mats.bronze), 3.32);
  put(new THREE.Mesh(new THREE.CylinderGeometry(.43, .46, .25, 10), mats.bronze), 3.95);
  put(new THREE.Mesh(new THREE.BoxGeometry(1.15, .08, .78), mats.bronze), 4.12);
  const crown = put(new THREE.Mesh(new THREE.BoxGeometry(1.27, .03, .9), mats.gold), 4.17);
  crown.castShadow = false;
  const halo = put(new THREE.Mesh(new THREE.TorusGeometry(.7, .05, 6, 24), mats.goldDim), 3.7, -.3);
  halo.castShadow = false;
  const sash = put(new THREE.Mesh(new THREE.BoxGeometry(.72, .12, .08), mats.gold), 2.55, .56);
  sash.castShadow = false;
  addMerged(st, [tbox(.2, 1.9, .24, -.62, 2.05, .3, 0, -.3, -.08), tbox(.2, 1.9, .24, .62, 2.05, .3, 0, -.3, .08)], mats.bronze);
  for (const x of [-.62, .62]) {
    const hand = new THREE.Mesh(new THREE.SphereGeometry(.16, 8, 6), mats.bronze);
    hand.position.set(x, 1.12, .64); st.add(hand);
  }
  altar.add(st);

  // 四配神位
  const tabWood = [], tabCream = [], tabGold = [];
  for (const x of [-4.8, -3.2, 3.2, 4.8]) {
    tabWood.push(tbox(.95, .18, .55, x, altarY + .09, -8.55));
    tabWood.push(tbox(.72, 2.5, .14, x, altarY + 1.43, -8.55));
    tabCream.push(tbox(.5, 1.9, .02, x, altarY + 1.5, -8.47));
    tabGold.push(tbox(.86, .1, .2, x, altarY + 2.73, -8.55));
  }
  addMerged(altar, tabWood, mats.woodDark);
  addMerged(altar, tabCream, mats.plaster);
  addMerged(altar, tabGold, mats.gold);

  // 香案
  const tableTop = altarY + 1.0;
  const table = [];
  table.push(tbox(4.6, .18, 1.2, 0, tableTop - .09, -5.9));
  table.push(tbox(4.5, .06, .06, 0, tableTop - .2, -5.32));
  for (const x of [-1.95, 1.95]) for (const z of [-6.3, -5.5]) table.push(tbox(.18, .95, .18, x, tableTop - .57, z));
  addMerged(altar, table, mats.woodDark);
  const burner = new THREE.Group();
  burner.position.set(0, tableTop, -5.9);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(.42, .34, .5, 10), mats.bronze);
  pot.position.y = .4; pot.castShadow = true; burner.add(pot);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(.46, .42, .08, 10), mats.gold);
  rim.position.y = .67; burner.add(rim);
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(.055, .05, .3, 6), mats.bronze);
    leg.position.set(Math.cos(a) * .26, .15, Math.sin(a) * .26); burner.add(leg);
  }
  altar.add(burner);
  for (const x of [-1.2, 1.2]) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.1, .14, .5, 8), mats.gold);
    base.position.set(x, tableTop + .25, -5.9); altar.add(base);
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .4, 8), mats.plaster);
    candle.position.set(x, tableTop + .6, -5.9); altar.add(candle);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(.08, .22, 6),
      new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xff9a3a, emissiveIntensity: 1.6 }));
    flame.position.set(x, tableTop + .9, -5.9); altar.add(flame);
  }

  // 落地烛台
  for (const x of [-3.4, 3.4]) {
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(.22, .26, .25, 10), mats.stoneDark);
    stand.position.set(x, floorTop + .125, -1.3); altar.add(stand);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.05, .07, .8, 8), mats.goldDim);
    pole.position.set(x, floorTop + .65, -1.3); altar.add(pole);
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, .6, 8), mats.plaster);
    candle.position.set(x, floorTop + 1.35, -1.3); altar.add(candle);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(.09, .28, 6),
      new THREE.MeshStandardMaterial({ color: 0xffc46a, emissive: 0xff942f, emissiveIntensity: 1.8 }));
    flame.position.set(x, floorTop + 1.79, -1.3); altar.add(flame);
    const flare = makeGlowSprite(mats.glowTex, 0xffa050, .9, .5);
    flare.position.set(x, floorTop + 1.75, -1.3); altar.add(flare);
  }

  // 吊灯与吊索
  const cords = [];
  for (const z of [-2.0, 2.6]) {
    for (const s of [-1, 1]) {
      const l = addLantern(g, mats, s * 6.4, floorTop + 5.1, z, { scale: .95, glowTex: mats.glowTex });
      nightEmitters.push(l.children[0]);
      if (l.userData.glow) nightEmitters.push(l.userData.glow);
      cords.push(tbox(.04, 1.3, .04, s * 6.4, floorTop + 5.1 + .62 + .5, z));
    }
  }
  addMerged(g, cords, mats.woodDark);

  // 室内常亮暖光 + 夜间主灯（随祭坛居中，光源移到像前，避免贴屏过曝）
  const fill = new THREE.PointLight(0xffb87a, 10, 26, 1.7);
  fill.position.set(0, floorTop + 4.0, 2.2); g.add(fill);
  const fill2 = new THREE.PointLight(0xffb070, 5, 20, 1.7);
  fill2.position.set(0, floorTop + 3.8, 6.4); g.add(fill2);
  const night = addInteriorLight(g, mats, 0, floorTop + 3.7, 3.4, 14, 26);
  nightLights.push(night);
}

export function buildDachengHall(ctx) {
  const { group, mats, nightEmitters, nightLights } = ctx;
  const g = new THREE.Group();
  const platW = 40, platD = 33, platH = 1.3;
  // platform
  const plinth = addStonePlinth(g, mats.stone, platW, platD, platH, 0, 0);
  // steps south
  addSteps(g, mats.stone, 0, platD / 2 + 0.2, 11, platH, 5.5, 6);
  // side steps? small
  addSteps(g, mats.stone, -platW / 2 - .1, 0, 2.2, platH, 2.2, 4);
  // 台基不设围栏：可从正面台阶走上，也可直接跳上台基

  const bodyW = 30, bodyD = 20;
  const floorY = platH;
  const wallH = 7.6;
  // floor
  meshBox(g, mats.stone, bodyW + 1.0, .25, bodyD + 1.0, 0, floorY + .12, 0);
  // back & side walls
  const back = new THREE.Mesh(new THREE.BoxGeometry(bodyW, wallH, .5), mats.plaster);
  back.position.set(0, floorY + wallH / 2, -bodyD / 2); back.castShadow = true; back.receiveShadow = true; g.add(back);
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(.5, wallH, bodyD), mats.plaster);
    side.position.set(s * bodyW / 2, floorY + wallH / 2, 0); side.castShadow = true; side.receiveShadow = true; g.add(side);
  }
  // column grid: 6 front, 6 back, plus intermediate
  const colGeoms = [];
  const colXs = [-15, -9, -3, 3, 9, 15];
  for (const x of colXs) for (const z of [-9.6, 0, 9.6]) {
    // 祭坛移至殿内中心后，抽掉中央两根内柱，避免柱身穿台基与神龛
    if (z === 0 && Math.abs(x) === 3) continue;
    colGeoms.push(tcyl(.38, .42, wallH, x, floorY + wallH / 2, z, 12));
  }
  for (const z of [-9.6, 0, 9.6]) for (const s of [-1, 1]) {
    colGeoms.push(tcyl(.38, .42, wallH, s * bodyW / 2, floorY + wallH / 2, z, 12));
  }
  addMerged(g, colGeoms, mats.redColumn);
  // column bases
  const baseGeoms = [];
  for (const x of colXs) for (const z of [-9.6, 0, 9.6]) {
    if (z === 0 && Math.abs(x) === 3) continue;
    baseGeoms.push(tcyl(.62, .72, .55, x, floorY + .27, z, 10));
  }
  addMerged(g, baseGeoms, mats.stone);
  // front lattice bays
  for (let i = 0; i < 5; i++) {
    const x = -12 + i * 6;
    const center = i === 2;
    latticeDoor(g, mats, 5.15, 5.2, x, floorY + 2.9, 9.75, { open: center, glow: true, cols: 5, rows: 7 });
  }
  // side/back lattice windows
  for (const s of [-1, 1]) {
    addLatticeWall(g, mats, 5.5, 3.0, s * (bodyW / 2 + .27), floorY + 4.6, -4.5, { ry: s * Math.PI / 2, glow: true });
    addLatticeWall(g, mats, 5.5, 3.0, s * (bodyW / 2 + .27), floorY + 4.6, 4.5, { ry: s * Math.PI / 2, glow: true });
  }
  // beams / frieze
  meshBox(g, mats.redBeam, bodyW + .8, .55, bodyD + .8, 0, floorY + wallH - .15, 0);
  // 额枋：外圈金线（做成四边压条，避免整块板遮住室内天花）
  meshBox(g, mats.gold, bodyW + .9, .13, .3, 0, floorY + wallH - .5, -(bodyD + .9) / 2 + .15);
  meshBox(g, mats.gold, bodyW + .9, .13, .3, 0, floorY + wallH - .5, (bodyD + .9) / 2 - .15);
  meshBox(g, mats.gold, .3, .13, bodyD + .9, -(bodyW + .9) / 2 + .15, floorY + wallH - .5, 0);
  meshBox(g, mats.gold, .3, .13, bodyD + .9, (bodyW + .9) / 2 - .15, floorY + wallH - .5, 0);
  addBrackets(g, mats, bodyW, 10.15, floorY + wallH + .55, 12);
  addEaveRafters(g, mats, bodyW, 10.5, floorY + wallH + .2, 30);
  // plaque
  addPlaque(g, mats, mats.plaques.dacheng, 0, floorY + 6.7, 9.95, { w: 4.2, h: 1.15 });
  // upper storey
  const upW = 23, upD = 14;
  const upBase = floorY + wallH + 2.35;
  const upH = 3.2;
  const upFloor = new THREE.Mesh(new THREE.BoxGeometry(upW + 1.5, .4, upD + 1.5), mats.redDark);
  upFloor.position.set(0, upBase, 0); upFloor.castShadow = true; g.add(upFloor);
  for (const [w, h, d, x, y, z] of [
    [upW, upH, .35, 0, upBase + upH / 2, -upD / 2],
    [.35, upH, upD, -upW / 2, upBase + upH / 2, 0],
    [.35, upH, upD, upW / 2, upBase + upH / 2, 0]
  ]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats.plaster);
    m.position.set(x, y, z); m.castShadow = true; g.add(m);
  }
  // upper front windows, with white wall between the bays
  for (let i = 0; i < 5; i++) {
    addLatticeWall(g, mats, 3.25, 2.35, -8.8 + i * 4.4, upBase + 1.65, upD / 2 + .02, { glow: true });
  }
  addBalustrade(g, mats.redBeam, [
    [-upW / 2 - .6, upD / 2 + .8], [upW / 2 + .6, upD / 2 + .8], [upW / 2 + .6, upD / 2 + .8]
  ], upBase + .15, { h: .85, postEvery: 1.5 });
  // balcony floor
  meshBox(g, mats.wood, upW + 1.2, .22, 1.9, 0, upBase + .1, upD / 2 + .8);
  addBrackets(g, mats, upW, upD / 2 + 1.0, upBase + upH + .35, 9);
  // roof
  const roof = doubleEaveRoof({
    W: 37.0, D: 27.2, innerW: 25.5, innerD: 18.0, lowerH: 2.0,
    upperW: 29.0, upperD: 20.0, upperH: 3.7,
    eaveY: floorY + wallH + .55, upperEaveY: upBase + upH - .05,
    tileMat: mats.roof, ridgeMat: mats.ridge, gableMat: mats.redBeam, fasciaMat: mats.redDark
  });
  g.add(roof);
  // 室内：祭坛、神龛、壁画、天花、壁灯
  buildDachengInterior(g, mats, nightEmitters, nightLights);
  // lanterns on veranda
  for (const s of [-1, 1]) {
    for (const z of [-4, 4]) {
      const l = addLantern(g, mats, s * 16.2, floorY + 6.3, z, { scale: 1.0, glowTex: mats.glowTex });
      nightEmitters.push(l.children[0]);
      if (l.userData.glow) { l.userData.glow.userData.nightOpacity = .45; nightEmitters.push(l.userData.glow); }
    }
  }
  g.position.set(-40, 0, -16);
  group.add(g);
  return g;
}

// ------------------------------------------------------------------
export function buildPanPond(ctx) {
  const { group, mats } = ctx;
  const g = new THREE.Group();
  // 依 14.51.02 俯视：半月形（北直弦、南弧），三条南北向石板步道将水面分为四格
  const W2 = 15, DEP = 8.5;
  const R = (W2 * W2 + DEP * DEP) / (2 * DEP);
  const CY = R - DEP / 2;
  const a1 = Math.atan2(DEP / 2 - CY, W2);
  const a2 = Math.atan2(DEP / 2 - CY, -W2);
  const arcY = (x) => CY - Math.sqrt(Math.max(0, R * R - x * x));
  const water = new THREE.MeshPhysicalMaterial({
    color: 0x2f5f4e, roughness: .16, metalness: .22, transparent: true, opacity: .93,
    normalMap: mats.waterNormal, normalScale: new THREE.Vector2(.1, .1)
  });
  // 池岸白石环（外轮廓略放大后挖去水面）
  {
    const oW = W2 + .85, oD = DEP + .7;
    const oR = (oW * oW + oD * oD) / (2 * oD);
    const oCY = oR - oD / 2;
    const oa1 = Math.atan2(oD / 2 - oCY, oW), oa2 = Math.atan2(oD / 2 - oCY, -oW);
    const shape = new THREE.Shape();
    shape.moveTo(-oW, oD / 2);
    shape.lineTo(oW, oD / 2);
    shape.absarc(0, oCY, oR, oa1, oa2, true);
    shape.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-W2, DEP / 2);
    hole.absarc(0, CY, R, a2, a1, false);
    hole.lineTo(-W2, DEP / 2);
    shape.holes.push(hole);
    const geo = new THREE.ShapeGeometry(shape, 32);
    geo.rotateX(-Math.PI / 2);
    const rim = new THREE.Mesh(geo, mats.stone);
    rim.position.y = .1; rim.receiveShadow = true; g.add(rim);
  }
  // 池外环铺装（实景为浅灰石板，弧形环绕池岸）
  {
    const pW = W2 + 3.4, pD = DEP + 3.2;
    const pR = (pW * pW + pD * pD) / (2 * pD);
    const pCY = pR - pD / 2;
    const pa1 = Math.atan2(pD / 2 - pCY, pW), pa2 = Math.atan2(pD / 2 - pCY, -pW);
    const shape = new THREE.Shape();
    shape.moveTo(-pW, pD / 2);
    shape.lineTo(pW, pD / 2);
    shape.absarc(0, pCY, pR, pa1, pa2, true);
    shape.closePath();
    const hole = new THREE.Path();
    const hW = W2 + .95, hD = DEP + .8;
    const hR = (hW * hW + hD * hD) / (2 * hD);
    const hCY = hR - hD / 2;
    const ha1 = Math.atan2(hD / 2 - hCY, hW), ha2 = Math.atan2(hD / 2 - hCY, -hW);
    hole.moveTo(-hW, hD / 2);
    hole.absarc(0, hCY, hR, ha2, ha1, false);
    hole.lineTo(-hW, hD / 2);
    shape.holes.push(hole);
    const geo = new THREE.ShapeGeometry(shape, 32);
    geo.rotateX(-Math.PI / 2);
    const apron = new THREE.Mesh(geo, mats.path);
    apron.position.y = .06; apron.receiveShadow = true; g.add(apron);
  }
  // 四格水面
  const spans = [[-W2, -8.15], [-6.9, -0.78], [0.78, 6.9], [8.15, W2]];
  for (const [x0, x1] of spans) {
    const s = new THREE.Shape();
    s.moveTo(x0, DEP / 2);
    s.lineTo(x1, DEP / 2);
    for (let i = 16; i >= 0; i--) {
      const x = x0 + (x1 - x0) * i / 16;
      s.lineTo(x, arcY(x));
    }
    s.closePath();
    const geo = new THREE.ShapeGeometry(s, 8);
    geo.rotateX(-Math.PI / 2);
    const w = new THREE.Mesh(geo, water);
    w.position.y = .17; w.receiveShadow = true; g.add(w);
  }
  // 三条石板步道（中轴一条略宽），北接弦边、南端伸入岸
  for (const [x, wdt] of [[0, 1.5], [-7.55, 1.25], [7.55, 1.25]]) {
    meshBox(g, mats.slab, wdt, .26, DEP + 2.4, x, .16, .25);
  }
  // 步道矮望柱与池岸石柱（实景为短方柱，无连续栏板）
  const posts = [];
  for (const [x, wdt] of [[0, 1.5], [-7.55, 1.25], [7.55, 1.25]]) {
    for (let z = -3.6; z <= 4.6; z += 2.05) {
      for (const s of [-1, 1]) posts.push(tbox(.24, .46, .24, x + s * (wdt / 2 - .1), .5, z, 0));
    }
  }
  for (let x = -14; x <= 14; x += 3.4) {
    posts.push(tbox(.26, .42, .26, x, .44, -arcY(x) + .45, 0));
  }
  const postMesh = new THREE.Mesh(mergeGeometriesSafe(posts), mats.marble);
  postMesh.castShadow = true; g.add(postMesh);
  // 北弦边绿篱
  meshBox(g, mats.grassDark, 28.4, .62, .8, 0, .34, -5.0);
  // 旗杆：按 README 中轴序列「校门→旗杆/励志石→泮池」，位于泮池南侧、校门与泮池之间
  {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.1, .16, 15, 8), mats.whiteLine);
    pole.position.set(0, 7.8, 10.2); pole.castShadow = true; g.add(pole);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, .35, 16), mats.marble);
    base.position.set(0, .18, 10.2); base.receiveShadow = true; g.add(base);
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(20, 5.6), mats.grass);
    lawn.rotation.x = -Math.PI / 2; lawn.position.set(0, .04, 10.0); lawn.receiveShadow = true; g.add(lawn);
    const flagGeo = new THREE.PlaneGeometry(4.0, 2.6, 12, 4);
    const flag = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ color: 0xc23a2e, side: THREE.DoubleSide, roughness: .8 }));
    flag.position.set(2.0, 13.3, 10.2); g.add(flag);
    ctx.flag = flag; ctx.flagGeo = flagGeo;
  }
  g.position.set(-28, 0, 90);
  group.add(g);
  return g;
}

export function makeArchBridge(mats, width, length, rise, opts = {}) {
  const g = new THREE.Group();
  const segs = 18;
  const abutH = opts.abutH === undefined ? 1.5 : opts.abutH; // 桥台高：园林小桥可压低，避免高出桥面挡路
  const deckMat = mats.slab;   // 白色石板桥面
  const stoneMat = mats.stone; // 灰色石拱
  const yTop = (t) => .32 + rise * Math.sin(Math.PI * t);
  // 桥身侧墙（带半圆拱洞的实心石墙）
  const L = length;
  const R = Math.min(2.9, L / 2 - 1.0);
  const shape = new THREE.Shape();
  shape.moveTo(-L / 2, 0);
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    shape.lineTo(-L / 2 + t * L, yTop(t) - .14);
  }
  shape.lineTo(L / 2, 0);
  shape.closePath();
  // 拱洞：默认半圆；低矮园林桥传 archH 做扁椭圆，保证拱顶不越过桥面
  const archH = opts.archH === undefined ? R : opts.archH;
  const hole = new THREE.Path();
  hole.moveTo(-R, .18);
  hole.absellipse(0, .18, R, archH, Math.PI, 0, true);
  hole.closePath();
  shape.holes.push(hole);
  const wallGeo = new THREE.ExtrudeGeometry(shape, { depth: .42, bevelEnabled: false });
  wallGeo.rotateY(Math.PI / 2);
  for (const s of [-1, 1]) {
    const wall = new THREE.Mesh(wallGeo, deckMat);
    wall.position.x = s * (width / 2) - (s > 0 ? .42 : 0);
    wall.castShadow = true; wall.receiveShadow = true; g.add(wall);
  }
  // 桥面石板
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs, t1 = (i + 1) / segs;
    const z0 = -L / 2 + t0 * L, z1 = -L / 2 + t1 * L;
    const y0 = yTop(t0), y1 = yTop(t1);
    const len = Math.hypot(z1 - z0, y1 - y0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(width - .1, .2, len + .03), deckMat);
    m.position.set(0, (y0 + y1) / 2, (z0 + z1) / 2);
    m.rotation.x = -Math.atan2(y1 - y0, z1 - z0);
    m.castShadow = true; m.receiveShadow = true; g.add(m);
    // 白石栏板（连续实心板，下沿随桥面）
    for (const s of [-1, 1]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(.17, .5, len + .04), deckMat);
      panel.position.set(s * (width / 2 - .26), (y0 + y1) / 2 + .48, (z0 + z1) / 2);
      panel.rotation.x = -Math.atan2(y1 - y0, z1 - z0);
      panel.castShadow = true; g.add(panel);
      const cope = new THREE.Mesh(new THREE.BoxGeometry(.24, .1, len + .04), deckMat);
      cope.position.set(s * (width / 2 - .26), (y0 + y1) / 2 + .77, (z0 + z1) / 2);
      cope.rotation.x = -Math.atan2(y1 - y0, z1 - z0);
      g.add(cope);
    }
  }
  // 望柱：每侧 7 根，方形短柱
  for (let k = 0; k <= 6; k++) {
    const t = k / 6;
    const z = -L / 2 + t * L;
    const y = yTop(t);
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(.26, .95, .26), deckMat);
      post.position.set(s * (width / 2 - .26), y + .32, z);
      post.castShadow = true; g.add(post);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(.34, .12, .34), deckMat);
      cap.position.set(s * (width / 2 - .26), y + .84, z);
      g.add(cap);
    }
  }
  // 拱券石圈：深灰石材，突出于桥身侧面
  for (const s of [-1, 1]) {
    const ringPts = [];
    for (let i = 0; i <= 20; i++) {
      const a = Math.PI * i / 20;
      ringPts.push(new THREE.Vector3(0, .18 + Math.sin(a) * (archH + .1), Math.cos(a) * (R + .1)));
    }
    const curve = new THREE.CatmullRomCurve3(ringPts);
    const band = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, .24, 5, false), stoneMat);
    band.position.x = s * (width / 2 + .02);
    band.castShadow = true; g.add(band);
  }
  // 桥台（园林桥可传 abut:false 省去两端凸出的长方体石块）
  if (opts.abut !== false) {
    for (const s of [-1, 1]) {
      const ab = new THREE.Mesh(new THREE.BoxGeometry(width + .6, abutH, 1.6), stoneMat);
      ab.position.set(0, abutH / 2, s * (L / 2 - .5)); ab.castShadow = true; g.add(ab);
    }
  }
  // 桥额：石质匾板，位于两侧栏板顶端中央
  for (const s of [-1, 1]) {
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(.1, .55, 2.4), deckMat);
    plaque.position.set(s * (width / 2 - .28), rise + .72, 0);
    g.add(plaque);
  }
  return g;
}

// ------------------------------------------------------------------
// 梓荫山（B5）：坐标换算 worldX = X − 28，worldZ = 142 − Y
// 5 圈等高线以用户标注的椭圆为初值，圈间做平滑插值（等效样条）；整体北移 3m 避让田径场
const HILL_CONTOURS = [
  { x: 90, z: -36.0, a: 42, b: 16, e: 0 },
  { x: 94, z: -38.0, a: 34, b: 14, e: 2 },
  { x: 98, z: -39.0, a: 27, b: 12, e: 4 },
  { x: 102, z: -40.5, a: 19, b: 10, e: 6 },
  { x: 111, z: -39.0, a: 10, b: 8, e: 8 },
];
const HILL_PEAK = { x: 113, z: -48.5, e: 9.1 };
const HILL_CX = 90, HILL_CZ = -37;
// B 红木楼梯：三段 60° 陡梯 + 短平台；自纪念堂前庭西缘起坡，沿西坡爬到高台西侧灰白平台的北沿
// flight=true 的段严格按 60° 布置（每段水平投影 = 高差 / tan60°）
export const STAIR_B = [
  { p: [93.5, -53.6], y: 1.04 },
  { p: [93.9, -52.35], y: 1.50 },
  { p: [93.9, -51.14], y: 3.60, flight: true },   // F1 60°（贴纪念堂西侧上行，避开台基）
  { p: [93.9, -50.75], y: 3.60 },
  { p: [93.9, -48.55], y: 4.05 },
  { p: [94.15, -47.37], y: 6.15, flight: true },  // F2 60°
  { p: [94.6, -47.0], y: 6.15 },
  { p: [96.4, -44.2], y: 6.55 },
  { p: [96.6, -43.57], y: 7.70, flight: true },   // F3 60°
  { p: [97.3, -42.8], y: 7.70 },
  { p: [98.2, -42.1], y: 7.70 },
  { p: [98.5, -41.35], y: 7.70 },
];

// A 缓坡步道分段：石板缓坡与两处短石阶交替（stepped 段用块石踏步，其余铺石板）
// 高度取修缓后的山体；尾端截到西坡 (87.1,-34.6)，山脚不铺石阶/石板
export const A_WALK = [
  { stepped: false, pts: [[87.1, -34.6], [88.2, -36.2], [89.4, -38.0], [90.4, -38.9], [91.6, -39.5]], ys: [6.00, 6.06, 6.21, 6.33, 6.44] },
  { stepped: true, stepRun: .4, pts: [[91.6, -39.5], [92.8, -39.65]], ys: [6.44, 6.85] },
  { stepped: false, pts: [[92.8, -39.65], [94.4, -39.6]], ys: [6.85, 7.00] },
  { stepped: true, stepRun: .4, pts: [[94.4, -39.6], [95.4, -39.0]], ys: [7.00, 7.40] },
  { stepped: false, pts: [[95.4, -39.0], [96.45, -38.35]], ys: [7.40, 7.58] },
];

// A 线西段（2026-10-25 按用户标注新辟）：西坡脚 (56.65,-43.83) → 古炮南侧 → 碑亭南侧
// → A 线起点 (75,-48) → 西坡陡段石阶 → (87.1,-34.6) 接 A_WALK。
// 清树带只有 2m，铺装取 1.6m（半宽 .8），避免碰两侧保留乔木；下段爬坡与陡段做石阶，其余石板。
// 碑亭实体（x67.6~72.4, z-48.9~-44.1）与两门古炮基座均在路北侧，路线从其南侧绕行。
export const A_WEST = [
  { stepped: true, stepRun: .4, stepW: 1.6, pts: [[56.65, -43.83], [57.8, -43.75], [59.0, -43.63], [60.2, -43.52], [61.4, -43.5]], ys: [.38, .70, 1.11, 1.52, 1.84] },
  { stepped: false, w: .8, pts: [[61.4, -43.5], [62.5, -43.55], [63.6, -43.32], [64.7, -43.15], [65.8, -43.05], [66.9, -42.98], [68.2, -42.92], [69.6, -42.92], [71.0, -42.96], [72.4, -43.08], [73.4, -43.3], [73.85, -44.3], [74.3, -45.4], [74.7, -46.5], [74.95, -47.4], [75.0, -48.0]], ys: [1.84, 2.00, 2.06, 2.18, 2.33, 2.48, 2.58, 2.64, 2.66, 2.64, 2.60, 2.63, 2.67, 2.70, 2.72, 2.73] },
  { stepped: true, stepRun: .4, stepW: 1.6, pts: [[75.0, -48.0], [75.5, -47.2], [76.0, -46.4], [76.5, -45.7], [77.0, -45.0], [77.5, -44.25], [78.0, -43.5], [78.5, -42.75], [79.0, -42.0]], ys: [2.73, 3.04, 3.35, 3.63, 3.92, 4.22, 4.51, 4.81, 5.11] },
  { stepped: false, w: .8, pts: [[79.0, -42.0], [80.2, -40.55], [81.5, -39.1], [83.0, -37.0], [85.0, -35.9], [87.1, -34.6]], ys: [5.11, 5.40, 5.70, 5.88, 6.00, 6.00] },
];

// 路网（世界坐标）：A 北线 / B 红木楼梯（自建结构） / C 梓荫阁下山块石台阶 / D 南线 / F 环山外线
export const HILL_ROADS = [
  // A：西坡 (87.1,-34.6) 起沿西坡缓上，全长约 13m、落差 1.6m；两处短石阶（各 3 级）其余石板缓坡，末端 7.58 接看台西沿。
  // 山脚段为 A0（A_WEST），在 (87.1,-34.6) 与本体对接；切坡整条折线一次登记，避免分段 blend 叠加把缓坡抬成陡坎。
  { id: 'A', custom: true, w: 1.2, blend: 1.8, pts: A_WALK.flatMap((s, i) => (i ? s.pts.slice(1) : s.pts)), ys: A_WALK.flatMap((s, i) => (i ? s.ys.slice(1) : s.ys)) },
  // A0：A 线西段窄步道（1.6m）。trail=true：切坡仍参与地形与露岩避让，但不按大路 4.2m 树冠净距清树，
  // 保留清树带两侧原乔木（用户 2026-10-25 只要求删连线南侧 2m 内）
  { id: 'A0', custom: true, trail: true, w: 1.0, blend: 1.6, pts: A_WEST.flatMap((s, i) => (i ? s.pts.slice(1) : s.pts)), ys: A_WEST.flatMap((s, i) => (i ? s.ys.slice(1) : s.ys)) },
  { id: 'B', custom: true, w: 1.7, blend: 1.5, pts: STAIR_B.map((s) => s.p), ys: STAIR_B.map((s) => s.y) },
  { id: 'C', wood: false, stepped: true, w: 1.25, blend: 2.6, pts: [[117.6, -33.6], [118, -32], [126, -25], [132, -20]], ys: [7.95, 7.4, 3.4, .15] },
  { id: 'D', wood: false, w: 1.15, blend: 2.8, pts: [[132, -20], [113, -18], [97, -23], [82, -25], [67, -22], [52, -16], [43, -18], [41, -30], [39, -44]], ys: [.15, .15, .15, .15, .15, .15, .15, .15, .15] },
  // F 环山外线：富的廊东端 → 红线南侧北段 → 外圈等高线以东 5m → J
  { id: 'F', wood: false, w: 1.2, blend: 2.8, pts: [[98, -60], [108, -58], [123, -58], [136, -57], [137, -44], [135, -32], [132, -20]], ys: [.15, .15, .15, .15, .2, .2, .15] },
];
// 高台西侧灰白看台（低 0.3m）：台地压到板底以下，防止草地穿出台面
const DECK_PAD = { x: 98.7, z: -38.7, hx: 2.1, hz: 2.5, e: 7.35, blend: 1.0 };
// 台地：山巅高台 / 吴公碑亭 / 石刻石台
const HILL_PADS = [
  // 高台台地内缩，前沿（南）与东侧让出挡墙；外侧再用两块切坡台地把墙脚降到 4.5~4.7m
  { x: 108.6, z: -42.6, hx: 8.6, hz: 5.8, e: 7.62, blend: 2.8 },
  { x: 106.9, z: -32.6, hx: 8.9, hz: 1.5, e: 4.7, blend: 2.4 },  // 前沿外侧：挡墙露出 3~4m（东端让开 C 梯）
  { x: 120.6, z: -42.4, hx: 1.2, hz: 6.4, e: 4.5, blend: 1.8 },  // 东侧外侧
  { x: 70, z: -46.5, hx: 3.2, hz: 3.2, e: 2.55, blend: 1.8 },
  // 石刻台地：东坡脚，岩体与前侧石台同处一个平台
  { x: 127.2, z: -35.6, hx: 2.6, hz: 4.2, e: 2.9, blend: 2.0 },
  DECK_PAD,
];
const smooth01 = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

function nearestRoad(road, x, z) {
  let best = { d: Infinity, y: 0 };
  for (let i = 0; i < road.pts.length - 1; i++) {
    const [x0, z0] = road.pts[i], [x1, z1] = road.pts[i + 1];
    const dx = x1 - x0, dz = z1 - z0;
    const l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / l2));
    const d = Math.hypot(x - (x0 + dx * t), z - (z0 + dz * t));
    if (d < best.d) best = { d, y: road.ys[i] + (road.ys[i + 1] - road.ys[i]) * t };
  }
  return best;
}

/** 到梓荫山路网的最小净距（已扣路宽），供植被避让；trail:false 时忽略 A0 一类窄步道 */
export function hillRoadClearance(x, z, { trail = true } = {}) {
  let best = Infinity;
  for (const r of HILL_ROADS) {
    if (!trail && r.trail) continue;
    best = Math.min(best, nearestRoad(r, x, z).d - r.w);
  }
  return best;
}

function contourHeight(x, z) {
  // 取“最内圈”包含该点的等高线，再向紧邻的外一圈连续插值。
  // 从最外圈起算会在椭圆边界切换插值对、形成 3~4m 突坎；最内圈起算两侧端点一致（t→0/1 同高程），全山连续。
  let ci = -1, cq = 0;
  for (let i = 0; i < HILL_CONTOURS.length; i++) {
    const c = HILL_CONTOURS[i];
    const q = Math.hypot((x - c.x) / c.a, (z - c.z) / c.b);
    if (q < 1) { ci = i; cq = q; }
  }
  if (ci < 0) return 0;
  const c = HILL_CONTOURS[ci];
  if (ci === HILL_CONTOURS.length - 1) return c.e + (HILL_PEAK.e - c.e) * smooth01(1 - cq);
  const n = HILL_CONTOURS[ci + 1];
  const qn = Math.hypot((x - n.x) / n.a, (z - n.z) / n.b);
  const t = (1 - cq) / (1 - cq + Math.max(0, qn - 1));
  return c.e + (n.e - c.e) * smooth01(t);
}

/** 世界坐标地形高程：等高线插值 → 建筑台地 → 道路切坡（路必须最后切，否则台地过渡带会把楼梯埋掉） */
export function hillHeightAt(x, z) {
  let h = contourHeight(x, z);
  for (const p of HILL_PADS) {
    const dx = Math.max(0, Math.abs(x - p.x) - p.hx), dz = Math.max(0, Math.abs(z - p.z) - p.hz);
    const d = Math.hypot(dx, dz);
    if (d >= p.blend) continue;
    const t = d <= 0 ? 1 : 1 - smooth01(d / p.blend);
    h = h * (1 - t) + p.e * t;
  }
  for (const r of HILL_ROADS) {
    const n = nearestRoad(r, x, z);
    const outer = r.w + r.blend;
    if (n.d <= r.w) { h = n.y; continue; }
    const t = 1 - smooth01((n.d - r.w) / (outer - r.w));
    h = h * (1 - t) + n.y * t;
  }
  // 看台再压一次：A/B 路切坡的端点会把台面下的地形抬到 7.7，须整体压回板底（边缘由台座遮住），
  // 且不能向外混合，否则会在梯口前形成凹坑、制造 >0.35m 落差
  if (Math.abs(x - DECK_PAD.x) <= DECK_PAD.hx + .25 && Math.abs(z - DECK_PAD.z) <= DECK_PAD.hz + .25) {
    h = DECK_PAD.e;
  }
  return h;
}

export function buildZiyinHill(ctx) {
  const { group, mats } = ctx;
  const W = 90, D = 36;
  const geo = new THREE.PlaneGeometry(W, D, 150, 60);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = [];
  const col = new THREE.Color();
  const rnd = mulberry32(21);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + HILL_CX, z = pos.getZ(i) + HILL_CZ;
    const y = hillHeightAt(x, z);
    pos.setY(i, y);
    const slope = Math.min(1, y / 10);
    col.setHSL(.23 + rnd() * .05, .20 + slope * .10, .34 + slope * .10 + rnd() * .03);
    if (y > 8.2 && rnd() < .25) col.setHSL(.11, .08, .38);
    if (slope > .55 && rnd() < .10) col.setHSL(.07, .22, .34);
    colors.push(col.r, col.g, col.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const hillTex = mats.stoneTex.clone();
  hillTex.needsUpdate = true; hillTex.wrapS = hillTex.wrapT = THREE.RepeatWrapping; hillTex.repeat.set(12, 5);
  const hillMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .98, map: hillTex, color: 0xa8b09a });
  const hill = new THREE.Mesh(geo, hillMat);
  hill.position.set(HILL_CX, .02, HILL_CZ);
  hill.castShadow = true; hill.receiveShadow = true;
  group.add(hill);
  // 露岩
  const rockGeos = [];
  for (let i = 0; i < 26; i++) {
    const x = HILL_CX + (rnd() - .5) * 82, z = HILL_CZ + (rnd() - .5) * 32;
    const y = hillHeightAt(x, z);
    if (y < 1.2) continue;
    if (x > 97 && x < 124 && z > -37 && z < -26) continue;   // 高台前沿切坡
    if (x > 118 && x < 132 && z > -50 && z < -29) continue;  // 高台东侧切坡与石刻石台
    if (hillRoadClearance(x, z) < 1.8) continue;             // 让开石板路与楼梯
    const s = .5 + rnd() * 1.3;
    const rock = new THREE.DodecahedronGeometry(s, 0);
    rock.scale(.9 + rnd() * .6, .55 + rnd() * .5, .8 + rnd() * .7);
    rock.rotateY(rnd() * 6.28); rock.rotateX(rnd() * .4);
    rock.translate(x, y + s * .15, z);
    rockGeos.push(rock);
  }
  // 剔除压在看台/平台西沿接口上的露岩（挡路并穿模）
  const rockGeosKept = rockGeos.filter((rock) => {
    rock.computeBoundingBox();
    const b = rock.boundingBox;
    return !(b.max.x > 95.5 && b.min.x < 103.5 && b.max.z > -43 && b.min.z < -34.5 && b.max.y > 7.3);
  });
  if (rockGeosKept.length) {
    const rocks = addMerged(group, rockGeosKept, mats.rock);
    if (rocks) { rocks.castShadow = true; rocks.receiveShadow = true; }
  }
  return { group: hill, heightAt: hillHeightAt, W, D, H: 10 };
}

/** 沿折线采样路面中线（含高度），供连续石板带使用 */
function roadSamples(r) {
  const out = [];
  let acc = 0;
  for (let i = 0; i < r.pts.length - 1; i++) {
    const [x0, z0] = r.pts[i], [x1, z1] = r.pts[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(2, Math.ceil(len / .55));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      const cy = r.ys[i] + (r.ys[i + 1] - r.ys[i]) * t;
      const y = Math.max(cy, hillHeightAt(x, z));
      const last = out[out.length - 1];
      if (last && Math.hypot(last.x - x, last.z - z) < .08) continue;
      out.push({ x, z, y, v: acc + len * t });
    }
    acc += len;
  }
  const [lx, lz] = r.pts[r.pts.length - 1];
  out.push({ x: lx, z: lz, y: Math.max(r.ys[r.ys.length - 1], hillHeightAt(lx, lz)), v: acc });
  return out;
}

// 折线用 Catmull-Rom 圆滑后再铺石带：直接铺折线时，转角内侧的边会自相交，石板带出现缺口
function smoothTrail(pts, ys, step = .35) {
  const outP = [], outY = [], n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    const y0 = ys[Math.max(0, i - 1)], y1 = ys[i], y2 = ys[i + 1], y3 = ys[Math.min(n - 1, i + 2)];
    const m = Math.max(2, Math.round(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = i === 0 ? 0 : 1; k <= m; k++) {
      const t = k / m, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => .5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      outP.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      outY.push(f(y0, y1, y2, y3));
    }
  }
  return { pts: outP, ys: outY };
}

function stoneRibbon(r) {
  const S = roadSamples(r);
  const pos = [], uv = [], idx = [];
  const w = r.w;
  const lift = r.lift || .02;
  const edges = [];
  for (let i = 0; i < S.length; i++) {
    const p = S[i];
    const a = S[Math.max(0, i - 1)], b = S[Math.min(S.length - 1, i + 1)];
    let tx = b.x - a.x, tz = b.z - a.z;
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl; tz /= tl;
    const nx = tz, nz = -tx;
    edges.push({ tx, tz, nx, nz, y: p.y + lift, v: p.v });
    pos.push(p.x + nx * w, p.y + lift, p.z + nz * w);   // L
    pos.push(p.x - nx * w, p.y + lift, p.z - nz * w);   // R
    uv.push(0, p.v / 2.5, 1, p.v / 2.5);
  }
  for (let i = 0; i < S.length - 1; i++) {
    const l0 = i * 2, r0 = i * 2 + 1, l1 = (i + 1) * 2, r1 = (i + 1) * 2 + 1;
    idx.push(l0, r0, l1, r0, r1, l1);
  }
  // 两侧裙边：顶边贴路面，底边压到地形之下
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let i = 0; i < S.length; i++) {
      const p = S[i], e = edges[i];
      const ex = p.x + e.nx * w * side, ez = p.z + e.nz * w * side;
      const gy = Math.min(hillHeightAt(ex, ez), p.y) - .35;
      pos.push(ex, p.y + lift, ez);   // top
      pos.push(ex, gy, ez);          // bottom
      uv.push(side > 0 ? 0 : 1, p.v / 2.5, side > 0 ? 0 : 1, p.v / 2.5);
    }
    for (let i = 0; i < S.length - 1; i++) {
      const t0 = base + i * 2, b0 = t0 + 1, t1 = base + (i + 1) * 2, b1 = t1 + 1;
      // 法线朝外：L 侧 (t0,t1,b0)(t1,b1,b0)；R 侧反向
      if (side > 0) idx.push(t0, t1, b0, t1, b1, b0);
      else idx.push(t0, b0, t1, t1, b0, b1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** 石板路/块石台阶/红木楼梯铺装 + 坡脚块石挡墙 + 转折处矮石阶 */
export function buildHillRoads(ctx) {
  const { group, mats } = ctx;
  const stoneGeos = [], slabGeos = [], stepGeos = [], woodGeos = [], wallGeos = [];
  for (const r of HILL_ROADS) {
    if (r.custom) continue;
    if (r.stepped) {
      // 块石台阶：按路径中线逐级下踏步，踏面水平、外侧见踢面
      for (let i = 0; i < r.pts.length - 1; i++) {
        const [x0, z0] = r.pts[i], [x1, z1] = r.pts[i + 1];
        const len = Math.hypot(x1 - x0, z1 - z0);
        const n = Math.max(2, Math.round(len / (r.stepRun || .46)));
        const ry = Math.atan2(x1 - x0, z1 - z0);
        for (let k = 0; k < n; k++) {
          const t = (k + .5) / n;
          const mx = x0 + (x1 - x0) * t, mz = z0 + (z1 - z0) * t;
          const my = r.ys[i] + (r.ys[i + 1] - r.ys[i]) * t;
          stepGeos.push(tbox(r.w * 2, .3, len / n + .05, mx, my, mz, ry));
        }
      }
    } else if (!r.wood) { (r.slab ? slabGeos : stoneGeos).push(stoneRibbon(r)); }
    else {
      for (let i = 0; i < r.pts.length - 1; i++) {
        const [x0, z0] = r.pts[i], [x1, z1] = r.pts[i + 1];
        const len = Math.hypot(x1 - x0, z1 - z0);
        const n = Math.max(2, Math.ceil(len / .36));
        const ry = Math.atan2(x1 - x0, z1 - z0);
        for (let k = 0; k < n; k++) {
          const t = (k + .5) / n;
          const mx = x0 + (x1 - x0) * t, mz = z0 + (z1 - z0) * t;
          const sy = r.ys[i] + (r.ys[i + 1] - r.ys[i]) * (k + .5) / n;
          // 逐级踏步：踏面水平、外侧留出踢面高度
          const y = Math.max(sy, hillHeightAt(mx, mz));
          woodGeos.push(tbox(r.w * 2, .26, len / n + .06, mx, y + .05, mz, ry));
          woodGeos.push(tbox(r.w * 2, .3, .07, mx, y - .12, mz, ry));
        }
      }
    }
    for (let i = 0; i < r.pts.length - 1; i++) {
      const [x0, z0] = r.pts[i], [x1, z1] = r.pts[i + 1];
      const len = Math.hypot(x1 - x0, z1 - z0);
      const ry = Math.atan2(x1 - x0, z1 - z0);
      // 上坡一侧块石挡墙
      const nx = (z1 - z0) / len, nz = -(x1 - x0) / len;
      const side = contourHeight((x0 + x1) / 2 + nx * 4, (z0 + z1) / 2 + nz * 4)
        > contourHeight((x0 + x1) / 2 - nx * 4, (z0 + z1) / 2 - nz * 4) ? 1 : -1;
      const subs = Math.max(2, Math.ceil(len / 2));
      const hs = [];
      for (let k = 0; k < subs; k++) {
        const t = (k + .5) / subs;
        const px = x0 + (x1 - x0) * t + nx * side * (r.w + .42);
        const pz = z0 + (z1 - z0) * t + nz * side * (r.w + .42);
        const roadY = r.ys[i] + (r.ys[i + 1] - r.ys[i]) * t;
        hs.push(Math.min(2.2, Math.max(0, contourHeight(px, pz) - roadY)));
      }
      // 高度沿路平滑，避免相邻块高低突变形成锯齿状突块
      const sm = hs.map((v, k) => (hs[Math.max(0, k - 1)] + v * 2 + hs[Math.min(hs.length - 1, k + 1)]) / 4);
      for (let k = 0; k < subs; k++) {
        const t = (k + .5) / subs;
        const px = x0 + (x1 - x0) * t + nx * side * (r.w + .42);
        const pz = z0 + (z1 - z0) * t + nz * side * (r.w + .42);
        const roadY = r.ys[i] + (r.ys[i + 1] - r.ys[i]) * t;
        const hw = sm[k];
        if (hw >= .3) wallGeos.push(tbox(.55, hw, len / subs + .3, px, roadY + hw / 2, pz, ry));
      }
    }
  }
  // A 线铺装：西段（A_WEST，新辟窄道）与本体（A_WALK）同法；段可带 w（石板半宽）/ stepW（石阶宽）
  for (const seg of [...A_WEST, ...A_WALK]) {
    if (seg.stepped) {
      for (let i = 0; i < seg.pts.length - 1; i++) {
        const [x0, z0] = seg.pts[i], [x1, z1] = seg.pts[i + 1];
        const len = Math.hypot(x1 - x0, z1 - z0);
        const n = Math.max(2, Math.round(len / seg.stepRun));
        const ry = Math.atan2(x1 - x0, z1 - z0);
        for (let k = 0; k < n; k++) {
          const t = (k + .5) / n;
          const mx = x0 + (x1 - x0) * t, mz = z0 + (z1 - z0) * t;
          const my = seg.ys[i] + (seg.ys[i + 1] - seg.ys[i]) * t;
          // 踏步箱体向下加深 0.16：顶面仍为路面 +0.15，底面埋入切坡，避免下坡侧底棱悬空成锯齿
          stepGeos.push(tbox(seg.stepW || 2.2, .46, len / n + .05, mx, my - .08, mz, ry));
        }
      }
    } else {
      const sm = smoothTrail(seg.pts, seg.ys);
      slabGeos.push(stoneRibbon({ pts: sm.pts, ys: sm.ys, w: seg.w || 1.0, lift: .1 }));
    }
  }
  // 石板与石阶转角（A_WEST 折返点 (75,-48) 端面差约 117°；A_WEST 接 A_WALK 处约 90°）各压一块转角石台补齐缺口。
  // 台面比石带高 2cm 避免共面闪烁，底边埋入地形。
  for (const [ax, bx] of [[A_WEST[1], A_WEST[2]], [A_WEST[A_WEST.length - 1], A_WALK[0]]]) {
    if (!ax || !bx) continue;
    const [jx, jz] = ax.pts[ax.pts.length - 1], jy = ax.ys[ax.ys.length - 1];
    const [nx, nz] = bx.pts[1];
    slabGeos.push(tbox(1.8, .14, 1.8, jx, jy + .05, jz, Math.atan2(nx - jx, nz - jz)));
  }
  const stone = new THREE.Mesh(mergeGeometriesSafe(stoneGeos), mats.roadStone);
  stone.receiveShadow = true; stone.castShadow = true;
  group.add(stone);
  if (slabGeos.length) {
    const slabs = new THREE.Mesh(mergeGeometriesSafe(slabGeos), mats.pathStone);
    slabs.receiveShadow = true; slabs.castShadow = true;
    group.add(slabs);
  }
  if (stepGeos.length) {
    const steps = new THREE.Mesh(mergeGeometriesSafe(stepGeos), mats.stone);
    steps.receiveShadow = true; steps.castShadow = true;
    group.add(steps);
  }
  const wood = new THREE.Mesh(mergeGeometriesSafe(woodGeos), mats.woodDark);
  wood.receiveShadow = true; wood.castShadow = true;
  group.add(wood);
  const walls = new THREE.Mesh(mergeGeometriesSafe(wallGeos), mats.stoneDark);
  walls.receiveShadow = true; walls.castShadow = true;
  group.add(walls);
}

/** 直跑楼梯：实心踏步 + 木/石栏杆；railSides 控制做几侧栏杆 */
function stairRun(parent, mat, railMat, [x0, z0, y0], [x1, z1, y1], width, { railSides = [1, -1], postGap = 1.1, railH = .95, postW = .08, railW = .09 } = {}) {
  const dx = x1 - x0, dz = z1 - z0;
  const run = Math.hypot(dx, dz);
  const rise = y1 - y0;
  const ry = Math.atan2(dx, dz);
  const n = Math.max(2, Math.round(Math.abs(rise) / .17));
  const sd = run / n, sh = rise / n;
  const geos = [];
  for (let i = 0; i < n; i++) {
    const t = (i + .5) / n;
    const top = y0 + sh * (i + 1) + .03;
    const h = Math.max(.2, top - (y0 - .55));
    geos.push(tbox(width, h, sd + .02, x0 + dx * t, top - h / 2, z0 + dz * t, ry));
  }
  addMerged(parent, geos, mat);
  if (!railMat) return;
  const nx = Math.cos(ry), nz = -Math.sin(ry);
  for (const s of railSides) {
    const off = s * (width / 2 - .08);
    const posts = [];
    const nPost = Math.max(2, Math.round(run / postGap));
    for (let i = 0; i <= nPost; i++) {
      const t = i / nPost;
      const ty = y0 + rise * t + .03;
      posts.push(tbox(postW, railH, postW, x0 + dx * t + nx * off, ty + railH / 2, z0 + dz * t + nz * off, ry));
    }
    addMerged(parent, posts, railMat);
    // 连续扶手（斜置）
    const holder = new THREE.Group();
    const slope = Math.hypot(run, rise);
    for (const yy of [railH, railH * .55]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(railW, railW, slope + .1), railMat);
      bar.rotation.x = -Math.atan2(rise, run);
      bar.position.y = yy;
      bar.castShadow = true;
      holder.add(bar);
    }
    holder.rotation.y = ry;
    holder.position.set(x0 + dx / 2 + nx * off, (y0 + y1) / 2 + .03, z0 + dz / 2 + nz * off);
    parent.add(holder);
  }
}

/** 木栈道/木平台：顺坡铺板 + 板缝压条 + 立柱斜扶手（用于 60° 梯之间的缓坡段） */
function woodWalk(parent, mat, railMat, [x0, z0, y0], [x1, z1, y1], width, { railSides = [1, -1], railH = .95, postGap = 1.0 } = {}) {
  const dx = x1 - x0, dz = z1 - z0;
  const run = Math.hypot(dx, dz);
  if (run < .01) return;
  const rise = y1 - y0;
  const ry = Math.atan2(dx, dz);
  const nx = Math.cos(ry), nz = -Math.sin(ry);
  const n = Math.max(1, Math.round(run / .42));
  const geos = [];
  for (let i = 0; i < n; i++) {
    const t = (i + .5) / n;
    const mx = x0 + dx * t, mz = z0 + dz * t;
    const y = y0 + rise * t;
    geos.push(tbox(width, .18, run / n + .05, mx, y - .02, mz, ry));
    geos.push(tbox(width + .04, .1, .07, mx, y - .05, mz, ry));  // 板侧封边
  }
  // 两侧纵梁（斜置）
  const slope = Math.hypot(run, rise);
  const holder = new THREE.Group();
  for (const s of [-1, 1]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(.12, .26, slope + .1), mat);
    beam.rotation.x = -Math.atan2(rise, run);
    beam.position.set(s * (width / 2 - .06), -.02, 0);
    beam.castShadow = true; beam.receiveShadow = true;
    holder.add(beam);
  }
  holder.rotation.y = ry;
  holder.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  parent.add(holder);
  addMerged(parent, geos, mat);
  if (!railMat) return;
  for (const s of railSides) {
    const off = s * (width / 2 - .08);
    const posts = [];
    const nPost = Math.max(2, Math.round(run / postGap));
    for (let i = 0; i <= nPost; i++) {
      const t = i / nPost;
      const ty = y0 + rise * t + .07;
      posts.push(tbox(.08, railH, .08, x0 + dx * t + nx * off, ty + railH / 2, z0 + dz * t + nz * off, ry));
      // 立柱落到地形（坡面外侧可能低于栈道）
      const gy = hillHeightAt(x0 + dx * t + nx * off, z0 + dz * t + nz * off);
      const drop = ty - gy;
      if (drop > .5) posts.push(tbox(.1, drop, .1, x0 + dx * t + nx * off, gy + drop / 2, z0 + dz * t + nz * off, ry));
    }
    addMerged(parent, posts, railMat);
    const bar = new THREE.Group();
    for (const yy of [railH, railH * .55]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(.09, .09, slope + .1), railMat);
      b.rotation.x = -Math.atan2(rise, run);
      b.position.y = yy;
      b.castShadow = true;
      bar.add(b);
    }
    bar.rotation.y = ry;
    bar.position.set(x0 + dx / 2 + nx * off, (y0 + y1) / 2 + .07, z0 + dz / 2 + nz * off);
    parent.add(bar);
  }
}

/** 山顶高台 +8m：块石挡墙、大块石板台面、白色石栏杆、后侧垛口挡墙 */
export function buildHillPlatform(ctx) {
  const { group, mats } = ctx;
  const g = new THREE.Group();
  const X0 = 100.8, X1 = 119.2, Z0 = -48.2, Z1 = -33.8, TOP = 8.0, FOOT = 4.2;
  // 台面
  const deck = new THREE.Mesh(new THREE.BoxGeometry(X1 - X0 + .6, .42, Z1 - Z0 + .6), mats.slab);
  deck.position.set((X0 + X1) / 2, TOP - .21, (Z0 + Z1) / 2);
  deck.castShadow = true; deck.receiveShadow = true; g.add(deck);
  // 前沿（南）与东侧块石挡墙，压顶石（南沿整段封闭）
  const walls = [];
  const faceH = TOP - FOOT;
  walls.push(tbox(X1 - X0 + 1.0, faceH, .9, (X0 + X1) / 2, FOOT + faceH / 2, Z1 + .25, 0));
  walls.push(tbox(.9, faceH, Z1 - Z0 + .6, X1 - .25, FOOT + faceH / 2, (Z0 + Z1) / 2, 0));
  // 墙面分块砌缝（浅色勾缝块）
  for (let x = X0 + .6; x < X1 - .4; x += 1.5) {
    for (let k = 0; k < 3; k++) walls.push(tbox(1.38, .06, .06, x, FOOT + .6 + k * 1.2, Z1 + .72, 0));
  }
  for (let z = Z0 + .7; z < Z1 - .4; z += 1.5) {
    for (let k = 0; k < 3; k++) walls.push(tbox(.06, .06, 1.38, X1 + .21, FOOT + .6 + k * 1.2, z, 0));
  }
  walls.push(tbox(X1 - X0 + 1.4, .22, 1.1, (X0 + X1) / 2, TOP + .11, Z1 + .3, 0));  // 压顶
  walls.push(tbox(1.1, .22, Z1 - Z0 + .8, X1 + .2, TOP + .11, (Z0 + Z1) / 2, 0));
  addMerged(g, walls, mats.stoneDark);
  // 后侧垛口挡墙（背靠山体）
  const cren = [];
  cren.push(tbox(X1 - X0 + .8, 1.7, .7, (X0 + X1) / 2, TOP + .85, Z0 + .2, 0));
  for (let x = X0; x < X1 - .2; x += .95) cren.push(tbox(.5, .5, .7, x + .25, TOP + 1.95, Z0 + .2, 0));
  addMerged(g, cren, mats.plasterCool);
  // 新增梓荫阁前院围墙（同北墙形制：1.7m 墙身 + 0.5m 垛口）
  // 西/东沿自北墙向南至前墙，前墙中间留 4m 门洞（x 109~113）正对梓荫阁台阶
  const cren2 = [];
  cren2.push(tbox(.7, 1.7, 8.8, 101.0, TOP + .85, -44.0, 0));
  for (let z = -48.0; z <= -40.2; z += .95) cren2.push(tbox(.7, .5, .5, 101.0, TOP + 1.95, z + .25, 0));
  cren2.push(tbox(.7, 1.7, 8.8, 119.0, TOP + .85, -44.0, 0));
  for (let z = -48.0; z <= -40.2; z += .95) cren2.push(tbox(.7, .5, .5, 119.0, TOP + 1.95, z + .25, 0));
  cren2.push(tbox(8.0, 1.7, .7, 105.0, TOP + .85, -40.0, 0));
  for (let x = 101.0; x <= 108.75; x += .95) cren2.push(tbox(.5, .5, .7, x + .25, TOP + 1.95, -40.0, 0));
  cren2.push(tbox(6.0, 1.7, .7, 116.0, TOP + .85, -40.0, 0));
  for (let x = 113.0; x <= 118.75; x += .95) cren2.push(tbox(.5, .5, .7, x + .25, TOP + 1.95, -40.0, 0));
  addMerged(g, cren2, mats.plasterCool);
  // 白色石栏杆：方形望柱 + 栏板，南沿与东沿（楼梯口留缺口）
  const posts = [], panels = [];
  const railH = 1.02, pw = .26;
  const gapS = (x) => x > 115.9 && x < 119.2; // 仅 C 梯口
  for (let x = X0 + .3; x <= X1 - .2; x += 1.55) {
    if (gapS(x)) continue;
    posts.push(tbox(pw, railH, pw, x, TOP + railH / 2, Z1 - .12, 0));
  }
  for (let z = Z0 + .5; z <= Z1 - .2; z += 1.55) {
    posts.push(tbox(pw, railH, pw, X1 - .12, TOP + railH / 2, z, 0));
  }
  for (let x = X0 + 1.06; x <= X1 - .9; x += 1.55) {
    if (gapS(x)) continue;
    panels.push(tbox(1.24, .52, .1, x, TOP + .56, Z1 - .12, 0));
  }
  for (let z = Z0 + 1.26; z <= Z1 - .9; z += 1.55) {
    panels.push(tbox(.1, .52, 1.24, X1 - .12, TOP + .56, z, 0));
  }
  // 西沿：灰白看台（z −41.2 ~ −36.2）整段敞开，看台南北两侧仍设白栏杆
  for (let z = Z0 + .5; z <= -41.4; z += 1.55) {
    posts.push(tbox(pw, railH, pw, X0 + .12, TOP + railH / 2, z, 0));
  }
  for (let z = Z0 + 1.26; z <= -41.6; z += 1.55) {
    panels.push(tbox(.1, .52, 1.24, X0 + .12, TOP + .56, z, 0));
  }
  for (let z = -36.4; z <= Z1 - .2; z += 1.55) {
    posts.push(tbox(pw, railH, pw, X0 + .12, TOP + railH / 2, z, 0));
  }
  for (let z = -36.0; z <= Z1 - .9; z += 1.55) {
    panels.push(tbox(.1, .52, 1.24, X0 + .12, TOP + .56, z, 0));
  }
  addMerged(g, posts.concat(panels), mats.slab);
  // ---- 西侧灰白看台（比台面低 0.3m，东边与高台对接）----
  const WX0 = 96.6, WX1 = 100.8, WZ0 = -41.2, WZ1 = -36.2, WTOP = 7.7;
  const wdeck = new THREE.Mesh(new THREE.BoxGeometry(WX1 - WX0 + .5, .42, WZ1 - WZ0 + .5), mats.marble);
  wdeck.position.set((WX0 + WX1) / 2, WTOP - .21, (WZ0 + WZ1) / 2);
  wdeck.castShadow = true; wdeck.receiveShadow = true; g.add(wdeck);
  // 台座（挡土）
  const wbase = new THREE.Mesh(new THREE.BoxGeometry(WX1 - WX0 + .5, 3.3, WZ1 - WZ0 + .5), mats.stoneDark);
  wbase.position.set((WX0 + WX1) / 2, WTOP - .42 - 1.65, (WZ0 + WZ1) / 2);
  wbase.castShadow = true; wbase.receiveShadow = true; g.add(wbase);
  // 看台白栏杆：南沿整段；北沿留 B 口 x 97.3~99.7；西沿留 A2 口 z −39.6~−37.1（梯口两侧立望柱收口）
  const wPosts = [], wPanels = [];
  const wph = .92;
  const wpost = (x, z) => wPosts.push(tbox(.24, wph, .24, x, WTOP + wph / 2, z, 0));
  const wpanel = (x, z, w, d) => wPanels.push(tbox(w, .48, d, x, WTOP + .5, z, 0));
  for (const x of [96.8, 97.3, 99.7, 100.7]) wpost(x, WZ0 + .12);
  for (const x of [96.8, 98.1, 99.4, 100.7]) wpost(x, WZ1 - .12);
  for (const z of [-40.95, -39.65, -37.05, -36.35]) wpost(WX0 + .12, z);
  for (const x of [97.05, 100.2]) wpanel(x, WZ0 + .12, .4, .1);
  for (const x of [97.45, 98.75, 100.05]) wpanel(x, WZ1 - .12, 1.06, .1);
  wpanel(WX0 + .12, -40.3, .1, 1.06);
  wpanel(WX0 + .12, -36.7, .1, .56);
  addMerged(g, wPosts.concat(wPanels), mats.slab);
  group.add(g);
}

/** B 红木楼梯（60° 三跑之字折梯）：前庭西缘起坡 → 三段 60° 陡梯 + 两段缓坡栈道 → 高台西南角上台 */
export function buildHillStairB(ctx) {
  const { group, mats } = ctx;
  const red = mats.redColumn;
  const g = new THREE.Group();
  const W = 2.2;
  for (let i = 0; i < STAIR_B.length - 1; i++) {
    const a = STAIR_B[i], b = STAIR_B[i + 1];
    const p0 = [a.p[0], a.p[1], a.y], p1 = [b.p[0], b.p[1], b.y];
    if (b.flight) {
      // 60° 陡梯：实心踏步 + 两侧红木扶手
      stairRun(g, red, red, p0, p1, W, { railSides: [1, -1], postGap: .7, railH: 1.0 });
    } else {
      // 缓坡段/平台：木栈道 + 扶手
      woodWalk(g, red, red, p0, p1, W, { railSides: [1, -1], postGap: .9 });
    }
  }
  group.add(g);
}


/** 零厚度平面片：二维栅栏的横杆/竖条 */
function flatBar(w, h, x, y, z, ry) {
  const g = new THREE.PlaneGeometry(w, h);
  g.rotateY(ry - Math.PI / 2);
  g.translate(x, y, z);
  return g;
}

/** 按折线生成铁栅栏，并把每段登记为不可穿越（h 为碰撞高度）
 *  flat=true 时全部构件为零厚度平面，横杆不再外凸（二维栅栏） */
function fenceMesh(ctx, pts, h = 3.1, flat = false) {
  const { group, mats } = ctx;
  const geos = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < .05) continue;
    if (ctx.fences) ctx.fences.push([[x0, z0], [x1, z1], h]);
    const ry = Math.atan2(x1 - x0, z1 - z0);
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    const bars = Math.max(2, Math.round(len / .28));
    if (flat) {
      // 横杆与竖条共面，沿法线错开 2mm 防止闪烁
      const nx = Math.cos(ry), nz = -Math.sin(ry);
      for (const y of [1.0, 2.0, 3.0]) geos.push(flatBar(len, .06, mx + nx * .002, y, mz + nz * .002, ry));
      for (let k = 0; k < bars; k++) {
        const t = (k + .5) / bars;
        geos.push(flatBar(.035, 3.0, x0 + (x1 - x0) * t, 1.5, z0 + (z1 - z0) * t, ry));
      }
      geos.push(flatBar(.1, h, x0 - nx * .002, h / 2, z0 - nz * .002, ry));
    } else {
      for (const y of [1.0, 2.0, 3.0]) geos.push(tbox(len, .06, .06, mx, y, mz, ry));
      for (let k = 0; k < bars; k++) {
        const t = (k + .5) / bars;
        geos.push(tbox(.035, 3.0, .035, x0 + (x1 - x0) * t, 1.5, z0 + (z1 - z0) * t, ry));
      }
      geos.push(tbox(.1, 3.1, .1, x0, 1.55, z0, ry));
    }
  }
  let mat = mats.darkMetal;
  if (flat) { mat = mats.darkMetal.clone(); mat.side = THREE.DoubleSide; }
  const mesh = new THREE.Mesh(mergeGeometriesSafe(geos), mat);
  mesh.castShadow = true; mesh.receiveShadow = true;
  group.add(mesh);
}

/** 独立铁栅栏：用于把楼端与雾墙之间的缺口补齐；flat=true 生成二维平面栅栏 */
export function buildFenceRun(ctx, pts, flat = false) {
  fenceMesh(ctx, pts, 3.1, flat);
}

export function buildHillFence(ctx) {
  // 沿 D 线（跑道北缘外 3~5m）南侧 1.4m 走，弯曲方向与道路一致，不再按跑道圆弧向内切
  const road = [[52, -16], [67, -22], [82, -25], [97, -23], [113, -18], [124, -20]];
  const pts = [];
  for (let i = 0; i < road.length - 1; i++) {
    const [x0, z0] = road[i], [x1, z1] = road[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / 3));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      pts.push([x0 + (x1 - x0) * t, z0 + (z1 - z0) * t + 1.4]);
    }
  }
  pts.push([road[road.length - 1][0], road[road.length - 1][1] + 1.4]);
  fenceMesh(ctx, pts, 3.1, true); // 二维平面栅栏
}

/** A 线路边细节：蓝釉大花盆、矩形灯柱、沿阶草 */
export function buildHillStreetDetails(ctx) {
  const { group, mats } = ctx;
  const potMat = new THREE.MeshStandardMaterial({ color: 0x2b4a7a, roughness: .35, metalness: .1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f5a34, roughness: .85 });
  // 花盆/灯柱按新 A/A2（山腰→西坡）外侧布置
  for (const [x, z] of [[88.4, -41.3], [91.8, -41.8], [93.4, -36.9]]) {
    const y = hillHeightAt(x, z);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(.42, .3, .78, 14), potMat);
    pot.position.set(x, y + .39, z); pot.castShadow = true; group.add(pot);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(.44, .06, 6, 16), potMat);
    collar.rotation.x = Math.PI / 2; collar.position.set(x, y + .78, z); group.add(collar);
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(.1, 1.15, 5), leafMat);
      leaf.position.set(x + Math.cos(a) * .28, y + 1.35, z + Math.sin(a) * .28);
      leaf.rotation.set(Math.cos(a) * .5, 0, -Math.sin(a) * .5);
      leaf.castShadow = true; group.add(leaf);
    }
  }
  // 矩形灯柱
  for (const [x, z] of [[88.4, -39.2], [95.6, -36.8]]) {
    const y = hillHeightAt(x, z);
    const post = new THREE.Mesh(new THREE.BoxGeometry(.3, 2.9, .2), mats.darkMetal);
    post.position.set(x, y + 1.45, z); post.castShadow = true; group.add(post);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(.22, 1.5, .26), mats.windowGlow.clone());
    panel.position.set(x, y + 2.2, z); panel.userData.baseEmissive = 1.6;
    group.add(panel);
    ctx.nightEmitters.push(panel);
  }
}

function makePavilion(mats, nightEmitters) {
  const g = new THREE.Group();
  const R = 3.5, colH = 4.2;
  // stone plinth
  addStonePlinth(g, mats.stone, R * 2 + 1.8, R * 2 + 1.8, .5, 0, 0);
  // 6 columns
  const cols = [];
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + Math.PI / 6;
    cols.push(tcyl(.24, .3, colH, Math.cos(a) * R, .5 + colH / 2, Math.sin(a) * R, 10));
  }
  addMerged(g, cols, mats.redColumn);
  // top beams
  const beams = [];
  for (let i = 0; i < 6; i++) {
    const a0 = i / 6 * Math.PI * 2 + Math.PI / 6, a1 = (i + 1) / 6 * Math.PI * 2 + Math.PI / 6;
    const x0 = Math.cos(a0) * R, z0 = Math.sin(a0) * R, x1 = Math.cos(a1) * R, z1 = Math.sin(a1) * R;
    const len = Math.hypot(x1 - x0, z1 - z0);
    beams.push(tbox(.2, .35, len, (x0 + x1) / 2, .5 + colH, (z0 + z1) / 2, Math.atan2(x1 - x0, z1 - z0)));
  }
  addMerged(g, beams, mats.redBeam);
  // bench
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + Math.PI / 6;
    const x = Math.cos(a) * (R - .45), z = Math.sin(a) * (R - .45);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.1, .14, .55), mats.wood);
    bench.position.set(x, 1.0, z); bench.rotation.y = -a + Math.PI / 2; g.add(bench);
  }
  // roof — two hexagonal tiers
  const roof1 = makeHexRoof(mats, R + 1.6, 1.3, 1.0);
  roof1.position.y = .5 + colH + .15; g.add(roof1);
  const roof2 = makeHexRoof(mats, R + .6, 2.6, .7);
  roof2.position.y = .5 + colH + 1.55; g.add(roof2);
  // finial
  const fin = new THREE.Mesh(new THREE.SphereGeometry(.3, 10, 8), mats.gold);
  fin.position.y = .5 + colH + 4.2; g.add(fin);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(.16, 1.4, 6), mats.gold);
  spire.position.y = .5 + colH + 5.0; g.add(spire);
  // stele inside
  const stele = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.4, .3), mats.stoneDark);
  stele.position.set(0, 1.7, 0); stele.castShadow = true; g.add(stele);
  addPlaque(g, mats, mats.plaques.wugong, 0, .5 + colH + .3, R + 1.65, { w: 2.9, h: .75 });
  // hanging lantern
  const l = addLantern(g, mats, 0, .5 + colH - .6, 0, { scale: .75, glowTex: mats.glowTex });
  nightEmitters.push(l.children[0]);
  if (l.userData.glow) { l.userData.glow.userData.nightOpacity = .4; nightEmitters.push(l.userData.glow); }
  return g;
}

function makeHexRoof(mats, R, H, lift) {
  const g = new THREE.Group();
  const segs = 6;
  const pos = [], uv = [], idx = [];
  // center apex ring: 6 triangles with a lifted eave
  for (let i = 0; i <= segs; i++) {
    const a = i / segs * Math.PI * 2 + Math.PI / 6;
    const x = Math.cos(a) * R, z = Math.sin(a) * R;
    pos.push(x, lift, z); uv.push(0, 1);
  }
  pos.push(0, H, 0); uv.push(.5, 0);
  for (let i = 0; i < segs; i++) {
    idx.push(i, i + 1, segs + 1);
  }
  // inner ring for curved slope
  const g2 = new THREE.BufferGeometry();
  g2.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g2.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g2.setIndex(idx); g2.computeVertexNormals();
  const mesh = new THREE.Mesh(g2, mats.roof);
  mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh);
  // fascia around eave
  for (let i = 0; i < segs; i++) {
    const a0 = i / segs * Math.PI * 2 + Math.PI / 6, a1 = (i + 1) / segs * Math.PI * 2 + Math.PI / 6;
    const x0 = Math.cos(a0) * R, z0 = Math.sin(a0) * R, x1 = Math.cos(a1) * R, z1 = Math.sin(a1) * R;
    const len = Math.hypot(x1 - x0, z1 - z0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(.14, .28, len), mats.ridge);
    m.position.set((x0 + x1) / 2, lift - .1, (z0 + z1) / 2);
    m.rotation.y = Math.atan2(x1 - x0, z1 - z0); g.add(m);
  }
  // hip ridges
  for (let i = 0; i < segs; i++) {
    const a = i / segs * Math.PI * 2 + Math.PI / 6;
    const x = Math.cos(a) * R, z = Math.sin(a) * R;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, H, 0), new THREE.Vector3(x * .55, lift + (H - lift) * .45, z * .55),
      new THREE.Vector3(x * 1.0, lift, z * 1.0), new THREE.Vector3(x * 1.04, lift + .35, z * 1.04)
    ]);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 8, .09, 4, false), mats.ridge);
    g.add(tube);
  }
  return g;
}

// 蛟川书院西南角小亭子（46.48/47.09：六角灰瓦亭，深色柱）
export function buildCornerPavilion(ctx) {
  const { mats } = ctx;
  const g = new THREE.Group();
  const R = 2.1, colH = 2.7;
  addStonePlinth(g, mats.stone, R * 2 + 1.4, R * 2 + 1.4, .36, 0, 0);
  const cols = [], beams = [];
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + Math.PI / 6;
    cols.push(tcyl(.14, .17, colH, Math.cos(a) * R, .36 + colH / 2, Math.sin(a) * R, 8));
    const a1 = (i + 1) / 6 * Math.PI * 2 + Math.PI / 6;
    const x0 = Math.cos(a) * R, z0 = Math.sin(a) * R, x1 = Math.cos(a1) * R, z1 = Math.sin(a1) * R;
    beams.push(tbox(.14, .26, Math.hypot(x1 - x0, z1 - z0), (x0 + x1) / 2, .36 + colH, (z0 + z1) / 2, Math.atan2(x1 - x0, z1 - z0)));
  }
  addMerged(g, cols, mats.woodDark);
  addMerged(g, beams, mats.woodDark);
  const roof = makeHexRoof(mats, R + 1.0, 1.5, .4);
  roof.position.y = .36 + colH + .08; g.add(roof);
  return g;
}

// ------------------------------------------------------------------
export function buildAcademy(ctx) {
  const { group, mats, nightEmitters, nightLights } = ctx;
  const g = new THREE.Group();
  const W = 64, D = 42;
  // compound walls
  addWall(g, mats, -W / 2, D / 2, -W / 2, -D / 2, { h: 3.0 });
  addWall(g, mats, W / 2, D / 2, W / 2, -D / 2, { h: 3.0 });
  addWall(g, mats, -W / 2, -D / 2, -4, -D / 2, { h: 3.0 });
  addWall(g, mats, 4, -D / 2, W / 2, -D / 2, { h: 3.0 });
  addWall(g, mats, -W / 2, D / 2, -5, D / 2, { h: 3.0 });
  addWall(g, mats, 5, D / 2, W / 2, D / 2, { h: 3.0 });
  // gatehouse
  const gate = new THREE.Group();
  meshBox(gate, mats.stone, 12, .3, 5.2, 0, .15, 0);
  for (const s of [-1, 1]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(2.6, 5.2, 4.2), mats.plaster);
    pier.position.set(s * 3.8, 2.6, 0); pier.castShadow = true; gate.add(pier);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(2.8, .25, 4.4), mats.stoneDark);
    cap.position.set(s * 3.8, 5.2, 0); gate.add(cap);
  }
  const gRoof = hipRoofGroup({ W: 12.5, D: 6.4, H: 2.6, tileMat: mats.roof, ridgeMat: mats.ridge, fasciaMat: mats.redDark, ridgeRatio: .42, cornerLift: .9 });
  gRoof.position.y = 5.3; gate.add(gRoof);
  addPlaque(gate, mats, mats.plaques.jiaochuan, 0, 4.4, 2.25, { w: 4.2, h: .95 });
  for (const s of [-1, 1]) {
    const l = addLantern(gate, mats, s * 3.7, 3.7, 1.9, { scale: .85, glowTex: mats.glowTex });
    nightEmitters.push(l.children[0]);
    if (l.userData.glow) { l.userData.glow.userData.nightOpacity = .35; nightEmitters.push(l.userData.glow); }
  }
  gate.position.set(0, 0, D / 2);
  g.add(gate);
  // courtyard paving
  meshBox(g, mats.path, W - 8, .12, D - 8, 0, .06, 0);
  // small reflecting basin
  const basin = new THREE.Mesh(new THREE.BoxGeometry(9, .18, 4.2), mats.water);
  basin.position.set(0, .14, 4.5); g.add(basin);
  const rim = new THREE.Mesh(new THREE.BoxGeometry(9.8, .3, 5.0), mats.stone);
  rim.position.set(0, .12, 4.5); g.add(rim);
  // main hall 2 storeys
  const hall = new THREE.Group();
  const bodyW = 30, bodyD = 15;
  const baseH = 1.0;
  const lowerH = 4.6, upperH = 3.4;
  addStonePlinth(hall, mats.stone, bodyW + 4, bodyD + 4, baseH, 0, 0);
  // lower floor walls / veranda
  meshBox(hall, mats.plaster, bodyW, lowerH, bodyD, 0, baseH + lowerH / 2, 0);
  // red columns front/back
  const colGeoms = [];
  for (let i = 0; i <= 6; i++) {
    const x = -bodyW / 2 + i * bodyW / 6;
    for (const z of [-bodyD / 2 - .4, bodyD / 2 + 1.4]) colGeoms.push(tcyl(.26, .3, lowerH, x, baseH + lowerH / 2, z, 10));
  }
  addMerged(hall, colGeoms, mats.redColumn);
  // lower lattice windows
  for (let i = 0; i < 6; i++) {
    addLatticeWall(hall, mats, 3.8, 2.9, -bodyW / 2 + (i + .5) * bodyW / 6, baseH + 2.6, bodyD / 2 + .03, { glow: true });
  }
  // upper storey set back with balcony
  const upW = bodyW - 2, upD = bodyD - 2;
  const upBase = baseH + lowerH + .35;
  meshBox(hall, mats.plaster, upW, upperH, upD, 0, upBase + upperH / 2, 0);
  for (let i = 0; i < 5; i++) {
    addLatticeWall(hall, mats, 2.9, 2.4, -upW / 2 + (i + .5) * upW / 5, upBase + 1.55, upD / 2 + .03, { glow: true });
  }
  // balcony floor and railing
  meshBox(hall, mats.wood, upW + 1.8, .22, 2.0, 0, upBase + .05, upD / 2 + 1.0);
  addBalustrade(hall, mats.redBeam, [[-upW / 2 - .8, upD / 2 + 1.9], [upW / 2 + .8, upD / 2 + 1.9]], upBase + .15, { h: .85, postEvery: 1.5, railMat: mats.redBeam });
  // lower veranda skirt roof
  const skirt = hipRoofGroup({ W: bodyW + 5.5, D: 7.5, H: 1.35, tileMat: mats.roof, ridgeMat: mats.ridge, fasciaMat: mats.redDark, ridgeRatio: .5, cornerLift: .55 });
  skirt.position.set(0, baseH + lowerH + .25, bodyD / 2 + 2.1); hall.add(skirt);
  // upper roof
  const roof = xieshanRoofGroup({ W: 34, D: 19, H: 4.6, skirtH: 2.0, gableWidth: 25, tileMat: mats.roof, ridgeMat: mats.ridge, gableMat: mats.redBeam, fasciaMat: mats.redDark, cornerLift: 1.0 });
  roof.position.y = upBase + upperH - .25; hall.add(roof);
  addPlaque(hall, mats, mats.plaques.jiaochuan, 0, upBase + 2.7, upD / 2 + .12, { w: 4.4, h: 1.0 });
  // interior light
  const li = addInteriorLight(hall, mats, 0, baseH + 3.2, 2, 16, 26);
  nightLights.push(li);
  hall.position.set(0, 0, -7.0);
  g.add(hall);
  // side wings
  for (const s of [-1, 1]) {
    const wing = new THREE.Group();
    const wW = 8, wD = 25;
    addStonePlinth(wing, mats.stone, wW + 2, wD + 2, .5, 0, 0);
    meshBox(wing, mats.plaster, wW, 4.0, wD, 0, 2.5, 0);
    const cols = [];
    for (let i = 0; i < 5; i++) cols.push(tcyl(.22, .26, 4.0, s * (wW / 2 + .4), 2.5, -wD / 2 + 2 + i * 5.2, 8));
    addMerged(wing, cols, mats.redColumn);
    for (let i = 0; i < 4; i++) {
      addLatticeWall(wing, mats, 3.8, 2.4, s * (wW / 2 + .02), 2.9, -wD / 2 + 3.8 + i * 5.2, { ry: s * Math.PI / 2, glow: true });
    }
    const wr = hipRoofGroup({ W: wW + 3.5, D: wD + 2, H: 2.4, tileMat: mats.roof, ridgeMat: mats.ridge, fasciaMat: mats.redDark, ridgeRatio: .3, cornerLift: .7 });
    wr.position.y = 4.55; wing.add(wr);
    wing.position.set(s * 27, 0, 1.5);
    g.add(wing);
  }
  // courtyard trees positions are handled by nature
  g.position.set(-89, 0, 111);
  group.add(g);
  return g;
}

function addTopiaryPine(parent, mats, x, z, s = 1) {
  const g = new THREE.Group();
  const ped = new THREE.Mesh(new THREE.BoxGeometry(.7 * s, .85 * s, .7 * s), mats.plasterCool);
  ped.position.y = .425 * s; ped.castShadow = true; ped.receiveShadow = true; g.add(ped);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.08 * s, .11 * s, .8 * s, 6), mats.woodDark);
  trunk.position.y = 1.15 * s; g.add(trunk);
  for (let i = 0; i < 3; i++) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry((.6 - i * .12) * s, .8 * s, 8), mats.grassDark);
    cone.position.y = (1.45 + i * .38) * s; cone.castShadow = true; g.add(cone);
  }
  g.position.set(x, 0, z); parent.add(g);
  return g;
}

function addBambooClump(parent, mats, x, z, n = 6) {
  const rnd = mulberry32((Math.abs(x * 131 + z * 17) | 0) + 7);
  for (let i = 0; i < n; i++) {
    const bx = x + (rnd() - .5) * 3.4, bz = z + (rnd() - .5) * 3.4;
    const h = 5.5 + rnd() * 3.2;
    const c = new THREE.Mesh(new THREE.CylinderGeometry(.05, .07, h, 5), mats.grassDark);
    c.position.set(bx, h / 2, bz); c.castShadow = true; parent.add(c);
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.0), mats.leaf);
    leaf.position.set(bx, h - .7, bz);
    leaf.rotation.y = rnd() * Math.PI; leaf.rotation.z = .3;
    parent.add(leaf);
  }
}

// ------------------------------------------------------------------
export function buildZhufeng(ctx) {
  const { group, mats, nightEmitters, nightLights } = ctx;
  const g = new THREE.Group();
  const W = 22, D = 17;
  // 憩园院落：四面白墙灰瓦院墙（局部坐标，整体缩放 1/2）
  // 南墙南扩 11.5 设计单位（5.75m），形成楼前庭院
  const CX = 14, ZN = -D / 2 - 2, ZS = 23, WH = 5.0;
  addWall(g, mats, -CX, ZN, CX, ZN, { h: WH });
  addWall(g, mats, -CX, ZS, CX, ZS, { h: WH });
  addWall(g, mats, -CX, ZN, -CX, ZS, { h: WH });
  // 东墙留出院门（z 17.5~21.5）
  addWall(g, mats, CX, ZN, CX, 17.5, { h: WH });
  addWall(g, mats, CX, 21.5, CX, ZS, { h: WH });
  // 出院门上方墙带与过梁
  meshBox(g, mats.plaster, .42, WH - 3.8, 4.0, CX, 3.8 + (WH - 3.8) / 2, 19.5);
  meshBox(g, mats.stoneDark, .7, .22, 4.4, CX, 3.72, 19.5);
  // plinth
  addStonePlinth(g, mats.stone, W + 2.5, D + 2.5, .8, 0, 0);
  // lower white base
  meshBox(g, mats.plaster, W, 1.4, D, 0, 1.5, 0);
  // red timber body, two floors
  const bodyH = 6.4;
  meshBox(g, mats.redBeam, W - .8, bodyH, D - .8, 0, 2.2 + bodyH / 2, 0);
  // red columns around
  const colGeoms = [];
  for (let i = 0; i <= 4; i++) {
    const x = -W / 2 + .6 + i * (W - 1.2) / 4;
    for (const z of [-D / 2 + .5, D / 2 - .5]) colGeoms.push(tcyl(.28, .32, bodyH, x, 2.2 + bodyH / 2, z, 10));
  }
  for (const z of [-D / 4, 0, D / 4]) for (const s of [-1, 1]) colGeoms.push(tcyl(.28, .32, bodyH, s * (W / 2 - .5), 2.2 + bodyH / 2, z, 10));
  addMerged(g, colGeoms, mats.redDark);
  // white infill lower floor
  meshBox(g, mats.plaster, W - 1.6, 3.2, D - 1.6, 0, 3.8, 0);
  // upper balcony and lattice
  const upY = 4.2;
  meshBox(g, mats.wood, W + 1.2, .2, 2.2, 0, upY, D / 2 + 1.0);
  addBalustrade(g, mats.redBeam, [[-W / 2 - .4, D / 2 + 1.9], [W / 2 + .4, D / 2 + 1.9]], upY + .1, { h: .8, postEvery: 1.4, railMat: mats.redBeam });
  for (let i = 0; i < 4; i++) {
    addLatticeWall(g, mats, 4.3, 1.9, -W / 2 + 3.0 + i * 5.3, upY + 1.2, D / 2 - .02, { glow: true });
  }
  // roof
  const roof = hipRoofGroup({ W: W + 5, D: D + 5, H: 4.2, tileMat: mats.roof, ridgeMat: mats.ridge, fasciaMat: mats.redDark, ridgeRatio: .44, cornerLift: .8 });
  roof.position.y = 8.9; g.add(roof);
  addPlaque(g, mats, mats.plaques.zhufeng, 0, 6.7, D / 2 + .45, { w: 4.9, h: .85 });
  // doorway
  latticeDoor(g, mats, 3.2, 3.6, 0, 2.9, D / 2 + .03, { open: true, glow: true });
  const li = addInteriorLight(g, mats, 0, 4.5, 2, 14, 24);
  nightLights.push(li);
  const l = addLantern(g, mats, -4.6, 6.2, D / 2 + 1.0, { scale: .9, glowTex: mats.glowTex });
  nightEmitters.push(l.children[0]);
  if (l.userData.glow) { l.userData.glow.userData.nightOpacity = .35; nightEmitters.push(l.userData.glow); }
  // ---- 憩园庭院（视频 120-159s / 210-231s） ----
  // 石板铺地
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(CX * 2 - .8, ZS - ZN - .8), mats.slab);
  yard.rotation.x = -Math.PI / 2;
  yard.position.set(0, .06, (ZN + ZS) / 2);
  yard.receiveShadow = true; g.add(yard);
  // 楼前三级石阶（台基 0.86，单步 0.287）
  addSteps(g, mats.stone, 0, 9.7, 5.0, .86, 1.2, 3);
  // 一层红漆门廊（位于二层挑台之下）
  const porchCols = [];
  for (const cx of [-3.6, -1.2, 1.2, 3.6]) {
    porchCols.push(tcyl(.22, .26, 3.34, cx, 2.53, 10.3, 10));
  }
  addMerged(g, porchCols, mats.redDark);
  meshBox(g, mats.redDark, 8.6, .26, .3, 0, 4.05, 10.3);
  // 门内“朱枫故居”石碑 + 两侧造型松
  addStele(g, mats, 0, 7.2, { w: 1.6, h: 2.7, d: .4, textMat: mats.plaques.zhufengGuju });
  addTopiaryPine(g, mats, -5.4, 9.3);
  addTopiaryPine(g, mats, 5.4, 9.3);
  // 门额下横幅
  addPlaque(g, mats, mats.plaques.yingming, 0, 7.9, D / 2 + .45, { w: 5.6, h: .55 });
  // 白色壁龛 + 半身铜像 + 鲜花
  meshBox(g, mats.plasterCool, 2.1, 3.0, .45, -6.9, 3.0, 8.2);
  const niche = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.3), mats.stoneDark);
  niche.position.set(-6.9, 3.0, 8.44); g.add(niche);
  const bustBase = new THREE.Mesh(new THREE.CylinderGeometry(.45, .55, .6, 10), mats.stone);
  bustBase.position.set(-6.9, 1.95, 8.5); g.add(bustBase);
  const shoulders = new THREE.Mesh(new THREE.BoxGeometry(.9, .5, .42), mats.bronze);
  shoulders.position.set(-6.9, 2.4, 8.5); g.add(shoulders);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.28, 10, 8), mats.bronze);
  head.position.set(-6.9, 2.85, 8.5); g.add(head);
  for (let i = 0; i < 3; i++) {
    const fl = new THREE.Mesh(new THREE.SphereGeometry(.09, 6, 5), i === 0 ? mats.lantern : mats.gold);
    fl.position.set(-6.9 + (i - 1) * .28, 1.72, 8.52); g.add(fl);
  }
  // 院内碑刻与党旗浮雕
  addStele(g, mats, -10.5, 18, { w: 1.9, h: 3.2, d: .45, textMat: mats.plaques.zhufengGuju, ry: .08 });
  addStele(g, mats, 9.5, 19.6, { w: 1.4, h: 2.4, d: .4, textMat: mats.plaques.wenbao, ry: .4 });
  addStele(g, mats, -9.5, -6.5, { w: 1.6, h: 2.4, d: .4, textMat: mats.plaques.yinglie });
  meshBox(g, mats.redBeam, .12, 2.2, 3.4, -13.72, 2.6, 4.0);
  const emblem = new THREE.Mesh(new THREE.CircleGeometry(.32, 16), mats.gold);
  emblem.position.set(-13.64, 3.05, 4.0); emblem.rotation.y = Math.PI / 2; g.add(emblem);
  // 院外墙面公告板（出院门南侧）
  addPlaque(g, mats, mats.plaques.notice, CX + .24, 2.7, 7.6, { w: 2.0, h: 2.8, ry: Math.PI / 2 });
  addPlaque(g, mats, mats.plaques.noticeRed, CX + .24, 1.0, 7.6, { w: 2.4, h: .6, ry: Math.PI / 2 });
  // 出院门：铁门扇（向外开启，贴墙柱）+ 4 个红灯笼
  for (const s of [-1, 1]) {
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.7, 3.2, .08), mats.black);
    leaf.position.set(CX + .9, 1.6, 19.5 + s * 1.95);
    leaf.castShadow = true; g.add(leaf);
  }
  for (const dz of [-1.35, -.45, .45, 1.35]) {
    const gl = addLantern(g, mats, CX + .32, 3.25, 19.5 + dz, { scale: .55, glowTex: mats.glowTex });
    nightEmitters.push(gl.children[0]);
  }
  // 石桌石凳与竹丛
  meshBox(g, mats.stoneDark, 1.0, 1.3, 1.0, 8, .65, 16.5);
  const tt = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, .18, 14), mats.stone);
  tt.position.set(8, 1.39, 16.5); tt.castShadow = true; g.add(tt);
  for (const [dx, dz] of [[1.7, 0], [-1.7, 0], [0, 1.7], [0, -1.7]]) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(.42, .46, .85, 10), mats.stone);
    st.position.set(8 + dx, .425, 16.5 + dz); g.add(st);
  }
  addBambooClump(g, mats, -11.5, 17, 6);
  addBambooClump(g, mats, 12.8, -4, 5);
  g.position.set(23, 0, 84);
  group.add(g);
  return g;
}

// 粉红木框玻璃门（BV1HnZTBNESa 0–41s）：门套 + 两扇内开门，上部三格玻璃、下裙板
function buildPinkDoors(parent, mats, { z, y0, w = 2.4, h = 2.9 }) {
  const pink = new THREE.MeshStandardMaterial({ color: 0xc49a9d, roughness: .62 });
  const pinkD = new THREE.MeshStandardMaterial({ color: 0xa87b80, roughness: .66 });
  addMerged(parent, [
    tbox(.09, h, .12, -w / 2, y0 + h / 2, z),
    tbox(.09, h, .12, w / 2, y0 + h / 2, z),
    tbox(w, .1, .12, 0, y0 + h, z),
  ], pink);
  const leafW = w / 2 - .03;
  for (const s of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(s * (w / 2 - .02), y0, z);
    hinge.rotation.y = -s * 1.34; // 向内开约 77°
    parent.add(hinge);
    const leaf = new THREE.Group();
    leaf.position.x = -s * leafW / 2;
    hinge.add(leaf);
    addMerged(leaf, [
      tbox(.075, h, .06, -leafW / 2 + .03, h / 2, 0),
      tbox(.075, h, .06, leafW / 2 - .03, h / 2, 0),
      tbox(leafW, .09, .06, 0, .045, 0),
      tbox(leafW, .09, .06, 0, h - .045, 0),
      tbox(leafW, .07, .06, 0, .52, 0),
      tbox(leafW, .07, .06, 0, 1.56, 0),
    ], pink);
    addBox(leaf, pinkD, leafW - .14, .82, .045, 0, .95, 0);
    const gh = (h - 1.63) / 3;
    for (let i = 0; i < 3; i++) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(leafW - .18, gh - .06), mats.glass);
      pane.position.set(0, 1.6 + (i + .5) * gh, .04);
      leaf.add(pane);
      addMerged(leaf, [tbox(leafW - .14, .035, .05, 0, 1.6 + i * gh, 0)], pink);
    }
  }
}

// ------------------------------------------------------------------
export function buildLinZexu(ctx) {
  const { mats, nightEmitters, nightLights } = ctx;
  const g = new THREE.Group();
  // 8×6 两层木构，坐于 14×9 山脚台基（含前庭），前脸朝南
  const W = 8, D = 6, TY = 1.0;
  addStonePlinth(g, mats.stone, 14, 9, TY, 0, 0);
  addSteps(g, mats.stone, 0, 4.5, 3.2, TY, 1.5, 4);
  const court = new THREE.Mesh(new THREE.PlaneGeometry(12.6, 3.4), mats.slab);
  court.rotation.x = -Math.PI / 2; court.position.set(0, TY + .04, 2.3); court.receiveShadow = true; g.add(court);
  const H1 = 3.3, H2 = 3.0, bz = -1.2, fz = bz + D / 2;
  // 内景：首层改墙壳（前墙留 2.4m 门洞），二层仍保留实心体
  const wt = .3;
  const segW = (W - 2.4) / 2;
  meshBox(g, mats.woodDark, W, H2, D, 0, TY + H1 + H2 / 2, bz);
  // 东墙（后墙）北段开门（与内景门洞同尺寸：x -3.4..-1.8，净高 2.4）
  const dX = -2.6, dW = 1.6, dH = 2.4;
  const d0 = dX - dW / 2, d1 = dX + dW / 2;
  const backZ = bz - D / 2 + wt / 2, dTop = TY + .13 + dH;
  meshBox(g, mats.woodDark, d0 + W / 2, H1, wt, (-W / 2 + d0) / 2, TY + H1 / 2, backZ);
  meshBox(g, mats.woodDark, W / 2 - d1, H1, wt, (d1 + W / 2) / 2, TY + H1 / 2, backZ);
  meshBox(g, mats.woodDark, dW, TY + H1 - dTop, wt, dX, dTop + (TY + H1 - dTop) / 2, backZ);
  for (const s of [-1, 1]) meshBox(g, mats.woodDark, wt, H1, D, s * (W / 2 - wt / 2), TY + H1 / 2, bz);
  for (const s of [-1, 1]) meshBox(g, mats.woodDark, segW, H1, wt, s * (1.2 + segW / 2), TY + H1 / 2, fz - wt / 2);
  meshBox(g, mats.woodDark, 2.4, H1 - 2.9, wt, 0, TY + 2.9 + (H1 - 2.9) / 2, fz - wt / 2);
  meshBox(g, mats.stone, W, .13, D, 0, 1.065, bz);
  meshBox(g, mats.plasterCool, W - wt * 2, .12, D - wt * 2, 0, 4.24, bz);
  // 一层敞开柱廊 + 竖联 + 玻璃格栅门（正门直通）
  const cols = [];
  for (const x of [-3.5, -1.75, 1.75, 3.5]) cols.push(tcyl(.18, .21, H1, x, TY + H1 / 2, fz + .55, 8));
  addMerged(g, cols, mats.woodDark);
  for (const x of [-3.5, -1.75, 1.75, 3.5]) meshBox(g, mats.woodDark, .26, 1.7, .06, x, TY + 2.1, fz + .63);
  for (const x of [-2.2, 2.2]) latticeDoor(g, mats, 1.9, 2.9, x, TY + 1.55, fz + .05, { glow: true, cols: 4, rows: 7 });
  buildPinkDoors(g, mats, { z: fz + .05, y0: TY + .13 });
  // 檐下挂落（回纹/冰裂）
  const val = [];
  for (let i = 0; i < 10; i++) {
    const x = -3.9 + i * .87;
    val.push(tbox(.5, .32, .1, x, TY + H1 - .18, fz + .58, 0));
    val.push(tbox(.1, .32, .42, x + .24, TY + H1 - .18, fz + .58, .6));
  }
  addMerged(g, val, mats.woodDark);
  // 二层挑出外廊：白色镂空栏杆
  meshBox(g, mats.woodDark, W + .4, .22, 1.5, 0, TY + H1 + .1, fz + .6);
  const rail = [];
  for (let i = 0; i <= 40; i++) rail.push(tbox(.05, .85, .05, -3.9 + i * .195, TY + H1 + .55, fz + 1.3, 0));
  rail.push(tbox(W + .2, .1, .12, 0, TY + H1 + 1.0, fz + 1.3, 0));
  addMerged(g, rail, mats.plasterCool);
  for (const x of [-2.4, 0, 2.4]) latticeDoor(g, mats, 1.9, 2.2, x, TY + H1 + 1.5, fz + .03, { glow: true, cols: 5, rows: 7 });
  meshBox(g, mats.woodDark, W + 1.4, .3, .3, 0, TY + H1 + H2 - .2, fz + .62);
  addPlaque(g, mats, mats.plaques.linzexu, 0, TY + H1 + H2 - .7, fz + .76, { w: 3.4, h: .7 });
  const roof = xieshanRoofGroup({ W: W + 3.2, D: D + 3.0, H: 2.5, skirtH: 1.1, gableWidth: W + 2.4, tileMat: mats.roof, ridgeMat: mats.ridge, gableMat: mats.plasterCool, fasciaMat: mats.redDark, cornerLift: .85 });
  roof.position.y = TY + H1 + H2 + .15; g.add(roof);
  // 前沿低石栏与块石挡墙
  const sr = [];
  for (const s of [-1, 1]) {
    for (let i = 0; i <= 6; i++) sr.push(tbox(.16, .7, .16, s * (2.0 + i * .38), TY + .35, 4.2, 0));
    sr.push(tbox(2.5, .1, .16, s * 3.15, TY + .72, 4.2, 0));
  }
  addMerged(g, sr, mats.stone);
  const bw = [];
  for (const s of [-1, 1]) bw.push(tbox(.7, 1.0, 3.2, s * 6.2, .5, 3.4, 0));
  addMerged(g, bw, mats.stoneDark);
  const li = addInteriorLight(g, mats, 0, TY + 2.2, 1, 12, 22);
  nightLights.push(li);
  decorateLinZexu(ctx, g, { TY, W, D, bz, fz, dx: dX, dw: dW, dh: dH });
  return g;
}

function makeScholar(mats) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.0, .5, 1.5), mats.stoneDark);
  base.position.y = .25; g.add(base);
  const robe = new THREE.Mesh(new THREE.ConeGeometry(.7, 2.4, 10), mats.bronze);
  robe.position.y = 1.5; g.add(robe);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.34, 10, 8), mats.bronze);
  head.position.y = 2.9; g.add(head);
  const hat = new THREE.Mesh(new THREE.BoxGeometry(.8, .16, .6), mats.bronze);
  hat.position.y = 3.2; g.add(hat);
  return g;
}

// ------------------------------------------------------------------
// 富的廊（BV1HnZTBNESa 64–115s / 360–379s）：暗红木柱 + 梁下贴金饰带 +
// 两侧红色格栅美人靠长凳 + 檐下挂花篮；西端两级石阶接白墙院落。
export function buildFudelang(ctx, opts = {}) {
  const { group, mats } = ctx;
  const { x = 0, z = -34.0, plaque = mats.plaques.fude, length = 21.8, bays = 7 } = opts;
  const g = new THREE.Group();
  const L = length, W = 3.6, H = 3.2;
  // 浅色石基座
  meshBox(g, mats.stone, L + 1.6, .35, W + 1.2, 0, .17, 0);
  // 暗红木柱 + 石柱础
  const cols = [];
  for (let i = 0; i <= bays; i++) {
    const cx = -L / 2 + i * L / bays;
    for (const s of [-1, 1]) {
      cols.push(tbox(.26, H, .26, cx, H / 2 + .34, s * W / 2, 0));
      cols.push(tbox(.4, .12, .4, cx, .41, s * W / 2, 0));
    }
  }
  addMerged(g, cols, mats.redDark);
  const bayW = L / bays;
  // 梁枋：暗红底 + 贴金饰带（柱间金条与金色方块）
  const beams = [], gold = [];
  for (const s of [-1, 1]) {
    beams.push(tbox(L, .34, .24, 0, H + .28, s * W / 2, 0));
    for (let i = 0; i < bays; i++) {
      const cx = -L / 2 + (i + .5) * bayW;
      gold.push(tbox(bayW * .74, .07, .03, cx, H + .4, s * (W / 2 + .13), 0));
      gold.push(tbox(.2, .2, .03, cx, H + .19, s * (W / 2 + .13), 0));
      gold.push(tbox(.05, .16, .03, cx - bayW * .3, H + .19, s * (W / 2 + .13), 0));
      gold.push(tbox(.05, .16, .03, cx + bayW * .3, H + .19, s * (W / 2 + .13), 0));
    }
  }
  addMerged(g, beams, mats.redDark);
  addMerged(g, gold, mats.gold);
  // 外檐挂落：暗红细棂
  const val = [];
  for (let i = 0; i < bays * 3; i++) {
    const cx = -L / 2 + (i + .5) * bayW / 3;
    val.push(tbox(.05, .34, .05, cx, H - .02, -W / 2 + .02, 0));
  }
  addMerged(g, val, mats.redDark);
  // 两侧红色格栅美人靠 + 长凳（视频 65/110s：廊两侧均开敞，坐凳沿柱间通长）
  const railGeos = [];
  for (const s of [-1, 1]) {
    railGeos.push(tbox(L - .3, .08, .1, 0, 1.32, s * (W / 2 - .02), 0));
    railGeos.push(tbox(L - .3, .06, .09, 0, .52, s * (W / 2 - .02), 0));
    const n = Math.max(2, Math.round((L - .3) / .16));
    for (let k = 0; k <= n; k++) railGeos.push(tbox(.04, .78, .04, -(L - .3) / 2 + k * (L - .3) / n, .91, s * (W / 2 - .02), 0));
    meshBox(g, mats.wood, L - .5, .12, .46, 0, .78, s * (W / 2 - .28));
    meshBox(g, mats.redDark, L - .5, .1, .1, 0, 1.0, s * (W / 2 - .5));
  }
  addMerged(g, railGeos, mats.redDark);
  // 西端入口：两级石阶降至院落（视频 52s 双狮之间进廊）
  for (let i = 0; i < 2; i++) {
    const top = .205 - i * .14;
    meshBox(g, mats.stone, .55, top, 2.6, -L / 2 - .275 - i * .55, top / 2, 0);
  }
  // 檐下挂花篮
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x4f6b3a, roughness: .85 });
  const flowerMat = new THREE.MeshStandardMaterial({ color: 0xd88a9c, roughness: .8 });
  for (let i = 0; i < bays; i += 2) {
    const cx = -L / 2 + (i + .5) * bayW;
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(.14, .1, .22, 8), mats.redDark);
    pot.position.set(cx, H - .3, -W / 2 + .3); pot.castShadow = true; g.add(pot);
    for (const [dx, dy, r] of [[0, .16, .24], [-.12, .1, .13], [.12, .09, .12]]) {
      const fol = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), leafMat);
      fol.position.set(cx + dx, H - .28 + dy, -W / 2 + .3);
      fol.scale.y = .55; fol.castShadow = true; g.add(fol);
    }
    for (const [dx, dz] of [[-.09, .09], [.08, .1], [.02, -.08]]) {
      const fl = new THREE.Mesh(new THREE.SphereGeometry(.055, 6, 5), flowerMat);
      fl.position.set(cx + dx, H - .13, -W / 2 + .3 + dz); g.add(fl);
    }
  }
  // 屋顶：深灰瓦、暗红檐口
  const roof = xieshanRoofGroup({ W: L + 1.8, D: W + 1.8, H: 1.2, skirtH: .55, gableWidth: L + 1, tileMat: mats.roofDark, ridgeMat: mats.ridge, gableMat: mats.plasterCool, fasciaMat: mats.redDark, cornerLift: .25 });
  roof.position.y = H + .48; g.add(roof);
  // 廊内补光（模拟两侧天光反射，避免梁底与金饰全黑）
  for (const lx of [-L * .26, L * .26]) {
    const li = new THREE.PointLight(0xffe0bb, 4.5, 11, 2);
    li.position.set(lx, 2.85, 0); g.add(li);
  }
  if (plaque) addPlaque(g, mats, plaque, -L / 2 - .12, H + .52, 0, { w: 2.4, h: .56, ry: -Math.PI / 2 });
  g.position.set(x, 0, z);
  group.add(g);
  return g;
}

// ------------------------------------------------------------------
// 富的廊西端白墙院落（BV1HnZTBNESa 44–63s / 285–335s）：南北向白墙 + 文保牌 +
// 大花窗 + 石凳盆景 + 石板铺地 + 修剪松；石狮一对守在富的廊西端开口。
function buildStoneLion(parent, mats, x, z, ry = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z); g.rotation.y = ry;
  meshBox(g, mats.stone, .8, .26, .6, 0, .13, 0);
  meshBox(g, mats.stone, .52, .16, .46, 0, .34, 0);
  const body = new THREE.Mesh(new THREE.SphereGeometry(.25, 12, 10), mats.stone);
  body.position.set(0, .62, -.05); body.scale.set(.9, 1.05, 1.15); body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.21, 14, 12), mats.stone);
  head.position.set(0, .94, .12); head.castShadow = true; g.add(head);
  const mane = new THREE.Mesh(new THREE.SphereGeometry(.24, 10, 8), mats.stoneDark);
  mane.position.set(0, .92, .03); mane.scale.set(1, .95, .8); g.add(mane);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(.05, .06, .34, 8), mats.stone);
    leg.position.set(s * .15, .35, .18); g.add(leg);
    const paw = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 6), mats.stone);
    paw.position.set(s * .15, .18, .26); paw.scale.set(1, .6, 1.2); g.add(paw);
  }
  parent.add(g);
  return g;
}

export function buildFudeWestCourt(ctx, opts = {}) {
  const { group, mats } = ctx;
  const { x = 70.4, z = -69.1 } = opts;
  const g = new THREE.Group();
  // 南北向白墙（与富的廊西端、宿舍西墙连成一线）
  addWall(g, mats, 0, -7.5, 0, 7.5, { h: 2.7, t: .3 });
  // 文保牌 + 两扇大花窗（朝东，面向院落）
  addPlaque(g, mats, mats.plaques.wenbao, .17, 1.85, .3, { w: .62, h: .92, ry: Math.PI / 2 });
  for (const wz of [-3.6, 4.2]) addLatticeWall(g, mats, 1.6, 1.15, .16, 1.75, wz, { ry: Math.PI / 2 });
  // 石板铺地
  const pave = new THREE.Mesh(new THREE.BoxGeometry(15, .06, 13.8), mats.stone);
  pave.position.set(7.6, .03, 0); pave.receiveShadow = true; g.add(pave);
  const lines = [];
  for (let i = 1; i < 10; i++) lines.push(tbox(.04, .012, 13.8, .2 + i * 1.45, .065, 0, 0));
  for (let i = 1; i < 9; i++) lines.push(tbox(15, .012, .04, 7.6, .065, -6.9 + i * 1.48, 0));
  addMerged(g, lines, mats.stoneDark);
  // 石凳 + 盆景
  const bench = (bz) => {
    meshBox(g, mats.stone, .52, .16, 1.9, .72, .44, bz);
    for (const s of [-1, 1]) meshBox(g, mats.stone, .44, .36, .18, .72, .18, bz + s * .8);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(.26, .2, .26, 8), mats.stoneDark);
    pot.position.set(.72, .65, bz); pot.castShadow = true; g.add(pot);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.05, .07, .5, 6), mats.woodDark);
    trunk.position.set(.72, .98, bz); g.add(trunk);
    const fol = new THREE.MeshStandardMaterial({ color: 0x3f5a34, roughness: .85 });
    for (const [dy, r] of [[.22, .3], [.46, .22], [.66, .15]]) {
      const pad = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), fol);
      pad.position.set(.72 + (dy * .2), 1.18 + dy, bz); pad.scale.y = .5; pad.castShadow = true; g.add(pad);
    }
  };
  bench(-4.9); bench(3.1);
  // 修剪松 3 株（视频 285–335s 院内造型树）
  const leaf = new THREE.MeshStandardMaterial({ color: 0x3f5a34, roughness: .85 });
  for (const [tx, tz, sc] of [[5.2, -4.2, 1], [8.6, 3.4, .88], [12.2, -1.8, .95]]) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.12 * sc, .18 * sc, 1.5 * sc, 8), mats.woodDark);
    trunk.position.set(tx, .75 * sc, tz); trunk.castShadow = true; g.add(trunk);
    for (const [dx, dy, dz, r] of [[0, 1.7, 0, .95], [-.5, 2.3, .2, .7], [.5, 2.6, -.2, .62], [0, 3.1, .1, .5]]) {
      const pad = new THREE.Mesh(new THREE.IcosahedronGeometry(r * sc, 0), leaf);
      pad.position.set(tx + dx * sc, dy * sc, tz + dz * sc); pad.scale.y = .42; pad.castShadow = true; g.add(pad);
    }
  }
  // 石狮一对：置于墙前，夹护富的廊西端上廊石阶
  buildStoneLion(g, mats, .62, 5.4, Math.PI / 2);
  buildStoneLion(g, mats, .62, 6.6, Math.PI / 2);
  g.position.set(x, 0, z);
  group.add(g);
  return g;
}

// ------------------------------------------------------------------
// 梓荫阁围墙内西侧六角亭（BV1HnZTBNESa 200–239s）：暗红柱、红色格栅美人靠、
// 白墙嵌灰石碑（181–201s）、六角攒尖顶；南侧留入口。
export function buildHexPavilion(ctx) {
  const { mats } = ctx;
  const g = new THREE.Group();
  const R = 1.05, CH = 2.7, PH = .12;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(R + .2, R + .24, PH, 6), mats.stone);
  base.position.y = PH / 2; base.receiveShadow = true; g.add(base);
  const verts = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + i * Math.PI / 3;
    verts.push([Math.cos(a) * R, Math.sin(a) * R]);
  }
  const cols = [];
  for (const [vx, vz] of verts) cols.push(tbox(.17, CH, .17, vx, PH + CH / 2, vz, 0));
  addMerged(g, cols, mats.redDark);
  // 白墙（局部 2–3 边）＋嵌灰石碑
  meshBox(g, mats.plaster, .12, 2.45, R + .06, -R + .06, PH + 1.225, 0);
  meshBox(g, mats.stoneDark, .06, 1.4, 1.16, -R + .13, PH + 1.55, 0);
  meshBox(g, mats.stone, .05, 1.24, 1.0, -R + .155, PH + 1.55, 0);
  // 美人靠长凳（1–2、3–4 两边，夹碑墙）
  const bench = (a, b) => {
    const [ax, az] = verts[a], [bx, bz] = verts[b];
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    const len = Math.hypot(bx - ax, bz - az);
    const ang = Math.atan2(bz - az, bx - ax);
    const bg = new THREE.Group();
    bg.position.set(mx * .84, PH, mz * .84); bg.rotation.y = -ang;
    g.add(bg);
    meshBox(bg, mats.wood, len - .3, .1, .42, 0, .5, 0);
    const bars = [];
    for (let i = 0; i < 5; i++) bars.push(tbox(.035, .55, .035, -(len - .3) / 2 + i * (len - .3) / 4, .8, -.17, 0));
    bars.push(tbox(len - .3, .06, .06, 0, 1.1, -.17, 0));
    addMerged(bg, bars, mats.redDark);
  };
  bench(1, 2); bench(3, 4);
  // 其余两边：红色格栅栏（5–0 边为入口）
  for (const [a, b] of [[0, 1], [4, 5]]) {
    const [ax, az] = verts[a], [bx, bz] = verts[b];
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    const len = Math.hypot(bx - ax, bz - az);
    const ang = Math.atan2(bz - az, bx - ax);
    const rg = new THREE.Group();
    rg.position.set(mx, PH, mz); rg.rotation.y = -ang; g.add(rg);
    const bars = [tbox(len - .1, .06, .06, 0, 1.05, 0, 0)];
    for (let i = 0; i <= 8; i++) bars.push(tbox(.035, .9, .035, -(len - .1) / 2 + i * (len - .1) / 8, .58, 0, 0));
    addMerged(rg, bars, mats.redDark);
  }
  // 梁下贴金饰带
  const gold = [];
  for (let i = 0; i < 6; i++) {
    const [ax, az] = verts[i], [bx, bz] = verts[(i + 1) % 6];
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    const len = Math.hypot(bx - ax, bz - az);
    const ang = Math.atan2(bz - az, bx - ax);
    gold.push(tbox(len - .06, .12, .06, mx, PH + CH - .12, mz, -ang));
  }
  addMerged(g, gold, mats.gold);
  // 六角攒尖顶 + 金宝顶
  const roof = new THREE.Mesh(new THREE.ConeGeometry(R + .38, 1.05, 6), mats.roofDark);
  roof.position.y = PH + CH + .525; roof.rotation.y = Math.PI / 6; roof.castShadow = true; g.add(roof);
  const fin = new THREE.Mesh(new THREE.SphereGeometry(.1, 10, 8), mats.gold);
  fin.position.y = PH + CH + 1.08; g.add(fin);
  const li = new THREE.PointLight(0xffc98a, 4, 8, 2);
  li.position.set(0, PH + 2.2, 0); g.add(li);
  return g;
}

// ------------------------------------------------------------------
// 灰廊架（视频 155-161s，红指革命浮雕）：灰方柱+石柱础、青砖墙+白抹灰带+红瓦压顶、四瓣花窗、赭红浮雕、黄木门、红木长凳、平顶藤架、石台基。
// 两段按 L 形生成，墙在局部 -Z、柱在 +Z；doors/windows/reliefs/benches 为局部 X，stairs.end=-1/+1 表示踏步端。
function quatrefoilPoints(r, d, seg = 112) {
  const cs = [[d, 0], [-d, 0], [0, d], [0, -d]];
  const pts = [];
  for (let i = 0; i < seg; i++) {
    const a = i / seg * Math.PI * 2;
    const ux = Math.cos(a), uz = Math.sin(a);
    let rr = 0;
    for (const [cx, cz] of cs) {
      const proj = cx * ux + cz * uz;
      const perp2 = cx * cx + cz * cz - proj * proj;
      const disc = r * r - perp2;
      if (disc >= 0) rr = Math.max(rr, proj + Math.sqrt(disc));
    }
    pts.push(new THREE.Vector2(ux * rr, uz * rr));
  }
  return pts;
}

function flowerWindowGeo(r, d) {
  const shape = new THREE.Shape(quatrefoilPoints(r, d));
  const geo = new THREE.ShapeGeometry(shape);
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i,
      (pos.getX(i) - bb.min.x) / (bb.max.x - bb.min.x),
      (pos.getY(i) - bb.min.y) / (bb.max.y - bb.min.y));
  }
  return geo;
}

function addFlowerWindow(parent, mats, cx, cy, faceZ) {
  const r = .26, d = .155;
  const outer = quatrefoilPoints(r * 1.045, d * 1.045);
  const inner = quatrefoilPoints(r, d);
  const ring = new THREE.Shape(outer);
  ring.holes.push(new THREE.Path(inner));
  const ringMesh = new THREE.Mesh(
    new THREE.ExtrudeGeometry(ring, { depth: .035, bevelEnabled: false }), mats.stone);
  ringMesh.position.set(cx, cy, faceZ - .01);
  ringMesh.castShadow = true; ringMesh.receiveShadow = true;
  parent.add(ringMesh);
  const lattice = new THREE.Mesh(flowerWindowGeo(r, d), mats.latticeJade);
  lattice.position.set(cx, cy, faceZ + .012);
  parent.add(lattice);
}

function addReliefPanel(parent, mats, cx, cy, faceZ, w, h, kind) {
  meshBox(parent, mats.stone, w + .12, h + .12, .05, cx, cy, faceZ + .015);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), kind === 'h' ? mats.reliefH : mats.reliefV);
  p.position.set(cx, cy, faceZ + .052);
  p.receiveShadow = true;
  parent.add(p);
}

export function buildRedCorridor(ctx, opts = {}) {
  const { group, mats } = ctx;
  const {
    x = 0, z = 0, length = 26.4, bays = 8,
    wallFrom = -length / 2, wallTo = length / 2,
    doors = [], windows = [], reliefs = [], benches = [], stairs = null,
  } = opts;
  const g = new THREE.Group();
  const L = length, W = 4.0;
  const plinthH = .3, paveH = .05, floorY = plinthH + paveH; // .35
  const wallT = .26, wallZ = -W / 2 + wallT / 2;
  const brickH = 2.42, bandH = .30, copeH = .22;
  // 石台基 + 灰石铺地（抬升 .35m）
  meshBox(g, mats.stone, L + .3, plinthH, W + .7, 0, plinthH / 2, 0);
  meshBox(g, mats.pathStone, L + .1, paveH, W + .4, 0, plinthH + paveH / 2, 0);
  // 青砖墙：芯体 + 两面砖纹（按长度设 repeat，避免拉伸）
  const wl = wallTo - wallFrom, wcx = (wallFrom + wallTo) / 2;
  meshBox(g, mats.grayBrickCore, wl, brickH, wallT, wcx, floorY + brickH / 2, wallZ);
  const brickFace = (fw, fh, px, pz, ry) => {
    const mat = mats.grayBrick.clone();
    mat.color.set(0xc4cac8); // 青灰砖，比沁园灰砖更冷更深
    mat.map = mats.grayBrick.map.clone();
    mat.map.wrapS = THREE.RepeatWrapping; mat.map.wrapT = THREE.RepeatWrapping;
    mat.map.repeat.set(Math.max(1, fw / 2.6), Math.max(1, fh / 2.0));
    mat.map.needsUpdate = true;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), mat);
    p.position.set(px, floorY + fh / 2, pz); p.rotation.y = ry;
    p.receiveShadow = true; g.add(p);
  };
  brickFace(wl, brickH, wcx, wallZ + wallT / 2 + .008, 0);
  brickFace(wl, brickH, wcx, wallZ - wallT / 2 - .008, Math.PI);
  // 白抹灰带 + 红瓦压顶
  meshBox(g, mats.plasterCool, wl, bandH, wallT + .05, wcx, floorY + brickH + bandH / 2, wallZ);
  meshBox(g, mats.tileRed, wl + .18, copeH, wallT + .26, wcx, floorY + brickH + bandH + copeH / 2, wallZ);
  meshBox(g, mats.ridgeWarm, wl + .2, .05, .1, wcx, floorY + brickH + bandH + copeH + .025, wallZ);
  const faceZ = wallZ + wallT / 2;
  // 三扇黄木门（视频 157-160s）
  for (const dx of doors) {
    const dw = .74, dh = 2.04;
    meshBox(g, mats.stone, dw + .3, .12, .3, dx, floorY + .06, faceZ + .1);
    meshBox(g, mats.woodDark, dw + .16, dh + .16, .06, dx, floorY + .12 + (dh + .16) / 2, faceZ + .02);
    meshBox(g, mats.woodDoor, dw, dh, .07, dx, floorY + .12 + dh / 2, faceZ + .06);
    for (let k = 1; k < 3; k++) {
      meshBox(g, mats.woodDark, dw - .1, .035, .02, dx, floorY + .12 + dh * k / 3, faceZ + .1);
    }
    meshBox(g, mats.bronze, .055, .055, .035, dx + dw * .3, floorY + 1.05, faceZ + .105);
  }
  // 四瓣花窗
  for (const wx of windows) {
    if (doors.some((d) => Math.abs(wx - d) < .62)) continue;
    addFlowerWindow(g, mats, wx, floorY + 1.34, faceZ);
  }
  // 赭红浮雕（竖幅/横幅）
  for (const r of reliefs) {
    const w = r.w || 1.6, h = r.h || 1.5;
    const cy = floorY + h / 2 + .22;
    addReliefPanel(g, mats, r.x, cy, faceZ, w, h, r.kind);
  }
  // 红木长凳（靠墙，视频入口处）
  for (const bx of benches) {
    const bz = faceZ + .34;
    meshBox(g, mats.redBeam, 1.85, .09, .46, bx, floorY + .46, bz);
    meshBox(g, mats.woodDark, 1.55, .08, .34, bx, floorY + .30, bz);
    for (const s of [-.7, .7]) meshBox(g, mats.woodDark, .1, .42, .38, bx + s, floorY + .21, bz);
  }
  // 灰方柱 + 浅灰石柱础
  const colGeoms = [], baseGeoms = [], colZ = W / 2 - .28;
  const colH = 2.42;
  for (let i = 0; i <= bays; i++) {
    const cx = -L / 2 + i * L / bays;
    baseGeoms.push(tbox(.62, .2, .62, cx, floorY + .1, colZ, 0));
    colGeoms.push(tbox(.46, colH, .46, cx, floorY + .2 + colH / 2, colZ, 0));
  }
  addMerged(g, colGeoms, mats.grayBrickCore);
  addMerged(g, baseGeoms, mats.stone);
  // 平顶藤架：柱顶纵梁 + 每开间横梁 + 细檩条（墙顶不压枋，让白抹灰带与红瓦压顶露出来）
  const colTop = floorY + .2 + colH;
  const beamY = colTop + .09;
  meshBox(g, mats.grayBeam, L + .5, .2, .2, 0, beamY, colZ);
  const crossGeoms = [];
  for (let i = 0; i <= bays; i++) {
    crossGeoms.push(tbox(.16, .2, W - .12, -L / 2 + i * L / bays, beamY, 0, 0));
  }
  addMerged(g, crossGeoms, mats.grayBeam);
  const purlinGeoms = [];
  for (let k = -2; k <= 2; k++) {
    purlinGeoms.push(tbox(L + .25, .07, .1, 0, beamY + .16, k * .72, 0));
  }
  addMerged(g, purlinGeoms, mats.grayBeam);
  // 藤蔓：平顶绿团 + 外檐垂藤
  const rnd = mulberry32(913 + Math.round(L * 7));
  const vineGeos = [], hangGeos = [];
  const nVine = Math.round(L * 1.6);
  for (let i = 0; i < nVine; i++) {
    const vx = -L / 2 + rnd() * L;
    const vz = -W / 2 + .35 + rnd() * (W - .7);
    const s = .27 + rnd() * .36;
    const geo = new THREE.IcosahedronGeometry(s, 1);
    geo.scale(1.25, .5, 1.25);
    geo.translate(vx, beamY + .24 + rnd() * .16, vz);
    vineGeos.push(geo);
  }
  // 垂藤：外檐处少量成簇的垂挂绿团 + 短细枝，避免规则“吊饰”感
  const nHang = Math.max(4, Math.round(L * .22));
  for (let i = 0; i < nHang; i++) {
    const vx = -L / 2 + .6 + rnd() * (L - 1.2);
    const hz = colZ + .12 + rnd() * .08;
    for (let j = 0; j < 4; j++) {
      const blob = new THREE.IcosahedronGeometry(.13 + rnd() * .1, 1);
      blob.scale(1.6, .6, 1.0);
      blob.translate(vx + (rnd() - .5) * .34, colTop - .06 - rnd() * .18, hz + (rnd() - .5) * .06);
      hangGeos.push(blob);
    }
    for (let j = 0; j < 2; j++) {
      const len = .16 + rnd() * .3;
      hangGeos.push(tbox(.03, len, .03, vx + (rnd() - .5) * .2, colTop - len / 2 - .1, hz, 0));
    }
  }
  addMerged(g, vineGeos, mats.vine, { cast: false });
  addMerged(g, hangGeos, mats.vine, { cast: false });
  // 端部踏步（出口 3 级 / 入口 2 级）
  if (stairs && stairs.end) {
    const dir = stairs.end < 0 ? -1 : 1;
    const st = addSteps(g, mats.stone, dir * (L / 2 + .16), 0, W + .4, floorY, 1.0, stairs.steps || 2,
      { ry: dir * Math.PI / 2 });
    if (st) st.receiveShadow = true;
  }
  g.position.set(x, 0, z);
  group.add(g);
  return g;
}

// ------------------------------------------------------------------
function cloneFacadeMats(mats, key, w, d, h) {
  const base = mats.facades[key];
  const mk = (width) => {
    const map = base.map.clone(); map.needsUpdate = true; map.wrapS = THREE.RepeatWrapping;
    map.repeat.set(Math.max(1, width / 26), 1);
    const em = base.emissiveMap.clone(); em.needsUpdate = true; em.wrapS = THREE.RepeatWrapping;
    em.repeat.set(map.repeat.x, 1);
    const mat = base.clone();
    mat.map = map; mat.emissiveMap = em;
    mat.emissiveIntensity = 0;
    mat.userData.baseEmissive = 1.25;
    return mat;
  };
  return { front: mk(w), side: mk(d), h };
}

// ------------------------------------------------------------------
// 自习室（自主学习室）：青灰砖单层、灰瓦四坡顶、红棕木框窗（参考视频 68-78s）
export function buildStudyRoom(ctx, { x, z, w = 15, d = 10 } = {}) {
  const { group, mats } = ctx;
  const g = new THREE.Group();
  const H = 4.0, by = .35;
  meshBox(g, mats.stone, w + .55, by, d + .55, 0, by / 2, 0);
  meshBox(g, mats.grayBrickCore, w, H, d, 0, by + H / 2, 0);
  // 四面青灰砖纹（逐面按尺寸设置贴图重复，避免砖块被拉伸）
  const brickFace = (fw, fh, px, pz, ry) => {
    const mat = mats.grayBrick.clone();
    mat.map = mats.grayBrick.map.clone();
    mat.map.repeat.set(Math.max(1, fw / 2.6), Math.max(1, fh / 2.0));
    mat.map.needsUpdate = true;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), mat);
    p.position.set(px, by + H / 2, pz); p.rotation.y = ry;
    p.receiveShadow = true; g.add(p);
  };
  brickFace(w, H, 0, d / 2 + .012, 0);
  brickFace(w, H, 0, -d / 2 - .012, Math.PI);
  brickFace(d, H, -w / 2 - .012, 0, -Math.PI / 2);
  brickFace(d, H, w / 2 + .012, 0, Math.PI / 2);
  // 南北立面：红棕木框窗 + 混凝土门套（s=-1 北面、+1 南面）
  const addWindow = (nz, wx, s) => {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(2.25, 2.3), mats.winStudy);
    pane.position.set(wx, by + 2.15, nz + s * .035);
    pane.rotation.y = s > 0 ? 0 : Math.PI; g.add(pane);
    meshBox(g, mats.stoneDark, 2.5, .12, .16, wx, by + .94, nz + s * .06);
  };
  const addDoor = (nz, wx, s) => {
    meshBox(g, mats.stoneDark, .22, 2.9, .3, wx - 1.02, by + 1.45, nz + s * .04);
    meshBox(g, mats.stoneDark, .22, 2.9, .3, wx + 1.02, by + 1.45, nz + s * .04);
    meshBox(g, mats.stoneDark, 2.26, .26, .3, wx, by + 2.94, nz + s * .04);
    meshBox(g, mats.darkMetal, 1.7, 2.6, .08, wx, by + 1.3, nz + s * .02);
  };
  // 北面（临沁园）：门在西端，三樘窗依次向东
  for (const wx of [-1.9, 1.5, 4.9]) addWindow(-d / 2, wx, -1);
  addDoor(-d / 2, -5.6, -1);
  // 南面：门在东南，西、中三樘窗
  for (const wx of [-4.6, -1.2, 2.2]) addWindow(d / 2, wx, 1);
  addDoor(d / 2, 5.6, 1);
  // 东墙临园一侧挂“自主学习室 / Independent Study Room”匾
  addPlaque(g, mats, mats.plaques.study, w / 2 + .08, by + 2.5, 2.2, { w: 3.1, h: .82, ry: Math.PI / 2 });
  addPlaque(g, mats, mats.plaques.studyEn, w / 2 + .08, by + 1.85, 2.2, { w: 3.1, h: .48, ry: Math.PI / 2 });
  // 灰瓦四坡顶 + 白脊白檐口
  const roof = hipRoofGroup({
    W: w + 2.2, D: d + 2.0, H: 2.85, tileMat: mats.roofSlate,
    ridgeMat: mats.plasterCool, fasciaMat: mats.plasterCool, ridgeRatio: .55, cornerLift: .35,
  });
  roof.position.y = by + H + .05; g.add(roof);
  g.position.set(x, 0, z);
  group.add(g);
  return g;
}

// ------------------------------------------------------------------
// 书吧：青灰砖两层、通高白色细格窗；南端整面梁柱框架玻璃幕墙（参考视频 b22/t00060/t00063）
export function buildBookBar(ctx, { x, z, w = 14, d = 16 } = {}) {
  const { group, mats, nightLights } = ctx;
  const g = new THREE.Group();
  const H = 7.4, by = .4;
  const dg = 2.4;                      // 南端框架玻璃体进深
  const db = d - dg;                   // 青灰砖主体进深
  const bz = -dg / 2;                  // 砖体中心（向南让出玻璃体）
  const gz = d / 2 - dg / 2;           // 玻璃体中心
  meshBox(g, mats.stone, w + .6, by, d + .6, 0, by / 2, 0);
  // 首层内景：实心砖体改墙壳（南墙开 4m 门洞），上部仍为砖墙
  const wt = .32;
  const segW = (w - 4) / 2;
  meshBox(g, mats.wood, w, .12, db, 0, by + .06, bz);
  meshBox(g, mats.grayBrickCore, w, H, wt, 0, by + H / 2, bz - db / 2 + wt / 2);
  // 西墙整段；东墙（临沁园）北端开门：门洞局部 z -6.2..-4.4、净高 .44..3.14，墙分三段
  meshBox(g, mats.plasterCool, wt, H, db, -(w / 2 - wt / 2), by + H / 2, bz);
  const edZ0 = -6.2, edZ1 = -4.4, edTop = 3.14, ewX = w / 2 - wt / 2;
  meshBox(g, mats.plasterCool, wt, H, edZ0 - (bz - db / 2), ewX, by + H / 2, (bz - db / 2 + edZ0) / 2);
  meshBox(g, mats.plasterCool, wt, H, bz + db / 2 - edZ1, ewX, by + H / 2, (edZ1 + bz + db / 2) / 2);
  meshBox(g, mats.plasterCool, wt, by + H - edTop, edZ1 - edZ0, ewX, (edTop + by + H) / 2, (edZ0 + edZ1) / 2);
  for (const s of [-1, 1]) meshBox(g, mats.plasterCool, segW, H, wt, s * (w / 2 - segW / 2), by + H / 2, bz + db / 2 - wt / 2);
  meshBox(g, mats.plasterCool, 4, H - 3, wt, 0, by + 3 + (H - 3) / 2, bz + db / 2 - wt / 2);
  const brickFace = (fw, fh, px, pz, ry, py = by + H / 2, rep, off) => {
    const mat = mats.grayBrick.clone();
    mat.map = mats.grayBrick.map.clone();
    mat.map.repeat.set(Math.max(1, fw / 2.6), Math.max(1, fh / 2.0));
    if (rep) mat.map.repeat.set(rep[0], rep[1]);
    if (off) mat.map.offset.set(off[0], off[1]);
    mat.map.needsUpdate = true;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), mat);
    p.position.set(px, py, pz); p.rotation.y = ry;
    p.receiveShadow = true; g.add(p);
  };
  brickFace(segW, H, -(w / 2 - segW / 2), bz + db / 2 + .012, 0);
  brickFace(segW, H, w / 2 - segW / 2, bz + db / 2 + .012, 0);
  brickFace(4, H - 3, 0, bz + db / 2 + .012, 0, by + 3 + (H - 3) / 2);
  brickFace(db, H, -w / 2 - .012, bz, -Math.PI / 2);
  // 东立面随东北角门洞分三段（北段 / 南段 / 门上过梁）；按整面砖缝对齐 UV，避免门洞处错缝
  const zS = bz + db / 2, zN = bz - db / 2;
  const eastBrick = (z0, z1, y0, y1) => {
    const fw = z1 - z0, fh = y1 - y0;
    brickFace(fw, fh, w / 2 + .012, (z0 + z1) / 2, Math.PI / 2, (y0 + y1) / 2,
      [fw / 2.6, fh / 2], [(zS - z1) / 2.6, (y0 - by) / 2]);
  };
  eastBrick(zN, edZ0, by, by + H);
  eastBrick(edZ1, zS, by, by + H);
  eastBrick(edZ0, edZ1, edTop, by + H);
  brickFace(w, H, 0, bz - db / 2 - .012, Math.PI);
  // 东立面（临沁园）：两樘通高白色细格窗（北樘让位给东北角入口）
  for (const off of [0, 4.6]) {
    const wz = bz + off;
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 5.0), mats.winTall);
    pane.position.set(w / 2 + .04, by + 3.65, wz); pane.rotation.y = Math.PI / 2; g.add(pane);
    // 白色窗框贴面（沿 z 向，不凸出墙面）
    meshBox(g, mats.plaster, .1, .14, 3.6, w / 2 + .03, by + 1.08, wz);
    meshBox(g, mats.plaster, .1, .14, 3.6, w / 2 + .03, by + 6.22, wz);
    meshBox(g, mats.plaster, .1, 5.28, .14, w / 2 + .03, by + 3.65, wz - 1.73);
    meshBox(g, mats.plaster, .1, 5.28, .14, w / 2 + .03, by + 3.65, wz + 1.73);
  }
  // 南端整面框架结构：梁柱网格 + 白色镂空屏板，不设玻璃
  const towerSteel = new THREE.MeshStandardMaterial({ color: 0xd7dedb, roughness: .55, metalness: .08 });
  // 白色镂空格栅贴图（透明底 + 白格线），按开间填板
  const gc = document.createElement('canvas');
  gc.width = gc.height = 128;
  const gx = gc.getContext('2d');
  gx.strokeStyle = '#eef1ed'; gx.lineWidth = 6;
  for (let i = 0; i <= 4; i++) {
    const p = i * 32;
    gx.beginPath(); gx.moveTo(p, 0); gx.lineTo(p, 128); gx.stroke();
    gx.beginPath(); gx.moveTo(0, p); gx.lineTo(128, p); gx.stroke();
  }
  const grilleTex = new THREE.CanvasTexture(gc);
  grilleTex.colorSpace = THREE.SRGBColorSpace;
  grilleTex.wrapS = grilleTex.wrapT = THREE.RepeatWrapping;
  const grilleMatFor = (pw, ph) => {
    const t = grilleTex.clone(); t.needsUpdate = true;
    t.repeat.set(Math.max(1, Math.round(pw / .55)), Math.max(1, Math.round(ph / .55)));
    return new THREE.MeshStandardMaterial({
      map: t, transparent: true, alphaTest: .35, side: THREE.DoubleSide, roughness: .72, metalness: .05,
    });
  };
  const FH = 9.2;
  // 南面七开间八根柱；东西两侧各三根
  for (let i = 0; i <= 7; i++) {
    meshBox(g, towerSteel, .2, FH, .2, -w / 2 + i * (w / 7), by + FH / 2, d / 2 - .07);
  }
  for (const s of [-1, 1]) for (const off of [-1.05, 0, 1.05]) {
    meshBox(g, towerSteel, .2, FH, .2, s * (w / 2 - .09), by + FH / 2, gz + off);
  }
  // 基座、三层楼面、顶梁五道横梁
  for (const hy of [0, 2.9, 5.8, 8.6, FH]) {
    meshBox(g, towerSteel, w + .18, .18, dg + .18, 0, by + hy, gz);
  }
  meshBox(g, mats.plasterCool, w + .42, .2, dg + .42, 0, by + FH + .1, gz);
  // 白色镂空格栅：南面三层与顶层满铺，东西侧面同样
  const p3 = new THREE.Mesh(new THREE.PlaneGeometry(w - .3, 2.56), grilleMatFor(w - .3, 2.56));
  p3.position.set(0, by + 7.15, d / 2 + .1); g.add(p3);
  const p4 = new THREE.Mesh(new THREE.PlaneGeometry(w - .3, .76), grilleMatFor(w - .3, .76));
  p4.position.set(0, by + 9.07, d / 2 + .1); g.add(p4);
  for (const s of [-1, 1]) {
    const q3 = new THREE.Mesh(new THREE.PlaneGeometry(dg - .2, 2.56), grilleMatFor(dg - .2, 2.56));
    q3.position.set(s * (w / 2 + .1), by + 7.15, gz); q3.rotation.y = s * Math.PI / 2; g.add(q3);
    const q4 = new THREE.Mesh(new THREE.PlaneGeometry(dg - .2, .76), grilleMatFor(dg - .2, .76));
    q4.position.set(s * (w / 2 + .1), by + 9.07, gz); q4.rotation.y = s * Math.PI / 2; g.add(q4);
  }
  // 南面弧形石阶（参考视频 b22/t00063：三级弧形踏步，铺在框架幕墙脚下）
  for (const [r, h] of [[2.4, .1], [2.0, .2], [1.6, .3]]) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 28, 1, false, -Math.PI / 2, Math.PI), mats.stone);
    st.position.set(0, h / 2, d / 2);
    st.castShadow = true; st.receiveShadow = true; g.add(st);
  }
  // 平屋面 + 白色女儿墙（砖体部分；南侧由玻璃框架体收头）
  meshBox(g, mats.roofDark, w + .7, .22, db + .7, 0, by + H + .11, bz);
  meshBox(g, mats.plasterCool, w + .8, .6, .26, 0, by + H + .5, bz - (db / 2 + .28));
  for (const s of [-1, 1]) {
    meshBox(g, mats.plasterCool, .26, .6, db + .8, s * (w / 2 + .28), by + H + .5, bz);
  }
  const bulk = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.1, 2.6), mats.plasterCool);
  bulk.position.set(-w * .22, by + H + 1.06, bz - 2.2); bulk.castShadow = true; g.add(bulk);
  decorateBookBar(ctx, g, { by, w, d, db, bz });
  const li = addInteriorLight(g, mats, 0, 2.4, -1.0, 14, 20);
  nightLights.push(li);
  g.position.set(x, 0, z);
  group.add(g);
  return g;
}

export function buildModernBlock(ctx, {
  x, z, w, d, floors = 4, key = 'teachA', roofH = 2.6, ry = 0, roofMat = null, glassAtrium = false,
  corridor = false, baseH = 0, railMat = null, flatRoof = false, entrance = true, roofBulk = true,
  porch = false, openInterior = false, corridorGaps = null,
  closedCorridorEnds = false, // 外廊东西端封实墙（与南侧副楼连成一体，外墙不再开缺口）
  openGround = null   // 首层前脸敞开（靠花池一侧）：{ x0, x1 } 局部 x 范围；仅 baseH=0 用
} = {}) {
  const { group, mats, nightEmitters } = ctx;
  const g = new THREE.Group();
  const floorH = 3.45;
  const h = floors * floorH + 1.2;
  const cd = corridor ? 2.2 : 0;            // 南侧连续外廊进深
  const by = baseH;                          // 石砌基座高度
  const fm = cloneFacadeMats(mats, key, w, d, h);
  // 可进入体：前后立面各用独立材质，便于给门洞/楼层通道单独挖透明洞
  const frontMat = openInterior || openGround ? fm.front.clone() : fm.front;
  const backMat = openInterior ? fm.front.clone() : fm.front;
  if (!openInterior) nightEmitters.push(fm.front, fm.side);
  if (openGround) nightEmitters.push(frontMat);
  // core & plinth
  if (by > 0) meshBox(g, mats.facadeStone, w + .9, by, d + .9, 0, by / 2, 0);
  else meshBox(g, mats.stoneDark, w + .7, .8, d + .7, 0, .4, 0);
  // openInterior：不填实心体，由内景模块另建墙壳/楼板；外立面贴图仍在
  if (!openInterior && openGround) {
    // 首层前脸掏空：后方 5.3m 实体 + 两端实体 + 上部整层压顶，形成 2.2m 进深外廊
    const ogD = 2.2, ogT = floorH;
    meshBox(g, mats.plaster, w, ogT, d - ogD, 0, ogT / 2, -ogD / 2);
    const lw = openGround.x0 + w / 2, rw = w / 2 - openGround.x1;
    if (lw > .02) meshBox(g, mats.plaster, lw, ogT, ogD, -w / 2 + lw / 2, ogT / 2, d / 2 - ogD / 2);
    if (rw > .02) meshBox(g, mats.plaster, rw, ogT, ogD, w / 2 - rw / 2, ogT / 2, d / 2 - ogD / 2);
    meshBox(g, mats.plaster, w, h - ogT, d, 0, ogT + (h - ogT) / 2, 0);
  } else if (!openInterior) {
    meshBox(g, mats.plaster, w, h, d - cd, 0, by + h / 2, -cd / 2);
  }
  g.userData.frontFacade = frontMat;
  g.userData.backFacade = backMat;
  // facades
  const front = new THREE.Mesh(new THREE.PlaneGeometry(w, h), frontMat);
  front.position.set(0, by + h / 2, d / 2 - cd + .012); g.add(front);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), backMat);
  back.position.set(0, by + h / 2, -d / 2 - .012); back.rotation.y = Math.PI; g.add(back);
  const sideD = closedCorridorEnds && corridor ? d : d - cd;
  const sideZ = closedCorridorEnds && corridor ? 0 : -cd / 2;
  const left = new THREE.Mesh(new THREE.PlaneGeometry(sideD, h), fm.side);
  left.position.set(-w / 2 - .012, by + h / 2, sideZ); left.rotation.y = -Math.PI / 2; g.add(left);
  const right = left.clone(); right.position.x = w / 2 + .012; right.rotation.y = Math.PI / 2; g.add(right);
  g.userData.sidePlanes = { left, right };   // 供内景模块在山墙贴图上开洞
  // white bands at floor lines (3D relief)
  const bands = [];
  for (let f = 0; f <= floors; f++) {
    const y = by + 1.2 + f * floorH;
    if (openInterior || openGround) {
      // 只做四周贴墙的腰线，避免整块横板切断室内/外廊；首层腰线会横穿门洞/窗，跳过
      if (f === 0) continue;
      bands.push(tbox(w + .28, .16, .32, 0, y, d / 2 - cd, 0));
      bands.push(tbox(w + .28, .16, .32, 0, y, -d / 2, 0));
      bands.push(tbox(.32, .16, sideD + .28, -w / 2, y, sideZ, 0));
      bands.push(tbox(.32, .16, sideD + .28, w / 2, y, sideZ, 0));
    } else {
      bands.push(tbox(w + .28, .16, d - cd + .28, 0, y, -cd / 2, 0));
    }
  }
  addMerged(g, bands, mats.plasterCool);
  if (openInterior) nightEmitters.push(frontMat, backMat, fm.side);
  if (openGround) {
    // 首层立面挖空 + 方柱外廊：靠花池一侧看得见廊下、进得去
    const ogD = 2.2, ogT = floorH;
    punchFacade(g, 'front', w, h, by, [{ x0: openGround.x0, x1: openGround.x1, y0: .84, y1: ogT - .03 }]);
    const bays = Math.max(3, Math.round((openGround.x1 - openGround.x0) / 3.7));
    const colsX = [];
    for (let i = 0; i <= bays; i++) {
      const cx = openGround.x0 + (openGround.x1 - openGround.x0) * (i / bays);
      colsX.push(cx);
      meshBox(g, mats.plaster, .34, ogT - .8, .34, cx, .8 + (ogT - .8) / 2, d / 2 - .17);
    }
    // 通长三级台阶：与开口同长，单级 ≤.35（0.8/0.533/0.267），台阶顶与廊内 .8 走面搭接
    const steps = [];
    for (let i = 0; i < 3; i++) {
      const top = .8 - .2667 * i, z0 = d / 2 + .35 + i * .4, z1 = z0 + .42;
      meshBox(g, mats.facadeStone, openGround.x1 - openGround.x0, top, z1 - z0,
        (openGround.x0 + openGround.x1) / 2, top / 2, z0 + .21);
      steps.push({ x0: openGround.x0, x1: openGround.x1, z0, z1, y: top });
    }
    g.userData.openGround = {
      x0: openGround.x0, x1: openGround.x1, z0: d / 2 - ogD, z1: d / 2, y: .8, top: ogT, colsX, steps,
    };
  }
  // red fascia / parapet band
  meshBox(g, mats.redBeam, w + .35, .34, d - cd + .35, 0, by + h - .1, -cd / 2);
  meshBox(g, mats.plasterCool, w + .55, .18, d - cd + .55, 0, by + h + .08, -cd / 2);
  // roof
  if (flatRoof) {
    // 平屋顶：4 层长方体顶部露台（上人屋面）
    meshBox(g, mats.roofDark, w + .7, .2, d - cd + .7, 0, by + h + .1, -cd / 2);
  } else {
    const roof = hipRoofGroup({ W: w + 2.2, D: d + 2.2 - cd, H: roofH, tileMat: roofMat || mats.roofDark, ridgeMat: mats.ridge, fasciaMat: mats.ridge, ridgeRatio: .45, cornerLift: .5 });
    roof.position.y = by + h + .05; g.add(roof);
  }
  // 连续外廊：楼板 + 灰色栏板 + 方柱（51.37 蛟川教学楼）
  if (corridor) {
    const slabs = [], rails = [], cols = [];
    const bays = Math.max(4, Math.round(w / 3.7));
    // 外廊栏板/立柱在楼梯口位置留缺口
    const gaps = (corridorGaps || []).slice().sort((a, b) => a[0] - b[0]);
    const railSpans = [];
    let cur = -w / 2;
    for (const [g0, g1] of gaps) {
      if (g0 > cur + .05) railSpans.push([cur, Math.min(g0, w / 2)]);
      cur = Math.max(cur, g1);
    }
    if (cur < w / 2 - .05) railSpans.push([cur, w / 2]);
    for (let f = 0; f <= floors; f++) {
      const y = by + f * floorH;
      slabs.push(tbox(w, .22, cd, 0, y, d / 2 - cd / 2, 0));
      if (f < floors) {
        // 楼梯口只在首层留缺口，上层必须有连续栏板
        for (const [a, b] of (f === 0 ? railSpans : [[-w / 2, w / 2]])) {
          rails.push(tbox(b - a, .96, .1, (a + b) / 2, y + .56, d / 2 - .06, 0));
          rails.push(tbox(b - a + .06, .1, .18, (a + b) / 2, y + 1.06, d / 2 - .06, 0));
        }
      }
    }
    for (let i = 0; i <= bays; i++) {
      const bx = -w / 2 + w * i / bays;
      if (gaps.some(([g0, g1]) => bx > g0 - .2 && bx < g1 + .2)) continue;
      cols.push(tbox(.34, h, .34, bx, by + h / 2, d / 2 - .17, 0));
    }
    addMerged(g, slabs, mats.plasterCool);
    addMerged(g, rails, railMat || mats.facadeStone);
    addMerged(g, cols, mats.plasterCool);
    if (closedCorridorEnds) {
      // 外廊东西两端封实墙：向南再补 .5m 与副楼北墙齐平，侧立面不再出现通高缺口
      const ends = [];
      for (const s of [-1, 1]) ends.push(tbox(.3, h, d + .5, s * (w / 2 - .15), by + h / 2, .25, 0));
      addMerged(g, ends, mats.plasterCool);
    }
  }
  // 双跑石阶入口（基座抬高时从场坪上到外廊层）；否则沿用雨棚式入口
  if (corridor && by > 0) {
    const sw = Math.min(5.6, w * .1);
    // 外廊可进入时台阶顶步与基座外沿搭接
    const sz = corridorGaps && corridorGaps.length ? d / 2 + .15 : d / 2 + .3;
    for (const s of [-1, 1]) addSteps(g, mats.stone, s * (sw / 2 + 1.2), sz, sw, by, 6.0, 13);
    meshBox(g, mats.stoneDark, 2.2, by, 5.8, 0, by / 2, d / 2 + 3.2);
    meshBox(g, mats.grass, 1.9, .18, 5.4, 0, by + .09, d / 2 + 3.2);
    for (const s of [-1, 1]) meshBox(g, mats.stoneDark, .36, 1.05, 6.2, s * (sw + 1.2), .52, d / 2 + 3.3);
  } else if (entrance && !porch) {
    // entrance canopy
    const canW = Math.min(9, w * .38);
    meshBox(g, mats.plasterCool, canW, .4, 4.2, 0, 4.1, d / 2 + 2.0);
    meshBox(g, mats.darkMetal, canW - .3, .16, 4.0, 0, 3.88, d / 2 + 2.0);
    for (const s of [-1, 1]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(.22, .24, 3.9, 8), mats.plasterCool);
      col.position.set(s * (canW / 2 - .5), 2.0, d / 2 + 3.6); col.castShadow = true; g.add(col);
    }
    addSteps(g, mats.stone, 0, d / 2 + 4.3, canW + 1.5, .7, 1.6, 3);
  }
  // 红柱灰瓦门廊（视频 75-104s 行政楼）：石砌台基 + 红柱 + 灰瓦小坡顶 + 黑玻璃门 + 造型松
  if (porch) {
    const pw = Math.min(7.4, w * .34), pd = 2.4;
    const py = by;
    meshBox(g, mats.stone, pw, py, pd, 0, py / 2, d / 2 + pd / 2);
    addSteps(g, mats.stone, 0, d / 2 + pd, pw + 1.0, py, 1.2, 3);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.9), mats.glass);
    door.position.set(0, py + 1.5, d / 2 + .02); g.add(door);
    meshBox(g, mats.black, 2.82, .12, .12, 0, py + 2.98, d / 2 + .06);
    for (const s of [-1, 1]) meshBox(g, mats.black, .12, 2.9, .12, s * 1.36, py + 1.5, d / 2 + .06);
    const colGeos = [];
    for (const x0 of [-pw / 2 + .35, -1.9, 1.9, pw / 2 - .35]) {
      colGeos.push(tbox(.28, 3.15, .28, x0, py + 1.575, d / 2 + pd - .3, 0));
    }
    addMerged(g, colGeos, mats.redBeam);
    meshBox(g, mats.redBeam, pw + .4, .26, .3, 0, py + 3.2, d / 2 + pd - .3);
    const proof = hipRoofGroup({ W: pw + 1.3, D: pd + 1.1, H: .72, tileMat: mats.roof, ridgeMat: mats.ridge, fasciaMat: mats.redBeam, ridgeRatio: .4, cornerLift: 0 });
    proof.position.set(0, py + 3.33, d / 2 + pd / 2); g.add(proof);
    for (const s of [-1, 1]) {
      const px = s * (pw / 2 + .85), pz = d / 2 + pd / 2;
      meshBox(g, mats.plasterCool, .7, .85, .7, px, .425, pz);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.09, .12, .9, 6), mats.woodDark);
      trunk.position.set(px, 1.3, pz); g.add(trunk);
      for (let i = 0; i < 3; i++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(.62 - i * .12, .85, 8), mats.grassDark);
        cone.position.set(px, 1.65 + i * .4, pz); cone.castShadow = true; g.add(cone);
      }
    }
  }
  // glass atrium
  if (glassAtrium) {
    const gw = Math.min(8, w * .3), gd = 3.6, gh = h * .78;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(gw, gh, gd), mats.glass);
    glass.position.set(0, gh / 2 + .6, d / 2 + .4); g.add(glass);
    const frameMat = mats.plasterCool;
    for (let i = 0; i <= 4; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(.14, gh, .14), frameMat);
      m.position.set(-gw / 2 + i * gw / 4, gh / 2 + .6, d / 2 + gd / 2 + .4); g.add(m);
    }
    for (let j = 0; j <= 5; j++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(gw, .12, .12), frameMat);
      m.position.set(0, .6 + j * gh / 5, d / 2 + gd / 2 + .4); g.add(m);
    }
    const warm = new THREE.PointLight(0xffc07a, 0, 22, 1.8);
    warm.position.set(0, gh * .5, d / 2 + 2); warm.userData.baseIntensity = 8;
    g.add(warm); ctx.nightLights.push(warm);
  }
  // rooftop details（实景中教学楼层顶为干净瓦面，仅留小楼梯间）
  if (roofBulk) {
    const bulk = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.1, 2.6), mats.plasterCool);
    bulk.position.set(w * .22, by + h + 1.2, -d * .15); bulk.castShadow = true; g.add(bulk);
  }
  g.position.set(x, 0, z); g.rotation.y = ry;
  group.add(g);
  return g;
}

// ------------------------------------------------------------------
// 电教楼：回字形平面（外轮廓 47×48，居中内院 20×20）。
// 东西两块为 5 层长条（进深占满 48m）；南北两块为 5.5 层（宽 20m，夹在内院两侧），平屋顶。
export function buildDianjiaoRing(ctx, {
  x, z, w = 47, d = 48, court = 20, floorsEW = 5, floorsNS = 5.5, key = 'lab',
  glassAtrium = false, entrance = true, roofBulk = true
} = {}) {
  const { group, mats, nightEmitters, nightLights } = ctx;
  const g = new THREE.Group();
  const floorH = 3.45;
  const hEW = floorsEW * floorH + 1.2;    // 东西块 5 层：18.45
  const hNS = floorsNS * floorH + 1.2;    // 南北块 5.5 层：20.175
  const hFace = floorsEW * floorH + 1.2;  // 立面贴图按 5 层窗排绘制
  const ewW = (w - court) / 2;            // 东西块宽 13.5
  const nsD = (d - court) / 2;            // 南北块深 14
  const xEW = court / 2 + ewW / 2;        // 16.75
  const zNS = court / 2 + nsD / 2;        // 17

  // 四块主体（内院不填）
  meshBox(g, mats.plaster, ewW, hEW, d, xEW, hEW / 2, 0);
  meshBox(g, mats.plaster, ewW, hEW, d, -xEW, hEW / 2, 0);
  meshBox(g, mats.plaster, court, hNS, nsD, 0, hNS / 2, zNS);
  meshBox(g, mats.plaster, court, hNS, nsD, 0, hNS / 2, -zNS);
  // 石砌基座：逐块铺，内院留空
  meshBox(g, mats.stoneDark, ewW + .7, .8, d, xEW, .4, 0);
  meshBox(g, mats.stoneDark, ewW + .7, .8, d, -xEW, .4, 0);
  meshBox(g, mats.stoneDark, court, .8, nsD + .7, 0, .4, zNS);
  meshBox(g, mats.stoneDark, court, .8, nsD + .7, 0, .4, -zNS);

  // 内院地面（石板，无入口）
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(court, court), mats.slab);
  yard.rotation.x = -Math.PI / 2; yard.position.y = .065; yard.receiveShadow = true; g.add(yard);

  // 立面材质：48m 长面 / 20m 短面 / 13.5m 端面 各自 repeat
  const fmWide = cloneFacadeMats(mats, key, d, ewW, hFace);
  const fmNarrow = cloneFacadeMats(mats, key, court, court, hFace);
  const fmEnd = cloneFacadeMats(mats, key, ewW, d, hFace);
  nightEmitters.push(fmWide.front, fmNarrow.front, fmEnd.front);
  const face = (mat, pw, ph, px, py, pz, ry) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), mat);
    p.position.set(px, py, pz); p.rotation.y = ry; g.add(p);
  };
  // 外立面：南（中间 20m 高、两端 13.5m 低）、北、东、西
  face(fmNarrow.front, court, hFace, 0, hFace / 2, d / 2 + .012, 0);
  face(fmEnd.front, ewW, hEW, xEW, hEW / 2, d / 2 + .012, 0);
  face(fmEnd.front, ewW, hEW, -xEW, hEW / 2, d / 2 + .012, 0);
  face(fmNarrow.front, court, hFace, 0, hFace / 2, -d / 2 - .012, Math.PI);
  face(fmEnd.front, ewW, hEW, xEW, hEW / 2, -d / 2 - .012, Math.PI);
  face(fmEnd.front, ewW, hEW, -xEW, hEW / 2, -d / 2 - .012, Math.PI);
  face(fmWide.front, d, hEW, w / 2 + .012, hEW / 2, 0, Math.PI / 2);
  face(fmWide.front, d, hEW, -w / 2 - .012, hEW / 2, 0, -Math.PI / 2);
  // 内院四立面
  face(fmNarrow.front, court, hFace, 0, hFace / 2, court / 2 - .012, Math.PI);
  face(fmNarrow.front, court, hFace, 0, hFace / 2, -court / 2 + .012, 0);
  face(fmNarrow.front, court, hEW, court / 2 - .012, hEW / 2, 0, -Math.PI / 2);
  face(fmNarrow.front, court, hEW, -court / 2 + .012, hEW / 2, 0, Math.PI / 2);

  // 层间白带（东西块包裹整块，南北块沿内院宽度）
  const bandsEW = [], bandsNS = [];
  for (let f = 0; f <= floorsEW; f++) {
    const y = 1.2 + f * floorH;
    bandsEW.push(tbox(ewW + .28, .16, d, xEW, y, 0, 0));
    bandsEW.push(tbox(ewW + .28, .16, d, -xEW, y, 0, 0));
    bandsNS.push(tbox(court, .16, nsD + .28, 0, y, zNS, 0));
    bandsNS.push(tbox(court, .16, nsD + .28, 0, y, -zNS, 0));
  }
  bandsNS.push(tbox(court, .16, nsD + .28, 0, hNS, zNS, 0));
  bandsNS.push(tbox(court, .16, nsD + .28, 0, hNS, -zNS, 0));
  addMerged(g, bandsEW, mats.plasterCool);
  addMerged(g, bandsNS, mats.plasterCool);

  // 红檐带 + 白色女儿墙
  for (const s of [-1, 1]) {
    meshBox(g, mats.redBeam, ewW + .35, .34, d + .35, s * xEW, hEW - .1, 0);
    meshBox(g, mats.plasterCool, ewW + .55, .18, d + .55, s * xEW, hEW + .08, 0);
    meshBox(g, mats.redBeam, court + .35, .34, nsD + .35, 0, hNS - .1, s * zNS);
    meshBox(g, mats.plasterCool, court + .55, .18, nsD + .55, 0, hNS + .08, s * zNS);
  }
  // 平屋顶
  for (const s of [-1, 1]) {
    meshBox(g, mats.roofDark, ewW + .7, .2, d + .7, s * xEW, hEW + .1, 0);
    meshBox(g, mats.roofDark, court + .7, .2, nsD + .7, 0, hNS + .1, s * zNS);
  }

  // 南侧入口雨棚 + 玻璃中庭（位于 20m 南块中央）
  if (entrance) {
    const canW = Math.min(9, court * .38);
    meshBox(g, mats.plasterCool, canW, .4, 4.2, 0, 4.1, d / 2 + 2.0);
    meshBox(g, mats.darkMetal, canW - .3, .16, 4.0, 0, 3.88, d / 2 + 2.0);
    for (const s of [-1, 1]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(.22, .24, 3.9, 8), mats.plasterCool);
      col.position.set(s * (canW / 2 - .5), 2.0, d / 2 + 3.6); col.castShadow = true; g.add(col);
    }
    addSteps(g, mats.stone, 0, d / 2 + 4.3, canW + 1.5, .7, 1.6, 3);
  }
  if (glassAtrium) {
    const gw = Math.min(8, court * .3), gd = 3.6, gh = hFace * .78;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(gw, gh, gd), mats.glass);
    glass.position.set(0, gh / 2 + .6, d / 2 + .4); g.add(glass);
    for (let i = 0; i <= 4; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(.14, gh, .14), mats.plasterCool);
      m.position.set(-gw / 2 + i * gw / 4, gh / 2 + .6, d / 2 + gd / 2 + .4); g.add(m);
    }
    for (let j = 0; j <= 5; j++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(gw, .12, .12), mats.plasterCool);
      m.position.set(0, .6 + j * gh / 5, d / 2 + gd / 2 + .4); g.add(m);
    }
    const warm = new THREE.PointLight(0xffc07a, 0, 22, 1.8);
    warm.position.set(0, gh * .5, d / 2 + 2); warm.userData.baseIntensity = 8;
    g.add(warm); nightLights.push(warm);
  }
  // 北块屋顶小楼梯间
  if (roofBulk) {
    const bulk = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.1, 2.6), mats.plasterCool);
    bulk.position.set(-4.5, hNS + 1.15, -zNS); bulk.castShadow = true; g.add(bulk);
  }
  g.position.set(x, 0, z);
  group.add(g);
  return g;
}

function textTextureLocal(text) {
  // lazy import avoidance: create a small sign canvas
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#e7e1d2'; g.fillRect(0, 0, 512, 128);
  g.fillStyle = '#3a3a34'; g.font = 'bold 64px "Songti SC","STSong",serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 68);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ------------------------------------------------------------------
export function buildTrack(ctx) {
  const { group, mats, nightEmitters, nightLights } = ctx;
  const g = new THREE.Group();
  const CX = 80, CZ = 69;
  const outerW = 92, outerD = 176, innerW = 76, innerD = 160;
  const halfLo = (outerD - outerW) / 2, halfLi = (innerD - innerW) / 2;
  const ro = outerW / 2, ri = innerW / 2;

  function stadiumShape(hw, halfL, clockwise = false) {
    const s = new THREE.Shape();
    // start bottom-right straight
    s.moveTo(hw, -halfL);
    s.lineTo(hw, halfL);
    s.absarc(0, halfL, hw, 0, Math.PI, false);
    s.lineTo(-hw, -halfL);
    s.absarc(0, -halfL, hw, Math.PI, Math.PI * 2, false);
    return s;
  }
  function stadiumPath(hw, halfL, n = 80) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push(new THREE.Vector3(hw, 0, -halfL + t * 2 * halfL));
    }
    for (let i = 1; i <= n; i++) {
      const a = (i / n) * Math.PI;
      pts.push(new THREE.Vector3(Math.cos(a) * hw, 0, halfL + Math.sin(a) * hw));
    }
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      pts.push(new THREE.Vector3(-hw, 0, halfL - t * 2 * halfL));
    }
    for (let i = 1; i <= n; i++) {
      const a = Math.PI + (i / n) * Math.PI;
      pts.push(new THREE.Vector3(Math.cos(a) * hw, 0, -halfL + Math.sin(a) * hw));
    }
    return pts;
  }

  const outerShape = stadiumShape(ro, halfLo);
  const innerShape = stadiumShape(ri, halfLi);
  outerShape.holes.push(new THREE.Path(innerShape.getPoints(80)));
  const trackGeo = new THREE.ShapeGeometry(outerShape, 80);
  trackGeo.rotateX(-Math.PI / 2);
  const track = new THREE.Mesh(trackGeo, mats.track);
  track.position.y = .09; track.receiveShadow = true; g.add(track);
  // infield
  const infieldGeo = new THREE.ShapeGeometry(stadiumShape(ri - .2, halfLi), 80);
  infieldGeo.rotateX(-Math.PI / 2);
  const infield = new THREE.Mesh(infieldGeo, mats.infield);
  infield.position.y = .075; infield.receiveShadow = true; g.add(infield);
  // lane lines
  for (let lane = 0; lane <= 8; lane++) {
    const hw = ri + (ro - ri) * (lane / 8);
    const halfL = halfLi + (halfLo - halfLi) * (lane / 8);
    const pts = stadiumPath(hw - .05, halfL - .05).map(p => p.setY(.105));
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xe9e3d2, transparent: true, opacity: .55 }));
    g.add(line);
  }
  // start / finish
  const finish = new THREE.Mesh(new THREE.PlaneGeometry(ro - ri, .35), mats.whiteLine);
  finish.rotation.x = -Math.PI / 2; finish.position.set((ro + ri) / 2, .11, halfLo - .5); g.add(finish);
  // soccer pitch lines
  const lineGeoms = [];
  const pitchW = innerW * .82, pitchD = innerD * .82;
  for (const [w, d, x, z] of [
    [pitchW, .12, 0, -pitchD / 2], [pitchW, .12, 0, pitchD / 2],
    [.12, pitchD, -pitchW / 2, 0], [.12, pitchD, pitchW / 2, 0],
    [pitchD * .28, .1, 0, 0]
  ]) lineGeoms.push(tbox(w, .02, d, x, .11, z, 0));
  // center circle
  const circle = new THREE.Mesh(new THREE.RingGeometry(4.2, 4.45, 40), mats.whiteLine);
  circle.rotation.x = -Math.PI / 2; circle.position.y = .112; g.add(circle);
  addMerged(g, lineGeoms, mats.whiteLine);
  // goals
  for (const s of [-1, 1]) {
    for (const sx of [-4.2, 4.2]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, 2.6, 6), mats.whiteLine);
      post.position.set(sx, 1.3, s * pitchD / 2); g.add(post);
    }
    const cross = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, 8.5, 6), mats.whiteLine);
    cross.rotation.z = Math.PI / 2; cross.position.set(0, 2.55, s * pitchD / 2); g.add(cross);
  }
  // 跑道西侧的粉色球场群（篮球场×2 / 司令台 / 排球场）
  {
    const pinkMat = new THREE.MeshStandardMaterial({ color: 0xa9584f, roughness: .92 });
    const courts = [
      [-55, -70, 14, 27, true], // 篮球场（南）
      [-56, -43, 14, 27, true], // 篮球场（北）
      [-52, -11, 13, 24, false], // 司令台
      [-54, 27, 15, 24, false],  // 排球场
    ];
    for (const [x, z, w, d, teal] of courts) {
      const pad = new THREE.Mesh(new THREE.BoxGeometry(w, .08, d), pinkMat);
      pad.position.set(x, .10, z); pad.receiveShadow = true; g.add(pad);
      // 篮球场：红色围边内套青绿场地＋红色中圈（45.05/52.54）
      if (teal) {
        const inner = new THREE.Mesh(new THREE.BoxGeometry(w - 3.0, .04, d - 3.0), new THREE.MeshStandardMaterial({ color: 0x6aa294, roughness: .92 }));
        inner.position.set(x, .145, z); inner.receiveShadow = true; g.add(inner);
        const ring = new THREE.Mesh(new THREE.RingGeometry(1.35, 1.55, 32), pinkMat.clone());
        ring.rotation.x = -Math.PI / 2; ring.position.set(x, .17, z); g.add(ring);
      }
      const lg = [];
      lg.push(tbox(w, .02, .12, x, .16, z - d / 2 + .2, 0), tbox(w, .02, .12, x, .16, z + d / 2 - .2, 0));
      lg.push(tbox(.12, .02, d, x - w / 2 + .2, .16, z, 0), tbox(.12, .02, d, x + w / 2 - .2, .16, z, 0));
      lg.push(tbox(w, .02, .12, x, .16, z, 0));
      addMerged(g, lg, mats.whiteLine);
    }
    // 司令台（52.29：灰瓦长厅＋深出檐横向板带，台上红木围栏，楼梯在两端）
    {
      const stand = new THREE.Group();
      const SW = 24, SD = 8, SH = 1.4;
      // 深出檐下近全阴影，按实景补少量天光反射，避免台身与后墙发黑
      const standWall = new THREE.MeshStandardMaterial({ map: mats.plasterTex, color: 0xf3f1e9, roughness: .92, emissive: 0x4a4843, emissiveIntensity: .8 });
      const standStone = new THREE.MeshStandardMaterial({ map: mats.stoneTex, color: 0xffffff, roughness: .93, emissive: 0x2e2d28, emissiveIntensity: 1 });
      // 舞台：灰砖台身＋深色台面
      meshBox(stand, standStone, SW, SH, SD, 0, SH / 2, 0);
      meshBox(stand, mats.woodDark, SW + .2, .12, SD + .2, 0, SH + .06, 0);
      // 后墙：仅保留西侧 1 m 厚墙，南北两侧不设墙
      meshBox(stand, standWall, SW, 4.4, 1.0, 0, SH + 2.2, -SD / 2 + .5);
      // 后墙白框窗与檐下深色通风口
      for (const wx of [-9.5, -3.2, 3.2, 9.5]) {
        meshBox(stand, mats.plasterCool, 2.2, 1.8, .1, wx, SH + 2.2, -SD / 2 + 1.02);
        meshBox(stand, mats.darkMetal, 1.9, 1.5, .1, wx, SH + 2.2, -SD / 2 + 1.08);
        meshBox(stand, mats.darkMetal, 1.6, .75, .08, wx, SH + 3.65, -SD / 2 + 1.05);
      }
      // 檐下横向板带（灰绿板材＋白色边框）
      const standBand = new THREE.MeshStandardMaterial({ map: mats.stonePanelTex, color: 0xa9aaa5, roughness: .86, emissive: 0x3a3c38, emissiveIntensity: .7 });
      meshBox(stand, standBand, SW + 3.2, 1.5, SD + 3.4, 0, SH + 4.55, 0);
      const bandGeoms = [];
      for (const s of [-1, 1]) {
        bandGeoms.push(tbox(SW + 3.4, .1, .12, 0, SH + 5.32, s * (SD / 2 + 1.75), 0));
        bandGeoms.push(tbox(SW + 3.4, .1, .12, 0, SH + 3.78, s * (SD / 2 + 1.75), 0));
        bandGeoms.push(tbox(.12, .1, SD + 3.4, s * (SW / 2 + 1.65), SH + 5.32, 0, 0));
      }
      for (let i = 0; i <= 7; i++) {
        const bx = -SW / 2 - 1.6 + (SW + 3.2) * i / 7;
        bandGeoms.push(tbox(.12, 1.5, .12, bx, SH + 4.55, SD / 2 + 1.72, 0));
      }
      addMerged(stand, bandGeoms, mats.plasterCool);
      // 灰瓦四坡屋顶（出檐覆盖舞台）
      const standRoof = hipRoofGroup({ W: SW + 4.4, D: SD + 4.6, H: 2.0, tileMat: mats.roof, ridgeMat: mats.ridge, fasciaMat: mats.ridge, ridgeRatio: .5, cornerLift: .9 });
      standRoof.position.y = SH + 5.35; stand.add(standRoof);
      // 台面红木围栏：正面（东）通长＋南北两侧东半段，西半段留楼梯口
      const railY = SH + .12;
      const railOpt = { h: 1.0, postEvery: 1.5, postW: .16, railW: .12, railMat: mats.wood };
      addBalustrade(stand, mats.wood, [[-SW / 2 + .12, SD / 2 - .1], [SW / 2 - .12, SD / 2 - .1]], railY, railOpt);
      for (const s of [-1, 1]) {
        addBalustrade(stand, mats.wood, [[s * (SW / 2 - .1), .2], [s * (SW / 2 - .1), SD / 2 - .12]], railY, railOpt);
      }
      // 楼梯：东西朝向，与司令台并列（南北各一部，自东向西上台）＋红木扶手
      const RUN = 3.6, slope = Math.atan2(SH, RUN);
      for (const s of [-1, 1]) {
        const sx = s * (SW / 2 + 1.7);
        addSteps(stand, mats.stone, sx, -RUN / 2, 3.2, SH, RUN, 5);
        for (const ox of [-1.55, 1.55]) {
          const rail = new THREE.Mesh(new THREE.BoxGeometry(.12, .12, RUN / Math.cos(slope) + .3), mats.wood);
          rail.position.set(sx + ox, SH / 2 + 1.0, 0);
          rail.rotation.x = slope;
          rail.castShadow = true; stand.add(rail);
          for (const dz of [-1.4, 0, 1.4]) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(.11, .95, .11), mats.wood);
            post.position.set(sx + ox, SH * (1 - (dz + RUN / 2) / RUN) + .47, dz);
            post.castShadow = true; stand.add(post);
          }
        }
      }
      // 西段顶面与司令台面同高（SH），水平延伸至与西墙相连（仅补平台，不动楼梯）
      for (const s of [-1, 1]) {
        const sx = s * (SW / 2 + 1.7);
        meshBox(stand, standStone, 3.2, SH, 1.9, sx, SH / 2, -RUN / 2 - 1.0);
      }
      stand.position.set(-52, 0, -11);
      stand.rotation.y = Math.PI / 2;   // 正面朝东对跑道
      g.add(stand);
    }
    // 篮球架
    for (const [bx, bz, s] of [[-50, -81, 1], [-50, -59, -1], [-51, -54, 1], [-51, -32, -1]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.14, .18, 3.6, 8), mats.darkMetal);
      pole.position.set(bx, 1.8, bz); pole.castShadow = true; g.add(pole);
      const board = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, .16), mats.whiteLine);
      board.position.set(bx, 3.4, bz - s * .5); g.add(board);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(.4, .06, 6, 14), new THREE.MeshStandardMaterial({ color: 0xd8793c, roughness: .5 }));
      rim.rotation.x = Math.PI / 2; rim.position.set(bx, 3.0, bz - s * 1.1); g.add(rim);
    }
  }
  // floodlights
  for (const [fx, fz] of [[ro + 4, -halfLo - 8], [ro + 4, halfLo + 8], [-ro - 4, -halfLo - 8], [-ro - 4, halfLo + 8]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.18, .28, 20, 8), mats.darkMetal);
    pole.position.set(fx, 10, fz); pole.castShadow = true; g.add(pole);
    const head = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.5, .5, 3.2), mats.windowGlow);
      lamp.position.set(0, 19.6 + i * .55, 0); head.add(lamp);
    }
    head.position.set(fx, 0, fz); head.rotation.x = -0.25; g.add(head);
    const glow = makeGlowSprite(mats.glowTex, 0xffd39a, 9, 0.0);
    glow.position.set(fx, 20.5, fz); glow.userData.nightOpacity = .35; g.add(glow);
    nightEmitters.push(head.children[0]);
    nightEmitters.push(glow);
    const li = new THREE.PointLight(0xffd7a0, 0, 72, 1.7);
    li.position.set(fx, 19.5, fz); li.userData.baseIntensity = 300;
    g.add(li); nightLights.push(li);
  }
  g.position.set(CX, 0, CZ);
  group.add(g);
  return g;
}

// ------------------------------------------------------------------
export function buildGym(ctx) {
  const { group, mats } = ctx;
  const g = new THREE.Group();
  const W = 36, D = 33, H = 11.4; // 三层主楼（倒凸字形中间凸出块；北端不动、南端后缩 5m）
  // 基座
  meshBox(g, mats.stone, W + 4, .9, D + 4, 0, .45, 0);
  // 主体：灰色石材幕墙（14.53.30 / 14.51.13）
  // 2026-10-25 用户指定：只掏空一层，二层及以上保持实心；东西两侧与两翼全高打通
  const f1 = 3.9, tw = .5;                 // 一层净高顶（与楼层压线同高）、墙厚
  const upperH = H + .7 - f1;              // 3.9…12.1
  meshBox(g, mats.facadeStone, W, upperH, D, 0, f1 + upperH / 2, 0);
  meshBox(g, mats.facadeStone, W, f1 - .7, tw, 0, (.7 + f1) / 2, -D / 2 + tw / 2);
  meshBox(g, mats.facadeStone, W, f1 - .7, tw, 0, (.7 + f1) / 2, D / 2 - tw / 2);
  for (const s of [-1, 1]) {
    // 侧墙只留南段（z −3.5…16.5）；北段 z −16.5…−3.5 为通往两翼的通口
    meshBox(g, mats.facadeStone, tw, f1 - .7, 20, s * (W / 2 - tw / 2), (.7 + f1) / 2, 6.5);
  }
  // 正面中部玻璃幕墙
  const gw = W * .34, gh = H * .5;
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(gw, gh), mats.glass);
  glass.position.set(0, H * .42, D / 2 + .03); g.add(glass);
  for (let i = 0; i <= 6; i++) {
    meshBox(g, mats.plasterCool, .16, gh, .26, -gw / 2 + i * gw / 6, H * .42, D / 2 + .12);
  }
  // 侧立面下部横向暗窗带
  for (const s of [-1, 1]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(D * .82, 1.9), mats.glass);
    win.position.set(s * (W / 2 + .02), 4.5, 0); win.rotation.y = s * Math.PI / 2; g.add(win);
  }
  // 上部红褐色横向百叶带：长边通长，短边避开门厅
  const louver = (len, x, z, ry) => {
    const geos = [];
    for (let i = 0; i < 8; i++) {
      geos.push(tbox(len, .12, .3, x, H - 2.9 + i * .24, z, ry));
    }
    const mesh = new THREE.Mesh(mergeGeometriesSafe(geos), mats.redDark);
    mesh.castShadow = true; g.add(mesh);
  };
  for (const s of [-1, 1]) louver(D * .86, s * (W / 2 + .18), 0, Math.PI / 2);
  for (const s of [-1, 1]) {
    const seg = (W - gw) / 2 - 2;
    louver(seg, s * (gw / 2 + seg / 2 + .6), D / 2 + .18, 0);
    louver(seg, s * (gw / 2 + seg / 2 + .6), -D / 2 - .18, 0);
  }
  // 竖向石柱（墙垛），正面中部让出门厅
  const piers = [];
  for (let i = 0; i <= 8; i++) {
    const z = -D / 2 + i * D / 8;
    for (const s of [-1, 1]) piers.push(tbox(.6, H + .2, .55, s * (W / 2 + .25), H / 2 + .7, z, 0));
  }
  for (let i = 0; i <= 12; i++) {
    const x = -W / 2 + i * W / 12;
    if (Math.abs(x) < gw / 2 + 1.2) continue;
    for (const s of [-1, 1]) piers.push(tbox(.55, H + .2, .6, x, H / 2 + .7, s * (D / 2 + .25), 0));
  }
  const pierMesh = new THREE.Mesh(mergeGeometriesSafe(piers), mats.facadeStone);
  pierMesh.castShadow = true; pierMesh.receiveShadow = true; g.add(pierMesh);
  // 楼层石材压线（三层）
  for (const y of [3.9, 7.5]) meshBox(g, mats.plasterCool, W + 1.1, .16, D + 1.1, 0, y, 0);
  // 红色檐带 + 浅灰压顶
  meshBox(g, mats.redBeam, W + 2.6, .55, D + 2.6, 0, H + .75, 0);
  meshBox(g, mats.plasterCool, W + 3.1, .2, D + 3.1, 0, H + 1.05, 0);
  // 单一深蓝灰瓦四坡顶：满铺整个中间块
  const roof = hipRoofGroup({ W: W + 4, D: D + 5.2, H: 2.4, tileMat: mats.roofSlate, ridgeMat: mats.ridge, fasciaMat: mats.redDark, ridgeRatio: .55, cornerLift: .3 });
  roof.position.set(0, H + 1.1, 0); g.add(roof);
  // 夜间入口照明
  const li = new THREE.PointLight(0xffc887, 0, 30, 1.8);
  li.position.set(0, 8, D / 2 + 2); li.userData.baseIntensity = 10;
  g.add(li); ctx.nightLights.push(li);
  // 一层内景：基座顶面 .9 即地面，走面一直铺到两翼 .94 地面；墙面/壁柱按段碰撞
  const cols = [
    { x: 0, z: 0, hx: 20, hz: 18.5, y1: .9 },     // 基座：地面层封边，馆内 .9 以上不生效
    { x: 0, z: -16.25, hx: 18, hz: .25 },         // 北墙
    { x: 0, z: 16.25, hx: 18, hz: .25 },          // 南墙
    { x: 17.75, z: 6.5, hx: .25, hz: 10 },        // 东墙南段
    { x: -17.75, z: 6.5, hx: .25, hz: 10 },       // 西墙南段
    { x: 0, z: 0, hx: 18, hz: 16.5, y0: f1 },     // 二层及以上实心体：只挡高处相机
  ];
  for (const s of [-1, 1]) {
    for (const z of [-16.5, -12.375, -8.25, -4.125]) {
      cols.push({ x: s * 18.25, z, hx: .3, hz: .275 }); // 落在通口内的主馆立面壁柱
    }
  }
  g.userData.interior = {
    colliders: cols,
    walk: [{ x0: -20, x1: 20, z0: -18.5, z1: 18.5, y: .9 }],
  };
  // 一层掏空后无采光：只补不可见光源，不新增陈设（压低到人眼以上，避免天花板过曝）
  for (const [lx, lz, it, ds] of [[-9, -8, 38, 26], [9, -8, 38, 26], [-9, 8, 38, 26], [9, 8, 38, 26], [0, 0, 20, 20]]) {
    const l = new THREE.PointLight(0xffe9d2, it, ds, 1.7);
    l.position.set(lx, 2.7, lz);
    g.add(l);
  }
  group.add(g);
  return g;
}

/** 体艺馆翼楼：灰色石材、平屋面；西翼屋顶两片网球场，东翼对称但不设球场 */
export function buildPoolWing(ctx, { x = -24, z = -99, courts = true, hollow = false, empty = false } = {}) {
  const { group, mats, nightEmitters } = ctx;
  const g = new THREE.Group();
  const W = 34, D = 17, H = 11.0; // 三层，西翼屋顶作网球场
  // 东翼门位（用户 2026-10-25）：西北门加宽至 3.6m、西南门与之对称、东北门开在东墙
  const t = .5;
  const doorX = 13.6, doorW = 3.6, doorH = 2.66;
  const eastZ = -5.6, eastW = 2.6, eastH = 2.66;
  meshBox(g, mats.stoneDark, W + .8, .7, D + .8, 0, .35, 0);
  if (hollow) {
    // 掏空墙壳（2026-10-25 用户指定：东西翼均掏空；主馆一侧留 3.9m 高通口 z −5…+8）
    const y0 = .7, wh = H - .3, wz = D / 2 - t / 2;
    const ex = W / 2 - t / 2;                      // 16.75
    if (empty) {
      // 西翼：只掏空，不设外门、不做内景
      meshBox(g, mats.facadeStone, W, wh, t, 0, y0 + wh / 2, -wz);
      meshBox(g, mats.facadeStone, W, wh, t, 0, y0 + wh / 2, wz);
      meshBox(g, mats.facadeStone, t, wh, D - t * 2, -ex, y0 + wh / 2, 0);
      // 东墙通主馆：北段实墙 z −8…−5 + 洞上过梁 z −5…+8（3.9…11.4）
      meshBox(g, mats.facadeStone, t, wh, 3.0, ex, y0 + wh / 2, -6.5);
      meshBox(g, mats.facadeStone, t, wh - 3.2, 13.0, ex, 7.65, 1.5);
      // 素地面 + 平顶，无陈设
      meshBox(g, mats.stone, W - 1 - .02, .16, D - 1 - .02, 0, .86, 0);
      meshBox(g, mats.plasterCool, W - 1 - .02, .2, D - 1 - .02, 0, 10.4, 0);
      g.userData.interior = {
        colliders: [
          { x: 0, z: -8.25, hx: 17, hz: .25 },
          { x: 0, z: 8.25, hx: 17, hz: .25 },
          { x: -16.75, z: 0, hx: .25, hz: 8.5 },
          { x: 16.75, z: -6.5, hx: .25, hz: 1.5 }, // 东墙北段；通口不设碰撞
        ],
        walk: [{ x0: -16.45, x1: 16.45, z0: -7.95, z1: 7.95, y: .94 }],
      };
      // 空壳补光（不可见光源，不新增陈设）
      for (const lx of [-10, 0, 10]) {
        const l = new THREE.PointLight(0xffe9d2, 48, 30, 1.7);
        l.position.set(lx, 6.6, 0);
        g.add(l);
      }
    } else {
      // 东翼：门洞分段墙壳 + 内景
      // 北墙西北门洞 x −15.4…−11.8；南墙西南门洞对称；东墙东北门洞 z −6.9…−4.3
      const segW = W / 2 - doorX - doorW / 2;       // 1.6 门西侧窄墙
      const segCX = -W / 2 + segW / 2;              // −16.2
      const midW = W - segW - doorW;                // 28.8
      const midCX = W / 2 - midW / 2;               // 2.6
      meshBox(g, mats.facadeStone, segW, wh, t, segCX, y0 + wh / 2, -wz);
      meshBox(g, mats.facadeStone, midW, wh, t, midCX, y0 + wh / 2, -wz);
      meshBox(g, mats.facadeStone, segW, wh, t, segCX, y0 + wh / 2, wz);
      meshBox(g, mats.facadeStone, midW, wh, t, midCX, y0 + wh / 2, wz);
      for (const sz of [-wz, wz]) {
        meshBox(g, mats.facadeStone, doorW, 7.8, t, -doorX, 7.5, sz);   // 门洞过梁 3.6..11.4
        meshBox(g, mats.facadeStone, doorW, .24, t, -doorX, .82, sz);   // 门槛下墙 .7..94
      }
      meshBox(g, mats.facadeStone, t, wh, 1.1, ex, y0 + wh / 2, -7.45);   // 东墙北段
      meshBox(g, mats.facadeStone, t, wh, 12.3, ex, y0 + wh / 2, 1.85);   // 东墙南段
      meshBox(g, mats.facadeStone, t, 7.8, eastW, ex, 7.5, eastZ);        // 东门过梁 3.6..11.4
      meshBox(g, mats.facadeStone, t, .24, eastW, ex, .82, eastZ);        // 东门门槛下墙
      // 西墙通主馆：北段实墙 z −8…−5 + 洞上过梁 z −5…+8（3.9…11.4）
      meshBox(g, mats.facadeStone, t, wh, 3.0, -ex, y0 + wh / 2, -6.5);
      meshBox(g, mats.facadeStone, t, wh - 3.2, 13.0, -ex, 7.65, 1.5);
      decorateGymEastWing(ctx, g, { W, D, fy: .94, doorX, doorW, doorH, eastZ, eastW, eastH });
    }
  } else {
    meshBox(g, mats.facadeStone, W, H, D, 0, H / 2 + .4, 0);
  }
  // 横向连续窗带（南、北，二层与三层）
  for (const s of [-1, 1]) {
    for (const yy of [4.4, 8.0]) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(W * .82, 1.6), mats.glass);
      win.position.set(0, yy, s * (D / 2 + .02)); win.rotation.y = s > 0 ? 0 : Math.PI; g.add(win);
    }
  }
  // 红色檐口 + 平屋面女儿墙
  meshBox(g, mats.redBeam, W + .5, .4, D + .5, 0, H + .5, 0);
  meshBox(g, mats.plasterCool, W + .2, .7, D + .2, 0, H + .95, 0);
  if (courts) {
    // 屋顶网球场（14.44.19）：两片并排，粉红面层 + 白线 + 围网
    const courtW = 13.4, courtD = 6.4;
    for (const s of [-1, 1]) {
      const px = s * 7.6;
      meshBox(g, mats.track, courtW, .12, courtD, px, H + 1.32, 0);
      const lineGeos = [];
      for (const lx of [-courtW / 2 + .6, courtW / 2 - .6]) lineGeos.push(tbox(.08, .03, courtD - 1.2, px + lx, H + 1.39, 0, 0));
      for (const lz of [-courtD / 2 + .6, courtD / 2 - .6]) lineGeos.push(tbox(courtW - 1.2, .03, .08, px, H + 1.39, lz, 0));
      lineGeos.push(tbox(.06, .03, courtD - 1.2, px, H + 1.39, 0, 0));
      addMerged(g, lineGeos, mats.trackLine);
      // 网柱与网
      for (const lz of [-courtD / 2 + .7, courtD / 2 - .7]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, 1.1, 6), mats.darkMetal);
        post.position.set(px, H + 1.9, lz); g.add(post);
      }
      const net = new THREE.Mesh(new THREE.PlaneGeometry(courtD - 1.4, .9), new THREE.MeshStandardMaterial({ color: 0xd8dcd8, transparent: true, opacity: .5, side: THREE.DoubleSide }));
      net.rotation.y = Math.PI / 2; net.position.set(px, H + 1.9, 0); g.add(net);
    }
    // 屋顶围网
    for (const z of [-D / 2 + .3, D / 2 - .3]) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(W - .6, 4), new THREE.MeshStandardMaterial({ color: 0x7d8580, transparent: true, opacity: .32, side: THREE.DoubleSide }));
      f.position.set(0, H + 3.4, z); g.add(f);
    }
  }
  const pole = new THREE.PointLight(0xffd7a0, 0, 40, 1.8);
  pole.position.set(0, H + 6, 0); pole.userData.baseIntensity = 40; g.add(pole); nightEmitters.push(pole);
  g.position.set(x, 0, z);
  group.add(g);
  return g;
}


// ------------------------------------------------------------------
export function buildObservatory(ctx) {
  const { group, mats } = ctx;
  const g = new THREE.Group();
  // white science hall
  meshBox(g, mats.plasterCool, 22, 12, 15, 0, 6, 0);
  meshBox(g, mats.redBeam, 22.4, .4, 15.4, 0, 12.0, 0);
  meshBox(g, mats.plasterCool, 23, .5, 16, 0, 12.25, 0);
  // vertical glazing bands
  for (let i = 0; i < 4; i++) {
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 7.2), mats.glass);
    glass.position.set(-7.5 + i * 5, 5.8, 7.55); g.add(glass);
  }
  // observatory drum + dome
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.9, 2.1, 24), mats.plasterCool);
  drum.position.set(0, 13.6, 0); drum.castShadow = true; g.add(drum);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(4.8, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xe6e7e2, roughness: .3, metalness: .25 }));
  dome.position.set(0, 14.6, 0); dome.castShadow = true; g.add(dome);
  const slit = new THREE.Mesh(new THREE.BoxGeometry(.9, 3.4, 1.1), new THREE.MeshStandardMaterial({ color: 0x27323a, roughness: .4 }));
  slit.position.set(0, 16.2, 4.2); slit.rotation.x = -.15; g.add(slit);
  g.position.set(-94, 0, -92);
  group.add(g);
  // clock tower
  const t = new THREE.Group();
  meshBox(t, mats.plasterCool, 6.4, 27, 6.4, 0, 13.5, 0);
  meshBox(t, mats.redBeam, 6.8, .5, 6.8, 0, 6.5, 0);
  meshBox(t, new THREE.MeshStandardMaterial({ color: 0x5b6264, roughness: .7 }), 7.8, 1.0, 7.8, 0, 27.2, 0);
  meshBox(t, mats.plasterCool, 7.2, .5, 7.2, 0, 27.8, 0);
  const cc = makeCanvas(256, 256), cg = cc.getContext('2d');
  cg.fillStyle = '#eee9dd'; cg.fillRect(0, 0, 256, 256);
  cg.strokeStyle = '#2b2f30'; cg.lineWidth = 10; cg.beginPath(); cg.arc(128, 128, 94, 0, Math.PI * 2); cg.stroke();
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    cg.beginPath(); cg.lineWidth = i % 3 === 0 ? 8 : 4;
    cg.moveTo(128 + Math.cos(a) * 74, 128 + Math.sin(a) * 74);
    cg.lineTo(128 + Math.cos(a) * 88, 128 + Math.sin(a) * 88); cg.stroke();
  }
  cg.lineWidth = 7; cg.beginPath(); cg.moveTo(128, 128); cg.lineTo(128 + 50, 128 - 30); cg.stroke();
  cg.lineWidth = 5; cg.beginPath(); cg.moveTo(128, 128); cg.lineTo(128 - 12, 128 - 66); cg.stroke();
  const clockTex = canvasTexture(cc);
  for (let i = 0; i < 4; i++) {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), new THREE.MeshStandardMaterial({ map: clockTex, roughness: .6 }));
    const a = i * Math.PI / 2;
    face.position.set(Math.sin(a) * 3.23, 22, Math.cos(a) * 3.23); face.rotation.y = a; t.add(face);
  }
  t.position.set(-124, 0, -62);
  group.add(t);
  return { group: g, tower: t };
}

// ------------------------------------------------------------------
export function buildDachengGate(ctx) {
  const { group, mats, nightLights } = ctx;
  const g = new THREE.Group();
  const W = 23, D = 7;
  // stone base
  meshBox(g, mats.stone, W + 2, .35, D + 2, 0, .17, 0);
  // side rooms / white walls
  const officeTex = textTextureLocal('办公室');
  for (const s of [-1, 1]) {
    meshBox(g, mats.plaster, 6.2, 4.5, 5.6, s * 8.3, 2.55, 0);
    meshBox(g, mats.redBeam, 6.4, .35, 5.8, s * 8.3, 4.8, 0);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(6.5, .22, 5.9), mats.stoneDark);
    cap.position.set(s * 8.3, 5.02, 0); g.add(cap);
    // 两侧门柱各辟为一间办公室：门朝内侧相对，窗与门牌留在南立面
    latticeDoor(g, mats, 1.5, 2.5, s * 5.2, 1.62, 0, { open: true, glow: true, cols: 3, rows: 5, ry: -s * Math.PI / 2 });
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.1), mats.glass);
    win.position.set(s * 8.3 + (s < 0 ? -1.9 : 1.9), 2.1, 2.83); g.add(win);
    addPlaque(g, mats, officeTex, s * 5.18, 3.55, 0, { w: 1.7, h: .5, ry: -s * Math.PI / 2 });
    const ol = addInteriorLight(g, mats, s * 8.3, 2.5, 0, 8, 12);
    nightLights.push(ol);
  }
  // red columns flanking central opening
  const cols = [];
  for (const x of [-4.4, -2.0, 2.0, 4.4]) cols.push(tcyl(.26, .3, 4.9, x, 2.65, D / 2 - .45, 10));
  addMerged(g, cols, mats.redColumn);
  // central red lintel
  meshBox(g, mats.redBeam, 9.2, .55, .55, 0, 5.05, D / 2 - .25);
  // roof
  const roof = hipRoofGroup({ W: 24.5, D: 9.4, H: 3.1, tileMat: mats.roof, ridgeMat: mats.ridge, fasciaMat: mats.redDark, ridgeRatio: .4, cornerLift: 1.0 });
  roof.position.y = 5.35; g.add(roof);
  addPlaque(g, mats, mats.plaques.dachengmen, 0, 5.15, D / 2 + .16, { w: 4.2, h: .9 });
  // 门槛/台阶
  meshBox(g, mats.stone, 10.4, .5, 1.0, 0, .6, D / 2 - .2);
  addSteps(g, mats.stone, 0, D / 2 + 1.0, 6.4, .35, 1.4, 3);
  const li = addInteriorLight(g, mats, 0, 3.4, 1, 16, 24);
  nightLights.push(li);
  g.position.set(-28, 0, 26);
  group.add(g);
  return g;
}

// ------------------------------------------------------------------
export function buildHillHall(ctx) {
  const { mats, nightEmitters, nightLights } = ctx;
  const g = new THREE.Group();
  const W = 16, D = 10, H = 4.8;
  // stone terrace
  addStonePlinth(g, mats.stone, 24, 16, 1.2, 0, 0);
  addSteps(g, mats.stone, 0, 8.4, 7, 1.2, 3.0, 4);
  // body
  meshBox(g, mats.plaster, W, H, D, 0, 1.2 + H / 2, 0);
  const cols = [];
  for (let i = 0; i <= 4; i++) {
    const x = -W / 2 + i * W / 4;
    for (const z of [-D / 2 - .3, D / 2 + .3]) cols.push(tcyl(.23, .27, H, x, 1.2 + H / 2, z, 9));
  }
  addMerged(g, cols, mats.redColumn);
  for (let i = 0; i < 4; i++) {
    latticeDoor(g, mats, 3.1, 3.2, -W / 2 + (i + .5) * W / 4, 1.2 + 2.7, D / 2 + .34, { open: i === 1, glow: true, cols: 4, rows: 6 });
  }
  meshBox(g, mats.redBeam, W + .6, .4, D + .6, 0, 1.2 + H - .1, 0);
  const roof = xieshanRoofGroup({ W: 20, D: 14, H: 3.5, skirtH: 1.7, gableWidth: 14, tileMat: mats.roof, ridgeMat: mats.ridge, gableMat: mats.plasterCool, fasciaMat: mats.redDark, cornerLift: .95 });
  roof.position.y = 1.2 + H + .2; g.add(roof);
  addPlaque(g, mats, mats.plaques.linzexu, 0, 1.2 + 4.2, D / 2 + .44, { w: 5.4, h: .95 });
  // stone statue in front
  const statue = makeScholar(mats);
  statue.position.set(0, 1.2, D / 2 + 4.2); g.add(statue);
  const l = addLantern(g, mats, 0, 3.3, D / 2 + 1.4, { scale: .65, glowTex: mats.glowTex });
  nightEmitters.push(l.children[0]);
  if (l.userData.glow) { l.userData.glow.userData.nightOpacity = .35; nightEmitters.push(l.userData.glow); }
  const li = addInteriorLight(g, mats, 0, 3.6, 1, 18, 24);
  nightLights.push(li);
  return g;
}

export function buildZiyinPavilion(ctx) {
  const { mats, nightLights } = ctx;
  const g = new THREE.Group();
  // 12×9 两层江南风格：白粉墙 + 深灰瓦 + 深褐木，正门朝南（面向操场）
  const BW = 12, BD = 9, H1 = 3.4, H2 = 3.0, TY = .35;
  const UW = 10.4, UD = 7.6;
  addStonePlinth(g, mats.stone, 14, 11, TY, 0, 0);
  addSteps(g, mats.stone, 0, 5.6, 3.0, TY, 1.1, 2);
  meshBox(g, mats.plaster, BW, H1, BD, 0, TY + H1 / 2, 0);
  // 一层：红褐色硬木格栅门（五开间）+ 深褐木柱
  for (let i = 0; i < 5; i++) {
    latticeDoor(g, mats, 1.85, 2.7, -4.2 + i * 2.1, TY + 1.45, BD / 2 + .05, { open: i === 2, glow: true, cols: 4, rows: 7 });
  }
  const cols = [];
  for (let i = 0; i <= 5; i++) {
    const x = -BW / 2 + i * BW / 5;
    cols.push(tcyl(.2, .24, H1, x, TY + H1 / 2, BD / 2 + .35, 8));
    cols.push(tcyl(.2, .24, H1, x, TY + H1 / 2, -BD / 2 - .35, 8));
  }
  addMerged(g, cols, mats.woodDark);
  addPlaque(g, mats, mats.plaques.ziyinge, 0, TY + 2.95, BD / 2 + .48, { w: 3.0, h: .62 });
  // 二层：白墙 + 深褐木窗白格
  meshBox(g, mats.plaster, UW, H2, UD, 0, TY + H1 + H2 / 2, 0);
  for (let i = 0; i < 4; i++) {
    const x = -3.6 + i * 2.4;
    addLatticeWall(g, mats, 1.8, 1.9, x, TY + H1 + 1.45, UD / 2 + .04, { glow: true });
    addLatticeWall(g, mats, 1.8, 1.9, x, TY + H1 + 1.45, -UD / 2 - .04, { glow: true, ry: Math.PI });
  }
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      addLatticeWall(g, mats, 1.7, 1.9, s * (UW / 2 + .04), TY + H1 + 1.45, -2.4 + i * 2.4, { glow: true, ry: s * Math.PI / 2 });
    }
  }
  // 上下两层出檐（重檐）
  const roof = doubleEaveRoof({
    W: 15.6, D: 12.6, innerW: 12.0, innerD: 8.8, lowerH: 1.5,
    upperW: 13.6, upperD: 10.6, upperH: 2.2,
    eaveY: TY + H1, upperEaveY: TY + H1 + H2,
    tileMat: mats.roof, ridgeMat: mats.ridge, gableMat: mats.plaster, fasciaMat: mats.redDark
  });
  g.add(roof);
  // 前院小乔木（台面沿用山顶高台铺装）
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.12, .16, 2.2, 7), mats.woodDark);
  trunk.position.set(-4.6, 1.1, 7.9); trunk.castShadow = true; g.add(trunk);
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3, 1), new THREE.MeshStandardMaterial({ color: 0x3f6b3c, roughness: .9 }));
  crown.position.set(-4.6, 2.6, 7.9); crown.castShadow = true; g.add(crown);
  const li = addInteriorLight(g, mats, 0, TY + 2.2, 0, 14, 22);
  nightLights.push(li);
  return g;
}

/** 吴公纪功碑亭：4×4 方亭、单檐四角攒尖、灰绿瓦、黄色装饰带、石柱竖联、石碑、三级石阶 */
export function buildWuGongPavilion(ctx) {
  const { mats } = ctx;
  const g = new THREE.Group();
  const CH = 3.2;
  const greenTile = new THREE.MeshStandardMaterial({ color: 0x5d6b58, roughness: .82, metalness: .05 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc9a34a, roughness: .55, metalness: .15 });
  addStonePlinth(g, mats.stone, 4.8, 4.8, .5, 0, 0);
  addSteps(g, mats.stone, 0, 2.9, 2.2, .5, 1.1, 3);
  // 四根石柱
  const cols = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cols.push(tcyl(.21, .24, CH, sx * 1.55, .5 + CH / 2, sz * 1.55, 8));
  addMerged(g, cols, mats.stone);
  // 石柱竖联
  for (const sx of [-1, 1]) meshBox(g, mats.woodDark, .05, 1.9, .3, sx * 1.55 + .24, 2.05, 1.55);
  meshBox(g, mats.woodDark, 3.2, .16, .16, 0, .5 + CH - .35, 1.55);
  addPlaque(g, mats, mats.plaques.wugong, 0, .5 + CH + .05, 1.62, { w: 2.9, h: .5 });
  // 檐下黄色装饰带
  const band = [];
  for (const [x, z, ry] of [[0, 1.55, 0], [0, -1.55, 0], [1.55, 0, Math.PI / 2], [-1.55, 0, Math.PI / 2]]) {
    band.push(tbox(3.3, .16, .08, x, .5 + CH - .08, z, ry));
  }
  addMerged(g, band, gold);
  // 单檐四角攒尖（灰绿瓦，翘角）
  const roof = hipRoofGroup({ W: 5.4, D: 5.4, H: 1.5, tileMat: greenTile, ridgeMat: mats.ridge, fasciaMat: mats.woodDark, ridgeRatio: .12, cornerLift: 1.15 });
  roof.position.y = .5 + CH + .12; g.add(roof);
  // 亭内石碑
  addStele(g, mats, 0, -.2, { w: 1.5, h: 2.8, textMat: mats.plaques.wugong });
  return g;
}

/** 四角亭：4.2×4.2 方亭、单檐四角攒尖、灰绿瓦、石柱、南面临 D 线三级石阶 */
export function buildCornerSquarePavilion(ctx) {
  const { mats } = ctx;
  const g = new THREE.Group();
  const CH = 3.0;
  const greenTile = new THREE.MeshStandardMaterial({ color: 0x5d6b58, roughness: .82, metalness: .05 });
  addStonePlinth(g, mats.stone, 4.4, 4.4, .42, 0, 0);
  addSteps(g, mats.stone, 0, 2.2, 2.0, .42, 1.2, 3);
  const cols = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cols.push(tcyl(.2, .23, CH, sx * 1.45, .42 + CH / 2, sz * 1.45, 8));
  addMerged(g, cols, mats.stone);
  const beams = [];
  for (const sz of [-1, 1]) beams.push(tbox(3.2, .26, .2, 0, .42 + CH, sz * 1.45, 0));
  for (const sx of [-1, 1]) beams.push(tbox(.2, .26, 3.2, sx * 1.45, .42 + CH, 0, 0));
  addMerged(g, beams, mats.woodDark);
  const bench = [];
  for (const sz of [-1, 1]) bench.push(tbox(2.9, .12, .34, 0, .42 + .46, sz * 1.28, 0));
  addMerged(g, bench, mats.woodDark);
  const roof = hipRoofGroup({ W: 4.8, D: 4.8, H: 1.45, tileMat: greenTile, ridgeMat: mats.ridge, fasciaMat: mats.woodDark, ridgeRatio: .12, cornerLift: 1.1 });
  roof.position.y = .42 + CH + .1; g.add(roof);
  return g;
}

/** 沁園门洞：自习室与空中走廊南端楼梯间之间的灰砖墙，平顶方洞 + 黑底金字匾 + 橙红瓦压顶 */
export function buildQinyuanGate(ctx) {
  const { mats } = ctx;
  const g = new THREE.Group();
  const W = 7.0, H = 4.2, T = .5, OPEN = 3.2, OH = 3.15;
  const side = (W - OPEN) / 2;
  const greyBrick = mats.facadeStone;
  meshBox(g, greyBrick, side, H, T, -(OPEN / 2 + side / 2), H / 2, 0);
  meshBox(g, greyBrick, side, H, T, (OPEN / 2 + side / 2), H / 2, 0);
  meshBox(g, greyBrick, OPEN, H - OH, T, 0, OH + (H - OH) / 2, 0);
  const tileMat = new THREE.MeshStandardMaterial({ color: 0xa1513a, roughness: .62, metalness: .06 });
  meshBox(g, tileMat, W + .5, .26, T + .5, 0, H + .13, 0);
  meshBox(g, mats.woodDark, W + .3, .1, T + .3, 0, H + .01, 0);
  // 匾两面都有：北面朝园内，南面朝自习室/走廊一侧
  addPlaque(g, mats, mats.plaques.qinyuan, 0, OH + .48, -T / 2 - .09, { w: 1.9, h: .62, ry: Math.PI });
  addPlaque(g, mats, mats.plaques.qinyuan, 0, OH + .48, T / 2 + .09, { w: 1.9, h: .62 });
  return g;
}

/** 沁园六角亭：悬浮于书吧圆形水池上的绿琉璃六角亭，西侧石阶接岸成桥状 */
export function buildQinyuanPavilion(ctx) {
  const { mats } = ctx;
  const g = new THREE.Group();
  const R = 2.2, colH = 3.0;
  const glaze = new THREE.MeshStandardMaterial({ color: 0x578765, roughness: .45, metalness: .14 });
  const glazeRidge = new THREE.MeshStandardMaterial({ color: 0x3c5b46, roughness: .6 });
  // 水上六边石台
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(3.35, 3.5, .72, 6), mats.stone);
  plinth.position.y = .24; plinth.castShadow = true; plinth.receiveShadow = true; g.add(plinth);
  // 台面转 30°：南北两侧为平边，南接石阶、北接拱桥（柱避开上桥动线）
  plinth.rotation.y = Math.PI / 6;
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, .1, 6), mats.slab);
  deck.position.y = .64; deck.receiveShadow = true; deck.rotation.y = Math.PI / 6; g.add(deck);
  // 六根红柱与檐梁（随台面转 30°，落在平边两端）
  const cols = [], beams = [];
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    cols.push(tcyl(.22, .26, colH, Math.cos(a) * R, .64 + colH / 2, Math.sin(a) * R, 10));
    const a1 = (i + 1) / 6 * Math.PI * 2;
    const x0 = Math.cos(a) * R, z0 = Math.sin(a) * R, x1 = Math.cos(a1) * R, z1 = Math.sin(a1) * R;
    beams.push(tbox(.2, .32, Math.hypot(x1 - x0, z1 - z0), (x0 + x1) / 2, .64 + colH, (z0 + z1) / 2, Math.atan2(x1 - x0, z1 - z0)));
  }
  addMerged(g, cols, mats.redColumn);
  addMerged(g, beams, mats.redBeam);
  // 绿琉璃单檐六角攒尖 + 红檐口 + 宝顶
  const roof = makeHexRoof({ ...mats, roof: glaze, ridge: glazeRidge }, 3.15, 1.3, 1.05);
  roof.position.y = .64 + colH + .12; roof.rotation.y = Math.PI / 6; g.add(roof);
  const fin = new THREE.Mesh(new THREE.SphereGeometry(.22, 10, 8), mats.gold);
  fin.position.y = .64 + colH + 1.55; g.add(fin);
  // 南侧石阶：从下沉园地面（y=−1）上到台面（y≈−.3），与石台构成桥状
  // 顶端直接压进六边形台面南缘（z=2.78，台面平边在 2.9），避免中间露水缝
  const st = addSteps(g, mats.stone, 0, 2.78, 2.6, .6, 3.0, 5);
  st.position.y = 0;
  // 两侧石帮：逐级落地的踏步侧墙
  const sh = .6 / 5, sd = 3.0 / 5;
  for (const s of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const top = .6 - sh * i;
      meshBox(g, mats.stone, .16, top, sd, s * 1.38, top / 2, 2.78 + sd * (i + .5));
    }
  }
  // 池边点石
  const rockGeos = [];
  for (const [rx, rz, s] of [[-2, -5.3, .9], [2.8, -5.4, 1.1], [4, -3.7, .8], [4.6, 1.3, .7]]) {
    const rg = new THREE.DodecahedronGeometry(s, 0);
    rg.scale(1.1, .6, .9); rg.rotateY(rx * 1.7); rg.rotateX(.2);
    rg.translate(rx, .26 + s * .18, rz); rockGeos.push(rg);
  }
  const rocks = addMerged(g, rockGeos, mats.rock);
  if (rocks) { rocks.castShadow = true; rocks.receiveShadow = true; }
  return g;
}

/** 都督俞公亭：F 路东北角石亭，石柱、石楣刻“都督俞公亭”、灰瓦四角攒尖、亭内立俞大猷生祠碑 */
export function buildYuGongPavilion(ctx) {
  const { mats } = ctx;
  const g = new THREE.Group();
  const CH = 3.2;
  const greenTile = new THREE.MeshStandardMaterial({ color: 0x5d6b58, roughness: .82, metalness: .05 });
  addStonePlinth(g, mats.stone, 5.2, 5.2, .5, 0, 0);
  // 南侧台阶：顶端压进台基压顶边（z=2.55），三级落地
  addSteps(g, mats.stone, 0, 2.55, 2.2, .62, 1.5, 3);
  const cols = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cols.push(tcyl(.22, .25, CH, sx * 1.65, .5 + CH / 2, sz * 1.65, 8));
  addMerged(g, cols, mats.stone);
  const beams = [];
  for (const sz of [-1, 1]) beams.push(tbox(3.5, .28, .2, 0, .5 + CH, sz * 1.65, 0));
  for (const sx of [-1, 1]) beams.push(tbox(.2, .28, 3.5, sx * 1.65, .5 + CH, 0, 0));
  addMerged(g, beams, mats.stoneDark);
  addPlaque(g, mats, mats.plaques.yugong, 0, .5 + CH + .06, 1.72, { w: 3.2, h: .58 });
  const roof = hipRoofGroup({ W: 5.8, D: 5.8, H: 1.7, tileMat: greenTile, ridgeMat: mats.ridge, fasciaMat: mats.stoneDark, ridgeRatio: .12, cornerLift: .55 });
  roof.position.y = .5 + CH + .12; g.add(roof);
  addStele(g, mats, 0, -.2, { w: 1.3, h: 2.3, textMat: mats.plaques.yudaoyou });
  return g;
}

/** 柔石亭：朱枫故居西北侧松柏间的红柱灰瓦四角亭，红挂落 + 黑底金字匾 */
export function buildRoushiPavilion(ctx) {
  const { mats } = ctx;
  const g = new THREE.Group();
  const CH = 2.95;
  const red = mats.redBeam;
  const tile = new THREE.MeshStandardMaterial({ color: 0x4a4f4c, roughness: .8, metalness: .05 });
  addStonePlinth(g, mats.stone, 4.3, 4.3, .3, 0, 0);
  // 南侧三级石阶（top .3/.2/.1，接台面 .36）
  addSteps(g, mats.stone, 0, 2.27, 2.0, .3, .9, 3);
  const geoms = [];
  // 四根红柱（柱础 + 柱头）
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    geoms.push(tcyl(.15, .17, CH, sx * 1.42, .36 + CH / 2, sz * 1.42, 10));
    geoms.push(tbox(.36, .16, .36, sx * 1.42, .36 + CH - .08, sz * 1.42, 0));
  }
  // 额枋
  for (const sz of [-1, 1]) geoms.push(tbox(3.2, .24, .18, 0, .36 + CH, sz * 1.42, 0));
  for (const sx of [-1, 1]) geoms.push(tbox(.18, .24, 3.2, sx * 1.42, .36 + CH, 0, 0));
  // 檐下红挂落（通长横档 + 竖棂）
  for (const [x, z, ry] of [[0, 1.42, 0], [0, -1.42, 0], [1.42, 0, Math.PI / 2], [-1.42, 0, Math.PI / 2]]) {
    geoms.push(tbox(2.7, .09, .08, x, .36 + CH - .17, z, ry));
    for (let i = -3; i <= 3; i++) {
      geoms.push(tbox(.07, .3, .07, x + Math.cos(ry) * i * .42, .36 + CH - .37, z - Math.sin(ry) * i * .42, ry));
    }
  }
  addMerged(g, geoms, red);
  // 白色天花 + 南面黑底金字匾
  meshBox(g, mats.plaster, 2.9, .06, 2.9, 0, .36 + CH + .01, 0);
  addPlaque(g, mats, mats.plaques.roushi, 0, .36 + CH - .5, 1.56, { w: 1.8, h: .5 });
  // 单檐四角攒尖（灰瓦、翘角）
  const roof = hipRoofGroup({ W: 5.1, D: 5.1, H: 1.7, tileMat: tile, ridgeMat: mats.ridge, fasciaMat: mats.redDark, ridgeRatio: .12, cornerLift: .62 });
  roof.position.y = .36 + CH + .14; g.add(roof);
  return g;
}

// 柔石亭北广场松树落点（nature.js 补植与三脚撑共用；亭北面向南视频机位）
// 2026-10-25 用户指令：池内两株连同花池北移至教学楼 SE 的 L 形缺口，池边距楼面 2m；东侧草地上第三株留在广场
// 收尾补植：NE / NW 各两座同样花池内各补一株高冠松（每池一株，SE 同规格）
export const ROUSHI_PINES = [
  [3.4, 62.9], [12.0, 63.1], [13.6, 102.2], // SE 两池 + 广场草地
  [3.75, 35.0], [12.3, 34.9], // NE 西池 / 东池
  [-69.25, 35.0], [-60.7, 34.9] // NW 西池 / 东池
];
// 低矮砖池/石坛/景石碰撞：须在 Nature 生成后再并入，避免把池内松树筛掉
export const ROUSHI_COURT_COLLIDERS = [
  { x: 3.75, z: 63.0, hx: 2.75, hz: 1.5 }, // 西花池（教学楼 SE 缺口）
  { x: 12.3, z: 62.9, hx: 2.7, hz: 1.4 }, // 东花池（教学楼 SE 缺口）
  { x: 3.75, z: 35.0, hx: 2.75, hz: 1.5 }, // 西花池（教学楼 NE 缺口）
  { x: 12.3, z: 34.9, hx: 2.7, hz: 1.4 }, // 东花池（教学楼 NE 缺口）
  { x: -69.25, z: 35.0, hx: 2.75, hz: 1.5 }, // 西花池（教学楼 NW 缺口）
  { x: -60.7, z: 34.9, hx: 2.7, hz: 1.4 }, // 东花池（教学楼 NW 缺口）
  { x: 2.9, z: 84.9, hx: 1.9, hz: 1.2 }, // 石坛
  { x: 10.9, z: 83.3, hx: .85, hz: .6 }, // 景石
  { x: -9.7, z: 74.8, hx: 1.1, hz: 1.0 }, // 西球状灌木
  { x: 11.9, z: 73.0, hx: 1.0, hz: .9 } // 东球状灌木
];

/** 柔石亭北广场：方格石板铺装整体北移 20m（含石坛、景石、球状灌木与矮木栏）；广场原址成草地，加四排灌木带；
 *  砖砌花池（紫花+地被）分布教学楼 SE / NE / NW 三处 L 形缺口，池边距楼面 2m；
 *  教学楼 SW 缺口在与 SE 花池对称处建整片 20×20m 竹林（北缘距楼 2m）（2026-10-25） */
export function buildRoushiNorthCourt(ctx) {
  const { mats } = ctx;
  const g = new THREE.Group();
  const X0 = -7.6, Z0 = 73.5, W = 20.6, D = 12.7, CX = X0 + W / 2, CZ = Z0 + D / 2;
  // 0.6m 方格石板 + 深色石缝
  const cv = makeCanvas(256, 256), c2 = cv.getContext('2d');
  c2.fillStyle = '#847f74'; c2.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const t = 196 + ((i * 5 + j * 11) % 6) * 7;
    c2.fillStyle = `rgb(${t},${t - 5},${t - 16})`;
    c2.fillRect(i * 64 + 2, j * 64 + 2, 60, 60);
  }
  const paveMat = new THREE.MeshStandardMaterial({ map: canvasTexture(cv, { repeat: [W / 2.4, D / 2.4] }), roughness: .93, metalness: .02 });
  meshBox(g, paveMat, W, .06, D, CX, .03, CZ);
  // 四周石压边
  for (const [x, z, w, d] of [[CX, Z0, W, .16], [CX, Z0 + D, W, .16], [X0, CZ, .16, D], [X0 + W, CZ, .16, D]]) {
    meshBox(g, mats.stoneDark, w, .09, d, x, .045, z);
  }
  // 排水篦子
  meshBox(g, mats.darkMetal, .64, .03, .64, 1.6, .075, 78.8);
  for (let i = -3; i <= 3; i++) meshBox(g, mats.black, .04, .012, .56, 1.6 + i * .085, .092, 78.8);

  // 两座砖砌花池：砖壁 + 石压顶 + 土面 + 绿色地被 + 紫花
  const rnd = mulberry32(20261025);
  const flowers = [], leaves = [];
  const soilMat = new THREE.MeshStandardMaterial({ color: 0x4d653c, roughness: .98 });
  const bed = (x0, z0, x1, z1, nf, nl) => {
    const bx = (x0 + x1) / 2, bz = (z0 + z1) / 2, h = .42, t = .14;
    meshBox(g, mats.brick, x1 - x0, h, t, bx, h / 2, z0 + t / 2);
    meshBox(g, mats.brick, x1 - x0, h, t, bx, h / 2, z1 - t / 2);
    meshBox(g, mats.brick, t, h, z1 - z0 - t * 2, x0 + t / 2, h / 2, bz);
    meshBox(g, mats.brick, t, h, z1 - z0 - t * 2, x1 - t / 2, h / 2, bz);
    meshBox(g, mats.stoneDark, x1 - x0 + .04, .07, t + .04, bx, h + .035, z0 + t / 2);
    meshBox(g, mats.stoneDark, x1 - x0 + .04, .07, t + .04, bx, h + .035, z1 - t / 2);
    meshBox(g, mats.stoneDark, t + .04, .07, z1 - z0 - t * 2, x0 + t / 2, h + .035, bz);
    meshBox(g, mats.stoneDark, t + .04, .07, z1 - z0 - t * 2, x1 - t / 2, h + .035, bz);
    meshBox(g, mats.soil, x1 - x0 - t * 2, .3, z1 - z0 - t * 2, bx, .17, bz);
    meshBox(g, soilMat, x1 - x0 - t * 2 + .04, .1, z1 - z0 - t * 2 + .04, bx, .35, bz);
    for (let i = 0; i < nf; i++) flowers.push([x0 + .3 + rnd() * (x1 - x0 - .6), .5 + rnd() * .16, z0 + .3 + rnd() * (z1 - z0 - .6), rnd()]);
    for (let i = 0; i < nl; i++) leaves.push([x0 + .25 + rnd() * (x1 - x0 - .5), .38 + rnd() * .07, z0 + .25 + rnd() * (z1 - z0 - .5), rnd()]);
  };
  // 两座花池按用户指令北移至教学楼 SE（x -13…17, z 52…67）的 L 形缺口：西池距南块东墙 2m、
  // 两池距北块南墙 2m、东池距北块东缘 2m；池内两株高冠松随池同步平移（相对位置不变）
  bed(1.0, 61.5, 6.5, 64.5, 120, 46);
  bed(9.6, 61.5, 15.0, 64.3, 70, 30);
  // 教学楼 NE（x -9…17 / z 24…39，缺口 x -1…17 / z 31.5…39）同样两池，2m 距楼，池内各一株高冠松
  bed(1.0, 33.5, 6.5, 36.5, 120, 46);
  bed(9.6, 33.5, 15.0, 36.3, 70, 30);
  // 教学楼 NW（x -74…-44 / z 24…39，缺口 x -74…-56 / z 31.5…39）镜像同样两池，2m 距楼，池内各一株高冠松
  bed(-72.0, 33.5, -66.5, 36.5, 120, 46);
  bed(-63.4, 33.5, -58.0, 36.3, 70, 30);
  // 教学楼 SW 缺口：与 SE 花池对称的位置改为整片 20×20m 竹林（北缘距楼 2m），池壁取消
  const brnd = mulberry32(20261026);
  const bx0 = -76, bx1 = -56, bz0 = 61.5, bz1 = 81.5;
  {
    // 林下地被：深色土/落叶层铺满 20×20m 范围
    meshBox(g, soilMat, bx1 - bx0, .06, bz1 - bz0, (bx0 + bx1) / 2, .03, (bz0 + bz1) / 2);
    const stemGeos = [], leafGeos = [];
    const nx = 12, nz = 12;
    for (let ix = 0; ix < nx; ix++) {
      for (let iz = 0; iz < nz; iz++) {
        const x = bx0 + 1.1 + (ix + .5) * (bx1 - bx0 - 2.2) / nx + (brnd() - .5) * .9;
        const z = bz0 + 1.0 + (iz + .5) * (bz1 - bz0 - 2.0) / nz + (brnd() - .5) * .9;
        const h = 4.2 + brnd() * 2.0, s = .95 + brnd() * .35;
        const n = 6 + Math.floor(brnd() * 4);
        for (let i = 0; i < n; i++) {
          const ox = (brnd() - .5) * .6, oz = (brnd() - .5) * .6;
          const hh = h * (.72 + brnd() * .42);
          stemGeos.push(tcyl(.026 * s, .042 * s, hh, x + ox, hh / 2, z + oz, 5,
            (brnd() - .5) * .09, 0, (brnd() - .5) * .09));
          for (let k = 0; k < 3; k++) {
            const geo = new THREE.IcosahedronGeometry((.3 + brnd() * .12) * s, 0);
            geo.scale(1.65, .45, 1.65);
            geo.translate(x + ox + (brnd() - .5) * .6, hh * (.55 + k * .16), z + oz + (brnd() - .5) * .6);
            leafGeos.push(geo);
          }
        }
      }
    }
    addMerged(g, stemGeos, mats.bambooStem);
    addMerged(g, leafGeos, mats.bambooLeaf);
  }

  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  const fGeo = new THREE.IcosahedronGeometry(.075, 0); fGeo.scale(1, .8, 1);
  const fMesh = new THREE.InstancedMesh(fGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .85 }), flowers.length);
  flowers.forEach(([x, y, z, r], i) => {
    m4.makeTranslation(x, y, z); fMesh.setMatrixAt(i, m4);
    col.set(r < .42 ? 0x7a55a6 : r < .8 ? 0x9d7cc6 : 0xd8c6e8); fMesh.setColorAt(i, col);
  });
  fMesh.castShadow = true; g.add(fMesh);
  const lGeo = new THREE.IcosahedronGeometry(.2, 0); lGeo.scale(1, .5, 1);
  const lMesh = new THREE.InstancedMesh(lGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .95 }), leaves.length);
  leaves.forEach(([x, y, z, r], i) => {
    m4.makeTranslation(x, y, z); lMesh.setMatrixAt(i, m4);
    col.set(r < .5 ? 0x3f5c33 : 0x557a42); lMesh.setColorAt(i, col);
  });
  lMesh.castShadow = true; g.add(lMesh);

  // 石坛：两级石台 + 深色石顶（随铺装北移 20m）
  meshBox(g, mats.stone, 3.8, .24, 2.4, 2.9, .12, 84.9);
  meshBox(g, mats.stone, 3.2, .34, 1.9, 2.9, .40, 84.9);
  meshBox(g, mats.stoneDark, 3.3, .06, 2.0, 2.9, .60, 84.9);

  // 景石（随铺装北移 20m）
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  rockGeo.scale(1.0, .62, .78); rockGeo.translate(10.9, .32, 83.3);
  const rock = new THREE.Mesh(rockGeo, mats.rock);
  rock.castShadow = true; rock.receiveShadow = true; g.add(rock);

  // 球状修剪灌木（云片状团块）
  const shrubMat = new THREE.MeshStandardMaterial({ color: 0x3d5637, roughness: .95 });
  const mound = (x, z, s) => {
    const geos = [];
    for (const [dx, dz, r, y] of [[0, 0, 1.0, .62], [.72, .24, .72, .5], [-.68, -.2, .66, .46], [.12, .62, .6, .44]]) {
      const geo = new THREE.IcosahedronGeometry(r * s, 1);
      geo.scale(1, .72, 1); geo.translate(x + dx * s, y * s, z + dz * s); geos.push(geo);
    }
    addMerged(g, geos, shrubMat);
  };
  mound(-9.7, 74.8, 1.15);
  mound(11.9, 73.0, 1.0);

  // 矮木栏：包住西侧灌木的 L 形两段
  const fenceGeos = [];
  const picketFence = (x1, z1, x2, z2) => {
    const len = Math.hypot(x2 - x1, z2 - z1), n = Math.max(2, Math.round(len / .34));
    const ux = (x2 - x1) / len, uz = (z2 - z1) / len;
    for (let i = 0; i <= n; i++) fenceGeos.push(tbox(.055, .52, .055, x1 + ux * i * len / n, .26, z1 + uz * i * len / n, 0));
    for (const y of [.16, .4]) {
      const rail = new THREE.BoxGeometry(.045, .05, len);
      rail.rotateY(Math.atan2(ux, uz));
      rail.translate((x1 + x2) / 2, y, (z1 + z2) / 2);
      fenceGeos.push(rail);
    }
  };
  picketFence(-8.5, 73.8, -8.5, 77.4);
  picketFence(-10.9, 73.8, -8.5, 73.8);
  addMerged(g, fenceGeos, mats.wood);

  // 亭与石坛（北移后 z=84.9）之间：四排连续灌木带，落在原铺装范围退出的草地（z 86.2…106.2）
  const hedgeRow = (x0, x1, z, h, w) => {
    const geos = [tbox(x1 - x0, h * .55, w, (x0 + x1) / 2, h * .275, z, 0)];
    const n = Math.max(2, Math.round((x1 - x0) / 1.15));
    for (let i = 0; i <= n; i++) {
      const blob = new THREE.IcosahedronGeometry((.5 + (i % 3) * .06) * w, 1);
      blob.scale(1.25, .7, 1);
      blob.translate(x0 + (x1 - x0) * i / n, h * .62, z + (i % 2 ? .07 : -.07));
      geos.push(blob);
    }
    addMerged(g, geos, shrubMat);
  };
  hedgeRow(-6.9, 11.7, 88.0, .62, 1.0);
  hedgeRow(-6.9, 11.7, 93.0, .72, 1.05);
  hedgeRow(-6.9, 11.7, 98.0, .80, 1.1);
  hedgeRow(-6.9, 11.7, 103.0, .70, 1.0);

  // 七株高冠松的三脚撑（杉木杆 + 草绳绑扎环）
  const strut = (x1, z1, x2, z2, y1, y2) => {
    const dx = x2 - x1, dz = z2 - z1, dy = y2 - y1;
    const len = Math.hypot(dx, dy, dz);
    const geo = new THREE.CylinderGeometry(.045, .055, len, 6);
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz).normalize()));
    geo.translate((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    return geo;
  };
  for (const [x, z] of ROUSHI_PINES) {
    const geos = [];
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * Math.PI * 2 + .5;
      geos.push(strut(x + Math.cos(a) * 1.05, z + Math.sin(a) * 1.05, x, z, .02, 2.55));
    }
    const ring = new THREE.CylinderGeometry(.34, .34, .16, 8, 1, true);
    ring.translate(x, 2.45, z); geos.push(ring);
    addMerged(g, geos, mats.woodDark);
  }
  return g;
}

/** 沁园鹅棚：水边木台、红色 X 形格子栏杆与白鹅 */
export function buildGoosePen(ctx) {
  const { mats } = ctx;
  const g = new THREE.Group();
  const W = 4.4, D = 3.2, Y = .42;
  const railMat = new THREE.MeshStandardMaterial({ color: 0x9a3b2c, roughness: .7 });
  meshBox(g, mats.wood, W, .16, D, 0, Y, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) meshBox(g, mats.woodDark, .18, .5, .18, sx * 1.9, .2, sz * 1.3);
  // 三面 X 形栏杆（临水侧留出上人缺口）
  const xPanel = (x, z, len, ry) => {
    const one = new THREE.Group();
    one.position.set(x, Y + .16, z); one.rotation.y = ry;
    for (const s of [-1, 1]) {
      const d = new THREE.Mesh(new THREE.BoxGeometry(.07, Math.hypot(len, .9), .07), railMat);
      d.position.y = .45; d.rotation.z = s * Math.atan2(len, .9); one.add(d);
    }
    meshBox(one, railMat, len, .08, .1, 0, .9, 0);
    meshBox(one, railMat, len, .1, .1, 0, .04, 0);
    g.add(one);
  };
  xPanel(0, -D / 2 + .05, W - .1, 0);
  xPanel(-W / 2 + .05, 0, D - .1, Math.PI / 2);
  xPanel(W / 2 - .05, 0, D - .1, Math.PI / 2);
  // 白鹅
  const white = new THREE.MeshStandardMaterial({ color: 0xf2efe4, roughness: .85 });
  const beak = new THREE.MeshStandardMaterial({ color: 0xd08a3a, roughness: .7 });
  for (const [gx, gz, ry] of [[-1.1, .5, .4], [0, -.6, -1.2], [1.2, .3, 2.4]]) {
    const goose = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(.34, 10, 8), white);
    body.scale.set(1.25, .85, .9); body.position.y = .3; goose.add(body);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(.07, .1, .55, 8), white);
    neck.position.set(.3, .62, 0); neck.rotation.z = -.35; goose.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 6), white);
    head.position.set(.45, .86, 0); goose.add(head);
    const bill = new THREE.Mesh(new THREE.ConeGeometry(.06, .18, 6), beak);
    bill.position.set(.62, .84, 0); bill.rotation.z = -Math.PI / 2; goose.add(bill);
    goose.position.set(gx, Y + .08, gz); goose.rotation.y = ry; g.add(goose);
  }
  return g;
}

/** 甜心屋咖啡：体艺馆后、学生宿舍前的深灰单层咖啡小屋，玻璃立面与白字招牌 */
export function buildSweetCafe(ctx) {
  const { mats } = ctx;
  const g = new THREE.Group();
  const W = 9, D = 7, H = 3.6;
  const dark = new THREE.MeshStandardMaterial({ color: 0x34383a, roughness: .82 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x6d5a48, roughness: .7 });
  meshBox(g, dark, W, H, D, 0, H / 2, 0);
  meshBox(g, mats.glass, W * .84, 1.7, .1, 0, 1.65, D / 2 + .03);
  meshBox(g, mats.glass, .1, 1.7, D * .5, W / 2 + .03, 1.65, 0);
  meshBox(g, dark, W + 1.2, .28, D + 1.2, 0, H + .14, 0);
  meshBox(g, trim, W + 1.2, .12, D + 1.2, 0, H - .02, 0);
  // 东端竖向木格栅
  for (let i = 0; i < 9; i++) meshBox(g, mats.woodDark, .1, H - 1.1, .12, W / 2 - 2.4 + i * .3, (H - 1.1) / 2 + .55, D / 2 + .06);
  addPlaque(g, mats, mats.plaques.tianxin, 0, H - .72, D / 2 + .18, { w: 2.3, h: .55 });
  return g;
}

/** 两门古炮：深色铁炮 + 石砌炮座，炮口朝碑亭一侧 */
export function buildCannons(ctx) {
  const { mats, group } = ctx;
  const g = new THREE.Group();
  const build = (x, z, scale) => {
    const one = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.6 * scale, .75, 2.6 * scale), mats.stoneDark);
    base.position.y = .37; base.castShadow = true; one.add(base);
    const step = new THREE.Mesh(new THREE.BoxGeometry(1.3 * scale, .35, 2.1 * scale), mats.stone);
    step.position.y = .92; one.add(step);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.24 * scale, .34 * scale, 3.1 * scale, 14), mats.darkMetal);
    barrel.rotation.x = Math.PI / 2 - .24;
    barrel.position.set(0, 1.45 * scale, .1 * scale); barrel.castShadow = true; one.add(barrel);
    for (const [zz, r] of [[1.1, .37], [0.75, .4], [-1.45, .27]]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r * scale, .08 * scale, 6, 14), mats.darkMetal);
      ring.position.set(0, 1.45 * scale + (1.1 - zz) * .22, zz * scale);
      ring.rotation.x = Math.PI / 2 - .24; one.add(ring);
    }
    one.position.set(x, hillHeightAt(x, z), z);
    one.rotation.y = Math.PI / 2; // 炮口朝东，指向碑亭
    g.add(one);
  };
  build(65.5, -45.2, 1.0);
  build(61.8, -45.4, .82);
  group.add(g);
}

/** 后山石刻：3m 高 4.5m 宽岩体、红漆“懲忿窒慾”、石台石栏杆、三尊石武将 */
export function buildInscriptionRock(ctx) {
  const { mats, group } = ctx;
  const g = new THREE.Group();
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x4b5548, roughness: .95 });
  const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6, 1), rockMat);
  rock.scale.set(1.05, .72, .5); rock.rotation.y = .18;
  rock.position.y = 1.5; rock.castShadow = true; rock.receiveShadow = true; g.add(rock);
  // 岩面四字（右列懲/忿，左列窒/慾）
  const cv = makeCanvas(512, 384), cg = cv.getContext('2d');
  cg.fillStyle = '#4b5548'; cg.fillRect(0, 0, 512, 384);
  cg.fillStyle = 'rgba(70,95,60,.35)';
  for (let i = 0; i < 60; i++) { cg.beginPath(); cg.arc(Math.random() * 512, Math.random() * 384, 8 + Math.random() * 30, 0, 6.3); cg.fill(); }
  cg.fillStyle = '#b23a2c'; cg.textAlign = 'center'; cg.textBaseline = 'middle';
  cg.font = 'bold 150px "Songti SC","STSong",serif';
  cg.fillText('懲', 370, 110); cg.fillText('忿', 365, 280);
  cg.fillText('窒', 145, 110); cg.fillText('慾', 150, 285);
  const tex = canvasTexture(cv);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 3.2), new THREE.MeshStandardMaterial({ map: tex, roughness: .95 }));
  face.position.set(0, 1.62, 1.34); g.add(face);
  // 顶部常春藤
  const ivy = new THREE.MeshStandardMaterial({ color: 0x2e4a2a, roughness: .9 });
  for (let i = 0; i < 16; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(.18, 5, 4), ivy);
    leaf.position.set(-2.0 + i * .26, 2.9 - (i % 3) * .18, 1.0 + (i % 2) * .12);
    leaf.scale.y = .5; g.add(leaf);
  }
  // 右侧石台 + 石栏杆（加宽以容纳四尊石武将）
  const plat = new THREE.Mesh(new THREE.BoxGeometry(5.8, .5, 2.2), mats.stone);
  plat.position.set(4.8, .25, .2); plat.receiveShadow = true; g.add(plat);
  const posts = [];
  for (let i = 0; i <= 5; i++) posts.push(tbox(.22, 1.1, .22, 1.9 + i * 1.16, .95, 1.15, 0));
  posts.push(tbox(5.8, .14, .18, 4.8, 1.42, 1.15, 0));
  addMerged(g, posts, mats.stone);
  // 四尊石武将
  const armor = new THREE.MeshStandardMaterial({ color: 0x6a6f66, roughness: .9 });
  for (let i = 0; i < 4; i++) {
    const one = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(.34, .46, 1.55, 8), armor);
    body.position.y = .78; one.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.23, 8, 6), armor);
    head.position.y = 1.75; one.add(head);
    const helm = new THREE.Mesh(new THREE.ConeGeometry(.27, .38, 8), armor);
    helm.position.y = 2.02; one.add(helm);
    one.position.set(3.0 + i * 1.35, .5, .1);
    one.rotation.y = -1.2;
    g.add(one);
  }
  g.position.set(127, hillHeightAt(127, -33), -33);
  g.rotation.y = Math.PI / 2; // 岩面朝东，正对 F 环山外线
  group.add(g);
}


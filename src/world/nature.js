import * as THREE from 'three';
import { mulberry32, mergeGeometriesSafe, tcyl, tbox } from '../util.js';
import { addMerged } from './detail.js';
import { hillRoadClearance, A_WALK, ROUSHI_PINES } from './buildings.js';

// A 线 2m 步道：富的廊西口草坡引道 → A 起点 → A_WALK 本体；沿线禁植（树干 + 树冠）
// 西段 A0（A_WEST）只有 2m 清树带，不并入本禁植线，避免冠幅再清掉两侧保留乔木
const A_LANE = [[72, -54], [75, -48], [79, -42], [83, -37]];
// 吴公纪功碑亭 (70,-46.5) — 两门古炮中点 (64,-45.3) 连线，延长至梓荫山西侧山脚
// 山脚按当前地形取 hillHeight<0.4 处 (56.65,-43.83)；线段南侧 2m 内不种树
const WU_CANNON_LINE = { x0: 70, z0: -46.5, x1: 56.65, z1: -43.83 };
function wuCannonSouthStrip(x, z) {
  const dx = WU_CANNON_LINE.x1 - WU_CANNON_LINE.x0, dz = WU_CANNON_LINE.z1 - WU_CANNON_LINE.z0;
  const len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
  const rx = x - WU_CANNON_LINE.x0, rz = z - WU_CANNON_LINE.z0;
  const s = rx * ux + rz * uz;
  if (s < 0 || s > len) return false;
  const off = uz * rx - ux * rz; // (uz,-ux) 指向 +z（南侧）
  return off >= 0 && off <= 2;
}
function aLaneDist(x, z) {
  const pts = [...A_LANE, ...A_WALK.flatMap((s, i) => (i ? s.pts.slice(1) : s.pts))];
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    d = Math.min(d, segDist(x, z, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  }
  return d;
}

// 树冠最大半径（冠幅 × scale 上限）+ 步道半宽 1m：树冠投影也不得压入 A 线 2m 步道
const A_CANOPY = { camphor: 5.5, pine: 5.3, cypress: 2.8, willow: 5.0, cherry: 4.2, ginkgo: 4.9 };
const aLaneClear = (x, z, type) => aLaneDist(x, z) >= (A_CANOPY[type] || 2.2);

const SEASONS = {
  spring: { camphor: '#6d844f', pine: '#46613f', cypress: '#3c5539', willow: '#8a9e5b', cherry: '#e4b3bf', ginkgo: '#c9ae55', grass: '#657c50' },
  summer: { camphor: '#405a33', pine: '#334d35', cypress: '#2d4531', willow: '#607f3e', cherry: '#4f6d3e', ginkgo: '#d8b440', grass: '#526a40' },
  autumn: { camphor: '#826437', pine: '#43543a', cypress: '#374832', willow: '#9d7a40', cherry: '#915f3b', ginkgo: '#e2b63a', grass: '#6c6d48' },
  winter: { camphor: '#4e5846', pine: '#384538', cypress: '#2f3e32', willow: '#656b50', cherry: '#5f5f50', ginkgo: '#d9a92f', grass: '#5b6250' }
};

function merge(geos) { return mergeGeometriesSafe(geos); }

// 跑道西侧球场群的塑胶面层范围
const COURT_AREAS = [
  [16.8, -15.7, 33.2, 13.7], // 篮球场（南）
  [15.8, 11.3, 32.2, 40.7], // 篮球场（北）
  [20.3, 44.8, 35.7, 71.2], // 司令台场地
  [17.3, 82.8, 34.7, 109.2], // 排球场
];
const onCourt = (x, z) => COURT_AREAS.some(([x0, z0, x1, z1]) => x > x0 && x < x1 && z > z0 && z < z1);

/** 点到线段的平面距离 */
function segDist(x, z, x0, z0, x1, z1) {
  const dx = x1 - x0, dz = z1 - z0;
  const l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / l2));
  return Math.hypot(x - (x0 + dx * t), z - (z0 + dz * t));
}

// 树干基部刷白（石灰水涂干），全场景共用一套几何与材质
let WHITE_BASE_GEO = null, WHITE_BASE_MAT = null;
function whiteBase() {
  if (!WHITE_BASE_GEO) {
    WHITE_BASE_GEO = new THREE.CylinderGeometry(.26, .32, 1.0, 7);
    WHITE_BASE_GEO.translate(0, .5, 0);
    WHITE_BASE_MAT = new THREE.MeshStandardMaterial({ color: 0xf1eee4, roughness: .95 });
  }
  return { geo: WHITE_BASE_GEO, mat: WHITE_BASE_MAT };
}

function addCanopyColors(geo) {
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  let minY = 1e9, maxY = -1e9;
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  const span = Math.max(1, maxY - minY);
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - minY) / span;
    const shade = 0.52 + 0.48 * Math.pow(t, 0.75) + (Math.sin(i * 12.9898) * 43758.5453 % 1 + 1) % 1 * .07;
    colors[i * 3] = shade; colors[i * 3 + 1] = shade; colors[i * 3 + 2] = shade;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

function camphorGeo() {
  const trunk = [tcyl(.22, .36, 4.8, 0, 2.4, 0, 8)];
  const branches = [];
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + .4;
    const b = new THREE.CylinderGeometry(.08, .17, 2.6, 6);
    b.rotateZ(.62); b.rotateY(a);
    b.translate(Math.cos(a) * 1.0, 4.4, Math.sin(a) * 1.0);
    branches.push(b);
  }
  const canopy = [];
  // broad, asymmetric crown with distinct lobes
  const blobs = [
    [0, 6.0, 0, 1.7, 1.25, 1.7], [1.8, 5.7, .5, 1.35, 1.05, 1.3], [-1.7, 5.8, -.4, 1.4, 1.1, 1.35],
    [.5, 7.1, -.4, 1.35, 1.05, 1.3], [-.7, 5.2, 1.5, 1.2, .95, 1.15], [1.9, 4.9, -1.3, .95, .8, .95],
    [-2.0, 5.1, 1.1, 1.0, .85, 1.0], [2.7, 6.3, .7, .9, .75, .9], [-2.6, 6.2, -.8, .95, .8, .9],
    [1.1, 7.8, .8, .85, .72, .85], [-1.0, 7.7, -1.2, .8, .7, .8], [.2, 8.3, 0, .85, .65, .85],
    [2.2, 7.2, -.9, .7, .6, .7], [-2.3, 7.0, 1.0, .75, .62, .75], [0.4, 4.8, -2.0, .8, .65, .8],
    [-.9, 6.8, 2.2, .7, .6, .7], [1.5, 6.0, 1.8, .75, .62, .75], [-1.6, 4.4, -.9, .8, .65, .8],
    [3.0, 5.5, -.3, .6, .52, .6], [-3.0, 5.6, .4, .6, .52, .6], [.9, 8.0, -1.7, .55, .5, .55],
  ];
  for (const [x, y, z, sx, sy, sz] of blobs) {
    const g = new THREE.IcosahedronGeometry(1, 1);
    g.scale(sx, sy, sz); g.translate(x, y, z);
    canopy.push(g);
  }
  return { trunk: merge(trunk.concat(branches)), canopy: addCanopyColors(merge(canopy)) };
}

function pineGeo() {
  const trunk = [tcyl(.2, .3, 5.0, 0, 2.5, 0, 7)];
  const canopy = [];
  const layers = [[2.3, 3.2, 2.6], [1.85, 2.8, 4.6], [1.3, 2.5, 6.2], [.7, 1.9, 7.5]];
  for (const [r, h, y] of layers) {
    const g = new THREE.ConeGeometry(r, h, 8, 1);
    g.translate(0, y, 0); canopy.push(g);
  }
  return { trunk: merge(trunk), canopy: addCanopyColors(merge(canopy)) };
}

// 高冠松（V10 大成门北—泮池内圈行道树）：主干加高、整层树冠上移，最小实例冠底也≥2.6m
function pineHighGeo() {
  const trunk = [tcyl(.2, .3, 6.8, 0, 3.4, 0, 7)];
  const canopy = [];
  const layers = [[2.3, 3.2, 2.6], [1.85, 2.8, 4.6], [1.3, 2.5, 6.2], [.7, 1.9, 7.5]];
  for (const [r, h, y] of layers) {
    const g = new THREE.ConeGeometry(r, h, 8, 1);
    g.translate(0, y + 2.1, 0); canopy.push(g);
  }
  return { trunk: merge(trunk), canopy: addCanopyColors(merge(canopy)) };
}

function cypressGeo() {
  const trunk = [tcyl(.18, .26, 3.0, 0, 1.5, 0, 6)];
  const canopy = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.ConeGeometry(1.2 - i * .25, 4.0, 8, 1);
    g.translate(0, 3.0 + i * 2.1, 0); canopy.push(g);
  }
  return { trunk: merge(trunk), canopy: addCanopyColors(merge(canopy)) };
}

function willowGeo() {
  const trunk = [tcyl(.28, .45, 3.4, 0, 1.7, 0, 8)];
  const canopy = [];
  for (let i = 0; i < 7; i++) {
    const a = i / 9 * Math.PI * 2;
    const g = new THREE.SphereGeometry(.85, 7, 6);
    g.scale(1.25, .65, 1.25);
    g.translate(Math.cos(a) * 1.25, 4.3 + (i % 3) * .28, Math.sin(a) * 1.25);
    canopy.push(g);
  }
  const top = new THREE.SphereGeometry(1.15, 8, 6); top.scale(1.2, .7, 1.2); top.translate(0, 5.1, 0); canopy.push(top);
  // hanging strands
  for (let i = 0; i < 13; i++) {
    const a = i / 13 * Math.PI * 2;
    const r = 1.65 + (i % 3) * .22;
    const g = new THREE.SphereGeometry(.26, 6, 5);
    g.scale(1.0, 3.4 + (i % 4) * .35, 1.0);
    g.translate(Math.cos(a) * r, 2.85, Math.sin(a) * r);
    canopy.push(g);
  }
  return { trunk: merge(trunk), canopy: addCanopyColors(merge(canopy)) };
}

function cherryGeo() {
  const trunk = [tcyl(.24, .36, 3.1, 0, 1.55, 0, 7)];
  const canopy = [];
  for (const [x, y, z, s] of [[0, 3.9, 0, 1.55], [1.05, 3.5, .35, 1.05], [-1.0, 3.6, -.3, 1.1], [.2, 4.7, -.3, .95], [.6, 3.3, -1.0, .8]]) {
    const g = new THREE.IcosahedronGeometry(1, 1); g.scale(s, s * .8, s); g.translate(x, y, z); canopy.push(g);
  }
  return { trunk: merge(trunk), canopy: addCanopyColors(merge(canopy)) };
}

// 银杏：直立主干、高冠，冠形较窄（体艺馆西翼南侧银杏林，视频 0–7s）
function ginkgoGeo() {
  const trunk = [tcyl(.26, .4, 5.4, 0, 2.7, 0, 8)];
  const branches = [];
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2 + .3;
    const b = new THREE.CylinderGeometry(.07, .16, 2.5, 6);
    b.rotateZ(.52); b.rotateY(a);
    b.translate(Math.cos(a) * .9, 5.0, Math.sin(a) * .9);
    branches.push(b);
  }
  const canopy = [];
  const blobs = [
    [0, 7.4, 0, 1.5, 1.3, 1.5], [1.3, 7.0, .4, 1.1, 1.0, 1.1], [-1.3, 7.1, -.3, 1.15, .95, 1.15],
    [.4, 8.6, -.3, 1.05, .9, 1.05], [-.6, 6.4, 1.1, .95, .8, .95], [1.6, 6.1, -1.0, .8, .7, .8],
    [-1.7, 6.2, .9, .85, .7, .85], [2.1, 7.8, .6, .7, .6, .7], [-2.2, 7.7, -.6, .75, .65, .75],
    [.8, 9.4, .5, .6, .5, .6]
  ];
  for (const [x, y, z, sx, sy, sz] of blobs) {
    const g = new THREE.IcosahedronGeometry(1, 1);
    g.scale(sx, sy, sz); g.translate(x, y, z);
    canopy.push(g);
  }
  return { trunk: merge(trunk.concat(branches)), canopy: addCanopyColors(merge(canopy)) };
}

export class Nature {
  constructor(scene, mats, { hill, hillHeight, dropAt, colliders, inBounds } = {}) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.mats = mats;
    this.hill = hill;
    this.hillHeight = hillHeight;
    this.dropAt = dropAt;
    this.colliders = colliders || [];
    // 闭环外不留任何植被：所有落点按校园边界过滤
    this.inBounds = inBounds || (() => true);
    this.season = 'summer';
    this.density = 1;
    this.types = {};
    this.typeList = []; // 同一 key 可能注册多批（cypress），季节换色/密度需覆盖全部实例
    this.allTrees = [];
    this.leafParticles = null;
    this._buildTrees();
    this._buildGinkgoGrove();
    this._buildHedges();
    this._buildShrubs();
    this._buildCorridorGarden();
    this._buildLeaves();
    this._buildBirds();
  }

  _addType(key, geos, positions, scaleRange, { shadow = true, canopy = { r: 3, y0: 2, y1: 8, trunk: .45 }, margin = 3, whiteScale = 1 } = {}) {
    // 与建筑立面保持净距，避免树冠插进墙体和窗户
    if (this.colliders.length) {
      positions = positions.filter(([x, , z]) => !this.colliders.some((c) =>
        Math.abs(x - c.x) < c.hx + margin && Math.abs(z - c.z) < c.hz + margin));
    }
    // 吴公碑—古炮连线延长至西山脚，线段南侧 2m 内不种树
    positions = positions.filter(([x, , z]) => !wuCannonSouthStrip(x, z));
    // 闭环外不种树
    positions = positions.filter(([x, , z]) => this.inBounds(x, z));
    if (!positions.length) return;
    const trunkMesh = new THREE.InstancedMesh(geos.trunk, this.mats.bark || this.mats.woodDark, positions.length);
    const wb = whiteBase();
    const whiteMesh = new THREE.InstancedMesh(wb.geo, wb.mat, positions.length);
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .92, vertexColors: true });
    const canopyMesh = new THREE.InstancedMesh(geos.canopy, canopyMat, positions.length);
    trunkMesh.castShadow = shadow; trunkMesh.receiveShadow = true;
    canopyMesh.castShadow = shadow; canopyMesh.receiveShadow = true;
    const dummy = new THREE.Object3D();
    const wdummy = new THREE.Object3D();
    const rnd = mulberry32(key.length * 91 + 7);
    positions.forEach((p, i) => {
      const s = scaleRange[0] + rnd() * (scaleRange[1] - scaleRange[0]);
      const sy = s * (0.9 + rnd() * .2);
      const drop = this.dropAt ? this.dropAt(p[0], p[2]) : 0;
      dummy.position.set(p[0], (p[1] || 0) - drop, p[2]);
      dummy.rotation.y = rnd() * 6.28;
      dummy.scale.set(s, sy, s);
      dummy.updateMatrix();
      trunkMesh.setMatrixAt(i, dummy.matrix);
      canopyMesh.setMatrixAt(i, dummy.matrix);
      if (whiteScale === 1) {
        whiteMesh.setMatrixAt(i, dummy.matrix);
      } else {
        wdummy.position.copy(dummy.position);
        wdummy.rotation.copy(dummy.rotation);
        wdummy.scale.set(s * whiteScale, sy, s * whiteScale);
        wdummy.updateMatrix();
        whiteMesh.setMatrixAt(i, wdummy.matrix);
      }
      const c = new THREE.Color().setHSL(0.22 + rnd() * .09, .06 + rnd() * .09, .78 + rnd() * .16);
      canopyMesh.setColorAt(i, c);
      this.allTrees.push({
        x: p[0], z: p[2], type: key, y: (p[1] || 0) - drop,
        r: canopy.r * s, y0: canopy.y0 * sy, y1: canopy.y1 * sy, trunk: canopy.trunk * s,
      });
    });
    trunkMesh.instanceMatrix.needsUpdate = true;
    canopyMesh.instanceMatrix.needsUpdate = true;
    whiteMesh.instanceMatrix.needsUpdate = true;
    whiteMesh.castShadow = false; whiteMesh.receiveShadow = true;
    if (canopyMesh.instanceColor) canopyMesh.instanceColor.needsUpdate = true;
    this.group.add(trunkMesh, canopyMesh, whiteMesh);
    const rec = { key, trunkMesh, canopyMesh, canopyMat, positions, count: positions.length };
    this.types[key] = rec;
    this.typeList.push(rec);
  }

  _buildTrees() {
    const rnd = mulberry32(1234);
    const avoid = [
      [-41, 2, -15, 18], // 大成殿
      [-51, -34, 0, -12], // 实验楼
      [-29, -8, -7, 0], // 空地（禁乔木，保持通行开敞）
      [-74, 19, -44, 41], // 教学楼 NW
      [-13, 17, 17, 39], // 教学楼 NE
      [-74, 45, -44, 67], // 教学楼 SW
      [-13, 47, 17, 69], // 教学楼 SE
      [-40, 54, -16, 68], // 大成门
      [-46, 82, -10, 104], // 泮池（含北岸草坪，避免大树压水）
      [-44, 104, -12, 138], // 校门内中轴灌木带（禁乔木）
      [-40, 134, -16, 152], // 校门
      [-100, -101, -53, -51], // 电教楼
      [-93, -53, -76, -35], // 书吧（14×16）
      [-79, -22, -63, -12], // 自习室
      [-73, -51, -55.8, -23], // 沁园（整体下沉区，树木按地势落位）
      [-8, -107, 64, -63], // 体艺馆
      [-42, -108, -8, -90], // 体艺馆西翼
      [-41, -89, -7, -65], // 体艺馆西翼南面银杏林（手工种植，禁随机树）
      [69, -94, 109, -76], // 学生宿舍
      [-109, -125, -85, -101], // 科学楼
      [-109, -172, -47, -144], // 综合楼
      [-41, -157, 3, -143], // 1#宿舍
      [14, -142, 66, -128], // 2#宿舍
      [4, 134, 30, 144], // 行政楼
      [16, 117, 28, 127], // 朱枫故居
      [-2.2, 104.4, 4.2, 112.6], // 柔石亭（朱枫故居西北侧）
      [-157, 81, -79, 112], // 蛟川书院主楼（北贴雾墙，厚 17m）+ 南侧双石阶
      [136, -47, 181, -24], // 操场北侧宿舍（梓荫山东侧，横向布置）
      [-100, 99, -79, 118], // 蛟川东副楼（16×10，含北门门槛与南入口台阶）
      [-157, 99, -136, 118], // 蛟川西副楼（16×10，含北门门槛与南入口台阶）
      [-112, 146, -74, 161], // 书院办公室（南立面贴雾墙，含北入口台阶与前庭）
      [34, -19, 126, 157], // 田径场
      [44, -56, 138, -18], // 梓荫山
      [76, -63, 98, -57], // 富的廊
      [-55, -60, 98, -43], // 梓荫河四段
      [-33, 16, -23, 142], // 中轴
      [21, -14, 38, 108], // 西侧球场群
      [8.0, -24.8, 17.5, 11.5], // 红廊（灰廊架）及其西/东/北/南密植区、球场侧二维栅栏
    ];
    const inRect = (x, z) => avoid.some(([x1, z1, x2, z2]) => x > x1 && x < x2 && z > z1 && z < z2);
    const camphor = [], pine = [], cypress = [], willow = [], cherry = [], highPine = [];
    // 校门—泮池：内圈灌木（见 _buildShrubs），外圈才是乔木
    for (let z = 104; z <= 136; z += 8) {
      for (const x of [-47, -9]) if (!inRect(x, z)) camphor.push([x, 0, z]);
    }
    // 大成门—泮池之间：乔木林
    for (let z = 71; z <= 81; z += 4) {
      for (const x of [-42, -38, -18, -14]) if (!inRect(x, z)) camphor.push([x, 0, z]);
    }
    // 贴中轴步道的内圈行道树（视频 196–201：夹道密林、树干刷白）
    // V10 内圈 8 株为高冠松：冠底≥2.65m，树冠越过步道不挡通行
    for (let z = 68.5; z <= 81.5; z += 4.2) {
      for (const x of [-34.2, -21.8]) highPine.push([x, 0, z]);
    }
    // 校门内中轴两旁为灌木带（见 _buildShrubs）
    // around gate
    for (const x of [-52, -4]) {
      for (const z of [156, 164]) if (!inRect(x, z)) camphor.push([x, 0, z]);
    }
    // courtyard cherry
    cherry.push([-35, 0, 50], [-21, 0, 50]);
    // academy courtyard
    camphor.push([-134, 0, 145], [-114, 0, 145]);
    // 蛟川书院西南角：小亭四周留出空地，外围种植乔木（47.09）
    for (const [x, z] of [[-144, 124], [-156, 124], [-141, 120], [-157, 120]]) {
      if (!inRect(x, z)) camphor.push([x, 0, z]);
    }
    // 大成殿 flanks
    cypress.push([-42, 0, -4], [-14, 0, -4], [-42, 0, 22], [-14, 0, 22]);
    // 梓荫山密林（中心 90,-37，90×36）；独立 RNG 避免改动其余随机植被落位
    const hrnd = mulberry32(9182);
    for (let i = 0; i < 820; i++) {
      const x = 90 + (hrnd() - .5) * 84;
      const z = -37 + (hrnd() - .5) * 32;
      const y = this.hillHeight ? this.hillHeight(x, z) : 0;
      if (y < .4) continue;
      if (x > 99 && x < 121 && z > -50 && z < -32) continue; // 山顶高台、梓荫阁与楼梯口
      if (Math.abs(x - 100) < 6 && Math.abs(z + 53) < 7.5) continue; // 林则徐纪念堂
      if (Math.hypot(x - 70, z + 46.5) < 6.5) continue; // 吴公纪功碑亭与古炮
      if (Math.hypot(x - 127, z + 33) < 4.5) continue;  // 石刻、石台与石武将
      if (Math.hypot(x - 134, z + 54) < 5.5) continue;  // 都督俞公亭
      // 只按大路留树冠净距；A0 窄步道（trail）不参与，保住走廊两侧已保留乔木
      if (hillRoadClearance(x, z, { trail: false }) < 4.2) continue;
      if (aLaneDist(x, z) < 2.2) continue;              // A 线 2m 步道禁植（树干，含草坡引道）
      // 红木楼梯沟槽：留出通视走廊，避免树冠盖死台阶
      if (Math.min(segDist(x, z, 93.8, -53.4, 96.4, -45.6), segDist(x, z, 96.4, -45.6, 97.4, -44.4), segDist(x, z, 97.4, -44.4, 100.4, -35.2)) < 8) continue;
      const r = hrnd();
      const type = r < .55 ? 'camphor' : r < .78 ? 'pine' : 'cypress';
      if (!aLaneClear(x, z, type)) continue;            // A 线树冠也不压线
      if (type === 'camphor') camphor.push([x, y, z]);
      else if (type === 'pine') pine.push([x, y, z]);
      else cypress.push([x, y, z]);
    }
    // green filler
    for (let i = 0; i < 55; i++) {
      const x = -140 + rnd() * 370, z = -150 + rnd() * 300;
      if (inRect(x, z)) continue;
      if (hillRoadClearance(x, z) < 2.2) continue;
      if (Math.hypot(x + 28, z - 8) < 82) continue;
      if (x > 16 && x < 150 && z > -60 && z < 162) continue;
      if (Math.hypot(x + 148, z - 118.5) < 8) continue; // 蛟川小亭周边留空
      if (Math.hypot(x + 20, z + 127) < 8) continue;   // 甜心屋咖啡（体艺馆北、2#宿舍南）
      if (Math.hypot(x + 53.5, z + 46.8) < 6) continue; // 沁园鹅棚（走廊西侧）
      if (rnd() < .55) camphor.push([x, 0, z]);
      else if (rnd() < .5) pine.push([x, 0, z]);
      else cypress.push([x, 0, z]);
    }
    // 沁园岸边海棠+垂柳（参考 14.56.42：书吧临水、走廊沿水、中间绿化）
    for (const [x, z] of [[-69, -55], [-66, -36], [-50, -34], [-62, -30], [-70, -30], [-48, -30]]) {
      if (!inRect(x, z)) cherry.push([x, 0, z]);
    }
    for (const [x, z] of [[-74, -36], [-56, -27], [-78, -42]]) willow.push([x, 0, z]);
    // 沁园下沉区内临水乔木（dropAt 自动落位，避开水面、假山与鹅棚踏步）
    for (const [x, z] of [[-70.6, -43.2], [-68.4, -49.2], [-59.2, -45.8]]) willow.push([x, 0, z]);
    // 闭环外无种植，落点统一按边界过滤
    // avenue trees and lush campus planting
    for (let z = 134; z >= 72; z -= 8) {
      if (z > 86 && z < 106) continue;
      for (const x of [-38, -18]) if (!inRect(x, z)) camphor.push([x, 0, z]);
    }
    for (const [x, z] of [[-35, 44], [-21, 44], [-35, -8], [-21, -8]]) camphor.push([x, 0, z]);
    // V1 中轴林带（BV1NT42117VK 0/25/29/250/290s：大成殿—大成门之间连续樟林）
    // 四列错位，让开 x -33…-23 中轴步道与大成殿/大成门实体
    for (const z of [22, 30, 38, 46]) {
      for (const x of [-40.0, -36.4, -20.6, -17.0]) camphor.push([x, 0, z]);
    }
    // V2 大成殿两翼：贴殿身东西各 5 株窄冠柏（视频殿角深绿针叶列）
    for (const z of [-8, 0, 8, 16, 20]) cypress.push([-43.5, 0, z], [-12.5, 0, z]);
    // V3 教学楼两院间补樟 8 株，与院心树组成两院各 5 株（BV1NT42117VK 25/29s 航拍密林）
    // z=47 位于南北两排 L 形楼之间（楼面 42.75 / 52），西院 -71…-56、东院 1…16
    for (const x of [-71, -66, -61, -56, 1, 6, 11, 16]) camphor.push([x, 0, 47]);
    // track perimeter（田径场外缘约 x 34~126、z -19~157）
    for (let z = -16; z <= 156; z += 11) if (!inRect(16, z)) camphor.push([16 + (rnd() - .5) * 2, 0, z]);
    for (let x = 38; x <= 122; x += 11) if (!inRect(x, 164)) camphor.push([x, 0, 164 + (rnd() - .5) * 2]);
    // north perimeter
    for (let x = -116; x <= 120; x += 14) if (!inRect(x, -148)) camphor.push([x, 0, -148 + (rnd() - .5) * 3]);
    // track perimeter, east
    for (let z = -16; z <= 156; z += 12) camphor.push([132 + (rnd() - .5) * 2, 0, z]);
    // V5 梓荫山南坡脚：低坡位补 7 株；y 取 hillHeight()，
    // 落点已按 D 环山路/C 梯净距 ≥4.2m、A 线树冠净距、既有树 ≥1.7m 筛选
    for (const [x, z] of [[48, -24], [53, -24], [58, -25], [64, -27], [130, -30]]) {
      camphor.push([x, this.hillHeight(x, z), z]);
    }
    pine.push([112, this.hillHeight(112, -24), -24]);
    cypress.push([117, this.hillHeight(117, -24), -24]);
    // V5 跑道远端（z=164）补 2 株：填 60↔71 与 115↔122 两处空档
    camphor.push([65, 0, 164.5], [121, 0, 164.5]);
    // V9 北区宿舍（BV1NT42117VK）：西草坪 8 + 2#宿舍东侧 10
    // 西草坪沿 z=-118 一列 8 株（咖啡屋南侧草地）；东侧 x=72 / x=94 两列各 5 株
    for (const x of [-46, -40, -34, -28, -22, -16, -10, -4]) camphor.push([x, 0, -118]);
    for (const z of [-136, -130, -124, -118, -112]) camphor.push([72, 0, z]);
    for (const z of [-138, -132, -126, -120, -114]) camphor.push([94, 0, z]);
    // 柔石亭北广场：7 株高冠松，三脚撑在 buildings.js 的 buildRoushiNorthCourt
    for (const [x, z] of ROUSHI_PINES) highPine.push([x, 0, z]);
    // courtyards
    for (const [x, z] of [[-54, 51], [-34, 51], [-54, 26], [-34, 26], [-70, 31], [-24, 31]]) cypress.push([x, 0, z]);
    for (const [x, z] of [[-52, 47], [-4, 47], [-52, 5], [-4, 5], [-60, -2], [-6, -2], [-58, -24], [-8, -24], [-56, 30], [-2, 30]]) camphor.push([x, 0, z]);
    for (let x = -100; x <= 110; x += 16) { if (!inRect(x, 120)) camphor.push([x, 0, 120 + (rnd() - .5) * 3]); if (!inRect(x + 4, 134)) camphor.push([x + 4, 0, 134 + (rnd() - .5) * 3]); }
    // 富的廊两岸：南岸垂柳临水，北岸廊后香樟（廊体紧贴水面，中间无种植空间）
    for (let x = 12; x <= 98; x += 7) {
      const jx = x + (rnd() - .5) * 2.5;
      const zc = -51 - (jx - 7) / 91 * 6; // 梓荫河东北段中心线
      const zs = zc + 5.2 + (rnd() - .5) * .8;
      const ys = this.hillHeight ? Math.max(0, this.hillHeight(jx, zs)) : 0;
      if (aLaneClear(jx, zs, 'willow')) willow.push([jx, ys, zs]);
      if (jx < 74 || jx > 100) {
        const zn = zc - 7.6 + (rnd() - .5) * 1.2;
        const yn = this.hillHeight ? Math.max(0, this.hillHeight(jx, zn)) : 0;
        if (aLaneClear(jx, zn, 'camphor')) camphor.push([jx, yn, zn]);
      }
    }
    for (const [x, z] of [[70, -63.5], [101, -63.5], [66, -59.5], [104, -59.5]]) {
      const y = this.hillHeight ? Math.max(0, this.hillHeight(x, z)) : 0;
      camphor.push([x, y, z]);
    }

    this._addType('camphor', camphorGeo(), camphor, [1.0, 1.3],
      { canopy: { r: 3.4, y0: 4.0, y1: 9.6, trunk: .58 }, margin: 3.6 });
    // V1 古樟 4 株：冠幅压过殿角（与视频同机位）
    this._addType('camphor', camphorGeo(), [[-38.2, 0, 26], [-18.8, 0, 26], [-38.2, 0, 42], [-18.8, 0, 42]], [1.45, 1.65],
      { canopy: { r: 3.4, y0: 4.0, y1: 9.6, trunk: .58 }, margin: 3.6 });
    this._addType('pine', pineGeo(), pine, [.95, 1.3],
      { canopy: { r: 3.3, y0: .8, y1: 9.2, trunk: .38 }, margin: 2.6 });
    // V10 内圈行道松：更高的主干与上移树冠，冠底 3.1m（最小缩放实例≥2.65m）
    this._addType('pine', pineHighGeo(), highPine, [.95, 1.3],
      { canopy: { r: 3.3, y0: 3.1, y1: 10.6, trunk: .38 }, margin: 2.6 });
    this._addType('cypress', cypressGeo(), cypress, [.95, 1.25],
      { canopy: { r: 1.4, y0: 1.0, y1: 9.6, trunk: .32 }, margin: 1.2 });
    // 柔石亭四周 5m 内：小尺度柏树（视频 b27 红亭掩映在柏树间，南面台阶前留空）
    this._addType('cypress', cypressGeo(), [
      [1, 0, 104.5], [-2.9, 0, 105.6], [4.9, 0, 105.6], [-3.4, 0, 108.5], [5.4, 0, 108.5], [-2.5, 0, 111.5], [4.5, 0, 111.5],
    ], [.5, .62], { canopy: { r: 1.4, y0: 1.0, y1: 9.6, trunk: .32 }, margin: 1.2 });
    this._addType('willow', willowGeo(), willow, [1.0, 1.3],
      { canopy: { r: 3.0, y0: .5, y1: 6.5, trunk: .5 }, margin: 3.0 });
    this._addType('cherry', cherryGeo(), cherry, [1.0, 1.3],
      { canopy: { r: 2.4, y0: 1.8, y1: 6.2, trunk: .42 }, margin: 2.6 });
  }

  // 体艺馆西翼南面银杏林（视频 0–7s）：白干、金黄冠、金色落叶地被
  _buildGinkgoGrove() {
    const positions = [];
    const rnd = mulberry32(4271);
    for (const z of [-86, -79, -72]) {
      for (const x of [-38, -33, -28, -23, -18, -13]) {
        positions.push([x + (rnd() - .5) * 1.6, 0, z + (rnd() - .5) * 1.6]);
      }
    }
    this._addType('ginkgo', ginkgoGeo(), positions, [1.0, 1.2],
      { canopy: { r: 3.2, y0: 3.0, y1: 10.0, trunk: .42 }, margin: 3.0, whiteScale: 1.55 });
    const t = this.types.ginkgo;
    if (t) t.canopyMat.color.set(0xd8b440);
    // 金色落叶地被：小平面实例，不参与碰撞
    const N = 5000;
    const geo = new THREE.PlaneGeometry(.2, .14);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .95, side: THREE.DoubleSide });
    const mesh = new THREE.InstancedMesh(geo, mat, N);
    const d = new THREE.Object3D();
    const c = new THREE.Color();
    const r2 = mulberry32(9137);
    for (let i = 0; i < N; i++) {
      const x = -39 + r2() * 30;
      const z = -87 + r2() * 19;
      d.position.set(x, .045 + r2() * .015, z);
      d.rotation.set(0, r2() * Math.PI * 2, 0);
      d.scale.setScalar(.7 + r2() * .8);
      d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
      c.setHSL(.10 + r2() * .03, .5 + r2() * .2, .38 + r2() * .18);
      mesh.setColorAt(i, c);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  _buildHedges() {
    const geoms = [];
    const addRun = (x1, z1, x2, z2, h = .62, w = .75) => {
      const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
      const ry = Math.atan2(dx, dz);
      geoms.push(tbox(w, h, len, (x1 + x2) / 2, h / 2, (z1 + z2) / 2, ry));
    };
    // 中轴绿篱（泮池、大成门处断开）
    for (const x of [-35.2, -20.8]) {
      addRun(x, 138, x, 106);
      addRun(x, 84, x, 70);
      addRun(x, 52, x, 22);
    }
    // 田径场西侧绿篱：只保留草地段；塑胶球场范围（篮球场 z -14.5~39.5、排球场 z 84~108）内不生成
    addRun(19.5, 39.5, 19.5, 84, .55);
    addRun(19.5, 108, 19.5, 110.4, .55);
    addRun(19.5, 127.3, 19.5, 154, .55); // 憩园院落段断开，南北墙外各留一段
    addRun(40, 163, 120, 163, .55);
    // building forecourts（教学楼群 2×2）
    addRun(-70, 71, -46, 71, .55);
    addRun(-11, 71, 13, 71, .55);
    addRun(-70, 16, -46, 16, .55);
    addRun(-11, 16, 13, 16, .55);
    // V3 两院南缘基础绿篱：西/东院各 5 段，贴南教学楼北立面（z=52）
    for (const [x0, x1] of [[-71.9, -49.7], [-8.3, 15.5]]) {
      const n = 5, gap = .8, seg = (x1 - x0 - gap * (n - 1)) / n;
      for (let i = 0; i < n; i++) {
        const a = x0 + i * (seg + gap);
        addRun(a, 51, a + seg, 51, .5, .7);
      }
    }
    // gate forecourt
    addRun(-48, 136, -36, 136, .55);
    addRun(-20, 136, -8, 136, .55);
    const mat = new THREE.MeshStandardMaterial({ color: 0x3b5737, roughness: .98 });
    const mesh = new THREE.Mesh(merge(geoms), mat);
    mesh.castShadow = true; mesh.receiveShadow = true; this.group.add(mesh);
    // flower dots along the avenue and around the flag circle
    const rnd = mulberry32(5150);
    const fg = [];
    for (let i = 0; i < 110; i++) {
      const side = i % 2 ? 1 : -1;
      const x = -28 + side * (5.8 + rnd() * 1.4);
      const z = 134 - rnd() * 112;
      if ((z > 84 && z < 106) || (z > 52 && z < 70)) continue;
      const g = new THREE.IcosahedronGeometry(.13 + rnd() * .09, 0);
      g.translate(x, .3, z); fg.push(g);
    }
    const flowerMat = new THREE.MeshStandardMaterial({ color: 0xbf5a44, roughness: .9 });
    const flowers = new THREE.Mesh(merge(fg), flowerMat);
    this.group.add(flowers);
  }

  _buildShrubs() {
    const rnd = mulberry32(88);
    const geos = [];
    for (let i = 0; i < 160; i++) {
      const x = -140 + rnd() * 370, z = -150 + rnd() * 300;
      if (!this.inBounds(x, z)) continue;
      if (x > 30 && x < 132 && z > -26 && z < 162) continue;
      if (onCourt(x, z)) continue; // 塑胶球场面上不生成灌木
      if (x > -48 && x < -8 && z > 40 && z < 100) continue;
      if (x > -44 && x < -12 && z > 84 && z < 106) continue;
      const g = new THREE.IcosahedronGeometry(.55 + rnd() * .75, 0);
      g.scale(1, .65, 1); g.translate(x, .35 - (this.dropAt ? this.dropAt(x, z) : 0), z); geos.push(g);
    }
    // 校门—泮池中轴两旁：连续灌木带（内圈），乔木退到 x≈±19 外圈
    for (const side of [-1, 1]) {
      for (let z = 106; z <= 137; z += 1.9) {
        for (let k = 0; k < 3; k++) {
          const x = -28 + side * (5.4 + k * 1.7 + (rnd() - .5) * .5);
          const g = new THREE.IcosahedronGeometry(.5 + rnd() * .3, 0);
          g.scale(1.1, .62, 1.1); g.translate(x, .3, z + (rnd() - .5) * .6); geos.push(g);
        }
      }
    }
    // 泮池北—大成门：步道两侧贴边灌木带（视频 196–201，内侧绿篱、外侧乔木）
    for (const side of [-1, 1]) {
      for (let z = 66.5; z <= 84; z += 1.7) {
        for (let k = 0; k < 3; k++) {
          const x = -28 + side * (4.4 + k * 1.55 + (rnd() - .5) * .45);
          const g = new THREE.IcosahedronGeometry(.45 + rnd() * .28, 0);
          g.scale(1.15, .55, 1.15); g.translate(x, .28, z + (rnd() - .5) * .5); geos.push(g);
        }
      }
    }
    // 梓荫山林下灌木（连片）
    const urnd = mulberry32(9183);
    for (let i = 0; i < 240; i++) {
      const x = 90 + (urnd() - .5) * 84, z = -37 + (urnd() - .5) * 32;
      const y = this.hillHeight ? this.hillHeight(x, z) : 0;
      if (y < .3) continue;
      if (y > 7.4) continue;                          // 高台台面
      if (x > 99 && x < 121 && z > -50 && z < -32) continue; // 山顶高台与梓荫阁
      if (hillRoadClearance(x, z) < .8) continue;
      if (aLaneDist(x, z) < 2.4) continue;             // A 线 2m 步道禁植（灌木冠也不压线）
      const g = new THREE.IcosahedronGeometry(.4 + urnd() * .55, 0);
      g.scale(1.2, .55, 1.2); g.translate(x, y + .25, z); geos.push(g);
    }
    const mat = new THREE.MeshStandardMaterial({ color: 0x4e6a3f, roughness: .95, vertexColors: false });
    const mesh = new THREE.InstancedMesh(merge(geos), mat, 1);
    // merged geometry already contains all shrubs; one instance at origin
    mesh.setMatrixAt(0, new THREE.Matrix4());
    mesh.castShadow = true; mesh.receiveShadow = true;
    this.group.add(mesh);
    this.shrubMat = mat;
  }

  // 红廊（灰廊架）周边环境：西侧苏铁/蕨类/紫红地被/白干乔木，东侧竹丛遮挡球场栅栏；
  // 北端出口蕨类与园路，南侧绿篱与地被（视频 149-162s）。
  _buildCorridorGarden() {
    const mats = this.mats;
    const rnd = mulberry32(7319);
    const stemGeos = [], leafGeos = [], fernGeos = [], cycadGeos = [];
    const whiteTrunkGeos = [], whiteCanopyGeos = [], redGeos = [], hedgeGeos = [], shrubGeos = [];
    const bamboo = (x, z, h, s = 1) => {
      const n = 7 + Math.floor(rnd() * 5);
      for (let i = 0; i < n; i++) {
        const ox = (rnd() - .5) * .7, oz = (rnd() - .5) * .7;
        const hh = h * (.7 + rnd() * .5);
        stemGeos.push(tcyl(.028 * s, .045 * s, hh, x + ox, hh / 2, z + oz, 5,
          (rnd() - .5) * .06, 0, (rnd() - .5) * .06));
        for (let k = 0; k < 4; k++) {
          const g = new THREE.IcosahedronGeometry((.22 + rnd() * .08) * s, 1);
          g.scale(1.5, .5, 1.5);
          g.translate(x + ox + (rnd() - .5) * .55, hh * (.34 + k * .19), z + oz + (rnd() - .5) * .55);
          leafGeos.push(g);
        }
      }
    };
    const fern = (x, z, s = 1) => {
      const n = 3 + Math.floor(rnd() * 3);
      for (let k = 0; k < n; k++) {
        const g = new THREE.IcosahedronGeometry((.28 + rnd() * .2) * s, 1);
        g.scale(1.7, .38, 1.7);
        g.translate(x + (rnd() - .5) * .7, .13 + rnd() * .1, z + (rnd() - .5) * .7);
        fernGeos.push(g);
      }
    };
    const cycad = (x, z, s = 1) => {
      cycadGeos.push(tcyl(.11 * s, .18 * s, .9 * s, x, .45 * s, z, 7));
      for (let i = 0; i < 13; i++) {
        const a = i / 13 * Math.PI * 2 + rnd() * .18;
        const len = (1.0 + rnd() * .28) * s;
        cycadGeos.push(tbox(len, .05 * s, .22 * s,
          x + Math.cos(a) * len * .42, .92 * s + rnd() * .1, z + Math.sin(a) * len * .42,
          -a, 0, -.38 + rnd() * .12));
      }
    };
    const whiteTree = (x, z, h = 5.4, s = 1) => {
      whiteTrunkGeos.push(tcyl(.1 * s, .16 * s, h, x, h / 2, z, 7));
      whiteTrunkGeos.push(tcyl(.04 * s, .07 * s, h * .35, x + .5, h * .78, z + .2, 6, 0, 0, -.45));
      for (let i = 0; i < 5; i++) {
        const g = new THREE.IcosahedronGeometry((.5 + rnd() * .35) * s, 1);
        g.scale(1.35, .6, 1.35);
        g.translate(x + (rnd() - .5) * 2.0, h * (.88 + rnd() * .22), z + (rnd() - .5) * 2.0);
        whiteCanopyGeos.push(g);
      }
    };
    const hedgeRun = (x1, z1, x2, z2, h = .8, w = .75) => {
      const len = Math.hypot(x2 - x1, z2 - z1);
      const ry = Math.atan2(x2 - x1, z2 - z1);
      hedgeGeos.push(tbox(w, h, len, (x1 + x2) / 2, h / 2, (z1 + z2) / 2, ry));
    };
    // 东侧：贴球场栅栏的竹丛（遮挡 x=16.4 栅栏），下沿蕨类
    for (let z = -24.0; z <= 13.6; z += 1.2) {
      bamboo(16.05 + (rnd() - .5) * .25, z + (rnd() - .5) * .4, 3.5 + rnd() * 1.5, .85 + rnd() * .25);
      fern(15.6 + (rnd() - .5) * .3, z + .55, .8);
    }
    // 转角以东（横段与球场之间）加高绿篱，配合竹丛挡住 3.1m 球场栅栏
    hedgeRun(16.05, 4.8, 16.05, 17.0, 2.7, .55);
    // 墙后高灌木丛（北侧墙后 / 东侧墙外），形成连续的背景绿带
    for (let x = -.2; x <= 11.0; x += .85) {
      for (let k = 0; k < 2; k++) {
        const g = new THREE.IcosahedronGeometry(.55 + rnd() * .3, 1);
        g.scale(1.25, .85, 1.25);
        g.translate(x + (rnd() - .5) * .5, 2.3 + rnd() * .9, 3.15 + (rnd() - .5) * .3);
        shrubGeos.push(g);
      }
    }
    for (let z = -24.0; z <= 6.2; z += .95) {
      for (let k = 0; k < 2; k++) {
        const g = new THREE.IcosahedronGeometry(.55 + rnd() * .25, 1);
        g.scale(1.05, .85, 1.05);
        g.translate(16.05 + (rnd() - .5) * .2, 2.3 + rnd() * .85, z + (rnd() - .5) * .4);
        shrubGeos.push(g);
      }
    }
    // 西侧花园：绿篱 + 紫红地被 + 蕨类 + 苏铁 + 白干乔木
    hedgeRun(8.45, -18.5, 8.45, 2.2, .86, .75);
    const bed = (x0, x1, z0, z1) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, .035, z1 - z0), mats.redGround);
      m.position.set((x0 + x1) / 2, .018, (z0 + z1) / 2);
      m.receiveShadow = true; this.group.add(m);
    };
    bed(8.6, 9.9, -19.0, 2.2);
    for (let z = -19.0; z <= 2.2; z += .55) {
      for (let k = 0; k < 2; k++) {
        const g = new THREE.IcosahedronGeometry(.3 + rnd() * .2, 1);
        g.scale(1.35, .22, 1.35);
        g.translate(9.0 + rnd() * .85, .08 + rnd() * .05, z + (rnd() - .5) * .4);
        redGeos.push(g);
      }
      if (rnd() < .55) fern(9.4 + rnd() * .45, z + .3, .9);
    }
    for (const [cx, cz] of [[9.55, -17.0], [9.6, -12.4], [9.45, -7.9], [9.6, -3.4]]) cycad(cx, cz, .95 + rnd() * .15);
    whiteTree(8.75, -19.4, 5.6, .95);
    whiteTree(8.7, -1.0, 5.2, .9);
    // 南侧：园路 + 连续紫红地被 + 绿篱
    hedgeRun(-1.5, 10.55, 12.0, 10.55, .62, .7);
    bed(-1.2, 11.8, 10.1, 10.5);
    for (let x = -1.2; x <= 11.8; x += .5) {
      for (let k = 0; k < 2; k++) {
        const g = new THREE.IcosahedronGeometry(.28 + rnd() * .18, 1);
        g.scale(1.35, .22, 1.35);
        g.translate(x + (rnd() - .5) * .25, .08, 10.18 + rnd() * .28);
        redGeos.push(g);
      }
    }
    for (const [cx, cz] of [[2.0, 10.4], [6.6, 10.45], [10.3, 10.4]]) cycad(cx, cz, .7);
    // 红廊与教学楼 NE 之间：向南重复四排同款植物带（绿篱 + 紫红地被，间植苏铁、蕨类）
    for (let row = 0; row < 4; row++) {
      const zr = 11.70 + row * 1.18;
      hedgeRun(-1.5, zr, 12.0, zr, .62, .62);
      bed(-1.2, 11.8, zr - .75, zr - .15);
      for (let x = -1.2; x <= 11.8; x += .6) {
        for (let k = 0; k < 2; k++) {
          const g = new THREE.IcosahedronGeometry(.28 + rnd() * .18, 1);
          g.scale(1.35, .22, 1.35);
          g.translate(x + (rnd() - .5) * .25, .08, zr - .55 + rnd() * .36);
          redGeos.push(g);
        }
        if (rnd() < .22) fern(x + .3, zr - .62, .8);
      }
      for (const [cx, cs] of [[1.1 + row * .7, .7], [6.6 - row * .55, .66], [10.6 + row * .35, .62]]) {
        cycad(cx, zr - .45 + (rnd() - .5) * .2, cs + rnd() * .08);
      }
    }
    // 实验楼西南角（大成殿西北）：空中走廊南端楼梯东侧的花园带，参考视频 t0149。
    // 楼梯在 x=-56…-52、脚端 z=-14.8；植物带贴楼梯东侧、沿实验楼南墙铺开，楼梯间留空。
    bed(-51.6, -46.0, -3.6, -2.9);
    for (let x = -51.5; x <= -46.1; x += .5) {
      for (let k = 0; k < 2; k++) {
        const g = new THREE.IcosahedronGeometry(.28 + rnd() * .16, 1);
        g.scale(1.35, .22, 1.35);
        g.translate(x + (rnd() - .5) * .22, .08, -3.35 + rnd() * .24);
        redGeos.push(g);
      }
    }
    for (let x = -51.5; x <= -46.1; x += .62) fern(x + (rnd() - .5) * .2, -2.6 + (rnd() - .5) * .3, .85);
    hedgeRun(-51.8, -4.2, -46.9, -4.2, .62, .8);
    hedgeRun(-51.4, -6.0, -46.3, -6.0, .78, .9);
    hedgeRun(-51.8, -7.8, -47.0, -7.8, .92, .95);
    hedgeRun(-51.6, -9.35, -46.4, -9.35, 1.0, 1.0);
    hedgeRun(-51.7, -10.9, -46.6, -10.9, 1.05, .95);
    for (let row = 1; row < 5; row++) {
      const zr = -4.2 - row * 1.675;
      for (let x = -51.7 + row * .2; x <= -46.2; x += .85) {
        const g = new THREE.IcosahedronGeometry(.36 + rnd() * .25, 1);
        g.scale(1.25, .8, 1.25);
        g.translate(x + (rnd() - .5) * .4, .42 + row * .13 + rnd() * .28, zr + (rnd() - .5) * .45);
        shrubGeos.push(g);
      }
    }
    cycad(-46.8, -5.8, 1.05);
    cycad(-51.0, -7.6, .78);
    cycad(-48.6, -9.6, .6);
    cycad(-50.4, -11.7, .68);
    whiteTree(-49.4, -10.2, 5.2, .85);
    // 北端出口：踏步与园路保持净空，蕨类只种在两侧
    for (let x = 9.2; x <= 10.6; x += .7) fern(x + (rnd() - .5) * .25, -22.6 + (rnd() - .5) * .9, .95);
    for (let x = 15.3; x <= 16.0; x += .7) fern(x + (rnd() - .5) * .2, -22.8 + (rnd() - .5) * .9, .85);
    whiteTree(10.2, -23.6, 5.8, 1);
    whiteTree(15.9, -24.8, 5.4, .95);
    // 园路（西侧通道、北出口、南侧通道）
    const path = (x0, x1, z0, z1, mat, y = .022) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, .045, z1 - z0), mat);
      p.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
      p.receiveShadow = true; this.group.add(p);
    };
    path(9.95, 11.05, -20.0, 2.3, mats.path);
    path(10.75, 15.3, -24.2, -21.6, mats.pathStone);
    path(-1.6, 12.0, 9.0, 10.05, mats.path);
    // 白色球头灯柱（视频 4.5-5m）
    const lampPole = [], lampHead = [];
    for (const [lx, lz] of [[9.25, -20.1], [9.15, 2.6], [15.8, -22.7]]) {
      lampPole.push(tcyl(.055, .08, 4.4, lx, 2.2, lz, 8));
      lampHead.push(new THREE.SphereGeometry(.24, 10, 8).translate(lx, 4.52, lz));
      lampPole.push(tcyl(.16, .2, .22, lx, .11, lz, 8));
    }
    addMerged(this.group, stemGeos, mats.bambooStem);
    addMerged(this.group, leafGeos, mats.bambooLeaf);
    addMerged(this.group, fernGeos, mats.fern);
    addMerged(this.group, cycadGeos, mats.cycad);
    addMerged(this.group, whiteTrunkGeos, mats.whiteBark);
    addMerged(this.group, whiteCanopyGeos, mats.vine);
    addMerged(this.group, redGeos, mats.redGround);
    addMerged(this.group, hedgeGeos, this.shrubMat || mats.fern);
    addMerged(this.group, shrubGeos, this.shrubMat || mats.fern);
    addMerged(this.group, lampPole, mats.lampWhite);
    addMerged(this.group, lampHead, mats.lampWhite);
  }

  _buildLeaves() {
    const n = 260;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    const rnd = mulberry32(321);
    this.leafData = [];
    for (let i = 0; i < n; i++) {
      const x = -130 + rnd() * 270, z = -155 + rnd() * 310, y = 2 + rnd() * 12;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      this.leafData.push({ x, z, y, speed: .35 + rnd() * .6, phase: rnd() * 6.28, swing: .6 + rnd() * 1.5 });
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xd8a45e, size: .45, transparent: true, opacity: .85, depthWrite: false, sizeAttenuation: true });
    this.leafParticles = new THREE.Points(geo, mat);
    this.leafParticles.visible = false;
    this.group.add(this.leafParticles);
  }

  _buildBirds() {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0x3a3a36, side: THREE.DoubleSide });
    for (let i = 0; i < 10; i++) {
      const bird = new THREE.Mesh(new THREE.ConeGeometry(.18, .8, 3), mat);
      bird.rotation.z = Math.PI / 2;
      bird.userData.phase = i / 10 * Math.PI * 2;
      g.add(bird);
    }
    g.position.set(50, 34, -90);
    this.birds = g;
    this.group.add(g);
  }

  setSeason(season) {
    this.season = season;
    const pal = SEASONS[season] || SEASONS.summer;
    for (const t of this.typeList) {
      const col = pal[t.key] || pal.camphor;
      t.canopyMat.color.set(col);
      if (t.key === 'cherry' && season !== 'spring') t.canopyMat.color.set(pal.camphor);
    }
    if (this.shrubMat) this.shrubMat.color.set(pal.grass).multiplyScalar(.82);
    if (this.leafParticles) {
      this.leafParticles.visible = season === 'autumn' || season === 'spring';
      this.leafParticles.material.color.set(season === 'spring' ? 0xe8b7c5 : 0xd8a45e);
    }
  }

  setDensity(d) {
    this.density = d;
    const target = Math.max(0, Math.min(1, d));
    for (const t of this.typeList) {
      const n = Math.floor(t.positions.length * (0.15 + 0.85 * target));
      t.trunkMesh.count = n;
      t.canopyMesh.count = n;
    }
  }

  update(dt, t, { night = 0 } = {}) {
    this.birds.position.y = 34 + Math.sin(t * .35) * 1.5;
    this.birds.rotation.y = t * .03;
    this.birds.children.forEach((b, i) => {
      b.position.set(Math.cos(t * .16 + b.userData.phase) * (15 + i * 1.2), Math.sin(t * .4 + i) * 1.4, Math.sin(t * .16 + b.userData.phase) * (12 + i));
      b.rotation.z = Math.PI / 2 + Math.sin(t * 7 + i) * .35;
    });
    if (this.leafParticles && this.leafParticles.visible) {
      const p = this.leafParticles.geometry.attributes.position;
      for (let i = 0; i < this.leafData.length; i++) {
        const d = this.leafData[i];
        d.y -= d.speed * dt;
        if (d.y < .3) d.y = 12 + Math.random() * 6;
        p.setXYZ(i, d.x + Math.sin(t * .8 + d.phase) * d.swing, d.y, d.z + Math.cos(t * .6 + d.phase) * d.swing * .5);
      }
      p.needsUpdate = true;
    }
  }
}

import * as THREE from 'three';
import {
  buildGate, buildDachengHall, buildPanPond, buildZiyinHill, buildLinZexu, buildZhufeng,
  buildDachengGate, buildFudelang, buildRedCorridor, buildZiyinPavilion, buildModernBlock, buildDianjiaoRing, buildTrack, buildGym, buildPoolWing, makeArchBridge, buildCornerPavilion,
  buildHillRoads, buildHillFence, buildHillStreetDetails, buildWuGongPavilion, buildCannons, buildInscriptionRock,
  buildHillPlatform, buildHillStairB, buildCornerSquarePavilion, buildFenceRun,
  buildQinyuanGate, buildQinyuanPavilion, buildYuGongPavilion, buildGoosePen, buildSweetCafe,
  buildStudyRoom, buildBookBar, buildRoushiPavilion, buildFudeWestCourt, buildHexPavilion,
  buildRoushiNorthCourt, buildStudyPond, ROUSHI_COURT_COLLIDERS
} from './buildings.js';
import { addStele, makeGlowSprite, addLantern, addMerged } from './detail.js';
import { decorateNorthBlock, decorateSouthBlock, decorateAcademy, decorateAnnex } from './classrooms.js';
import { Nature } from './nature.js';
import { People } from './people.js';
import { Context } from './context.js';
import { makeGlowSpriteTexture } from '../textures.js';
import { mulberry32, textTexture, tbox, tcyl, mergeGeometriesSafe } from '../util.js';

const FOG_DAY = new THREE.Color(0xd9dcda);
const FOG_NIGHT = new THREE.Color(0x23282c);

// 沁园整体下沉 1m：外边界与 context.js 地表开洞一致，内圈平台为满下沉区
const QINYU = {
  x0: -72.4, x1: -55.9, z0: -51, z1: -24,
  fx0: -70.4, fx1: -56.0, fz0: -49.4, fz1: -25.8,
};

/** 生成带云絮与竖直渐变的雾墙贴图 */
function makeFogTexture() {
  const W = 512, H = 256;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const rnd = mulberry32(2024);
  g.clearRect(0, 0, W, H);
  // 先铺一层近乎不透明的白作底，再叠云絮做浓淡变化
  g.fillStyle = 'rgba(255,255,255,.94)';
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 260; i++) {
    const x = rnd() * W, y = rnd() * H;
    const r = 18 + rnd() * 64;
    const a = .02 + rnd() * .05;
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `rgba(255,255,255,${a})`);
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // 下部厚实、上部收薄
  g.globalCompositeOperation = 'destination-in';
  const lg = g.createLinearGradient(0, H, 0, 0);
  lg.addColorStop(0, 'rgba(0,0,0,1)');
  lg.addColorStop(.72, 'rgba(0,0,0,.96)');
  lg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = lg;
  g.fillRect(0, 0, W, H);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 方形小料石铺地贴图：细方格灰石 + 勾缝 + 噪点，一片 8×8 格 */
function makeCobbleTexture() {
  const S = 256, N = 8, cell = S / N;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const rnd = mulberry32(4310);
  g.fillStyle = '#8e8b82'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const v = 168 + Math.floor(rnd() * 26);
    g.fillStyle = `rgb(${v},${v - 2},${v - 9})`;
    g.fillRect(i * cell + 1.5, j * cell + 1.5, cell - 3, cell - 3);
  }
  for (let k = 0; k < 3000; k++) {
    const v = 120 + rnd() * 90;
    g.fillStyle = `rgba(${v},${v},${v},${.08 + rnd() * .1})`;
    g.fillRect(rnd() * S, rnd() * S, 2, 2);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 生成四周柔和淡出的雾团贴图（用于散雾 Sprite，避免硬边） */
function makePuffTexture() {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const g = cv.getContext('2d');
  const rnd = mulberry32(7331);
  g.clearRect(0, 0, S, S);
  for (let i = 0; i < 140; i++) {
    const x = S * .18 + rnd() * S * .64;
    const y = S * .28 + rnd() * S * .44;
    const r = 16 + rnd() * 48;
    const a = .10 + rnd() * .18;
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `rgba(255,255,255,${a})`);
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // 圆形淡出，消除矩形硬边
  g.globalCompositeOperation = 'destination-in';
  const rg2 = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  rg2.addColorStop(0, 'rgba(0,0,0,1)');
  rg2.addColorStop(.55, 'rgba(0,0,0,.85)');
  rg2.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg2;
  g.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Campus {
  constructor(scene, mats) {
    this.scene = scene;
    this.mats = mats;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.nightEmitters = [];
    this.nightLights = [];
    this.colliders = [];
    this.walkSurfaces = [];
    this.fogSegments = [];
    this.fenceSegments = [];
    this.boundary = null;
    this.clockHands = [];
    this.ctx = { group: this.group, mats, nightEmitters: this.nightEmitters, nightLights: this.nightLights, fences: this.fenceSegments };
    this._buildGrounds();
    this._buildQinyuanBasin();
    this._buildQinyuanScenery();
    this._buildCreek();
    this._buildBuildings();
    this._buildWalls();
    this._buildOuterFog();
    this._buildPlazaDetails();
    this._buildNight();
    this.context = new Context(scene, mats, this.boundary);
    this.nature = new Nature(scene, mats, {
      hill: this.hill,
      hillHeight: (x, z) => this.hillHeight(x, z),
      dropAt: (x, z) => this._qinyuDrop(x, z),
      colliders: this.colliders,
      inBounds: (x, z) => this.inBounds(x, z),
    });
    this.people = new People(scene, mats, 72);
    this.nature.setSeason('summer');
    this.nature.setDensity(1);
    // 树干实体：小人不能穿过树干（半径封顶，避免堵死窄路）
    for (const t of this.nature.allTrees) {
      this.colliders.push({ x: t.x, z: t.z, hx: Math.min(t.trunk, .45), hz: Math.min(t.trunk, .45) });
    }
    // 柔石亭北广场的低矮砖池/石坛/景石：Nature 生成后再并入，避免筛掉池内高冠松
    for (const c of ROUSHI_COURT_COLLIDERS) this.colliders.push({ ...c });
    this.smoke = this._buildSmoke();
    this.landmarks = this._landmarks();
    this._time = 0;
  }

  _buildGrounds() {
    const m = this.mats;
    const path = (x, z, w, d, ry = 0, mat = m.roadStone, y = .055) => {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
      p.rotation.x = -Math.PI / 2; p.rotation.z = -ry;
      p.position.set(x, y, z); p.receiveShadow = true; this.group.add(p);
      return p;
    };
    // 石板路：按铺装尺寸细分贴图，避免长条铺装把石板纹理拉伸成整块
    const slabPath = (x, z, w, d, ry = 0, y = .06) => {
      const tex = m.path.map.clone();
      // 贴图内一片 4×8 块石板：按约 1m 一块反算重复次数，避免出现碎砖感
      tex.repeat.set(w / 4, d / 8);
      tex.needsUpdate = true;
      const mat = m.path.clone();
      mat.map = tex;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
      p.rotation.x = -Math.PI / 2; p.rotation.z = -ry;
      p.position.set(x, y, z); p.receiveShadow = true; this.group.add(p);
    };
    // 中轴：校门 → 泮池 为石板路（实景浅灰石板），旗杆前不再铺沥青
    // 泮池前圆形花坛周边石板广场：东西向各延伸 10m（33.2×6.9），花坛居中、行人绕行；以南收窄为 7m 步道
    slabPath(-28, 104.15, 33.2, 6.9);
    slabPath(-28, 128.3, 7, 41.4);
    path(-28, 72, 7, 10);
    path(-28, 36, 8, 40);
    path(-28, -5, 5, 12, 0, m.path);
    // 校门内小广场（小门楼，不做圆形广场）
    path(-28, 147, 26, 9);
    // 泮池两侧步道；原东西两条灰黑直路取消，改为左右对称的宽斜向石板路汇入广场
    path(-28, 86, 34, 3.2);
    slabPath(-42.58, 99.9, 17.0, 6.6, 0.415, .062);
    slabPath(-13.42, 99.9, 17.0, 6.6, -0.415, .062);
    // 两条斜路外端各向北直铺 10m（宽度仍 6.6m，与斜路同材质）
    slabPath(-50.43, 91.54, 6.6, 10, 0, .064);
    slabPath(-5.57, 91.54, 6.6, 10, 0, .064);
    // 教学楼群 2×2 之间的巷道
    path(-28, 43, 46, 4);
    path(-28, 2, 46, 3.4);
    // 校门向东至行政楼、朱枫故居
    path(4, 139, 34, 4.6);
    path(22, 131, 15, 3.6);
    // 西侧通教学区与电教楼
    // 原南北直路在水池段（z −10…18）取消，改环池园路，行人绕池走
    path(-60, -17, 4, 14);               // 沁园以北段（南端 z=-10，让开池岸）
    path(-60, 41.5, 4, 47);              // 水池以南段（z=18…65）
    path(-69.6, 2.8, 2.6, 27.6);          // 环池西段 x −70.9…−68.3 / z −11.0…16.6
    path(-66.2, -10.4, 9.4, 2.2);         // 环池北接 x −70.9…−61.5 / z −11.5…−9.3
    path(-62.7, 17.2, 17.8, 2.4);         // 环池南接 x −71.6…−53.8 / z 16.0…18.4
    path(-60, -63, 4, 24);               // 电教楼南侧段（盆地以北）
    path(-59.2, -30.2, 3.6, 12.4, 0, m.roadStone, -.945); // 沁园东侧：门洞 → 窄颈桥东端
    path(-66.2, -40.6, 6.8, 2.4, 0, m.roadStone, -.945);  // 亭北石阶 → 拱桥西端（北岸园路）
    // 广场 / 体艺馆前广场
    path(28, -61, 74, 7);
    // 沁园与空中走廊一带
    path(-54, -42, 4, 22);
    // 北区宿舍道路
    path(-20, -140, 116, 5);
    // 蛟川书院前庭：教学楼与办公楼之间的大面积白石板广场（47.09 实景，避开建筑体）
    path(-118, 125, 64, 9, 0, m.slab);        // 主楼←办公楼之间的主广场带
    path(-98, 108, 26, 28, 0, m.slab);        // 主楼东侧端头广场
    path(-148, 108, 22, 28, 0, m.slab);       // 主楼西侧端头广场
    for (const co of [[-150, 97], [-86, 97], [-150, 150], [-86, 150]]) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), m.slab);
      b.rotation.x = -Math.PI / 2; b.position.set(co[0], .045, co[1]); b.receiveShadow = true; this.group.add(b);
    }
    // 梓荫山北侧沿河石板路
    path(87, -63, 40, 4);
    // 草坪
    for (const [x, z, w, d] of [[-72, 30, 9, 22], [16, 28, 9, 22], [-72, 57, 9, 22], [16, 58, 9, 22]]) {
      const g = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m.grass);
      g.rotation.x = -Math.PI / 2; g.position.set(x, .03, z); g.receiveShadow = true; this.group.add(g);
    }
  }

  /** 沁园范围内地面下沉量（0…1m）：内圈平台满下沉，向外边缘线性收敛到 0 */
  _qinyuDrop(x, z) {
    const Q = QINYU;
    if (x <= Q.x0 || x >= Q.x1 || z <= Q.z0 || z >= Q.z1) return 0;
    const dx = x < Q.fx0 ? (x - Q.x0) / (Q.fx0 - Q.x0)
      : x > Q.fx1 ? (Q.x1 - x) / (Q.x1 - Q.fx1) : 1;
    const dz = z < Q.fz0 ? (z - Q.z0) / (Q.fz0 - Q.z0)
      : z > Q.fz1 ? (Q.z1 - z) / (Q.z1 - Q.fz1) : 1;
    return Math.min(1, Math.min(dx, dz));
  }

  /** 沁园下沉盆地网格（补 context.js 地表开洞），东缘挡土石墙遮住落差 */
  _buildQinyuanBasin() {
    const Q = QINYU;
    const w = Q.x1 - Q.x0, d = Q.z1 - Q.z0;
    const cx = (Q.x0 + Q.x1) / 2, cz = (Q.z0 + Q.z1) / 2;
    const geo = new THREE.PlaneGeometry(w, d, 54, 54);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, -this._qinyuDrop(pos.getX(i) + cx, pos.getZ(i) + cz));
    }
    geo.computeVertexNormals();
    const basin = new THREE.Mesh(geo, this.mats.grass);
    basin.position.set(cx, .02, cz);
    basin.receiveShadow = true;
    this.group.add(basin);
    // 东缘挡土石墙：空中走廊西柱廊下方，从盆地底砌至地面；北端止于鹅棚北缘，留出踏步开口
    const wall = new THREE.Mesh(new THREE.BoxGeometry(.35, 1.1, 15.9), this.mats.stone);
    wall.position.set(-55.95, -.5, -40.45);
    wall.castShadow = true; wall.receiveShadow = true;
    this.group.add(wall);
  }

  /** 沁园园景：北岸山石群、船形盆景与修剪灌木（参考视频 68-84s） */
  _buildQinyuanScenery() {
    const m = this.mats;
    const qy = new THREE.Group();
    qy.position.y = -1;                 // 盆地底面
    this.group.add(qy);
    const rnd = mulberry32(7719);
    // 山石群（高低错落的灰石）
    const rockGeos = [];
    const spots = [
      [-62.4, -46.0, 1.2], [-60.9, -47.6, 1.6], [-59.4, -46.9, 1.1], // 仅保留靠近鹅棚的三颗
    ];
    for (const [rx, rz, s] of spots) {
      const geo = new THREE.DodecahedronGeometry(.95 * s, 0);
      geo.scale(1, .85 + rnd() * .45, .8 + rnd() * .3);
      geo.rotateY(rnd() * Math.PI);
      geo.translate(rx, .45 * s, rz);
      rockGeos.push(geo);
    }
    const rocks = new THREE.Mesh(mergeGeometriesSafe(rockGeos), m.rock);
    rocks.castShadow = true; rocks.receiveShadow = true;
    qy.add(rocks);
    // 船形盆景：木盆 + 倾斜扭曲主干 + 云片状树冠
    const foliage = new THREE.MeshStandardMaterial({ color: 0x6c9642, roughness: .88 });
    const barkMat = new THREE.MeshStandardMaterial({ color: 0x5d4632, roughness: .95 });
    const penjing = (px, pz, potL, s) => {
      const pg = new THREE.Group();
      const boat = new THREE.Mesh(new THREE.BoxGeometry(potL, .5, .95), m.woodDark);
      boat.position.y = .25; boat.castShadow = true; pg.add(boat);
      const rim = new THREE.Mesh(new THREE.BoxGeometry(potL + .12, .12, 1.07), m.woodDark);
      rim.position.y = .5; pg.add(rim);
      const t1 = new THREE.Mesh(new THREE.CylinderGeometry(.16 * s, .26 * s, 1.7 * s, 6), barkMat);
      t1.position.set(-.2, .5 + .8 * s, 0); t1.rotation.z = .38; t1.castShadow = true; pg.add(t1);
      const t2 = new THREE.Mesh(new THREE.CylinderGeometry(.07 * s, .14 * s, 1.0 * s, 5), barkMat);
      t2.position.set(.5 * s, .5 + 1.35 * s, .1); t2.rotation.z = -.7; pg.add(t2);
      const pads = [
        [-.9, .5 + 1.75 * s, 0, 1.5], [.35, .5 + 1.95 * s, .15, 1.8],
        [1.1, .5 + 1.5 * s, -.2, 1.1], [0, .5 + 2.3 * s, 0, 1.0],
      ];
      for (const [dx, dy, dz, r] of pads) {
        const pad = new THREE.Mesh(new THREE.IcosahedronGeometry(.5 * s, 1), foliage);
        pad.scale.set(r, .42, r * .85);
        pad.position.set(dx, dy, dz);
        pad.castShadow = true; pg.add(pad);
      }
      pg.position.set(px, 0, pz); qy.add(pg);
    };
    penjing(-66.9, -45.0, 2.8, 1.15);
    penjing(-64.8, -44.6, 2.2, .82);
    // 修剪成圆锥的造型灌木
    for (const [sx, sz, r, h] of [[-69.9, -44.6, 1.1, 2.5], [-63.0, -45.7, .8, 1.7], [-58.6, -45.6, .9, 2.0]]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 9), foliage);
      cone.position.set(sx, h / 2, sz); cone.castShadow = true; qy.add(cone);
    }
  }

  _buildCreek() {
    const m = this.mats;
    const W = 7;
    const addWater = (x, z, w, d, ry) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, .04, d), m.water);
      mesh.position.set(x, .12, z);
      mesh.rotation.y = ry;
      mesh.receiveShadow = true;
      this.group.add(mesh);
    };
    // 梓荫河两侧不设驳岸与防护（河岸与地面平接，只有水面）
    // 梓荫河：四段窄水道，东西向，段间留石板空隙
    const segs = [
      [-55, -42, -45, -45],
      [-37, -22, -48, -48],
      [-14, 3, -48, -48],
      [7, 94, -51, -57],
    ];
    for (const [x0, x1, z0, z1] of segs) {
      const dx = x1 - x0, dz = z1 - z0;
      const len = Math.hypot(dx, dz);
      const ang = Math.atan2(dx, dz);
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      addWater(mx, mz, W, len, ang);
    }
    // 河面连续：补上断口（与两侧水面端头齐平；斜接段略低 5mm，避免共面闪烁）
    const fillWater = (x, z, w, d, ry, y) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, .04, d), m.water);
      mesh.position.set(x, y, z);
      mesh.rotation.y = ry;
      mesh.receiveShadow = true;
      this.group.add(mesh);
    };
    fillWater(-39.5, -46.5, 7, 5.83, Math.atan2(5, -3), .115); // 第 1、2 段之间
    fillWater(-18, -48, 7, 8, Math.PI / 2, .12);              // 第 2、3 段之间
    fillWater(5, -49.5, 7, 5, Math.atan2(4, -3), .115);       // 图一断口：第 3、4 段之间
    // 三座白色石拱桥：沁园桥、体艺馆前断口桥与两段之间一座
    const b1 = makeArchBridge(m, 4.2, 12, 2.6, { abut: false });
    b1.position.set(-45, 0, -45);
    this.group.add(b1);
    const b3 = makeArchBridge(m, 4.2, 12, 2.6, { abut: false });
    b3.position.set(5.5, 0, -49.9);
    this.group.add(b3);
    const b4 = makeArchBridge(m, 4.2, 12, 2.6, { abut: false });
    b4.position.set(-20, 0, -48);
    this.group.add(b4);
    // 三桥碰撞同步：桥面按真实拱线分 12 段可走；两端各加一级 0.2m 矮石踏步便于上桥
    for (const [bx, bz] of [[-45, -45], [5.5, -49.9], [-20, -48]]) {
      const half = 6;
      for (let i = 0; i < 12; i++) {
        this.walkSurfaces.push({
          x0: bx - 2, x1: bx + 2,
          z0: bz - half + i - .01, z1: bz - half + i + 1 + .01,
          yA: .42 + 2.6 * Math.sin(Math.PI * i / 12),
          yB: .42 + 2.6 * Math.sin(Math.PI * (i + 1) / 12),
          axis: 'z',
        });
      }
      for (const s of [-1, 1]) {
        const zc = bz + s * (half + .4);
        const st = new THREE.Mesh(new THREE.BoxGeometry(4.6, .2, .8), m.stone);
        st.position.set(bx, .1, zc);
        st.castShadow = true; st.receiveShadow = true;
        this.group.add(st);
        this.walkSurfaces.push({ x0: bx - 2.3, x1: bx + 2.3, z0: zc - .4, z1: zc + .4, y: .2 });
      }
    }
    // 沁园水域（对照手绘方位图）：西南圆形水塘（亭在其中）+ 东北窄颈石桥 + 向东北展开的宽水臂（鹅棚在北岸）
    // 轮廓以「圆池 + 斜向窄颈 + 水臂楔形」拼成单一闭合多边形，避免两块水面接缝
    const QY_C = { x: -66.0, z: -31.4 };   // 圆池中心
    const QY_R = 4.8;                       // 圆池半径
    const QY_AW = -87.8 * Math.PI / 180;    // 颈口西角
    const QY_AE = -38.6 * Math.PI / 180;    // 颈口东角
    const QY_NX = .45, QY_NZ = -.89;        // 窄颈走向（北偏东）
    const QY_NECK = 4.5;                    // 窄颈长度
    const QY_ARM = { xE: -56.6, zN: -45.8, zS: -38.2 }; // 水臂东端（贴空中走廊石墙）
    const qyOutline = (grow) => {
      const R = QY_R + grow;
      const pts = [];
      // 圆池岸线：自东颈口经南、西、北绕回西颈口（留出颈口缺口）
      const seg = 44, a0 = QY_AE, a1 = QY_AW + Math.PI * 2;
      for (let i = 0; i <= seg; i++) {
        const a = a0 + (a1 - a0) * (i / seg);
        const rr = R + Math.sin(a * 3 + .7) * .12 + Math.sin(a * 5 + 2.2) * .08;
        pts.push({ x: QY_C.x + Math.cos(a) * rr, z: QY_C.z + Math.sin(a) * rr });
      }
      const pw = pts[seg];
      const pe = { x: QY_C.x + Math.cos(QY_AE) * R, z: QY_C.z + Math.sin(QY_AE) * R };
      // 窄颈西岸 → 水臂西北岸
      pts.push({ x: pw.x + QY_NX * (QY_NECK + grow), z: pw.z + QY_NZ * (QY_NECK + grow) });
      pts.push({ x: QY_ARM.xE + grow, z: QY_ARM.zN - grow });
      // 水臂东端（南北向切边；东为 +x，外扩取 +grow，否则石岸洞会越出外轮廓）
      pts.push({ x: QY_ARM.xE + grow, z: QY_ARM.zS + grow });
      // 水臂东南岸 → 窄颈东岸
      pts.push({ x: pe.x + QY_NX * (QY_NECK + grow), z: pe.z + QY_NZ * (QY_NECK + grow) });
      return pts;
    };
    const toV2 = (pts) => pts.map((p) => new THREE.Vector2(p.x, -p.z)); // shape.y → 世界 −z
    const waterShape = new THREE.Shape(toV2(qyOutline(0)));
    const waterGeo = new THREE.ShapeGeometry(waterShape);
    waterGeo.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(waterGeo, m.water);
    water.position.y = -.84; water.receiveShadow = true; this.group.add(water);
    // 0.6m 窄石岸：有厚度的石砌池沿，压住水面边缘并落到盆地底
    const rimShape = new THREE.Shape(toV2(qyOutline(.5)));
    rimShape.holes.push(new THREE.Path(toV2(qyOutline(-.12))));
    const rimGeo = new THREE.ExtrudeGeometry(rimShape, { depth: .26, bevelEnabled: false });
    rimGeo.rotateX(-Math.PI / 2);
    const rim = new THREE.Mesh(rimGeo, m.stone);
    rim.position.y = -1; rim.receiveShadow = true; this.group.add(rim);
    // 空中走廊：南端接实验楼西墙，北端贯穿电教楼东翼并从楼北面穿出（方塔东移贴廊东侧）
    // 对照视频：两侧青砖矮墙 + 深色压顶 + 砖壁柱 + 梁式顶棚（梁间透光）+ 壁灯
    const cor = new THREE.Group();
    cor.position.set(-54, 0, 0);
    this.group.add(cor);
    const COR_W = 4;
    const COR_S = -22.5, COR_N = -100;             // 南端 / 北端（电教楼北立面）
    const COR_LEN = COR_S - COR_N;
    const COR_MID = (COR_S + COR_N) / 2;
    const DECK_Y = 4.36, DECK_T = .32, DECK_BOT = DECK_Y - DECK_T;   // 廊面顶 / 底
    const WALL_H = 1.35, WALL_T = .2, WALL_X = 1.9; // 矮墙中线（廊内净宽 3.6m）
    const BAY = 4.75;
    // 廊面（白石板）
    const deck = new THREE.Mesh(new THREE.BoxGeometry(COR_W, DECK_T, COR_LEN), m.slab);
    deck.position.set(0, DECK_Y - DECK_T / 2, COR_MID);
    deck.castShadow = true; deck.receiveShadow = true; cor.add(deck);
    // 青砖贴图按面尺寸重复，避免砖块被拉伸
    const brickMat = (rw, rh, color = 0xc0c5c2) => {
      const mat = m.grayBrick.clone();
      mat.map = m.grayBrick.map.clone();
      mat.map.repeat.set(rw, rh);
      mat.map.needsUpdate = true;
      mat.color = new THREE.Color(color);
      return mat;
    };
    // 两侧青砖矮墙 + 深色石压顶
    for (const s of [-1, 1]) {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(WALL_T, WALL_H, COR_LEN), brickMat(COR_LEN / 2.6, WALL_H / 2.0));
      wall.position.set(s * WALL_X, DECK_Y + WALL_H / 2, COR_MID);
      wall.castShadow = true; wall.receiveShadow = true; cor.add(wall);
      const cope = new THREE.Mesh(new THREE.BoxGeometry(WALL_T + .14, .09, COR_LEN), m.stoneDark);
      cope.position.set(s * WALL_X, DECK_Y + WALL_H + .045, COR_MID);
      cope.castShadow = true; cor.add(cope);
    }
    // 通高砖柱：两旁柱子自廊面直抵廊顶（每 4.75m 一道，石柱础/柱头）
    const pierZ = [];
    for (let z = COR_N + 2.4; z <= COR_S - 2.4; z += BAY) pierZ.push(z);
    const ROOF_Y = DECK_Y + 3.19 + .25;          // 7.8：梁顶 = 廊顶板底
    const pierGeos = [], capGeos = [];
    for (const z of pierZ) for (const s of [-1, 1]) {
      pierGeos.push(tbox(.34, ROOF_Y - DECK_Y, .34, s * WALL_X, (DECK_Y + ROOF_Y) / 2, z));
      capGeos.push(tbox(.46, .1, .46, s * WALL_X, DECK_Y + .05, z));
      capGeos.push(tbox(.46, .1, .46, s * WALL_X, ROOF_Y - .05, z));
    }
    addMerged(cor, pierGeos, brickMat(.13, (ROOF_Y - DECK_Y) / 2.0));
    addMerged(cor, capGeos, m.stoneDark);
    // 梁式顶棚：跨廊灰砖梁
    const beamGeos = [];
    for (let z = COR_N + 1.1; z < COR_S - .4; z += 2.2) {
      beamGeos.push(tbox(COR_W + .2, .5, .8, 0, DECK_Y + 3.19, z));
    }
    addMerged(cor, beamGeos, brickMat(COR_W / 2.6, .5 / 2.0, 0xacb1ae));
    // 廊顶：整条走廊满铺蓝白色铁板（两侧折边 + 顺纹压条）
    const roofDeck = new THREE.Mesh(new THREE.BoxGeometry(COR_W + .2, .1, COR_LEN + .4), m.metalBlue);
    roofDeck.position.set(0, ROOF_Y + .05, COR_MID);
    roofDeck.castShadow = true; roofDeck.receiveShadow = true; cor.add(roofDeck);
    const roofTrim = [];
    for (const s of [-1, 1]) roofTrim.push(tbox(.14, .18, COR_LEN + .4, s * 2.0, ROOF_Y + .1, COR_MID));
    for (const x of [-1.2, 0, 1.2]) roofTrim.push(tbox(.07, .05, COR_LEN + .4, x, ROOF_Y + .13, COR_MID));
    addMerged(cor, roofTrim, m.darkMetal);
    // 穿楼段（电教楼东翼 z -100…-52）：楼体开槽高度（4.04…8.0）内补通高砖墙，封住槽口东立面
    const PASS_Z0 = COR_N, PASS_Z1 = -52, PASS_TOP = 8.0;
    const passGeos = [];
    for (const s of [-1, 1]) {
      passGeos.push(tbox(WALL_T, PASS_TOP - DECK_BOT, PASS_Z1 - PASS_Z0, s * WALL_X,
        (DECK_BOT + PASS_TOP) / 2, (PASS_Z0 + PASS_Z1) / 2));
    }
    addMerged(cor, passGeos, brickMat((PASS_Z1 - PASS_Z0) / 2.6, (PASS_TOP - DECK_BOT) / 2.0));
    // 壁灯（青砖墙内侧，隔一壁柱一盏）
    const lampFrames = [], lampGlass = [];
    const lampMat = m.wallLamp.clone();
    lampMat.emissiveIntensity = 0; lampMat.userData.baseEmissive = 1.4;
    for (let i = 0; i < pierZ.length; i += 2) {
      const z = pierZ[i];
      lampFrames.push(tbox(.2, .5, .24, -WALL_X + .12, DECK_Y + 1.5, z));
      lampGlass.push(tbox(.1, .3, .1, -WALL_X + .14, DECK_Y + 1.5, z));
    }
    addMerged(cor, lampFrames, m.darkMetal);
    const lampMesh = addMerged(cor, lampGlass, lampMat);
    if (lampMesh) this.nightEmitters.push(lampMesh);
    // 南延段廊下：与廊面同材质的白石基座，中开桥洞（拱洞正对沁園门洞一侧步道）
    const WZ0 = -32.5, WZ1 = COR_S, WTOP = DECK_BOT, ACZ = -26.5, AR = 1.5, ASPRING = 2.0;
    const wallShape = new THREE.Shape();
    wallShape.moveTo(WZ0, 0); wallShape.lineTo(WZ1, 0);
    wallShape.lineTo(WZ1, WTOP); wallShape.lineTo(WZ0, WTOP); wallShape.closePath();
    const archHole = new THREE.Path();
    archHole.moveTo(ACZ - AR, 0);
    archHole.lineTo(ACZ - AR, ASPRING);
    archHole.absarc(ACZ, ASPRING, AR, Math.PI, 0, true);
    archHole.lineTo(ACZ + AR, 0);
    archHole.closePath();
    wallShape.holes.push(archHole);
    const wallGeo = new THREE.ExtrudeGeometry(wallShape, { depth: .5, bevelEnabled: false });
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(wallGeo, m.slab);
      // 旋转后局部 x→世界 z、局部 z→世界 −x；东墙贴 x=2，西墙贴 x=−2
      w.rotation.y = -Math.PI / 2;
      w.position.x = s > 0 ? 2 : -1.5;
      w.castShadow = true; w.receiveShadow = true; cor.add(w);
      // 拱券石圈，与两侧桥身同材质
      const pts = [];
      for (let i = 0; i <= 24; i++) {
        const a = Math.PI * i / 24;
        pts.push(new THREE.Vector3(s * 2.02, ASPRING + Math.sin(a) * (AR + .06), ACZ + Math.cos(a) * (AR + .06)));
      }
      const band = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, .13, 5, false), m.slab);
      band.castShadow = true; cor.add(band);
    }
    // 桥洞两侧石墙落地碰撞（洞口段留空可通行）
    for (const s of [-1, 1]) {
      const wx = -54 + s * 1.75;
      this.colliders.push({ x: wx, z: -30.25, hx: .25, hz: 2.25 });
      this.colliders.push({ x: wx, z: -23.75, hx: .25, hz: 1.25 });
    }
    // 廊下支撑柱（与白石基座同材，只在南段可见）
    const colGeos = [];
    for (const z of [-51.5, -46.75, -42, -37.25]) {
      for (const s of [-1, 1]) colGeos.push(tbox(.34, DECK_BOT, .34, s * 1.6, DECK_BOT / 2, z));
    }
    addMerged(cor, colGeos, m.plasterCool);
    // 台阶：单步 0.311m（≤0.35）；南端直跑 14 级；北端「方平台 → 东向一跑 → 方平台 → 北向落地」
    const RISER = DECK_Y / 14, TREAD = .34;
    const stepGeos = [], stairWallGeos = [], rampGeos = [], railGeos = [], bodyGeos = [];
    // 圆截面石扶手（平滑）：平台矮墙沿墙顶直铺，梯段则用斜砌矮墙 + 顺坡扶手
    const railX = (x0, x1, y, zc) => railGeos.push(
      tcyl(.09, .09, Math.abs(x1 - x0), (x0 + x1) / 2, y, zc, 12, 0, 0, Math.PI / 2));
    const railZ = (z0, z1, y, xc) => railGeos.push(
      tcyl(.09, .09, Math.abs(z1 - z0), xc, y, (z0 + z1) / 2, 12, Math.PI / 2, 0, 0));
    // 斜砌矮墙：顶面一次成形不随踏步锯齿，扶手顺坡压顶
    const rampWall = (axis, a0, a1, yA, yB, c) => {
      const asc = a0 <= a1;
      const s0 = asc ? a0 : a1, s1 = asc ? a1 : a0;
      const y0 = asc ? yA : yB, y1 = asc ? yB : yA;
      const th = Math.atan2(Math.abs(y1 - y0), s1 - s0);
      const len = Math.hypot(s1 - s0, y1 - y0);
      const r = .075;
      const my = (y0 + y1) / 2 + r / Math.cos(th);
      const sh = new THREE.Shape();
      sh.moveTo(s0, -.3); sh.lineTo(s1, -.3); sh.lineTo(s1, y1); sh.lineTo(s0, y0); sh.closePath();
      const gg = new THREE.ExtrudeGeometry(sh, { depth: WALL_T, bevelEnabled: false });
      if (axis === 'x') {
        gg.translate(0, 0, c - WALL_T / 2);
        railGeos.push(tcyl(r, r, len, (s0 + s1) / 2, my, c, 10, 0, 0, Math.atan2(-(s1 - s0), y1 - y0)));
      } else {
        gg.rotateY(-Math.PI / 2);
        gg.translate(c + WALL_T / 2, 0, 0);
        railGeos.push(tcyl(r, r, len, c, my, (s0 + s1) / 2, 10, Math.atan2(s1 - s0, y1 - y0), 0, 0));
      }
      rampGeos.push(gg);
    };
    for (let i = 0; i < 14; i++) {
      const top = DECK_Y - (i + 1) * RISER;
      const zc = COR_S + (i + .5) * TREAD;
      stepGeos.push(tbox(COR_W, top, TREAD, 0, top / 2, zc));
      for (const s of [-1, 1]) {
        this.colliders.push({ x: -54 + s * WALL_X, z: zc, hx: .1, hz: TREAD / 2, y1: top + 1.44 });
      }
      this.walkSurfaces.push({
        x0: -54 - WALL_X + .1, x1: -54 + WALL_X - .1, z0: COR_S + i * TREAD, z1: COR_S + (i + 1) * TREAD, y: top,
      });
    }
    // 南端斜砌矮墙 + 顺坡圆石扶手（与北端同做法，墙顶不随踏步锯齿）
    for (const s of [-1, 1]) rampWall('z', COR_S, COR_S + 14 * TREAD, DECK_Y + WALL_H, WALL_H, s * WALL_X);
    // —— 北端 P1：突出北墙的 4×4 方平台（廊面标高 4.36m） ——
    const P1Z0 = COR_N, P1Z1 = COR_N - 4, P1ZC = (P1Z0 + P1Z1) / 2;   // -100 ~ -104
    const P1_S = DECK_Y + WALL_H;
    stepGeos.push(tbox(COR_W, DECK_T, 4, 0, DECK_Y - DECK_T / 2, P1ZC));
    bodyGeos.push(tbox(COR_W, DECK_BOT, 4, 0, DECK_BOT / 2, P1ZC));
    // 西缘 / 北缘 / 东缘南段砖矮墙 + 圆石扶手（东缘北段敞开接东向梯，东缘南段贴方塔西面）
    stairWallGeos.push(tbox(WALL_T, WALL_H, 4, -2, DECK_Y + WALL_H / 2, P1ZC));
    railZ(P1Z1, P1Z0, P1_S, -2);
    stairWallGeos.push(tbox(4.2, WALL_H, WALL_T, 0, DECK_Y + WALL_H / 2, P1Z1));
    railX(-2.1, 2.1, P1_S, P1Z1);
    stairWallGeos.push(tbox(WALL_T, WALL_H, 1.9, 2, DECK_Y + WALL_H / 2, -100.95));
    railZ(-101.9, -100, P1_S, 2);
    for (const c of [
      { x: -56, z: P1ZC, hx: .1, hz: 2 },
      { x: -54, z: P1Z1, hx: 2.1, hz: .1 },
      { x: -52, z: -100.95, hx: .11, hz: .95 },
    ]) this.colliders.push({ ...c, y0: DECK_Y, y1: P1_S + .09 });
    this.walkSurfaces.push({ x0: -56, x1: -52, z0: P1Z1, z1: P1Z0, y: DECK_Y });

    // —— P1 东缘向东一跑（沿方塔北立面）：7 级高差 / 6 级踏步 ——
    const EZ0 = -101.6, EZ1 = -104, EZC = (EZ0 + EZ1) / 2;   // 梯带 z 范围（南缘即方塔北面）
    const N1 = 6, N2 = 6;
    const P2Y = DECK_Y - (N1 + 1) * RISER;                   // 第二平台标高 2.18m
    for (let i = 0; i < N1; i++) {
      const top = DECK_Y - (i + 1) * RISER;
      const xc = 2 + (i + .5) * TREAD;
      stepGeos.push(tbox(TREAD, top, EZ0 - EZ1, xc, top / 2, EZC));
      this.colliders.push({ x: -54 + xc, z: EZ1 + .1, hx: TREAD / 2 + .01, hz: .1, y1: top + 1.44 });
      this.walkSurfaces.push({
        x0: -52 + i * TREAD, x1: -52 + (i + 1) * TREAD, z0: EZ1 + .1, z1: EZ0 + .1, y: top,
      });
    }
    rampWall('x', 2, 2 + N1 * TREAD, DECK_Y - RISER + 1.35, P2Y + 1.35, EZ1 + .1);

    // —— 北端 P2：第二个 4×4 方平台（东向梯东端，北缘接落地一跑） ——
    const P2X0 = 2 + N1 * TREAD, P2X1 = P2X0 + 4;            // 局部 4.04 / 8.04
    const P2Z0 = EZ0, P2Z1 = EZ0 - 4, P2ZC = (P2Z0 + P2Z1) / 2;
    const P2_S = P2Y + 1.35;
    stepGeos.push(tbox(4, .16, 4, (P2X0 + P2X1) / 2, P2Y - .08, P2ZC));
    bodyGeos.push(tbox(4, P2Y - .16, 4, (P2X0 + P2X1) / 2, (P2Y - .16) / 2, P2ZC));
    // 东缘、西缘北段、南缘方塔以东砖矮墙 + 圆石扶手（南缘西段即方塔北立面）
    stairWallGeos.push(tbox(WALL_T, 1.35, 4, P2X1, P2Y + .675, P2ZC));
    railZ(P2Z1, P2Z0, P2_S, P2X1);
    stairWallGeos.push(tbox(WALL_T, 1.35, 1.6, P2X0, P2Y + .675, -104.8));
    railZ(P2Z1, -104, P2_S, P2X0);
    stairWallGeos.push(tbox(.88, 1.35, WALL_T, 7.67, P2Y + .675, -101.5));
    railX(7.23, 8.11, P2_S, -101.5);
    for (const c of [
      { x: -54 + P2X1, z: P2ZC, hx: .1, hz: 2 },
      { x: -54 + P2X0, z: -104.8, hx: .1, hz: .8 },
      { x: -46.33, z: -101.5, hx: .44, hz: .1 },
    ]) this.colliders.push({ ...c, y0: P2Y, y1: P2_S + .09 });
    this.walkSurfaces.push({ x0: -54 + P2X0, x1: -54 + P2X1, z0: P2Z1, z1: -101.5, y: P2Y });

    // —— P2 北缘向北一跑落地：7 级高差 / 6 级踏步 ——
    for (let i = 0; i < N2; i++) {
      const top = P2Y - (i + 1) * RISER;
      const zc = P2Z1 - (i + .5) * TREAD;
      stepGeos.push(tbox(4, top, TREAD, (P2X0 + P2X1) / 2, top / 2, zc));
      for (const s of [-1, 1]) {
        const wx = s < 0 ? P2X0 : P2X1;
        this.colliders.push({ x: -54 + wx, z: zc, hx: .1, hz: TREAD / 2, y1: top + 1.44 });
      }
      this.walkSurfaces.push({
        x0: -54 + P2X0, x1: -54 + P2X1, z0: P2Z1 - (i + 1) * TREAD, z1: P2Z1 - i * TREAD, y: top,
      });
    }
    for (const wx of [P2X0, P2X1]) rampWall('z', P2Z1, P2Z1 - N2 * TREAD, P2Y + 1.35, 1.35, wx);
    addMerged(cor, stepGeos, m.slab);
    addMerged(cor, stairWallGeos, brickMat(.13, 2.2));
    addMerged(cor, rampGeos, brickMat(1 / 2.6, 1 / 2.0));
    addMerged(cor, railGeos, m.stoneDark);
    addMerged(cor, bodyGeos, brickMat(COR_W / 2.6, 3.0));
    // 廊面走面与两侧矮墙碰撞（矮墙只挡廊面上的人，廊下行人不受影响）
    this.walkSurfaces.push({ x0: -54 - WALL_X + .1, x1: -54 + WALL_X - .1, z0: COR_N, z1: COR_S, y: DECK_Y });
    for (const s of [-1, 1]) {
      this.colliders.push({
        x: -54 + s * WALL_X, z: COR_MID, hx: WALL_T / 2, hz: COR_LEN / 2,
        y0: DECK_Y, y1: DECK_Y + WALL_H + .09,
      });
    }
  }

  _buildBuildings() {
    this.gate = buildGate(this.ctx);
    this.gate.position.set(-28, 0, 142);
    this.pond = buildPanPond(this.ctx);
    this.pond.position.set(-28, 0, 90);
    this.hall = buildDachengHall(this.ctx);
    this.hall.position.set(-28, 0, 10);
    this.hall.scale.set(.87, .8, .639); // 南北向缩至 .639（比东西向短）
    // 大成殿台基与正面台阶可站立（台基顶 1.3×.8=1.04m，台阶坡道 20.55→24.2）
    this.walkSurfaces.push(
      { x0: -45.4, x1: -10.6, z0: -.55, z1: 20.55, y: 1.04 },
      { x0: -32.8, x1: -23.2, z0: 20.55, z1: 24.2, yA: 1.04, yB: 0, axis: 'z' },
      // 殿内石地面（比台基高 0.196m，单步可走）
      { x0: -41.0, x1: -15.0, z0: 3.66, z1: 16.34, y: 1.236 },
      // 祭坛台基与两级石阶（居中，每级 0.18m）
      { x0: -35.48, x1: -20.52, z0: 7.90, z1: 12.42, y: 1.596 },
      { x0: -35.48, x1: -20.52, z0: 12.42, z1: 12.74, y: 1.416 },
    );
    this.dachengGate = buildDachengGate(this.ctx);
    this.dachengGate.position.set(-28, 0, 61);
    // 大成门：台基 0.34m 可站立，南侧台阶可走；通长门槛需跳一下
    this.walkSurfaces.push(
      { x0: -40.5, x1: -15.5, z0: 56.5, z1: 65.5, y: .34 },
      { x0: -31.2, x1: -24.8, z0: 65.5, z1: 66.9, yA: .34, yB: 0, axis: 'z' },
    );
    this.fenceSegments.push([[-33.2, 64.3], [-22.8, 64.3], .85]);
    this.hillObj = buildZiyinHill(this.ctx);
    this.hill = this.hillObj.group;
    this.hillHeight = (x, z) => this.hillObj.heightAt(x, z);
    // 梓荫阁高台：台面、台基、前台阶可走
    this.walkSurfaces.push(
      { x0: 100.6, x1: 119.4, z0: -48.4, z1: -33.6, y: 8.0 },
      { x0: 106.33, x1: 115.67, z0: -48.5, z1: -41.17, y: 8.233 },
      { x0: 110, x1: 112, z0: -41.1, z1: -40.37, yA: 8.233, yB: 8.0, axis: 'z' },
    );
    // 高台围栏/垛口墙碰撞同步：北垛口墙不可进入，南/东白栏杆不可穿越
    // 缺口保留：C 梯口（x>115.9）、西沿灰白看台段（z −41.2~−36.2）
    // 西侧灰白看台（比台面低 0.3m，东边与高台对接，可走；范围略超出板面以覆盖悬挑边）
    this.walkSurfaces.push({ x0: 96.35, x1: 101.05, z0: -41.45, z1: -35.95, y: 7.7 });
    this.fenceSegments.push(
      [[100.4, -48.0], [119.6, -48.0], 10.2],   // 北侧垛口挡墙（顶 10.2m，跳跃也无法越过）
      [[100.92, -33.92], [115.9, -33.92], 9.6], // 南沿白栏杆（C 梯口留空）
      [[119.08, -47.8], [119.08, -33.8], 9.6],  // 东沿白栏杆
      [[100.92, -47.7], [100.92, -41.5], 9.6],  // 西沿白栏杆（看台以北）
      [[100.92, -36.4], [100.92, -33.8], 9.6],  // 西沿白栏杆（看台以南）
      // 新增梓荫阁前院围墙（同北墙）：西/东沿至前墙，前墙中间 4m 门洞正对台阶
      [[101.0, -48.0], [101.0, -40.0], 10.2],
      [[119.0, -48.0], [119.0, -40.0], 10.2],
      [[101.0, -40.0], [109.0, -40.0], 10.2],
      [[113.0, -40.0], [119.0, -40.0], 10.2],
      // 看台白栏杆：南沿整段；北沿留 B 红木梯口（x 97.3~99.7）；西沿留 A2 石阶口（z −39.6~−37.1）
      [[96.6, -36.32], [100.8, -36.32], 9.0],
      [[96.6, -41.08], [97.3, -41.08], 9.0],
      [[99.7, -41.08], [100.8, -41.08], 9.0],
      [[96.72, -41.2], [96.72, -39.6], 9.0],
      [[96.72, -37.1], [96.72, -36.2], 9.0],
    );
    // 蛟川书院：主楼北贴雾墙（北檐 z≈83）；厚度 17m，南侧单廊 6 开间；东西副楼同形，贴主楼南墙两端
    this.academy = buildModernBlock(this.ctx, {
      x: -118, z: 91.5, w: 73, d: 17, floors: 5, key: 'lab', name: '蛟川书院',
      corridor: true, baseH: 2.6, openInterior: true, closedCorridorEnds: true,
      corridorGaps: [[-6.8, -1.2], [1.2, 6.8], [-29.6, -27.4], [27.4, 29.6]],
    });
    decorateAcademy(this.ctx, this.academy, {
      by: 2.6, fby: 2.6, w: 73, d: 17, floors: 5,
      corridorGaps: [[-6.8, -1.2], [1.2, 6.8], [-29.6, -27.4], [27.4, 29.6]],
    });
    this._registerInterior(this.academy);
    // 蛟川东西副楼：同形 16×10、3 层、基座 2.6 与主楼首层外廊同层；北墙开门直连外廊，南门下院内
    this.academyEast = buildModernBlock(this.ctx, {
      x: -89.5, z: 105.5, w: 16, d: 10, floors: 3, key: 'teach4', name: '蛟川东副楼',
      baseH: 2.6, openInterior: true, entrance: false,
    });
    decorateAnnex(this.ctx, this.academyEast, {
      by: 2.6, w: 16, d: 10, floors: 3, bbSide: 1, stairSide: -1, entry: 'front', northDoorX: 0,
    });
    this._registerInterior(this.academyEast);
    this.academyWing = buildModernBlock(this.ctx, {
      x: -146.5, z: 105.5, w: 16, d: 10, floors: 3, key: 'teach4', name: '蛟川西副楼',
      baseH: 2.6, openInterior: true, entrance: false,
    });
    decorateAnnex(this.ctx, this.academyWing, {
      by: 2.6, w: 16, d: 10, floors: 3, bbSide: 1, stairSide: -1, entry: 'front', northDoorX: 0,
    });
    this._registerInterior(this.academyWing);
    // 书院办公室：独立 4 层，南立面贴南侧雾墙（z≈158.8…159.8，随 x 略斜）；入口朝北面向书院前庭
    this.academyAdmin = buildModernBlock(this.ctx, {
      x: -93, z: 154.6, w: 32, d: 10, floors: 4, key: 'admin', name: '书院办公室', roofH: 2.2,
      baseH: .8, openInterior: true, entrance: false,
    });
    decorateAnnex(this.ctx, this.academyAdmin, {
      by: .8, w: 32, d: 10, floors: 4, bbSide: 1, stairSide: -1, entry: 'back',
    });
    this._registerInterior(this.academyAdmin);
    this.academyPavilion = buildCornerPavilion(this.ctx);
    this.academyPavilion.position.set(-148, 0, 118.5);
    this.group.add(this.academyPavilion);
    // 教学楼 SW 南侧竹林以南、校门以西草坪：视频 BV1Dx411v7jb t=150–179s 的六角灰瓦亭
    this.academyEastPavilion = buildCornerPavilion(this.ctx);
    this.academyEastPavilion.position.set(-63, 0, 94);
    this.group.add(this.academyEastPavilion);
    this.zhufeng = buildZhufeng(this.ctx);
    this.zhufeng.position.set(22, 0, 122);
    this.zhufeng.scale.set(.5, .5, .5); // 长宽高统一缩至 1/2
    this.zhufeng.rotation.y = Math.PI; // 整体绕建筑自身竖轴翻转 180°（院墙、庭院随动）
    // 憩园院落碰撞：整体翻转 180° 后西墙留出院门（x' = 44 - x, z' = 244 - z）
    this.colliders.push(
      { x: 22, z: 122, hx: 5.5, hz: 4.25 },
      { x: 22, z: 127.25, hx: 7, hz: .16 },       // 原南墙翻到北侧（楼后）
      { x: 22, z: 110.5, hx: 7, hz: .16 },        // 原北墙翻到南侧（院前）
      { x: 29, z: 118.875, hx: .16, hz: 8.375 },  // 原西墙翻到东侧（整段实墙）
      { x: 15, z: 120.25, hx: .16, hz: 7.0 },     // 原东墙（月洞门以北 113.25~127.25 连续实墙）
      { x: 15, z: 110.875, hx: .16, hz: .375 },   // 出院门北侧
      { x: 18, z: 113.75, hx: .65, hz: .65 },     // 石桌
    );
    // 台基与入口三级台阶（单步 0.287，翻转后台阶朝北）
    this.walkSurfaces.push(
      { x0: 15.875, x1: 28.125, z0: 117.125, z1: 126.875, y: .43 },
      { x0: 20.75, x1: 23.25, z0: 116.95, z1: 117.15, y: .43 },
      { x0: 20.75, x1: 23.25, z0: 116.75, z1: 116.95, y: .286 },
      { x0: 20.75, x1: 23.25, z0: 116.55, z1: 116.75, y: .143 },
    );
    // 柔石亭：朱枫故居建筑西墙外 10m、北墙外 5m 的松柏间
    this.roushiPavilion = buildRoushiPavilion(this.ctx);
    this.roushiPavilion.position.set(1, 0, 108.5);
    this.group.add(this.roushiPavilion);
    // 柔石亭北广场：方格铺地、两座砖砌花池、石坛、高冠松三脚撑（用户视频：亭北面向南看）
    this.roushiCourt = buildRoushiNorthCourt(this.ctx);
    this.group.add(this.roushiCourt);
    this.colliders.push(
      { x: -0.42, z: 107.08, hx: .18, hz: .18 },
      { x: 2.42, z: 107.08, hx: .18, hz: .18 },
      { x: -0.42, z: 109.92, hx: .18, hz: .18 },
      { x: 2.42, z: 109.92, hx: .18, hz: .18 },
    );
    this.walkSurfaces.push({ x0: -1.2, x1: 3.2, z0: 106.3, z1: 110.7, y: .36 });
    for (let i = 0; i < 3; i++) {
      this.walkSurfaces.push({ x0: 0, x1: 2, z0: 110.77 + i * .3, z1: 111.07 + i * .3, y: .3 - i * .1 });
    }
    // 沁园：门洞（自习室与空中走廊南端楼梯间之间）、水上绿琉璃六角亭、鹅棚
    // 门洞立在下沉区南缘的高地上，亭子随水面下沉 1m
    this.qinyuanGate = buildQinyuanGate(this.ctx);
    this.qinyuanGate.position.set(-60, 0, -22.5);
    this.group.add(this.qinyuanGate);
    this.colliders.push(
      { x: -62.55, z: -22.5, hx: .95, hz: .4 },
      { x: -57.45, z: -22.5, hx: .95, hz: .4 },
    );
    // 六角亭：立于西南圆池正中；石阶朝北，末端落到池北岸
    this.qinyuanPavilion = buildQinyuanPavilion(this.ctx);
    this.qinyuanPavilion.position.set(-66.0, -1, -31.4);
    this.qinyuanPavilion.rotation.y = Math.PI; // 石阶转向北，落北岸园路；避免朝西顶到书吧
    this.group.add(this.qinyuanPavilion);
    // 六角亭石台顶（六边形近似为矩形可走面，台面顶 −.31）
    this.walkSurfaces.push({ cx: -66.0, cz: -31.4, ry: 0, hx: 3.1, hz: 2.9, y: -.31 });
    for (let i = 0; i < 5; i++) {
      // 北侧五级台阶（亭体转 180° 后台阶朝北），每级降 .12；前三级落在水面，后两级上北岸
      const z1 = -31.4 - 2.78 - i * .6, z0 = z1 - .6;
      this.walkSurfaces.push({ x0: -67.3, x1: -64.7, z0, z1, y: -.4 - i * .12 });
    }
    // 白石拱桥：跨圆池与水臂之间的窄颈，斜向（视频 73s 短拱桥，桥长约 6m、跨水约 4m）
    const QY_BR = { x: -62.67, z: -37.98, ry: 1.102, len: 6.2, wid: 2.4, rise: .9 };
    const qyBridge = makeArchBridge(this.mats, QY_BR.wid, QY_BR.len, QY_BR.rise, { abutH: .3, archH: .72 });
    qyBridge.position.set(QY_BR.x, -1, QY_BR.z);
    qyBridge.rotation.y = QY_BR.ry;
    this.group.add(qyBridge);
    // 桥面 12 段旋转可走面（相邻高差 ≤ .3，单步限高内）
    const qySeg = QY_BR.len / 12;
    for (let i = 0; i < 12; i++) {
      const t = (i + .5) / 12;
      const lz = -QY_BR.len / 2 + (i + .5) * qySeg;
      const wx = QY_BR.x + Math.sin(QY_BR.ry) * lz, wz = QY_BR.z + Math.cos(QY_BR.ry) * lz;
      this.walkSurfaces.push({
        cx: wx, cz: wz, ry: QY_BR.ry, hx: .9, hz: qySeg / 2 + .02,
        y: -.58 + QY_BR.rise * Math.sin(Math.PI * t),
      });
    }
    // 桥两端各两级踏步落地（桥面端 −.58 → 园地 −1）
    for (const side of [-1, 1]) {
      for (let k = 0; k < 2; k++) {
        const lz = side * (QY_BR.len / 2 + .3 + k * .6);
        const wx = QY_BR.x + Math.sin(QY_BR.ry) * lz, wz = QY_BR.z + Math.cos(QY_BR.ry) * lz;
        const top = -.72 - k * .14, h = top + 1;
        const st = new THREE.Mesh(new THREE.BoxGeometry(2.8, h, .6), this.mats.stone);
        st.position.set(wx, -1 + h / 2, wz);
        st.rotation.y = QY_BR.ry;
        st.castShadow = true; st.receiveShadow = true;
        this.group.add(st);
        this.walkSurfaces.push({ cx: wx, cz: wz, ry: QY_BR.ry, hx: 1.2, hz: .3, y: top });
      }
    }
    this.goosePen = buildGoosePen(this.ctx);
    // 空中走廊西侧、梓荫河南岸；在下沉区外，落回常高地面
    this.goosePen.position.set(-53.5, 0, -46.8);
    this.group.add(this.goosePen);
    // 鹅棚北侧灰白平台：接鹅棚北缘，台面与常高地面齐平
    const penDeck = new THREE.Mesh(new THREE.BoxGeometry(5.6, .26, 1.75), this.mats.slab);
    penDeck.position.set(-53.1, -.06, -49.325);   // 台面 y=.07，南缘 z=-48.45 贴鹅棚
    penDeck.castShadow = true; penDeck.receiveShadow = true;
    this.group.add(penDeck);
    this.walkSurfaces.push({ x0: -55.9, x1: -50.3, z0: -50.2, z1: -48.45, y: .07 });
    // 直跑两级踏步（平台西缘向西落至盆底）
    for (let i = 0; i < 2; i++) {
      const top = .07 - (i + 1) * .2;
      const st = new THREE.Mesh(new THREE.BoxGeometry(.4, top + 1.1, 1.3), this.mats.slab);
      st.position.set(-56.1 - i * .4, (top - 1.1) / 2, -49.1);
      st.castShadow = true; st.receiveShadow = true; this.group.add(st);
      this.walkSurfaces.push({ x0: -56.3 - i * .4, x1: -55.9 - i * .4, z0: -49.75, z1: -48.45, y: top });
    }
    // 自习室东南 / 大成殿西北：石桥水池（对照实景照片：绿水池、石岸、假山石、石灯笼、菱形镂空石栏平板桥）
    this.studyPond = buildStudyPond(this.ctx);
    this.group.add(this.studyPond);
    this.colliders.push(...(this.studyPond.userData.colliders || []));
    this.walkSurfaces.push(...(this.studyPond.userData.walkSurfaces || []));
    this._buildHillLandmarks();
    this.fudelang = buildFudelang(this.ctx, { x: 82.6, z: -60, plaque: this.mats.plaques.fude });
    // 富的廊：台基可走（y=.345），西端两级石阶自院落上廊；两侧美人靠不可穿越
    this.walkSurfaces.push(
      { x0: 70.9, x1: 94.3, z0: -62.4, z1: -57.6, y: .345 },
      { x0: 71.15, x1: 71.7, z0: -61.3, z1: -58.7, y: .205 },
      { x0: 70.6, x1: 71.15, z0: -61.3, z1: -58.7, y: .065 },
    );
    this.fenceSegments.push(
      [[71.68, -61.8], [93.52, -61.8], 1.5],
      [[71.68, -58.2], [93.52, -58.2], 1.5],
    );
    // 富的廊西端白墙院落（44–63s）：南北向白墙、文保牌、大花窗、石凳盆景、修剪松、石狮
    buildFudeWestCourt(this.ctx, { x: 70.4, z: -69.1 });
    this.walkSurfaces.push({ x0: 70.5, x1: 85.5, z0: -76, z1: -62.2, y: .06 });
    this.colliders.push(
      // 白墙实体厚 .3m，中段留 2m 院门门洞（无匾额）；富的廊门楼独立在廊道西口前
      { x: 70.4, z: -73.3, hx: .15, hz: 3.3 },
      { x: 70.4, z: -64.8, hx: .15, hz: 3.2 },
      { x: 70.3, z: -61.3, hx: .35, hz: .45 },  // 富的廊门楼北垛
      { x: 70.3, z: -58.7, hx: .35, hz: .45 },  // 富的廊门楼南垛
      { x: 71.12, z: -74, hx: .32, hz: 1.0 },
      { x: 71.12, z: -66, hx: .32, hz: 1.0 },
      { x: 75.6, z: -73.3, hx: .28, hz: .28 },
      { x: 79.0, z: -65.7, hx: .28, hz: .28 },
      { x: 82.6, z: -70.9, hx: .28, hz: .28 },
      { x: 69.4, z: -61.4, hx: .42, hz: .32 },  // 石狮（富的廊门北）
      { x: 69.4, z: -58.6, hx: .42, hz: .32 },  // 石狮（富的廊门南）
    );
    // 梓荫阁围墙内西侧六角亭（200–239s）：白墙嵌石碑、两面美人靠、两面格栅，开口朝东入亭
    const hexPav = buildHexPavilion(this.ctx);
    hexPav.position.set(102.45, 8.0, -41.7);
    hexPav.rotation.y = 0; // 白墙朝西、入口朝东
    this.group.add(hexPav);
    this.walkSurfaces.push({ x0: 101.55, x1: 103.35, z0: -42.7, z1: -40.7, y: 8.12 });
    this.fenceSegments.push(
      [[103.359, -41.175], [102.45, -40.65], 9.6],
      [[102.45, -40.65], [101.541, -41.175], 9.6],
      [[101.541, -41.175], [101.541, -42.225], 10.6],
      [[101.541, -42.225], [102.45, -42.75], 9.6],
      [[102.45, -42.75], [103.359, -42.225], 9.6],
    );
    // 教学与功能建筑
    this.teach = [];
    this.annex = [];
    const defs = [
      // 教学楼群：围绕大成殿/大成门的 2×2 布局，严格关于中轴 x=-28.5 镜像
      // 平面为 L 形：南半段贴中轴（进深 7.5m、宽 30m），北半段向远离中轴方向内收 4m（宽 26m）
      // 形成「靠中轴一侧南凸北凹」；四栋均四层，主体高度不变
      { x: -59, z: 31.5, w: 30, d: 15, key: 'teachMain', name: '教学楼', floors: 4, lshape: true, walkIn: true },
      { x: 2, z: 31.5, w: 30, d: 15, key: 'teachMain', name: '教学楼', floors: 4, lshape: true, walkIn: true },
      { x: -59, z: 59.5, w: 30, d: 15, key: 'teachMain', name: '教学楼', floors: 4, lshape: true, walkIn: true, bare: true },
      { x: 2, z: 59.5, w: 30, d: 15, key: 'teachMain', name: '教学楼', floors: 4, lshape: true, walkIn: true },
      // 实验楼：东西向 4 层长方体（平屋面），中部另起第 5 层灰瓦大坡屋顶，两端为南向 2 层翼楼
      // 东端不动（x=0），西端自 -56 东移 5m 至 -51，露出空中走廊南端下行台阶
      { x: -25.5, z: -22, w: 51, d: 18, key: 'lab4', name: '实验楼', floors: 4, flatRoof: true },
      // 电教楼：回字形平面（外 47×48，内院 20×20），白色平屋顶（视频 58-78s）
      // 东西两块 5 层、南北两块 5.5 层；塔楼东北角、穹顶西南角（6.5 层）
      // 南侧入口雨棚/玻璃中庭取消：该轴在书吧东墙处，构件半埋入书吧、在夹角处外凸成杂物
      // 东翼东墙整体加厚 1.5m（局部 x 到 25，即世界 x=-52），并在空中走廊穿越处开全进深槽口
      // 槽口 x 21..25（世界 -56..-52，与廊宽一致）、y 4.04..8.0（廊底至梁顶），楼体被廊体真实贯穿
      {
        x: -77, z: -76, w: 47, d: 48, court: 20, key: 'lab', name: '电教楼', floors: 5, floorsNS: 5.5, ring: true, entrance: false,
        thickenE: 1.5, slot: { x0: 21, x1: 25, y0: 4.04, y1: 8.0 },
      },
      { x: -71, z: -17, w: 15, d: 10, name: '自习室', custom: 'study' },
      { x: -84.5, z: -44, w: 14, d: 16, name: '书吧', custom: 'book' },
      // 北区
      { x: -78, z: -158, w: 62, d: 28, key: 'admin', name: '综合楼', floors: 5, glassAtrium: true },
      { x: -96, z: -113, w: 21, d: 24, key: 'lab', name: '科学楼', floors: 5 },
      // 科学楼↔综合楼连廊（两楼间南北向连接体）
      { x: -96, z: -134.5, w: 21, d: 19, key: 'lab', name: '科学综合连廊', floors: 2 },
      // 北区建筑就位后补：科学楼与电教楼接壤处的小门及通往书吧西的小路（见 _buildScienceDoor）
      { x: -19, z: -150, w: 43, d: 13, key: 'dorm', name: '1#宿舍楼', floors: 5, ry: -.05 },
      { x: 40, z: -135, w: 52, d: 14, key: 'dorm', name: '2#宿舍楼', floors: 5 },
      { x: 89, z: -85, w: 39, d: 18, key: 'dorm', name: '学生宿舍', floors: 5 },
      // 校门区
      { x: 17, z: 139, w: 25, d: 10, key: 'admin3', name: '行政楼', floors: 3, baseH: 1.05, porch: true },
    ];
    for (const d of defs) {
      let b;
      if (d.lshape) {
        // 南北两块拼成 L 形：南块只保留靠中轴端的小长方形（宽 12m，带屋顶楼梯间），
        // 远离中轴的一段按用户标注删除；北块宽度减 4m、整体向远离中轴方向平移 2m
        const half = d.d / 2;
        const away = d.x < -28.5 ? -1 : 1;
        const sW = 12;
        const sX = d.x - away * ((d.w - sW) / 2);   // 南块内边线（贴中轴）保持不动
        const nbW = d.w - 4, nbX = d.x + away * 2, nbZ = d.z - half / 2;
        const sbZ = d.z + half / 2;
        b = buildModernBlock(this.ctx, {
          ...d, x: sX, w: sW, z: sbZ, d: half,
          entrance: false,  // 南立面雨棚门斗按标注取消
          roofH: 1.15,      // 坡高按宽度等比收，保持与北块屋顶同一坡度
          openInterior: !!d.walkIn,
          noBase: true,     // 青砖墙裙直达地面
        });
        const ogSide = -away;
        // 首层靠花池一侧（L 形缺口那 18m）敞开：三栋有内景的由内景模块拆墙，SW 由体量掏空
        const ogX0 = ogSide > 0 ? -nbW / 2 : -nbW / 2 + 8;
        const ogX1 = ogSide > 0 ? nbW / 2 - 8 : nbW / 2;
        const nb = buildModernBlock(this.ctx, {
          ...d, x: nbX, z: nbZ, w: nbW, d: half,
          entrance: false, // 北块南墙贴南块，重复入口雨棚会插进室内
          openInterior: !!d.walkIn,
          openGround: d.walkIn ? null : { x0: ogX0, x1: ogX1 },
          noFrontBand: !!d.walkIn, // 二层及以上前脸为开敞外廊
          noBase: true,            // 青砖墙裙直达地面
        });
        if (d.walkIn) {
          // 内景按手绘草图：北条 3 教室 + 两端楼梯 + 南侧走廊；南块单教室
          const connectSide = -away;              // 南块贴靠的那端楼梯
          const connX = connectSide * (nbW / 2 - 1.2);
          decorateNorthBlock(this.ctx, nb, {
            by: .8, fby: 0, w: nbW, d: half, floors: d.floors || 4,
            bbSide: 1, connectSide, bare: !!d.bare,
          });
          decorateSouthBlock(this.ctx, b, {
            by: .8, fby: 0, w: sW, d: half, floors: d.floors || 4,
            bbSide: -1, connectX: nbX + connX - sX, sharedW: 8, bare: !!d.bare,
          });
          this._registerInterior(nb);
          d.cols = [];
        } else {
          // 北块首层前脸已掏空：只登记后部/东端实体、方柱与 0.8m 基座外沿（跳上基座可进廊）
          const og = nb.userData.openGround;
          d.cols = [];
          this.colliders.push({
            x: sX, z: sbZ, hx: sW / 2, hz: half / 2,
          }, {
            x: nbX, z: nbZ + half / 2 - 2.2 - (half - 2.2) / 2, hx: nbW / 2, hz: (half - 2.2) / 2,
          }, {
            x: nbX + (og.x1 + nbW / 2) / 2, z: nbZ + half / 2 - 1.1, hx: (nbW / 2 - og.x1) / 2, hz: 1.1,
          }, {
            x: nbX - nbW / 2, z: nbZ + half / 2 - 1.1, hx: .05, hz: 1.1,
          });
          for (const cx of og.colsX) {
            this.colliders.push({
              x: nbX + cx, z: nbZ + half / 2 - .17, hx: .17, hz: .17, y0: og.y, y1: og.top,
            });
          }
          this.walkSurfaces.push({
            x0: nbX + og.x0, x1: nbX + og.x1,
            z0: nbZ + og.z0, z1: nbZ + half / 2 + .4, y: og.y,
          });
          // 通长三级台阶走面：与开口同长，逐级 .8→.533→.267
          for (const s of og.steps) {
            this.walkSurfaces.push({
              x0: nbX + s.x0, x1: nbX + s.x1, z0: nbZ + s.z0, z1: nbZ + s.z1, y: s.y,
            });
          }
        }
      } else {
        b = d.custom === 'study' ? buildStudyRoom(this.ctx, d)
          : d.custom === 'book' ? buildBookBar(this.ctx, d)
            : d.ring ? buildDianjiaoRing(this.ctx, d) : buildModernBlock(this.ctx, { ...d, floors: d.floors || 4 });
      }
      if (b.userData && b.userData.interior) this._registerInterior(b);
      this.teach.push(b);
    }
    // 书吧东墙（x=-77.5）与电教楼南墙（z=-52）夹角：三级同心半圆石阶，平边贴书吧东墙、弧线朝东外凸
    for (const [r, h] of [[2.7, .16], [2.2, .30], [1.65, .44]]) {
      const arc = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r, h, 36, 1, false, 0, Math.PI), this.mats.stone);
      arc.position.set(-77.3, h / 2, -49.3);
      arc.castShadow = true; arc.receiveShadow = true;
      this.group.add(arc);
    }
    // 石阶前的方形小料石铺地（视频 b22/t00063）：贴书吧东墙、自电教楼南墙向南 7m
    // 三级半圆石阶的可走面（矩形内接近似，中央 2.4m 宽通道），自沁园铺地逐级上到东门门槛（.44）
    this.walkSurfaces.push(
      { x0: -77.3, x1: -75.95, z0: -51.64, z1: -46.96, y: .16 },
      { x0: -75.95, x1: -74.88, z0: -50.5, z1: -48.1, y: .16 },
      { x0: -77.3, x1: -76.2, z0: -51.2, z1: -47.4, y: .30 },
      { x0: -76.2, x1: -75.456, z0: -50.5, z1: -48.1, y: .30 },
      { x0: -77.3, x1: -76.475, z0: -50.73, z1: -47.87, y: .44 },
      { x0: -76.475, x1: -76.168, z0: -50.5, z1: -48.1, y: .44 },
    );
    const cobbleTex = makeCobbleTexture();
    cobbleTex.repeat.set(4.9 / .9, 7 / .9);
    const apron = new THREE.Mesh(
      new THREE.PlaneGeometry(4.9, 7),
      new THREE.MeshStandardMaterial({ map: cobbleTex, roughness: .95 }));
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(-74.9, .035, -48.5);
    apron.receiveShadow = true;
    this.group.add(apron);
    this.gym = buildGym(this.ctx);
    this.gym.position.set(11, 0, -87.5); // 倒凸字形中间凸出块：北端 z=-104 不动、南端后缩至 z=-71，x 11 为东西翼对称轴
    // 甜心屋咖啡：体艺馆北面、2#宿舍楼南面之间（2026-10-25 用户要求：西移 40m 后再西移 20m、北移 10m）
    this.sweetCafe = buildSweetCafe(this.ctx);
    this.sweetCafe.position.set(-20, 0, -127);
    this.group.add(this.sweetCafe);
    this.colliders.push({ x: -20, z: -127, hx: 4.5, hz: 3.5 }); // 甜心屋咖啡（对齐 9×7 实体外墙）
    this.gymWing = buildPoolWing(this.ctx, { hollow: true, empty: true }); // 西翼只掏空：无外门、无内景
    this.gymEastWing = buildPoolWing(this.ctx, { x: 46, z: -99, courts: false, hollow: true }); // 东翼内景：红座椅看台 + 篮球馆
    this._registerInterior(this.gym);      // 主馆只掏空一层，经东西通口与两翼相连
    this._registerInterior(this.gymWing);
    this._registerInterior(this.gymEastWing);
    // 实验楼顶部第 5 层（南北通长、随主体按比例缩至 25.5m）+ 灰瓦大坡屋顶
    this.labTop = buildModernBlock(this.ctx, {
      x: -25.5, z: -22, w: 25.5, d: 18, key: 'lab5', name: '实验楼', floors: 1, roofH: 4.2,
      entrance: false, roofBulk: false,
    });
    this.labTop.position.y = 4 * 3.45 + 1.2;
    // 实验楼东西两端的南向 2 层翼楼（进深 12m→4m，贴主体南墙保留 4m）
    this.labWings = [-44, -7].map((wx) => buildModernBlock(this.ctx, {
      x: wx, z: -11, w: 14, d: 4, key: 'low2', name: '实验楼', floors: 2,
      entrance: false, // 去掉南向雨棚/入口台阶，避免视觉进深超出 4m
    }));
    for (const wing of this.labWings) this.colliders.push({ x: wing.position.x, z: wing.position.z, hx: 7, hz: 2 });

    // 红廊（反 L）：视频 155-161s 的灰廊架——灰方柱+平顶藤架、青砖墙+白抹灰带+红瓦压顶、
    // 四瓣花窗、赭红人物浮雕（“红”指浮雕）、三扇黄木门、红木长凳、端部踏步。
    // 竖段墙翻到东侧（x≈14.87，遮挡球场栅栏），柱列在西侧（x≈11.28）面向花园；
    // 横段墙在北侧（z≈4.53），柱列在南侧（z≈8.12）。
    const redV = buildRedCorridor(this.ctx, {
      x: 13.0, z: -6.8, length: 26.4, bays: 8,
      doors: [-9.0, -8.15, -7.3], // 视频 157-160s：三扇黄木门
      windows: [-4.6, -1.3, 2.0, 5.4, 8.8, 12.0], // 四瓣花窗
      reliefs: [
        { x: -11.35, w: 2.9, h: 1.15, kind: 'h' }, // 出口右侧横长幅
        { x: 4.6, w: 1.45, h: 1.9, kind: 'v' },     // 竖幅人物浮雕
      ],
      benches: [-2.2, 10.9],
      stairs: { end: -1, steps: 3 }, // 北端出口 3 级下
    });
    redV.rotation.y = -Math.PI / 2; // 墙转至东侧，柱列在西，覆盖 z -20…6.4
    const redH = buildRedCorridor(this.ctx, {
      x: 6.0, z: 6.4, length: 12.6, bays: 4,
      wallFrom: -6.3, wallTo: 5.12, // 墙止于竖段西柱线（x=11.12），转角留通行口
      windows: [-4.4, -1.4, 1.6, 4.2],
      reliefs: [{ x: -5.5, w: 1.2, h: 1.7, kind: 'v' }],
      benches: [-4.9],
      stairs: { end: -1, steps: 2 }, // 西端入口 2 级上
    });
    this.redCorridor = [redV, redH];
    // 廊下石台基可走（0.35m）+ 两端踏步坡面
    this.walkSurfaces.push(
      { x0: 10.65, x1: 15.35, z0: -20.15, z1: 6.55, y: .35 },
      { x0: -0.65, x1: 12.65, z0: 4.05, z1: 8.75, y: .35 },
      { x0: 11.0, x1: 15.0, z0: -21.5, z1: -20.0, yA: 0, yB: .35, axis: 'z' },
      { x0: -1.75, x1: -0.4, z0: 4.2, z1: 8.6, yA: 0, yB: .35, axis: 'x' },
    );
    // 青砖墙为实体：竖段在东侧 x=14.87（z -20…6.4），横段在北侧 z=4.53（x -0.3…11.12）
    this.colliders.push(
      { x: 14.87, z: -6.8, hx: .17, hz: 13.3 },
      { x: 5.41, z: 4.53, hx: 5.71, hz: .17 },
    );
    // 灰方柱为实体（竖段西侧 9 根、横段南侧 5 根）
    for (let i = 0; i <= 8; i++) this.colliders.push({ x: 11.28, z: 6.4 - i * (26.4 / 8), hx: .25, hz: .25 });
    for (let i = 0; i <= 4; i++) this.colliders.push({ x: -0.3 + i * (12.6 / 4), z: 8.12, hx: .25, hz: .25 });
    // 红廊与篮球场之间的铁栅栏（样式同梓荫山 D 线，二维平面）
    buildFenceRun(this.ctx, [[35, -15], [18, -15], [18, 33.5]], true);
    // 排球场西缘＋南缘铁栅栏（同上二维平面样式，贴场地边线转东至跑道）
    buildFenceRun(this.ctx, [[16.9, 85], [16.9, 109.7], [30, 109.7], [30, 125]], true);
    this.science = this.teach[8];
    this.complex = this.teach[7];
    this.labHall = this.teach[4];
    this.observatory = this.teach[5];
    this._buildObservatories(this.teach[5]);
    this.admin = this.teach[13];
    // 行政楼南门廊：台面与三级台阶（单步 0.35），门廊红柱与造型松碰撞
    this.walkSurfaces.push(
      { x0: 13.3, x1: 20.7, z0: 144, z1: 146.4, y: 1.05 },
      { x0: 12.8, x1: 21.2, z0: 146.4, z1: 146.8, y: 1.05 },
      { x0: 12.8, x1: 21.2, z0: 146.8, z1: 147.2, y: .70 },
      { x0: 12.8, x1: 21.2, z0: 147.2, z1: 147.6, y: .35 },
    );
    this.colliders.push(
      { x: 13.65, z: 146.1, hx: .18, hz: .18 }, { x: 15.1, z: 146.1, hx: .18, hz: .18 },
      { x: 18.9, z: 146.1, hx: .18, hz: .18 }, { x: 20.35, z: 146.1, hx: .18, hz: .18 },
      { x: 12.45, z: 145.2, hx: .4, hz: .4 }, { x: 21.55, z: 145.2, hx: .4, hz: .4 },
    );
    this.track = buildTrack(this.ctx);
    // 台面与南北两端楼梯可走
    this.walkSurfaces.push(
      { x0: 21, x1: 29, z0: 50.95, z1: 75.05, y: 1.4 },                    // 台面
      { x0: 21, x1: 23.45, z0: 47.65, z1: 51.1, y: 1.4 },                  // 北端平台
      { x0: 21, x1: 23.45, z0: 75.0, z1: 78.35, y: 1.4 },                  // 南端平台
      { x0: 23.3, x1: 26.9, z0: 47.7, z1: 50.9, yA: 1.4, yB: 0, axis: 'x' }, // 北端楼梯
      { x0: 23.3, x1: 26.9, z0: 75.1, z1: 78.3, yA: 1.4, yB: 0, axis: 'x' }, // 南端楼梯
    );
    // 司令台正面木栏（台面上不可翻越）
    this.fenceSegments.push([[28.9, 51.1], [28.9, 74.9], 2.55]);
    // 操场北侧 5 层灰白阳台宿舍（45.05）：真实位置在梓荫山东侧、紧贴 F 线雾墙中段，横向布置，外廊朝南
    this.neDorm = buildModernBlock(this.ctx, { x: 157, z: -36, w: 39, d: 18, floors: 5, key: 'dorm', corridor: true, railMat: this.mats.plasterCool });
    // 宿舍东端接不到东侧雾墙，沿南立面延长一段铁栅栏补齐；右上（东北）草坪此后不可进入
    buildFenceRun(this.ctx, [[176.5, -27], [197.5, -27.3]]);
    // 流芳碑：泮池北红点处（东段草坪），有字一面朝北
    this.liufang = addStele(this.group, this.mats, -16.3, 83.1, { w: 1.9, h: 4.2, d: .55, textMat: this.mats.plaques.liufang });
    this.liufang.rotation.y = Math.PI;
    // 科学楼北端→电教楼接壤处小门造型，铺白石板小路至书吧西侧
    this._buildScienceDoor();
    // 小人碰撞体（平面矩形，忽略小幅旋转）；电教楼为回字形，按四块翼楼分别登记
    for (const d of defs) {
      if (d.ring || d.custom === 'book') continue;
      if (d.cols) for (const [x, z, hx, hz] of d.cols) this.colliders.push({ x, z, hx, hz });
      else this.colliders.push({ x: d.x, z: d.z, hx: d.w / 2, hz: d.d / 2 });
    }
    this.colliders.push(
      { x: -61.5, z: -76, hx: 5.5, hz: 24 },       // 电教楼东块西段（全高实心）
      { x: -54, z: -76, hx: 2, hz: 24, y1: 4.04 }, // 东块廊体槽下（廊底以下实心）
      { x: -54, z: -76, hx: 2, hz: 24, y0: 8.0 },  // 东块廊体槽上（梁顶以上实心）
      { x: -93.75, z: -76, hx: 6.75, hz: 24 },     // 电教楼西块（5 层）
      { x: -77, z: -59, hx: 10, hz: 7 },           // 电教楼南块（5.5 层）
      { x: -77, z: -93, hx: 10, hz: 7 },           // 电教楼北块（5.5 层）
      { x: -49.3, z: -99, hx: 2.6, hz: 2.6 },      // 东北角方塔（东移至廊体东侧，贴 x=-52）
      // 大成殿：殿身按墙体分段登记，正面中央门洞保持通行
      { x: -28, z: 3.61, hx: 13.05, hz: .25 },      // 后墙
      { x: -41.05, z: 10, hx: .25, hz: 6.39 },      // 西墙
      { x: -14.95, z: 10, hx: .25, hz: 6.39 },      // 东墙
      { x: -35.645, z: 16.39, hx: 5.405, hz: .28 }, // 前墙西段
      { x: -20.355, z: 16.39, hx: 5.405, hz: .28 }, // 前墙东段（中央门洞 -30.24~-25.76 不设碰撞）
      // 殿内中排柱（中央两根随祭坛居中而取消，仅保留两侧）
      { x: -35.83, z: 10, hx: .42, hz: .42 }, { x: -20.17, z: 10, hx: .42, hz: .42 },
      // 祭坛（居中）：神龛屏风、四配神位、孔子像、香案、落地烛台、两侧长凳
      { x: -28, z: 8.09, hx: 4.75, hz: .2 },          // 神龛屏风
      { x: -32.18, z: 8.74, hx: .45, hz: .25 }, { x: -30.78, z: 8.74, hx: .45, hz: .25 },
      { x: -25.22, z: 8.74, hx: .45, hz: .25 }, { x: -23.82, z: 8.74, hx: .45, hz: .25 },
      { x: -28, z: 9.344, hx: 1.9, hz: 1.15 },       // 孔子坐像与底座
      { x: -28, z: 10.43, hx: 2.3, hz: .6 },         // 香案
      { x: -30.96, z: 13.37, hx: .25, hz: .25 }, { x: -25.04, z: 13.37, hx: .25, hz: .25 },
      { x: -40.5, z: 10, hx: .3, hz: 5.3 }, { x: -15.5, z: 10, hx: .3, hz: 5.3 },
      { x: -36.3, z: 61, hx: 3.0, hz: 4.2 },  // 大成门西次间
      { x: -19.7, z: 61, hx: 3.0, hz: 4.2 },  // 大成门东次间（中间门洞保持通行）
      { x: -28, z: 142, hx: 12, hz: 5 },  // 校门
      // 体艺馆主馆（只掏空一层）、东西翼均由内景墙壳分段碰撞，不再整块封死；
      // 主馆基座仍以 y1=.9 的碰撞封住室外地面，馆内 .9 走面以上不受影响
      { x: 157, z: -36, hx: 19.5, hz: 9 }, // 操场北侧宿舍（梓荫山东侧，横向，紧贴 F 线雾墙）
      { x: -148, z: 118.5, hx: 2.7, hz: 2.7 }, // 蛟川书院西南角小亭（西副楼南侧）
      { x: -63, z: 94, hx: 2.7, hz: 2.7 },     // 教学楼 SW 南侧竹林以南六角亭
      // 朱枫故居主体与院墙已在上方分段登记；此处不再用整块包围盒堵住院门
      { x: -42.9, z: 137.5, hx: 3.6, hz: 2.6 }, // 保安亭
      { x: -13.1, z: 137.5, hx: 3.6, hz: 2.6 }, // 报刊亭
      { x: -16.3, z: 83.1, hx: 1.2, hz: .7 }, // 流芳碑（泮池北红点处）
    );
    // 泮池水面：按可见扇形水面逐条（0.5m）登记，贴合弧形水岸；桥下单独放行。
    // 旧的整块矩形（hz=4.25 铺满南北）会在两端越过水面、封掉池外弧形石铺装。
    {
      const W2 = 15, DEP = 8.5;
      const R = (W2 * W2 + DEP * DEP) / (2 * DEP);
      const CY = R - DEP / 2;
      const zChord = 90 - DEP / 2; // 85.75 北侧直弦
      // 三条石板步道全部改为同型单拱石桥，水面连成一片；桥下水面碰撞按 y1 处理
      const spans = [[-15, 15]];
      const bridgeXs = [-7.55, 0, 7.55];
      for (const [a, b] of spans) {
        const n = Math.max(1, Math.ceil((b - a) / .5));
        for (let i = 0; i < n; i++) {
          const lx0 = a + (b - a) * i / n, lx1 = a + (b - a) * (i + 1) / n;
          const lx = (lx0 + lx1) / 2;
          if (bridgeXs.some((cx) => Math.abs(lx - cx) < 1.15)) continue; // 桥面正下方不重复登记
          const z1 = 90 - CY + Math.sqrt(Math.max(0, R * R - lx * lx)) + .04; // 弧线南缘
          this.colliders.push({
            x: -28 + lx, z: (zChord + z1) / 2,
            hx: (lx1 - lx0) / 2 + .01, hz: (z1 - zChord) / 2,
          });
        }
      }
      // 三座桥下水面：地面高度阻挡，桥面/踏步高度（≥.16）放行
      for (const cx of bridgeXs) {
        this.colliders.push({ x: -28 + cx, z: 90, hx: 1.15, hz: 4.75, y1: .14 });
      }
    }
    // 三座同型单拱石桥走面：桥头踏步 .16 → 桥面 .32~1.37
    for (const cx of [-7.55, 0, 7.55]) {
      const x0 = -28 + cx - 1.15, x1 = -28 + cx + 1.15, n = 12, za = 85.2, zb = 94.8;
      this.walkSurfaces.push({ x0, x1, z0: 84.7, z1: 85.2, y: .16 });
      for (let i = 0; i < n; i++) {
        const z0 = za + (zb - za) * i / n, z1 = za + (zb - za) * (i + 1) / n;
        this.walkSurfaces.push({
          x0, x1, z0, z1, axis: 'z',
          yA: .32 + 1.05 * Math.sin(Math.PI * i / n),
          yB: .32 + 1.05 * Math.sin(Math.PI * (i + 1) / n),
        });
      }
      this.walkSurfaces.push({ x0, x1, z0: 94.8, z1: 95.3, y: .16 });
    }
    this.colliders.push(
      { x: -28, z: 97.8, hx: 1.2, hz: 1.2 },    // 旗杆大理石基座（与可见基座对齐）
      { x: -28, z: 99.25, hx: 2.65, hz: .3 },   // 校训石碑（原白石条凳位置）
      // 梓荫山建筑群
      { x: 111, z: -44.83, hx: 4, hz: 3.2 },   // 梓荫阁（含台基，缩至 2/3 后）
      { x: 70, z: -46.5, hx: 2.4, hz: 2.4 }, // 吴公纪功碑亭
      { x: 127, z: -35.5, hx: 2.2, hz: 5.5 }, // 惩忿窒欲石刻、石台与四尊石武将
      { x: 121, z: -23.5, hx: 2.2, hz: 2.2 }, // 四角亭（高台东南脚草地，D 路北侧）
      // 司令台：台面可走，仅后墙和正面木栏为实体（世界坐标 = 局部坐标 + group 偏移 80,69）
      { x: 21.5, z: 63, hx: .55, hz: 12 },
      // 篮球架立柱（世界坐标 = buildTrack 局部坐标 + 偏移 80,69）
      { x: 43.5, z: 69, hx: 1.2, hz: 1.2 }, // 田径场国旗旗杆基座（西直道内侧草地）
      { x: 30, z: -12, hx: .3, hz: .3 },
      { x: 30, z: 10, hx: .3, hz: .3 },
      { x: 29, z: 15, hx: .3, hz: .3 },
      { x: 29, z: 37, hx: .3, hz: .3 },
    );
  }

  /** 电教楼：白色细高方塔（深色出挑平板顶、竖窗槽、无钟面）+ 半球观测穹顶 */
  _buildObservatories(block) {
    const m = this.mats;
    const hEW = 5 * 3.45 + 1.2;         // 东西块屋面 18.45
    const top = 6.5 * 3.45 + 1.2;       // 塔楼/穹顶顶 23.625
    // 细高方塔：贯通地面，位于东北角（用户确认）
    const sq = new THREE.Group();
    const tw = 5.2, th = top - .55;     // 塔身顶 23.075，顶板厚 .55
    const body = new THREE.Mesh(new THREE.BoxGeometry(tw, th, tw), m.plasterCool);
    body.position.y = th / 2; body.castShadow = true; body.receiveShadow = true; sq.add(body);
    // 上部竖窗槽：每面两个凸框竖槽，槽内一道横档（视频中无钟面）
    const slotCy = 21.55;
    const slotParts = [];
    for (const s of [-1, 1]) {
      const ox = s * 1.15;
      slotParts.push(tbox(.09, 2.6, .1, ox - .52, slotCy, tw / 2 + .04, 0));
      slotParts.push(tbox(.09, 2.6, .1, ox + .52, slotCy, tw / 2 + .04, 0));
      slotParts.push(tbox(1.13, .09, .1, ox, slotCy + 1.3, tw / 2 + .04, 0));
      slotParts.push(tbox(1.13, .09, .1, ox, slotCy - 1.3, tw / 2 + .04, 0));
      slotParts.push(tbox(1.13, .09, .1, ox, slotCy, tw / 2 + .04, 0));
    }
    const slotGeo = mergeGeometriesSafe(slotParts);
    for (let f = 0; f < 4; f++) {
      const slots = new THREE.Mesh(slotGeo, m.stone);
      slots.rotation.y = f * Math.PI / 2; sq.add(slots);
    }
    // 窗槽下方深色横带（略高于东西块屋面）
    const trim = new THREE.Mesh(new THREE.BoxGeometry(tw + .18, .5, tw + .18), m.ridge);
    trim.position.y = hEW + .4; sq.add(trim);
    // 深色出挑平板顶（视频中顶板平直、四周出挑）
    const cap = new THREE.Mesh(new THREE.BoxGeometry(tw + 2.6, .55, tw + 2.6), m.ridge);
    cap.position.y = th + .275; cap.castShadow = true; sq.add(cap);
    sq.position.set(27.7, 0, -23);   // 东移至廊体东侧（世界 x=-49.3），紧贴电教楼加厚后的东立面
    block.add(sq);
    // 圆形天文台：坐落在西南角 5 层块屋面（18.55），顶与塔楼同为 6.5 层
    const rd = new THREE.Group();
    const drumH = 1.3, domeR = 3.22;
    // 方形基座
    const podium = new THREE.Mesh(new THREE.BoxGeometry(8.4, .45, 8.4), m.plasterCool);
    podium.position.y = .225; podium.castShadow = true; rd.add(podium);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(3.25, 3.4, drumH, 28), m.plasterCool);
    drum.position.y = .45 + drumH / 2; drum.castShadow = true; rd.add(drum);
    // 鼓座下部连续横向长窗（实景为带竖梃的整圈窗带）
    const band = new THREE.Mesh(new THREE.CylinderGeometry(3.42, 3.42, .55, 28, 1, true), m.glass);
    band.position.y = .45 + .5; rd.add(band);
    for (let i = 0; i < 28; i++) {
      const a = i / 28 * Math.PI * 2;
      const mull = new THREE.Mesh(new THREE.BoxGeometry(.07, .57, .12), m.plasterCool);
      mull.position.set(Math.sin(a) * 3.43, .45 + .5, Math.cos(a) * 3.43);
      mull.rotation.y = a; rd.add(mull);
    }
    // 窗带上方白石窗台
    const sill = new THREE.Mesh(new THREE.CylinderGeometry(3.44, 3.44, .16, 28), m.plasterCool);
    sill.position.y = 1.3; rd.add(sill);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(3.28, 3.28, .12, 28), m.plasterCool);
    rim.position.y = .45 + drumH; rd.add(rim);
    const domeBase = .45 + drumH + .03;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(domeR, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xd3d7d2, roughness: .3, metalness: .28 }));
    dome.position.y = domeBase; dome.castShadow = true; rd.add(dome);
    // 观测缝：位于西侧，沿球面向上，底部带启闭罩盒
    const slitGrp = new THREE.Group();
    const slitMat = new THREE.MeshStandardMaterial({ color: 0x27323a, roughness: .4 });
    for (let i = 0; i < 9; i++) {
      const a = .1 + i * .11;
      const yy = domeR * Math.sin(a);
      const slit = new THREE.Mesh(new THREE.BoxGeometry(.3, .34, .12), slitMat);
      slit.position.set(0, yy, (domeR + .03) * Math.cos(a));
      slit.rotation.x = -a;
      slitGrp.add(slit);
    }
    const shutter = new THREE.Mesh(new THREE.BoxGeometry(.8, .7, .9), slitMat);
    shutter.position.set(0, .75, domeR); slitGrp.add(shutter);
    slitGrp.position.y = domeBase;
    slitGrp.rotation.y = -Math.PI / 2; // 缝口朝西
    rd.add(slitGrp);
    rd.position.set(-16, hEW + .1, 16);
    block.add(rd);
    return { square: sq, dome: rd };
  }

  /** 把建筑局部坐标的内景碰撞体/可走面按 group 旋转（π/2 整数倍）与平移注册到世界 */
  _registerInterior(b) {
    const data = b.userData && b.userData.interior;
    if (!data) return;
    const q = ((Math.round(b.rotation.y / (Math.PI / 2)) % 4) + 4) % 4;
    const quarterTurnOnly = Math.abs(b.rotation.y - Math.round(b.rotation.y / (Math.PI / 2) * (Math.PI / 2))) < 1e-6;
    const px = b.position.x, py = b.position.y, pz = b.position.z;
    const rot = (x, z) => quarterTurnOnly
      ? q === 0 ? [x, z] : q === 1 ? [z, -x] : q === 2 ? [-x, -z] : [-z, x]
      : [x * Math.cos(b.rotation.y) + z * Math.sin(b.rotation.y), -x * Math.sin(b.rotation.y) + z * Math.cos(b.rotation.y)];
    for (const c of data.colliders || []) {
      const [cx, cz] = rot(c.x, c.z);
      const ex = Math.abs(Math.cos(b.rotation.y)) * c.hx + Math.abs(Math.sin(b.rotation.y)) * c.hz;
      const ez = Math.abs(Math.sin(b.rotation.y)) * c.hx + Math.abs(Math.cos(b.rotation.y)) * c.hz;
      this.colliders.push({
        x: cx + px, z: cz + pz,
        hx: quarterTurnOnly ? ((q % 2) ? c.hz : c.hx) : ex,
        hz: quarterTurnOnly ? ((q % 2) ? c.hx : c.hz) : ez,
        y0: c.y0 === undefined ? undefined : c.y0 + py,
        y1: c.y1 === undefined ? undefined : c.y1 + py,
        pad: c.pad,
      });
    }
    for (const w of data.walk || []) {
      const [ax, az] = rot(w.x0, w.z0);
      const [bx, bz] = rot(w.x0, w.z1);
      const [cx, cz] = rot(w.x1, w.z0);
      const [dx, dz] = rot(w.x1, w.z1);
      const out = {
        x0: Math.min(ax, bx, cx, dx) + px, x1: Math.max(ax, bx, cx, dx) + px,
        z0: Math.min(az, bz, cz, dz) + pz, z1: Math.max(az, bz, cz, dz) + pz,
      };
      if (w.yA !== undefined) {
        if (q !== 0) continue; // 坡道仅注册无旋转建筑
        out.yA = w.yA + py; out.yB = w.yB + py; out.axis = w.axis;
      } else {
        out.y = w.y + py;
      }
      this.walkSurfaces.push(out);
    }
  }

  /** refY：可选脚底参考高度；只采纳不高于 refY+.36 的走面，用于多层楼内景 */
  groundY(x, z, refY) {
    let y = (this.hillHeight ? this.hillHeight(x, z) : 0) - this._qinyuDrop(x, z);
    // 可站立平台/坡道（台基、台阶）：取最高的一块
    for (const s of this.walkSurfaces) {
      if (s.ry !== undefined) {
        // 旋转矩形（斜向石桥、斜置台面）：先把点转回矩形局部坐标再判定
        const dx = x - s.cx, dz = z - s.cz;
        const co = Math.cos(s.ry), si = Math.sin(s.ry);
        const lx = dx * co - dz * si, lz = dx * si + dz * co;
        if (Math.abs(lx) > s.hx || Math.abs(lz) > s.hz) continue;
      } else if (x < s.x0 || x >= s.x1 || z < s.z0 || z >= s.z1) continue; // 含最小边，避免恰在分界线处踩空
      let sy;
      if (s.yA !== undefined) {
        const t = s.axis === 'x' ? (x - s.x0) / (s.x1 - s.x0) : (z - s.z0) / (s.z1 - s.z0);
        sy = s.yA + (s.yB - s.yA) * t;
      } else {
        sy = s.y;
      }
      if (refY !== undefined && sy > refY + .36) continue;
      if (sy > y) y = sy;
    }
    return y;
  }

  inBounds(x, z) {
    const poly = this.boundary;
    if (!poly) return true;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
      if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
  }

  /** 距红线边界是否小于 m（相位相机避让雾墙用） */
  nearBoundary(x, z, m = 2.5) {
    const poly = this.boundary;
    if (!poly) return false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
      const dx = xj - xi, dz = zj - zi;
      const l2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - xi) * dx + (z - zi) * dz) / l2));
      const px = xi + dx * t - x, pz = zi + dz * t - z;
      if (px * px + pz * pz < m * m) return true;
    }
    return false;
  }

  /** 小人不可通行的位置：出红线、撞到建筑或任何雾墙。y 为脚底高度，高于栅栏即可跨越 */
  isBlocked(x, z, y = 0) {
    if (!this.inBounds(x, z)) return true;
    for (const c of this.colliders) {
      // 内景墙体按楼层高度登记：y0 以上、y1 以下才阻挡
      if (c.y0 !== undefined && y < c.y0 - .02) continue;
      if (c.y1 !== undefined && y >= c.y1) continue;
      const pad = c.pad === undefined ? 0 : c.pad;
      if (Math.abs(x - c.x) < c.hx + pad && Math.abs(z - c.z) < c.hz + pad) return true;
    }
    for (const [a, b] of this.fogSegments) {
      const vx = b[0] - a[0], vz = b[1] - a[1];
      const wx = x - a[0], wz = z - a[1];
      const t = Math.max(0, Math.min(1, (wx * vx + wz * vz) / (vx * vx + vz * vz || 1)));
      const dx = wx - vx * t, dz = wz - vz * t;
      if (dx * dx + dz * dz < .36) return true; // 半径 .6m，雾墙不可穿越但路边仍可走
    }
    // 栅栏不可穿越，但脚底高于栅栏高度（跳跃）时允许越过；[a, b, h] 中的 h 为碰撞高度
    for (const seg of this.fenceSegments) {
      const a = seg[0], b = seg[1], h = seg[2] === undefined ? 3 : seg[2];
      if (y >= h) continue;
      const vx = b[0] - a[0], vz = b[1] - a[1];
      const wx = x - a[0], wz = z - a[1];
      const t = Math.max(0, Math.min(1, (wx * vx + wz * vz) / (vx * vx + vz * vz || 1)));
      const dx = wx - vx * t, dz = wz - vz * t;
      if (dx * dx + dz * dz < .2) return true;
    }
    return false;
  }

  /** 该点是否只被栅栏挡住（边界/建筑/雾墙都不挡），用于相机越过矮栅栏 */
  onlyFencesBlocked(x, z) {
    if (!this.inBounds(x, z)) return false;
    for (const c of this.colliders) {
      const pad = c.pad === undefined ? 0 : c.pad;
      if (Math.abs(x - c.x) < c.hx + pad && Math.abs(z - c.z) < c.hz + pad) return false;
    }
    for (const [a, b] of this.fogSegments) {
      const vx = b[0] - a[0], vz = b[1] - a[1];
      const wx = x - a[0], wz = z - a[1];
      const t = Math.max(0, Math.min(1, (wx * vx + wz * vz) / (vx * vx + vz * vz || 1)));
      const dx = wx - vx * t, dz = wz - vz * t;
      if (dx * dx + dz * dz < .36) return false;
    }
    for (const [a, b] of this.fenceSegments) {
      const vx = b[0] - a[0], vz = b[1] - a[1];
      const wx = x - a[0], wz = z - a[1];
      const t = Math.max(0, Math.min(1, (wx * vx + wz * vz) / (vx * vx + vz * vz || 1)));
      const dx = wx - vx * t, dz = wz - vz * t;
      if (dx * dx + dz * dz < .2) return true;
    }
    return false;
  }

  _buildWalls() {
    // 场地轮廓：北宽南窄的不规则多边形（世界坐标），西南并入蛟川书院，使其与主体相连
    const poly = [
      [-42, 146], [-23, 148], [95, 169], [137, 102], [167, 42], [187, -18],
      [218, -117], [67, -153], [-72, -179], [-115, -185], [-109, -99],
      [-85, -13], [-83, 81], [-159.6, 81], [-159.6, 156], [-76, 158]
    ];
    this.boundary = poly;
    // 实体围墙已取消，由外侧雾墙充当边界
  }

  /** 围墙外的浓雾：雾墙即边界，西南随蛟川书院地块外沿绕行 */
  _buildOuterFog() {
    const poly = this.boundary;
    if (!poly) return;
    const fogPoly = poly.slice();
    let cx = 0, cz = 0;
    for (const p of fogPoly) { cx += p[0]; cz += p[1]; }
    cx /= fogPoly.length; cz /= fogPoly.length;
    // 沿各顶点向外偏移，围成一圈
    const OUT = 2, H = 30;
    const pts = fogPoly.map(([x, z]) => {
      const dx = x - cx, dz = z - cz, l = Math.hypot(dx, dz) || 1;
      return [x + dx / l * OUT, z + dz / l * OUT];
    });
    const pos = [], uvs = [];
    let acc = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < .01) continue;
      const u0 = acc / 46, u1 = (acc + len) / 46;
      acc += len;
      pos.push(a[0], -1.5, a[1], b[0], -1.5, b[1], b[0], H, b[1]);
      pos.push(a[0], -1.5, a[1], b[0], H, b[1], a[0], H, a[1]);
      uvs.push(u0, 0, u1, 0, u1, 1);
      uvs.push(u0, 0, u1, 1, u0, 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    const tex = makeFogTexture();
    this.fogWallMat = new THREE.MeshBasicMaterial({
      map: tex, color: 0xd9dcda, transparent: true, opacity: 1,
      depthWrite: false, side: THREE.DoubleSide, fog: false
    });
    const wall = new THREE.Mesh(geo, this.fogWallMat);
    wall.renderOrder = 4;
    wall.frustumCulled = false;
    this.group.add(wall);

    this.fogPuffMat = new THREE.SpriteMaterial({
      map: makePuffTexture(), color: 0xd9dcda, transparent: true, depthWrite: false,
      opacity: .34, fog: false
    });
    const rnd = mulberry32(99);
    for (let i = 0; i < 44; i++) {
      const p = pts[Math.floor(rnd() * pts.length)];
      const dx = p[0] - cx, dz = p[1] - cz, l = Math.hypot(dx, dz) || 1;
      // 雾团全部留在红线外，避免大尺寸 Sprite 反向罩进校园造成满屏白
      const off = 30 + rnd() * 58;
      const s = new THREE.Sprite(this.fogPuffMat);
      s.position.set(p[0] + dx / l * off, 1 + rnd() * 20, p[1] + dz / l * off);
      s.scale.set(40 + rnd() * 52, 22 + rnd() * 30, 1);
      s.renderOrder = 5;
      this.group.add(s);
    }

    // 后山雾墙：沿 F 环山外线外扩约 1.2m 包围后山；东端用一条 x=const 向北接校园北面雾墙
    const fogRibbon = (pts) => {
      const p2 = [], u2 = [];
      let acc = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len < .01) continue;
        this.fogSegments.push([a, b]);
        const u0 = acc / 46, u1 = (acc + len) / 46;
        acc += len;
        p2.push(a[0], -1.5, a[1], b[0], -1.5, b[1], b[0], H, b[1]);
        p2.push(a[0], -1.5, a[1], b[0], H, b[1], a[0], H, a[1]);
        u2.push(u0, 0, u1, 0, u1, 1);
        u2.push(u0, 0, u1, 1, u0, 1);
      }
      const geo2 = new THREE.BufferGeometry();
      geo2.setAttribute('position', new THREE.Float32BufferAttribute(p2, 3));
      geo2.setAttribute('uv', new THREE.Float32BufferAttribute(u2, 2));
      const m = new THREE.Mesh(geo2, this.fogWallMat);
      m.renderOrder = 4;
      m.frustumCulled = false;
      this.group.add(m);
    };
    // F 线（世界坐标）沿背离山心的方向外扩 1.2m
    const F_PTS = [[98, -60], [108, -58], [123, -58], [136, -57], [137, -44], [135, -32], [132, -20]];
    const hillFog = F_PTS.map(([x, z]) => {
      const dx = x - 90, dz = z + 37, l = Math.hypot(dx, dz) || 1;
      return [x + dx / l * 1.2, z + dz / l * 1.2];
    });
    // F 线北段仍用雾墙（红线 2），止于宿舍西北角外侧
    fogRibbon([...hillFog.slice(0, 4), [137.3, -45.2]]);
    // 东北角封口：从后山雾墙西端起，紧贴学生宿舍东侧向北接校园北面雾墙（红线 1）
    fogRibbon([[hillFog[0][0], hillFog[0][1]], [109.2, -76], [109.2, -150]]);
    // 闭环：宿舍西侧那段雾墙换成铁栅栏（图中黑线），贴西墙向南接 D 线栅栏东端
    buildFenceRun(this.ctx, [[137.3, -45.2], [136.6, -32], [133.2, -19.6], [124, -18.6]], true);
  }

  _buildHillLandmarks() {
    const h = this.hillObj;
    // 路网 A/B/C/D/F、跑道北缘铁栅栏、路旁花盆与灯柱
    buildHillRoads(this.ctx);
    buildHillFence(this.ctx);
    buildHillStreetDetails(this.ctx);
    // 山顶高台 +8m（块石挡墙、白色石栏杆、垛口挡墙）
    buildHillPlatform(this.ctx);
    // 红木楼梯（下跑接纪念堂前庭 + 共用转角平台 + 两跑分叉 + 悬挑木平台 + 岩壁）
    buildHillStairB(this.ctx);
    // 林则徐纪念堂：山北脚台基，正门朝西面向梓荫河，北端由富的廊接入
    const lin = buildLinZexu(this.ctx);
    lin.position.set(100, h.heightAt(100, -56), -56);
    lin.rotation.y = -Math.PI / 2;
    this.group.add(lin);
    this._registerInterior(lin);
    // 梓荫阁：高台后部，正门朝南面向操场，背靠山体；缩至 2/3，北面仍贴北墙
    const pav = buildZiyinPavilion(this.ctx);
    pav.position.set(111, 8.0, -44.83);
    pav.scale.set(2 / 3, 2 / 3, 2 / 3);
    this.group.add(pav);
    // 吴公纪功碑亭：西坡，正面朝北临 A 线
    const wu = buildWuGongPavilion(this.ctx);
    wu.position.set(70, h.heightAt(70, -46.5), -46.5);
    wu.rotation.y = Math.PI;
    this.group.add(wu);
    // 两门古炮（碑亭前方路旁）与后山石刻（含石台、四尊石武将）
    buildCannons(this.ctx);
    buildInscriptionRock(this.ctx);
    // 四角亭：高台东南脚草地、D 路北侧，避开 C 下山台阶（C 末段中心线经 (126,−25)→(132,−20)）
    const p4 = buildCornerSquarePavilion(this.ctx);
    p4.position.set(121, h.heightAt(121, -23.5), -23.5);
    this.group.add(p4);
    // 都督俞公亭：F 路东北角，正面朝东临 F 线
    const yu = buildYuGongPavilion(this.ctx);
    yu.position.set(131.8, h.heightAt(131.8, -54), -54);
    yu.rotation.y = Math.PI / 2;
    this.group.add(yu);
    this.colliders.push({ x: 131.8, z: -54, hx: 2.6, hz: 2.6 });
  }

  _buildPlazaDetails() {
    const m = this.mats;
    // bollard path lights
    this.bollards = [];
    for (const z of [136, 124, 112, 82, 70]) {
      for (const s of [-1, 1]) {
        const g = new THREE.Group();
        const post = new THREE.Mesh(new THREE.CylinderGeometry(.12, .16, 1.4, 6), m.stoneDark);
        post.position.y = .7; g.add(post);
        const lamp = new THREE.Mesh(new THREE.CylinderGeometry(.2, .24, .28, 8), m.windowGlow.clone());
        lamp.position.y = 1.5; lamp.userData.baseEmissive = 2.2; g.add(lamp);
        const glow = makeGlowSprite(m.glowTex, 0xffc07a, 2.2, 0); glow.position.y = 1.55; glow.userData.nightOpacity = .4; g.add(glow);
        g.position.set(-28 + s * 5.2, 0, z);
        this.group.add(g);
        this.nightEmitters.push(lamp, glow);
        this.bollards.push(g);
      }
    }
    // 泮池岸边红灯笼：路上独立灯笼，按用户要求去掉
  }

  _buildNight() {
    const m = this.mats;
    const facadeMats = Object.values(m.facades);
    for (const f of facadeMats) f.userData.baseEmissive = 1.35;
    this.nightEmitters.push(m.latticeEmissive, m.windowGlow, m.town, ...facadeMats);
    // base emissive data
    m.windowGlow.userData.baseEmissive = 3.2;
    m.latticeEmissive.userData.baseEmissive = 1.4;
  }

  /** 科学楼北端→电教楼接壤处小门，白石板小路至书吧西侧（44.30/45.25） */
  _buildScienceDoor() {
    const m = this.mats;
    const g = new THREE.Group();
    const bx = (mat, w, h, d, x, y, z) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh);
    };
    const w = 6, h = 3.4;
    bx(m.plasterCool, w, h, .5, 0, h / 2, 0);
    bx(m.darkMetal, w - .4, h - .6, .52, 0, h / 2 - .1, .02);
    bx(m.plasterCool, .4, h, .7, -w / 2, h / 2, 0);
    bx(m.plasterCool, .4, h, .7, w / 2, h / 2, 0);
    bx(m.plasterCool, w + .2, .4, .6, 0, h + .18, 0);
    g.position.set(-96, 0, -99);
    this.group.add(g);
    // 白石板小路：自门洞向东通往书吧西侧（x≈-90 → -78）
    const path = (x, z, wd, dp) => {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(wd, dp), m.slab);
      p.rotation.x = -Math.PI / 2; p.position.set(x, .05, z); p.receiveShadow = true; this.group.add(p);
    };
    path(-78, -66, 3, 26);
    path(-66, -54, 26, 3);
  }

  _buildSmoke() {
    const tex = makeGlowSpriteTexture('232,226,210');
    const group = new THREE.Group();
    const puffs = [];
    for (let i = 0; i < 9; i++) {
      const mat = new THREE.SpriteMaterial({ map: tex, color: 0xc9c4b6, transparent: true, opacity: 0, depthWrite: false });
      const s = new THREE.Sprite(mat);
      s.userData.phase = i / 9;
      s.scale.setScalar(1.6 + i * .12);
      group.add(s); puffs.push(s);
    }
    group.position.set(-28, 2.6, -2);
    this.group.add(group);
    return { group, puffs };
  }

  _landmarks() {
    return [
      { id: 'gate', priority: 1, name: '校门', en: 'School Gate', pos: [-28, 10.5, 145], target: [-28, 4, 136], camera: [-28, 5.2, 176], desc: '主入口为一座小门楼，门额由郭沫若题写。入门沿中轴依次为泮池、大成门与大成殿。' },
      { id: 'pan', priority: 1, name: '泮池', en: 'Pan Pond', pos: [-28, 3, 96], target: [-28, 1, 96], camera: [0, 15, 128], desc: '孔庙前的泮池，由四段小水面沿圆弧排成扇形，中轴石板路从缺口穿过。' },
      { id: 'dachengmen', priority: 2, name: '大成门', en: 'Dacheng Gate', pos: [-28, 7, 61], target: [-28, 3, 61], camera: [14, 18, 96], desc: '泮池与大成殿之间的大成门，三开间、灰瓦红柱，与南排教学楼齐平，构成孔庙的礼序空间。' },
      { id: 'dacheng', priority: 1, name: '大成殿', en: 'Dacheng Hall', pos: [-28, 12, 10], target: [-28, 6, 10], camera: [10, 26, 72], desc: '孔庙的核心建筑，始建宋绍兴八年（1138）。现存小殿正压中轴，北接实验楼。' },
      { id: 'shiyan', priority: 2, name: '实验楼', en: 'Laboratory', pos: [-28, 16, -22], target: [-28, 9, -22], camera: [20, 30, 18], desc: '大成殿之北的东西向实验楼，四层主体加中部半幅第五层灰瓦大坡顶，东西两端为南向二层翼楼，梓荫河从楼北侧流过。' },
      { id: 'qinyuan', name: '沁园', en: 'Qinyuan Garden', pos: [-66, 2, -32], target: [-62, -1, -37], camera: [-30, 12, -20], desc: '电教楼以南、自习室以北的小园，西南圆池中有绿琉璃六角亭，斜石拱桥跨窄颈通往东北水臂。' },
      { id: 'shuba', name: '书吧', en: 'Book Bar', pos: [-84.5, 6, -44], target: [-84.5, 3, -44], camera: [-50, 12, -10], desc: '电教楼西南角向南凸出的两层小楼，临沁园而设。' },
      { id: 'zifei', name: '自习室', en: 'Study Room', pos: [-71, 5, -17], target: [-71, 2, -17], camera: [-40, 10, 4], desc: '沁园正南的小型自习建筑。' },
      { id: 'dianjiao', priority: 2, name: '电教楼', en: 'Audio-Visual Building', pos: [-77, 16, -76], target: [-77, 9, -76], camera: [-30, 26, -40], desc: '带内院的白色回字形楼宇，东北角为细高方塔、西南角为观测穹顶；东南角经空中走廊跨越梓荫河与实验楼相接。' },
      { id: 'kexue', priority: 2, name: '科学楼', en: 'Science Building', pos: [-96, 18, -132], target: [-96, 10, -132], camera: [-46, 28, -100], desc: '综合楼西段正南的科学楼，与综合楼相接成五层连续体量，与北区宿舍、体艺馆共同构成校园北部组团。' },
      { id: 'zonghe', name: '综合楼', en: 'Comprehensive Building', pos: [-78, 18, -158], target: [-78, 10, -158], camera: [-30, 30, -140], desc: '校园最北侧的综合楼，东西向长条，深色坡屋顶。' },
      { id: 'gym', name: '体艺馆', en: 'Gymnasium', pos: [11, 12, -87.5], target: [11, 7, -87.5], camera: [80, 30, -40], desc: '体艺馆为倒凸字形平面：中间凸出块朝南，东西两翼对称后退，位于梓荫河北岸。' },
      { id: 'academy', priority: 1, name: '蛟川书院', en: 'Jiaochuan Academy', pos: [-118, 18, 107], target: [-118, 9, 107], camera: [-50, 34, 175], desc: '校园西南侧的独立院落。清乾隆年间创办，为本地近代教育之源；主楼五层，东西副楼与办公室沿南廊布置。' },
      { id: 'zhufeng', name: '朱枫烈士纪念楼', en: 'Zhu Feng Memorial', pos: [22, 10, 122], target: [22, 5, 122], camera: [56, 18, 150], desc: '田径场西南角的小楼，与行政楼相邻，纪念革命烈士朱枫。' },
      { id: 'admin', name: '行政楼', en: 'Administration', pos: [17, 8, 139], target: [17, 4, 139], camera: [40, 12, 160], desc: '校门东侧的行政办公小楼。' },
      { id: 'fude', name: '富的廊', en: 'Fude Corridor', pos: [87, 5, -60], target: [87, 2, -60], camera: [118, 14, -30], desc: '紧贴梓荫河东北岸的单面空廊，暗红柱配石柱础，两侧通长格栅美人靠，是进入梓荫山体的起点。' },
      { id: 'lin', priority: 1, name: '林则徐纪念堂', en: 'Lin Zexu Hall', pos: [100, 10, -56], target: [100, 4, -56], camera: [86, 11, -70], desc: '沿红木楼梯爬升即至林则徐纪念堂。两层木构，正门朝西临梓荫河，二层挑出白色镂空栏杆外廊。' },
      { id: 'ziyinge', priority: 1, name: '梓荫阁', en: 'Ziyin Pavilion', pos: [111, 16, -43], target: [111, 10, -43], camera: [146, 26, -20], desc: '山顶高台后部的两层楼阁，白粉墙、深灰瓦重檐，二层连续木窗，一层红褐格栅门，正门朝南面向操场。' },
      { id: 'wugong', priority: 2, name: '吴公纪功碑亭', en: 'Wu Gong Stele Pavilion', pos: [70, 7, -46.5], target: [70, 3.5, -46.5], camera: [92, 12, -30], desc: '西坡低处临石板路的四柱方亭，单檐四角攒尖、灰绿瓦翘角，四柱悬竖联，亭内立吴公纪功碑。' },
      { id: 'yugong', name: '都督俞公亭', en: 'Yu Gong Pavilion', pos: [131.8, 8, -54], target: [131.8, 4, -54], camera: [118, 12, -38], desc: 'F 路东北角的石亭，石楣刻“都督俞公亭”，亭内立俞大猷生祠碑。' },
      { id: 'tianxin', name: '甜心屋咖啡', en: 'Sweet Heart Cafe', pos: [-20, 5, -127], target: [-20, 2, -127], camera: [-20, 8, -111], desc: '体艺馆北侧、2#宿舍楼南面的深灰单层咖啡小屋。' },
      { id: 'cannon', name: '古炮', en: 'Ancient Cannons', pos: [64, 5.4, -45.3], target: [64, 3.4, -45.3], camera: [84, 9, -32], desc: '碑亭前石板路旁的两门铁炮，架于石砌炮座，炮口朝向碑亭，大小各一。' },
      { id: 'rock', name: '惩忿窒欲石刻', en: 'Rock Inscription', pos: [127, 7.6, -33], target: [127, 4.6, -33], camera: [141, 7.5, -33], desc: '后山东坡脚的青灰岩面刻红漆大字“懲忿窒慾”，岩面朝东正对环山外线，岩顶垂常春藤，右侧石台并立四尊石武将。' },
      { id: 'ziyin', priority: 1, name: '梓荫山', en: 'Ziyin Hill', pos: [90, 14, -37], target: [90, 6, -37], camera: [150, 40, 4], desc: '校园内的历史山丘，五圈等高线缓坡、古木荫翳。山间有林则徐纪念堂、梓荫阁、吴公纪功碑亭、古炮与石刻。' },
      { id: 'track', priority: 1, name: '田径场', en: 'Athletic Field', pos: [80, 4, 69], target: [80, 0, 69], camera: [150, 90, 140], desc: '南北向的标准 400 米跑道与绿色足球场，粉色球场群位于跑道西侧。' },
    ];
  }

  setSeason(s) { this.nature.setSeason(s); }
  setBuildingDensity(d) {
    const t = Math.max(0, Math.min(1, d));
    if (this.annex[0]) this.annex[0].visible = t > .08;
    if (this.annex[1]) this.annex[1].visible = t > .30;
    if (this.annex[2]) this.annex[2].visible = t > .42;
    if (this.annex[3]) this.annex[3].visible = t > .55;
  }
  setDensity(d) { this.nature.setDensity(d); this.people.setDensity(d); }
  setNight(n) { this.people.setNight(n); }

  update(dt, t, { night = 0, season = 'summer' } = {}) {
    this._time = t;
    // 雾墙随昼夜变暗，夜间不至于泛白
    if (this.fogWallMat) {
      this.fogWallMat.color.copy(FOG_DAY).lerp(FOG_NIGHT, night * .92);
      if (this.fogPuffMat) this.fogPuffMat.color.copy(this.fogWallMat.color);
    }
    this.nature.update(dt, t, { night });
    // 钟楼指针随本地时间走时
    if (this.clockHands.length) {
      const d = new Date();
      const hh = d.getHours() % 12, mm = d.getMinutes(), ss = d.getSeconds();
      const hourA = (hh + mm / 60) / 12 * Math.PI * 2;
      const minA = (mm + ss / 60) / 60 * Math.PI * 2;
      const secA = ss / 60 * Math.PI * 2;
      for (const c of this.clockHands) {
        c.h.rotation.z = -hourA;
        c.m.rotation.z = -minA;
        c.s.rotation.z = -secA;
      }
    }
    this.people.update(dt, t);
    // smoke
    if (this.smoke) {
      for (const p of this.smoke.puffs) {
        const ph = ((t * .12 + p.userData.phase) % 1);
        p.position.set(Math.sin(ph * 6 + p.userData.phase * 9) * .5, ph * 6.0, Math.cos(ph * 5 + p.userData.phase * 7) * .5);
        p.material.opacity = (1 - ph) * .16;
        p.scale.setScalar(1.2 + ph * 2.6);
      }
    }
    // flags
    if (this.axisFlagGeo) {
      const pos = this.axisFlagGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        pos.setZ(i, Math.sin(x * 2.1 + t * 3.4) * (.14 + (x + 1.7) * .055));
      }
      pos.needsUpdate = true;
    }
    // 旗面飘动：泮池旗杆与田径场旗杆共用同一套波形
    const flutter = (geo, phase) => {
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        pos.setZ(i, Math.sin(x * 2.2 + t * 3.2 + phase) * (.18 + (x + 2.1) * .03));
      }
      pos.needsUpdate = true;
    };
    if (this.ctx.flagGeo) flutter(this.ctx.flagGeo, 0);
    if (this.ctx.fieldFlagGeo) flutter(this.ctx.fieldFlagGeo, .9);
    // water ripple
    if (this.mats.waterNormal) {
      this.mats.waterNormal.offset.x = (t * .012) % 1;
      this.mats.waterNormal.offset.y = (t * .008) % 1;
    }
  }
}

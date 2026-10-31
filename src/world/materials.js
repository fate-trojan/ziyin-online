import * as THREE from 'three';
import {
  makeRoofTextures, makePlasterTexture, makeStoneTexture, makeBrickTexture, makeWoodTexture,
  makeLatticeTexture, makeGroundTexture, makePathTexture, makeAsphaltTexture, makeWaterNormal,
  makeFacadeTexture, makeFacadeEmissive, makeGlowSpriteTexture, makeLeafTexture
  , makeWeatheredRoofTexture, makeStonePanelTexture, makeMuralTexture, makeCofferTexture
} from '../textures.js';
import { textTexture, mulberry32 } from '../util.js';

/** 窗片贴图：深色玻璃 + 边框/窗棂（自习室为红棕木框，书吧为白色细格） */
function makeWindowTexture({ cols = 2, rows = 2, frame = '#7c3b2c', frameW = 16, bg = '#3f5763' } = {}) {
  const W = 256, H = 384;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const lg = g.createLinearGradient(0, 0, W, H);
  lg.addColorStop(0, 'rgba(226,240,246,.55)');
  lg.addColorStop(.42, 'rgba(200,222,232,.12)');
  lg.addColorStop(1, 'rgba(120,150,165,.30)');
  g.fillStyle = lg; g.fillRect(0, 0, W, H);
  g.strokeStyle = frame;
  g.lineWidth = frameW;
  g.strokeRect(frameW / 2, frameW / 2, W - frameW, H - frameW);
  g.lineWidth = Math.max(3, frameW * .5);
  for (let i = 1; i < cols; i++) {
    const x = W * i / cols;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
  }
  for (let j = 1; j < rows; j++) {
    const y = H * j / rows;
    g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 赭红人物浮雕贴图：灰石板底 + 剪影人像（视频 157-160s 廊架墙面） */
function makeReliefTexture({ w = 1024, h = 420, figures = 8, rows = 1, seed = 71 } = {}) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  const rnd = mulberry32(seed);
  g.fillStyle = '#918b82'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 5000; i++) {
    const v = 110 + rnd() * 60;
    g.fillStyle = `rgba(${v},${v - 4},${v - 10},.25)`;
    g.fillRect(rnd() * w, rnd() * h, 2, 2);
  }
  const fig = (cx, baseY, s, flip) => {
    g.save();
    g.translate(cx, baseY);
    if (flip) g.scale(-1, 1);
    g.fillStyle = '#7f4a38';
    g.shadowColor = 'rgba(38,26,20,.5)';
    g.shadowOffsetX = 2; g.shadowOffsetY = 2; g.shadowBlur = 2;
    // 头
    g.beginPath(); g.arc(0, -1.60 * s, .22 * s, 0, Math.PI * 2); g.fill();
    // 躯干
    g.beginPath();
    g.moveTo(-.26 * s, -1.40 * s); g.lineTo(.26 * s, -1.40 * s);
    g.lineTo(.31 * s, -.48 * s); g.lineTo(-.31 * s, -.48 * s); g.closePath(); g.fill();
    // 腿
    g.fillRect(-.24 * s, -.52 * s, .18 * s, .52 * s);
    g.fillRect(.06 * s, -.52 * s, .18 * s, .52 * s);
    // 手臂（前伸/上举）
    g.save(); g.translate(.23 * s, -1.28 * s); g.rotate(-.42);
    g.fillRect(0, -.09 * s, .52 * s, .18 * s); g.restore();
    g.save(); g.translate(-.23 * s, -1.24 * s); g.rotate(-.15);
    g.fillRect(-.48 * s, -.09 * s, .48 * s, .18 * s); g.restore();
    g.shadowColor = 'transparent';
    // 亮部
    g.fillStyle = 'rgba(186,126,94,.42)';
    g.fillRect(-.20 * s, -1.32 * s, .12 * s, .68 * s);
    g.restore();
  };
  const rowH = h / rows;
  for (let r = 0; r < rows; r++) {
    const n = Math.max(2, Math.round(figures / rows));
    for (let i = 0; i < n; i++) {
      const cx = (i + .5) * w / n + (rnd() - .5) * w / n * .18;
      const baseY = r * rowH + rowH * .92 + (rnd() - .5) * rowH * .05;
      const s = Math.min(rowH / 2.0, w / n / 1.25) * (.82 + rnd() * .2);
      fig(cx, baseY, s, i % 2 === 1);
    }
  }
  // 细凿刻痕
  for (let i = 0; i < 260; i++) {
    g.strokeStyle = `rgba(60,50,44,${.05 + rnd() * .1})`;
    const x = rnd() * w, y = rnd() * h;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - .5) * 18, y + (rnd() - .5) * 8); g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createMaterials() {
  const roofTex = makeRoofTextures();
  const plasterTex = makePlasterTexture('#e8e3d6', [1, 1]);
  const stoneTex = makeStoneTexture('#918d82', [1, 1]);
  const marbleTex = makeStoneTexture('#c8c2b2', [1, 1]);
  const brickTex = makeBrickTexture('#98604b', [1, 1]);
  const woodTex = makeWoodTexture('#5b2a23', [1, 1]);
  const latticeTex = makeLatticeTexture({ bg: '#3a1b17', line: '#b9824f' });
  const latticeDiamond = makeLatticeTexture({ bg: '#3a1b17', line: '#c0915c', diamond: true });
  const latticeGlow = makeLatticeTexture({ bg: '#2a0f0b', line: '#ffd79a', cols: 8, rows: 12 });
  const groundTex = makeGroundTexture([12, 12]);
  const pathTex = makePathTexture([1, 1]);
  const asphaltTex = makeAsphaltTexture([8, 8]);
  const waterNormal = makeWaterNormal([3, 1.4]);
  const leafTex = makeLeafTexture('#ffffff');
  const weatheredRoofTex = makeWeatheredRoofTexture();
  const stonePanelTex = makeStonePanelTexture();
  const glowTex = makeGlowSpriteTexture('255,196,120');
  // 沁园一带：青灰砖墙 + 两种窗片（自习室红棕木框 / 书吧白色细格）
  const grayBrickTex = makeBrickTexture('#b8b4a9', [1, 1]);
  const studyWinTex = makeWindowTexture({ cols: 2, rows: 2, frame: '#7c3b2c', frameW: 18 });
  const tallWinTex = makeWindowTexture({ cols: 3, rows: 5, frame: '#eceae2', frameW: 10 });
  // 红廊（灰廊架）：青砖墙、黄木门、四瓣花窗、赭红浮雕、藤蔓
  const doorWoodTex = makeWoodTexture('#b98b4e', [1, 1]);
  const jadeLatticeTex = makeLatticeTexture({ bg: '#4d574c', line: '#e2dbc2', diamond: true, cols: 8, rows: 8 });
  const reliefVTex = makeReliefTexture({ w: 512, h: 640, figures: 5, rows: 2, seed: 73 });
  const reliefHTex = makeReliefTexture({ w: 1024, h: 380, figures: 9, rows: 1, seed: 79 });
  // 大成殿室内：圣迹图壁画带 + 蓝白椽花天花
  const muralTex = makeMuralTexture();
  const cofferTex = makeCofferTexture();
  cofferTex.repeat.set(1, 7);
  const shrineTex = makeLatticeTexture({ bg: '#d9c9a6', line: '#6d4b2c', cols: 3, rows: 10, border: false });

  const standard = (opts) => new THREE.MeshStandardMaterial(opts);

  const m = {
    roof: standard({ map: roofTex.map, bumpMap: roofTex.bump, bumpScale: 0.45, color: 0xffffff, roughness: 0.86, metalness: 0.04, side: THREE.DoubleSide }),
    roofDark: standard({ map: roofTex.map, bumpMap: roofTex.bump, bumpScale: 0.4, color: 0xf2f4f2, roughness: 0.9, metalness: 0.03, side: THREE.DoubleSide }),
    roofSlate: standard({ map: roofTex.map, bumpMap: roofTex.bump, bumpScale: 0.4, color: 0x9fa8a9, roughness: 0.82, metalness: 0.08, side: THREE.DoubleSide }),
    ridge: standard({ color: 0x363b3c, roughness: 0.72, metalness: 0.08 }),
    ridgeWarm: standard({ color: 0x4a3530, roughness: 0.7, metalness: 0.04 }),
    plaster: standard({ map: plasterTex, color: 0xffffff, roughness: 0.92 }),
    plasterCool: standard({ map: plasterTex, color: 0xe7e9e4, roughness: 0.9 }),
    stone: standard({ map: stoneTex, color: 0xffffff, roughness: 0.93 }),
    stoneDark: standard({ map: stoneTex, color: 0x8b8880, roughness: 0.95 }),
    marble: standard({ map: marbleTex, color: 0xffffff, roughness: 0.8 }),
    brick: standard({ map: brickTex, color: 0xffffff, roughness: 0.92 }),
    grayBrick: standard({ map: grayBrickTex, color: 0xffffff, roughness: 0.94 }),
    grayBrickCore: standard({ color: 0xa5a196, roughness: 0.95 }),
    winStudy: standard({ map: studyWinTex, color: 0xffffff, roughness: 0.42, metalness: 0.1 }),
    winTall: standard({ map: tallWinTex, color: 0xffffff, roughness: 0.38, metalness: 0.12 }),
    redColumn: standard({ color: 0x7c2e27, roughness: 0.55, metalness: 0.02 }),
    redBeam: standard({ color: 0x8f3a2d, roughness: 0.52 }),
    redDark: standard({ color: 0x5d201b, roughness: 0.6 }),
    wood: standard({ map: woodTex, color: 0xffffff, roughness: 0.66 }),
    woodDark: standard({ color: 0x3a211c, roughness: 0.7 }),
    bark: standard({ color: 0x6c5544, roughness: 0.96 }),
    lattice: standard({ map: latticeTex, color: 0xffffff, roughness: 0.62 }),
    latticeDiamond: standard({ map: latticeDiamond, color: 0xffffff, roughness: 0.62 }),
    latticeJade: standard({ map: jadeLatticeTex, color: 0xffffff, roughness: 0.66 }),
    tileRed: standard({ map: roofTex.map, color: 0xb05a42, roughness: 0.85, emissive: 0x3a120c, emissiveIntensity: 0.35, side: THREE.DoubleSide }),
    woodDoor: standard({ map: doorWoodTex, color: 0xffffff, roughness: 0.68 }),
    reliefV: standard({ map: reliefVTex, color: 0xffffff, roughness: 0.92 }),
    reliefH: standard({ map: reliefHTex, color: 0xffffff, roughness: 0.92 }),
    grayBeam: standard({ color: 0x918c7e, roughness: 0.88 }),
    vine: standard({ color: 0x4f6b3b, roughness: 0.94 }),
    bambooStem: standard({ color: 0x9aa06a, roughness: 0.86 }),
    bambooLeaf: standard({ color: 0x54713f, roughness: 0.92 }),
    fern: standard({ color: 0x5f7c46, roughness: 0.95 }),
    cycad: standard({ color: 0x47613a, roughness: 0.9 }),
    whiteBark: standard({ color: 0xe8e4d6, roughness: 0.9 }),
    redGround: standard({ color: 0x7d3d38, roughness: 0.95 }),
    lampWhite: standard({ color: 0xf2efe6, emissive: 0xfff1cf, emissiveIntensity: 0.35, roughness: 0.5 }),
    latticeEmissive: standard({ map: latticeTex, color: 0xffffff, roughness: 0.6, emissive: 0xffb86b, emissiveMap: latticeGlow, emissiveIntensity: 0 }),
    door: standard({ map: latticeTex, color: 0xb08a72, roughness: 0.58 }),
    gold: standard({ color: 0xb68a45, metalness: 0.65, roughness: 0.36 }),
    goldDim: standard({ color: 0x8d6a35, metalness: 0.55, roughness: 0.46 }),
    bronze: standard({ color: 0x5d4a2f, metalness: 0.72, roughness: 0.42 }),
    darkMetal: standard({ color: 0x2b2e2e, metalness: 0.55, roughness: 0.5 }),
    metalBlue: standard({ color: 0xd6e3e8, metalness: 0.46, roughness: 0.3 }),
    interior: standard({ color: 0x24140f, roughness: 0.9 }),
    interiorWall: standard({ map: plasterTex, color: 0x84352b, roughness: 0.9 }),
    mural: standard({ map: muralTex, color: 0xffffff, roughness: 0.82, emissive: 0x2a1408, emissiveIntensity: 0.18 }),
    shrinePanel: standard({ map: shrineTex, color: 0xffffff, roughness: 0.8 }),
    coffer: standard({ map: cofferTex, color: 0xffffff, roughness: 0.85, emissive: 0x0e1822, emissiveIntensity: 0.25 }),
    wallLamp: standard({ color: 0xffe2b0, emissive: 0xffb066, emissiveIntensity: 1.1, roughness: 0.5 }),
    warmInterior: standard({ color: 0x3a2118, roughness: 0.85, emissive: 0xff9a4a, emissiveIntensity: 0 }),
    glass: standard({ color: 0x3a5057, metalness: 0.14, roughness: 0.38 }),
    glassWarm: standard({ color: 0xffcf8a, emissive: 0xffb060, emissiveIntensity: 0, roughness: 0.4 }),
    ground: standard({ map: groundTex, color: 0xffffff, roughness: 1.0 }),
    grass: standard({ color: 0x617a4c, roughness: 1.0 }),
    grassDark: standard({ color: 0x4b613a, roughness: 1.0 }),
    path: standard({ map: pathTex, color: 0xffffff, roughness: 0.95 }),
    slab: standard({ map: marbleTex, color: 0xfdfcf6, roughness: 0.9 }),
    roadStone: standard({ map: stoneTex, color: 0x6f7473, roughness: 0.95 }),
    pathStone: standard({ map: stoneTex, color: 0xc6c0b0, roughness: 0.92 }),
    weatheredRoof: standard({ map: weatheredRoofTex, color: 0xffffff, roughness: 0.88, metalness: 0.18 }),
    facadeStone: standard({ map: stonePanelTex, color: 0xa9aaa5, roughness: .86, metalness: .04 }),
    gravel: standard({ color: 0x9a9486, roughness: 1.0 }),
    asphalt: standard({ map: asphaltTex, color: 0xffffff, roughness: 0.96 }),
    track: standard({ color: 0x9e4739, roughness: 0.9 }),
    trackLine: standard({ color: 0xe9e3d2, roughness: .85 }),   // 受光：夜间不再自发光
    infield: standard({ color: 0x5f7b46, roughness: 1.0 }),
    water: standard({ color: 0x2f86b4, roughness: 0.34, metalness: 0.06, transparent: true, opacity: 0.9 }),
    waterEdge: standard({ color: 0x5a5b52, roughness: 0.9 }),
    soil: standard({ color: 0x6b5a44, roughness: 1.0 }),
    rock: standard({ color: 0x77766b, roughness: 0.95 }),
    rockDark: standard({ color: 0x5a5a50, roughness: 0.98 }),
    lantern: standard({ color: 0xb83b2b, emissive: 0xff5b2e, emissiveIntensity: 0, roughness: 0.55 }),
    lanternGold: standard({ color: 0xb8893f, emissive: 0xffb25a, emissiveIntensity: 0, metalness: 0.5, roughness: 0.4 }),
    windowGlow: standard({ color: 0xffd08a, emissive: 0xffb060, emissiveIntensity: 0, roughness: 0.5 }),
    whiteLine: standard({ color: 0xdfd9c8, roughness: .85 }),   // 旗杆/跑道/球场线：受光，夜间不再发亮
    redLine: new THREE.MeshBasicMaterial({ color: 0xb04a3a }),
    black: standard({ color: 0x1d1f1f, roughness: 0.7 }),
    peach: standard({ color: 0xd9a49e, roughness: 0.85 }),
    leaf: standard({ map: leafTex, color: 0xffffff, roughness: 0.8, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide }),
    glowTex,
    waterNormal,
    stoneTex,
    plasterTex,
    stonePanelTex,
  };

  m.latticeEmissive.userData.baseEmissive = 0.85;
  m.windowGlow.userData.baseEmissive = 2.4;
  m.waterNormal = waterNormal;
  // signs / plaques
  m.plaques = {
    school: textTexture('数字校园', { w: 1024, h: 220, bg: '#202322', color: '#d9b46a', font: 'bold 104px "Songti SC","STSong",serif', letterSpacing: 12 }),
    dachengmen: textTexture('大成门', { w: 700, h: 190, bg: '#241b15', color: '#d9b46a', font: 'bold 96px "Songti SC","STSong",serif', letterSpacing: 10, border: '#8d6a35' }),
    dianjiao: textTexture('电教楼', { w: 600, h: 180, bg: '#2b2a25', color: '#d8c796', font: 'bold 84px "Songti SC","STSong",serif', letterSpacing: 8 }),
    dacheng: textTexture('大成殿', { w: 512, h: 200, bg: '#241b15', color: '#d9b46a', font: 'bold 110px "Songti SC","STSong",serif', letterSpacing: 14, border: '#8d6a35' }),
    jiaochuan: textTexture('蛟川书院', { w: 720, h: 200, bg: '#211a15', color: '#d9b46a', font: 'bold 96px "Songti SC","STSong",serif', letterSpacing: 10, border: '#8d6a35' }),
    ziyin: textTexture('梓荫山', { w: 600, h: 200, bg: '#2b2a25', color: '#d8c796', font: 'bold 100px "Songti SC","STSong",serif', letterSpacing: 12 }),
    wugong: textTexture('吴公纪功碑亭', { w: 700, h: 180, bg: '#2b2a25', color: '#d8c796', font: 'bold 74px "Songti SC","STSong",serif', letterSpacing: 2 }),
    zhufeng: textTexture('朱枫烈士纪念楼', { w: 900, h: 180, bg: '#2b1a16', color: '#e0c084', font: 'bold 72px "Songti SC","STSong",serif', letterSpacing: 2 }),
    roushi: textTexture('柔石亭', { w: 600, h: 180, bg: '#241a12', color: '#e8c979', font: 'bold 100px "Songti SC","STSong",serif', letterSpacing: 12 }),
    linzexu: textTexture('林则徐纪念堂', { w: 900, h: 180, bg: '#2b2a25', color: '#d8c796', font: 'bold 78px "Songti SC","STSong",serif', letterSpacing: 2 }),
    fude: textTexture('富的廊', { w: 600, h: 180, bg: '#2b2a25', color: '#d8c796', font: 'bold 90px "Songti SC","STSong",serif', letterSpacing: 10 }),
    ziyinge: textTexture('梓荫阁', { w: 600, h: 180, bg: '#2b2a25', color: '#d8c796', font: 'bold 90px "Songti SC","STSong",serif', letterSpacing: 10 }),
    liufang: textTexture('流芳碑', { w: 300, h: 600, bg: '#2e2d28', color: '#cfc3a4', font: 'bold 100px "Songti SC","STSong",serif', vertical: true }),
    motto: textTexture('励志 进取 勤奋 健美', { w: 2048, h: 420, bg: '#8b8d84', color: '#c9a84a', font: 'bold 200px "Songti SC","STSong",serif', letterSpacing: 10 }),
    yudaoyou: textTexture('俞大猷生祠碑', { w: 520, h: 300, bg: '#2e2d28', color: '#cfc3a4', font: 'bold 52px "Songti SC","STSong",serif' }),
    qinyuan: textTexture('沁園', { w: 480, h: 180, bg: '#24211b', color: '#d9b46a', font: 'bold 96px "Songti SC","STSong",serif', letterSpacing: 18 }),
    study: textTexture('自主学习室', { w: 640, h: 170, bg: '#e9e5da', color: '#b03a28', font: 'bold 86px "Songti SC","STSong",serif', letterSpacing: 8 }),
    studyEn: textTexture('Independent Study Room', { w: 640, h: 100, bg: '#e9e5da', color: '#3a3730', font: 'bold 34px "Helvetica Neue",Arial,sans-serif', letterSpacing: 2 }),
    bookbar: textTexture('书吧', { w: 420, h: 170, bg: '#24211b', color: '#d9b46a', font: 'bold 96px "Songti SC","STSong",serif', letterSpacing: 14 }),
    yugong: textTexture('都督俞公亭', { w: 900, h: 190, bg: '#c9c2b2', color: '#33302a', font: 'bold 82px "Songti SC","STSong",serif', letterSpacing: 6 }),
    tianxin: textTexture('甜心屋', { w: 640, h: 190, bg: '#2e3234', color: '#f0e7d2', font: 'bold 96px "Songti SC","STSong",serif', letterSpacing: 10 }),
    gym: textTexture('体艺馆', { w: 640, h: 190, bg: '#e5e0d2', color: '#3e3c35', font: 'bold 100px "Songti SC","STSong",serif', letterSpacing: 8 }),
    qiyuan: textTexture('憩园', { w: 480, h: 200, bg: '#efe7dc', color: '#8a4a42', font: 'bold 100px "Songti SC","STSong",serif', letterSpacing: 14, border: '#c9b8a6' }),
    zhufengGuju: textTexture('朱枫故居', { w: 420, h: 620, bg: '#3a3630', color: '#e8c979', font: 'bold 92px "Songti SC","STSong",serif', vertical: true }),
    yingming: textTexture('英名昭后世', { w: 900, h: 200, bg: '#8f2f26', color: '#f3d18a', font: 'bold 88px "Songti SC","STSong",serif', letterSpacing: 8 }),
    yinglie: textTexture('英烈伴读', { w: 560, h: 240, bg: '#cfc9b8', color: '#3a3730', font: 'bold 88px "Songti SC","STSong",serif', letterSpacing: 10 }),
    wenbao: textTexture('镇海区文物保护点', { w: 420, h: 620, bg: '#d8d4c6', color: '#3a3730', font: 'bold 60px "Songti SC","STSong",serif', vertical: true }),
    notice: textTexture('朱枫故居开放制度', { w: 640, h: 420, bg: '#17181a', color: '#e7e2d2', font: 'bold 44px "Songti SC","STSong",serif', letterSpacing: 2 }),
    noticeRed: textTexture('团队预约 0574-86273255', { w: 760, h: 200, bg: '#8e2f28', color: '#ffe9b0', font: 'bold 46px "Songti SC","STSong",serif', letterSpacing: 1 }),
  };

  // facade materials for modern campus buildings
  const facadeDefs = [
    { key: 'teachA', floors: 4, bays: 9, style: 'campus', seed: 3 },
    { key: 'teachB', floors: 4, bays: 7, style: 'campus', seed: 4 },
    { key: 'lab', floors: 5, bays: 10, style: 'campus', seed: 5 },
    { key: 'lab4', floors: 4, bays: 14, style: 'campus', seed: 15 },
    { key: 'lab5', floors: 1, bays: 8, style: 'campus', seed: 16 },
    { key: 'admin', floors: 4, bays: 9, style: 'campus', seed: 6 },
    { key: 'dorm', floors: 5, bays: 8, style: 'campus', seed: 7 },
    { key: 'teach3', floors: 3, bays: 7, style: 'campus', seed: 9 },
    { key: 'teach4', floors: 4, bays: 9, style: 'campus', seed: 10 },
    { key: 'teachMain', floors: 4, bays: 7, style: 'teach', seed: 21 },
    { key: 'teachSide', floors: 4, bays: 7, style: 'teachSide', seed: 22 },
    { key: 'low2', floors: 2, bays: 6, style: 'campus', seed: 11 },
    { key: 'admin3', floors: 3, bays: 7, style: 'campus', seed: 17 },
    { key: 'one1', floors: 1, bays: 4, style: 'campus', seed: 13 },
  ];
  const townDay = makeFacadeTexture({ w: 512, h: 512, floors: 3, bays: 4, style: 'grey', seed: 12 });
  const townEm = makeFacadeEmissive({ w: 512, h: 512, floors: 3, bays: 4, seed: 12 });
  m.town = standard({ map: townDay.map, emissiveMap: townEm, emissive: 0xffc078, emissiveIntensity: 0, roughness: .92 });
  m.town.userData.baseEmissive = 1.45;
  m.townWarm = m.town.clone(); m.townWarm.color = new THREE.Color(0xe8decd);
  m.townGrey = m.town.clone(); m.townGrey.color = new THREE.Color(0xc9cdc7);
  m.facades = {};
  for (const def of facadeDefs) {
    const day = makeFacadeTexture({ ...def, night: false });
    const em = makeFacadeEmissive(def);
    const mat = standard({ map: day.map, color: 0xffffff, roughness: 0.85, emissive: 0xffc078, emissiveMap: em, emissiveIntensity: 0 });
    m.facades[def.key] = mat;
  }
  return m;
}

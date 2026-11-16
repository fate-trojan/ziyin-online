import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createMaterials } from './world/materials.js';
import { Environment } from './core/sky.js';
import { Post } from './core/post.js';
import { Campus } from './world/campus.js';
import { createCharacter } from './world/character.js';
import { createHero2 } from './world/hero2.js';
import { Effects } from './world/effects.js';
import { Npc } from './world/npc.js';
import { buildKongziStatue } from './world/buildings.js';
import { buildSeatedStatue } from './world/interiors.js';
import { Labels } from './ui/labels.js';

const $ = (s) => document.querySelector(s);
const isMobile = matchMedia('(max-width: 820px), (pointer: coarse)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

const canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.6 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(44, innerWidth / innerHeight, .3, 5000);
if (isMobile) camera.position.set(10, 165, 340); else camera.position.set(-28, 26, 204);

const controls = new OrbitControls(camera, canvas);
if (isMobile) controls.target.set(20, 18, 20); else controls.target.set(-28, 8, 136);
controls.enableDamping = true;
controls.dampingFactor = .06;
controls.minDistance = 26;
controls.maxDistance = 820;
controls.maxPolarAngle = Math.PI * .495;
controls.minPolarAngle = .02;
controls.screenSpacePanning = false;
controls.zoomSpeed = .82;
controls.rotateSpeed = .5;
controls.autoRotateSpeed = .4;

const mats = createMaterials();
const env = new Environment(scene, renderer);
if (isMobile) env.sun.shadow.mapSize.set(1024, 1024);
const post = new Post(renderer, scene, camera, { mobile: isMobile });
const campus = new Campus(scene, mats);
// 夜景只保留灯具的点光源照明，窗户/灯罩/发光贴片等自发光全部关闭
env.registerNight([], campus.nightLights);

/* ---------------- 剧本动效与铜像 NPC ---------------- */
// 铜像直接复用校园里的坐像模型：孔子坐像在大成殿祭坛上，林公像在林则徐纪念堂。
// 剧本里它们不做骨骼动画，只整体平移（用户明确要求「铜人平移即可」）
const effects = new Effects(campus);
const kongziModel = buildKongziStatue(mats);
const linHost = new THREE.Group();
const linModel = buildSeatedStatue(linHost, mats, 0, 0, 0);
const kongzi = new Npc(campus, { name: '孔子', x: -28, z: 6, facing: 0, model: kongziModel, height: 2.3 });
const lin = new Npc(campus, { name: '林则徐', x: 101, z: -56, facing: -Math.PI / 2, model: linModel, height: 2.3 });
const npcs = [kongzi, lin];

/* ---------------- 可操控小人：竹节木偶 / 主角二号 可切换 ---------------- */
const puppet = createCharacter();
const hero2 = createHero2();
hero2.group.visible = false;
const player = {
  group: new THREE.Group(),
  heroes: [puppet, hero2],
  idx: 0,
  get current() { return this.heroes[this.idx]; },
  update(dt, speed, moving, night) { this.current.update(dt, speed, moving, night); },
};
player.group.add(puppet.group, hero2.group);
scene.add(player.group);

const heroBtn = $('#heroBtn');
function switchHero() {
  const next = 1 - player.idx;
  if (player.heroes[next].ready === false) return false;
  player.current.group.visible = false;
  player.heroes[next].group.visible = true;
  player.idx = next;
  heroBtn.textContent = next === 1 ? '②' : '①';
  heroBtn.classList.toggle('on', next === 1);
  return true;
}
heroBtn.addEventListener('click', switchHero);

// 固定出生点：校门内中轴广场（不再随机）
const spawn = new THREE.Vector3(-28, campus.groundY(-28, 120), 120);
player.group.position.copy(spawn);
let vy = 0, onGround = true;
let airDx = 0, airDz = 0, airSpeed = 0;
const JUMP_V = 6.4, GRAVITY = 18;
// 选一个身后最开阔的方向放相机，避免出生就被建筑贴脸
function openDirection(x, z) {
  let best = { a: 0, clear: -1 };
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    const dx = Math.sin(a), dz = Math.cos(a);
    let clear = 13;
    for (let d = 3; d <= 13; d += 1) {
      if (campus.isBlocked(x + dx * d, z + dz * d)) { clear = d - 1; break; }
    }
    if (clear > best.clear) best = { a, clear, dx, dz };
  }
  return best;
}
const open = openDirection(spawn.x, spawn.z);
// 相机贴在小人脑袋后约 3 米，随身体转向一起转
const CAM_DIST = 3.2;
const CAM_OFFSET = new THREE.Vector3(open.dx * CAM_DIST, 0, open.dz * CAM_DIST);
let facing = Math.atan2(-open.dx, -open.dz);
player.group.rotation.y = facing;
controls.target.set(spawn.x, spawn.y + 1.62, spawn.z);
camera.position.copy(controls.target).add(CAM_OFFSET);
controls.minDistance = 1.2;
controls.maxDistance = 12;
controls.enablePan = false;
controls.maxPolarAngle = Math.PI * 11 / 12;
controls.minPolarAngle = Math.PI / 12;
controls.rotateSpeed = .38;
controls.zoomSpeed = .9;

const state = {
  time: 11.5, targetTime: 11.5, mode: 'day', season: 'summer', style: 'ink',
  buildDensity: 1, treeDensity: 1, peopleDensity: 0, townMode: 'full',
  skyline: 1, skyVar: .42, fog: 1, exposure: 1, ambient: 1, sun: 1,
  labels: false,
};
let freeCam = false;

env.setTime(state.time, true);
env.update(0, true);
campus.setSeason(state.season);
campus.setBuildingDensity(state.buildDensity);
campus.nature.setDensity(state.treeDensity);
campus.people.setDensity(state.peopleDensity);

/* ---------------- labels & info ---------------- */
const labels = new Labels($('#labels'), camera, campus.landmarks, {
  onSelect: (l) => selectLandmark(l),
  onHover: null,
});
labels.setEnabled(state.labels);

const info = { current: null };
function showInfo(l) {
  info.current = l;
  const idx = String(campus.landmarks.findIndex(x => x.id === l.id) + 1).padStart(2, '0');
  $('#infoIndex').textContent = idx;
  $('#infoTitle').textContent = l.name;
  $('#infoEn').textContent = l.en;
  $('#infoDesc').textContent = l.desc;
  $('#infoCard').classList.remove('hidden');
}
function hideInfo() { $('#infoCard').classList.add('hidden'); info.current = null; }
function selectLandmark(l) {
  showInfo(l);
  labels.activeId = l.id;
  for (const it of labels.items) it.el.classList.toggle('active', it.l.id === l.id);
}
$('#infoClose').addEventListener('click', () => { hideInfo(); labels.activeId = null; labels.items.forEach(it => it.el.classList.remove('active')); });
$('#infoGo').addEventListener('click', () => {
  if (!info.current) return;
  const [x, , z] = info.current.pos;
  teleportNear(x, z);
});

function teleportNear(x, z) {
  const cands = [[x, z + 16], [x, z - 16], [x + 16, z], [x - 16, z], [x, z + 26], [x, z - 26]];
  for (const [cx, cz] of cands) {
    if (campus.isBlocked(cx, cz)) continue;
    const p = player.group.position;
    p.set(cx, campus.groundY(cx, cz), cz);
    controls.target.set(cx, p.y + 1.62, cz);
    camera.position.copy(controls.target).add(CAM_OFFSET);
    return true;
  }
  return false;
}

setTime(11.5, false);

/* ---------------- day / night ---------------- */
function setTime(t, animate = false) {
  t = clamp(t, 5, 23);
  state.time = t; state.targetTime = t;
  if (!animate) { env.setTime(t, true); }
  else { state.time = t; env.setTime(t, false); }
  state.mode = (t >= 18.6 || t < 6.3) ? 'night' : 'day';
  document.querySelectorAll('#dayNight button').forEach(b => b.classList.toggle('active', b.dataset.mode === state.mode));
}
function setMode(mode) {
  state.mode = mode;
  state.targetTime = mode === 'day' ? 11.5 : 21.0;
  document.querySelectorAll('#dayNight button').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  // collect the tween in the main loop
}
document.querySelectorAll('#dayNight button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));

$('#showLabels').addEventListener('change', (e) => { state.labels = e.target.checked; labels.setEnabled(state.labels); });

function setStyle(style) {
  state.style = style;
  const p = post.grade.uniforms;
  if (style === 'ink') {
    p.uWarmth.value = .07; p.uGrain.value = isMobile ? .02 : .03; p.uVignette.value = .32; p.uSaturation.value = 1.02;
    env.userFog = state.fog = 1; renderer.toneMappingExposure = 1.0;
  } else if (style === 'film') {
    p.uWarmth.value = .55; p.uGrain.value = isMobile ? .07 : .085; p.uVignette.value = .44; p.uSaturation.value = .84;
    env.userFog = state.fog = 1.12; renderer.toneMappingExposure = 1.04;
  } else {
    p.uWarmth.value = -.16; p.uGrain.value = isMobile ? .012 : .018; p.uVignette.value = .22; p.uSaturation.value = 1.12;
    env.userFog = state.fog = .72; renderer.toneMappingExposure = 1.06;
  }
}

$('#helpBtn').addEventListener('click', () => $('#helpModal').classList.remove('hidden'));
$('#helpClose').addEventListener('click', () => $('#helpModal').classList.add('hidden'));
$('#helpModal').addEventListener('click', (e) => { if (e.target.id === 'helpModal') $('#helpModal').classList.add('hidden'); });
$('#fullBtn').addEventListener('click', () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
});

/* keyboard */
const held = { w: false, a: false, s: false, d: false, shift: false };
addEventListener('keydown', (e) => {
  if (e.target && e.target.matches && e.target.matches('input, select, textarea')) return;
  const k = e.key.toLowerCase();
  if (k in held) { held[k] = true; e.preventDefault(); }
  if (e.key === 'Shift') held.shift = true;
  if (k === ' ' || e.code === 'Space') {
    if (onGround) { vy = JUMP_V; onGround = false; }
    e.preventDefault();
  }
  if (k === 'n') setMode(state.mode === 'day' ? 'night' : 'day');
  if (k === 'c') switchHero();
  if (k === 'l') { state.labels = !state.labels; labels.setEnabled(state.labels); $('#showLabels').checked = state.labels; }
});
addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k in held) held[k] = false;
  if (e.key === 'Shift') held.shift = false;
});
addEventListener('blur', () => { held.w = held.a = held.s = held.d = held.shift = false; });

/* 手机虚拟摇杆 */
const joy = { x: 0, y: 0 };
const joyEl = $('#joy');
const joyKnob = joyEl.querySelector('i');
if (isMobile) joyEl.classList.remove('hidden');
let joyPointer = null;
// 剧本驾驶时摇杆也要跟着动：手柄偏移量做平滑，停下自动回中
let joyKx = 0, joyKy = 0;
const joyPrevPos = new THREE.Vector3();
function moveJoy(e) {
  const r = joyEl.getBoundingClientRect();
  let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
  let dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
  const len = Math.hypot(dx, dy);
  if (len > 1) { dx /= len; dy /= len; }
  joy.x = dx; joy.y = dy;
  const reach = r.width * .3;
  joyKnob.style.transform = `translate(calc(-50% + ${dx * reach}px), calc(-50% + ${dy * reach}px))`;
}
joyEl.addEventListener('pointerdown', (e) => {
  joyPointer = e.pointerId;
  joyEl.setPointerCapture(e.pointerId);
  moveJoy(e);
  e.preventDefault();
});
joyEl.addEventListener('pointermove', (e) => { if (e.pointerId === joyPointer) moveJoy(e); });
const endJoy = (e) => {
  if (e.pointerId !== joyPointer) return;
  joyPointer = null; joy.x = 0; joy.y = 0;
  joyKnob.style.transform = 'translate(-50%, -50%)';
};
joyEl.addEventListener('pointerup', endJoy);
joyEl.addEventListener('pointercancel', endJoy);

/* 小人移动 + 第三人称跟身相机 */
const camFwd = new THREE.Vector3(), camRight = new THREE.Vector3();
const prevPos = new THREE.Vector3(), moveDelta = new THREE.Vector3();
// 小人身体半径：碰撞按「中心点 + 半径」判定，避免肩/腿插进课桌和墙里（视觉穿模）
// 取 .15：教室两排课桌之间实测净宽约 .54m，半径再大就走不过去了
const PLAYER_R = .15;
let walkBlend = 0;
let lookHold = 0;

// 俯仰回正：一旦偏离水平，立即以 30°/s 回到水平视角
const LEVEL_SPEED = THREE.MathUtils.degToRad(30);
controls.addEventListener('start', () => { lookHold = 2.2; });
function autoLevelCamera(dt) {
  const tgt = controls.target;
  const dx = camera.position.x - tgt.x, dz = camera.position.z - tgt.z;
  const horiz = Math.hypot(dx, dz);
  if (horiz < .05) return;
  const dy = camera.position.y - tgt.y;
  const pitch = Math.atan2(dy, horiz);
  if (Math.abs(pitch) < .002) return;
  const dist = Math.hypot(horiz, dy);
  const np = pitch - Math.sign(pitch) * Math.min(Math.abs(pitch), LEVEL_SPEED * dt);
  const nx = tgt.x + dx / horiz * Math.cos(np) * dist;
  const ny = tgt.y + Math.sin(np) * dist;
  const nz = tgt.z + dz / horiz * Math.cos(np) * dist;
  // 地面较高时不强行压低镜头，避免钻进地形
  if (ny < campus.groundY(nx, nz, tgt.y) + 1.3) return;
  camera.position.set(nx, ny, nz);
}

/* 行走时镜头缓缓转到小人背后，保持与身体朝向一致 */
const alignTmp = new THREE.Vector3();
function autoAlignCamera(dt) {
  if (lookHold > 0) { lookHold -= dt; return; }
  if (walkBlend < .15) return;
  const tgt = controls.target;
  alignTmp.copy(camera.position).sub(tgt);
  alignTmp.y = 0;
  const len = alignTmp.length();
  if (len < .2) return;
  const cur = Math.atan2(alignTmp.x, alignTmp.z);
  const want = facing + Math.PI;
  let d = want - cur;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  const a = cur + d * Math.min(1, dt * 4.5);
  camera.position.set(tgt.x + Math.sin(a) * len, camera.position.y, tgt.z + Math.cos(a) * len);
}
function updatePlayer(dt) {
  const pos = player.group.position;
  let wdx = 0, wdz = 0, speed = 0, forward = true;
  const f = clamp((held.w ? 1 : 0) - (held.s ? 1 : 0) - joy.y, -1, 1);
  const r = clamp((held.d ? 1 : 0) - (held.a ? 1 : 0) + joy.x, -1, 1);
  const len = Math.hypot(f, r);
  if (len > .04) {
    camera.getWorldDirection(camFwd); camFwd.y = 0;
    if (camFwd.lengthSq() < 1e-6) camFwd.set(0, 0, -1);
    camFwd.normalize();
    camRight.crossVectors(camFwd, camera.up).normalize();
    speed = held.shift ? 12 : 6;
    wdx = camFwd.x * (f / len) + camRight.x * (r / len);
    wdz = camFwd.z * (f / len) + camRight.z * (r / len);
    const l = Math.hypot(wdx, wdz) || 1;
    wdx /= l; wdz /= l;
    forward = f >= 0;
  }
  // 起跳后保留水平动量：空中不再受输入驱动时继续沿原方向平移，跳河跨沟才能过去
  if (onGround && speed > 0 && (wdx || wdz)) { airDx = wdx; airDz = wdz; airSpeed = speed; }
  if (!onGround && speed === 0 && airSpeed > 0) { speed = airSpeed; wdx = airDx; wdz = airDz; forward = false; }
  prevPos.copy(pos);
  if (speed > 0 && (wdx || wdz)) {
    const mx = wdx * speed * dt;
    const mz = wdz * speed * dt;
    const sprint = held.shift;
    // 分轴碰撞：建筑/石头不可穿过；台阶与缓坡可走（单步抬升 ≤.35m），更高的台基需跳上去
    // 奔跑撞到教室桌椅时，把整组桌子+双椅撞翻（碰撞体随即失效，可从倒下的桌面上走过）
    const stepOK = (x, z) => {
      if (campus.isBlocked(x, z, pos.y, PLAYER_R)) {
        if (sprint) campus.knockAt(x, z, pos.y, mx, mz);
        return false;
      }
      return campus.groundY(x, z, pos.y) - pos.y <= .35;
    };
    // 子步进：一帧位移拆成 ≤0.2m 的小段，低帧率时不会整段跨过薄墙或课桌
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(mx), Math.abs(mz)) / .2));
    for (let i = 0; i < n; i++) {
      if (stepOK(pos.x + mx / n, pos.z)) pos.x += mx / n;
      if (stepOK(pos.x, pos.z + mz / n)) pos.z += mz / n;
    }
    // 面朝移动方向：前进/横移按移动方向转身；S 后退保持朝向，背向退出（不转身）
    if (forward) {
      const targetFacing = Math.atan2(wdx, wdz);
      let diff = targetFacing - facing;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      facing += diff * Math.min(1, dt * 14);
      facing = Math.atan2(Math.sin(facing), Math.cos(facing));
    }
  }
  player.group.rotation.y = facing;
  // 跳跃与落地：重力作用在 y，贴地后归零
  vy -= GRAVITY * dt;
  pos.y += vy * dt;
  // refY 取本帧下落前的高度：单帧下落过多时仍能认出脚下这块楼面，不会漏掉地面继续掉
  const gy = campus.groundY(pos.x, pos.z, Math.max(pos.y, prevPos.y));
  if (pos.y <= gy) { pos.y = gy; vy = 0; onGround = true; }
  else onGround = false;
  // 相机跟随位移，保持环绕角度
  moveDelta.copy(pos).sub(prevPos);
  camera.position.add(moveDelta);
  controls.target.set(pos.x, pos.y + 1.62, pos.z);
  walkBlend += ((speed > 0 ? 1 : 0) - walkBlend) * Math.min(1, dt * 10);
  player.update(dt, speed, walkBlend > .1, env.night);
}

/* 摇杆随走动摆动：把主角这一帧的实际位移投影到相机屏幕坐标，驱动手柄偏移 */
function updateJoyStick(dt) {
  const p = player.group.position;
  if (joyPrevPos.lengthSq() === 0) { joyPrevPos.copy(p); return; }
  const dx = p.x - joyPrevPos.x, dz = p.z - joyPrevPos.z;
  joyPrevPos.copy(p);
  if (joyPointer !== null) return;               // 手指正在拖时不覆盖
  const v = Math.hypot(dx, dz) / Math.max(dt, 1e-4);
  let tx = 0, ty = 0;
  if (v > .2) {
    camera.getWorldDirection(camFwd); camFwd.y = 0;
    if (camFwd.lengthSq() < 1e-6) camFwd.set(0, 0, -1);
    camFwd.normalize();
    camRight.crossVectors(camFwd, camera.up).normalize();
    const f = dx * camFwd.x + dz * camFwd.z;
    const r = dx * camRight.x + dz * camRight.z;
    const len = Math.hypot(f, r) || 1;
    const mag = Math.min(1, v / 7.5);            // 以奔跑速度作为手柄最大幅度
    tx = r / len * mag;
    ty = -f / len * mag;
  }
  joyKx += (tx - joyKx) * Math.min(1, dt * 7);
  joyKy += (ty - joyKy) * Math.min(1, dt * 7);
  const reach = joyEl.getBoundingClientRect().width * .3;
  joyKnob.style.transform =
    `translate(calc(-50% + ${(joyKx * reach).toFixed(1)}px), calc(-50% + ${(joyKy * reach).toFixed(1)}px))`;
}

/* 相机避让建筑、地面、树冠与边界雾墙，防止第三人称视角钻进墙里 */
const camProbe = new THREE.Vector3();
const camTrees = [];
function treeBlocks(px, py, pz) {
  for (const t of camTrees) {
    const dx = px - t.x, dz = pz - t.z;
    const d2 = dx * dx + dz * dz;
    const h = py - t.y;
    if (h >= t.y0 && h <= t.y1 && d2 < t.r * t.r) return true;   // 树冠
    if (h < t.y0 && d2 < t.trunk * t.trunk) return true;        // 树干
  }
  return false;
}
function avoidCameraClip() {
  const tgt = controls.target;
  camProbe.copy(camera.position).sub(tgt);
  const dist = camProbe.length();
  if (dist < .01) return;
  const dir = camProbe.multiplyScalar(1 / dist);
  camTrees.length = 0;
  for (const t of campus.nature.allTrees) {
    if (Math.abs(t.x - tgt.x) < 13 && Math.abs(t.z - tgt.z) < 13) camTrees.push(t);
  }
  const STEPS = 12;
  let allowed = dist;
  let hit = false;
  for (let i = 1; i <= STEPS; i++) {
    const d = dist * i / STEPS;
    const px = tgt.x + dir.x * d, pz = tgt.z + dir.z * d, py = tgt.y + dir.y * d;
    if (campus.isBlocked(px, pz, py) || campus.nearBoundary(px, pz, 2.6) || treeBlocks(px, py, pz)) {
      allowed = Math.max(.55, d - dist / STEPS);
      hit = true;
      break;
    }
  }
  if (hit && allowed < 1.5) {
    // 贴矮栅栏时相机被压到 1m 内会穿栏杆：抬高到栏顶以上，仍在同一水平朝向
    const d2 = 1.6 / Math.max(.001, Math.hypot(dir.x, dir.z));
    const cx = tgt.x + dir.x * d2, cz = tgt.z + dir.z * d2;
    const cy = tgt.y + 2.7;
    if (!campus.nearBoundary(cx, cz, 2.6) && !treeBlocks(cx, cy, cz) &&
        (!campus.isBlocked(cx, cz, cy) || campus.onlyFencesBlocked(cx, cz))) {
      camera.position.set(cx, cy, cz);
      return;
    }
  }
  if (allowed < dist) camera.position.copy(tgt).addScaledVector(dir, allowed);
  const gy = campus.groundY(camera.position.x, camera.position.z, controls.target.y);
  if (camera.position.y < gy + 1.3) camera.position.y = gy + 1.3;
}

/* resize */
function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  post.setSize(innerWidth, innerHeight, renderer.getPixelRatio());
}
addEventListener('resize', resize);

/* animation */
const clock = new THREE.Clock();
let frames = 0, simT = 0;

function tick(rawDt) {
  const dt = Math.min(rawDt, .06);
  simT += rawDt;
  const t = simT;

  // time transition
  if (Math.abs(state.targetTime - state.time) > .002) {
    state.time = lerp(state.time, state.targetTime, 1 - Math.exp(-rawDt * 4.2));
    env.setTime(state.time, false);
  }
  if (!freeCam) updatePlayer(dt);
  if (!freeCam) autoAlignCamera(dt);
  env.followCamera(camera);
  env.update(rawDt);
  campus.update(dt, t, { night: env.night, season: state.season });
  effects.update(dt);
  for (const n of npcs) n.update(dt, camera, env.night);
  controls.update();
  if (!freeCam) { autoLevelCamera(rawDt); avoidCameraClip(); }
  updateJoyStick(dt);
  post.update(dt, { night: env.night, warmth: state.style === 'film' ? .55 : state.style === 'clear' ? -.16 : .02 });
  return dt;
}

function uiUpdate() {
  labels.update(camera);
  const dx = camera.position.x - controls.target.x, dz = camera.position.z - controls.target.z;
  const needle = document.querySelector('#compass .needle');
  if (needle) needle.style.transform = `translateX(-50%) rotate(${Math.atan2(dx, dz)}rad)`;
  frames++;
  if (frames === 3) $('#loading').classList.add('hidden');
}

function animate() {
  requestAnimationFrame(animate);
  const dt = tick(Math.min(clock.getDelta(), .25));
  post.render(dt);
  uiUpdate();
}
animate();


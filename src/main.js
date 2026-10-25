import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createMaterials } from './world/materials.js';
import { Environment } from './core/sky.js';
import { Post } from './core/post.js';
import { Campus } from './world/campus.js';
import { createCharacter } from './world/character.js';
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
env.registerNight(campus.nightEmitters, campus.nightLights);

/* ---------------- 可操控小人 ---------------- */
const player = createCharacter();
scene.add(player.group);

// 固定出生点：校门内中轴广场（不再随机）
const spawn = new THREE.Vector3(-28, campus.groundY(-28, 120), 120);
player.group.position.copy(spawn);
let vy = 0, onGround = true;
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
  const f = clamp((held.w ? 1 : 0) - (held.s ? 1 : 0) - joy.y, -1, 1);
  const r = clamp((held.d ? 1 : 0) - (held.a ? 1 : 0) + joy.x, -1, 1);
  const len = Math.hypot(f, r);
  const pos = player.group.position;
  prevPos.copy(pos);
  let speed = 0;
  if (len > .04) {
    camera.getWorldDirection(camFwd); camFwd.y = 0;
    if (camFwd.lengthSq() < 1e-6) camFwd.set(0, 0, -1);
    camFwd.normalize();
    camRight.crossVectors(camFwd, camera.up).normalize();
    speed = held.shift ? 12 : 6;
    const mx = (camFwd.x * (f / len) + camRight.x * (r / len)) * speed * dt;
    const mz = (camFwd.z * (f / len) + camRight.z * (r / len)) * speed * dt;
    // 分轴碰撞：建筑/石头不可穿过；台阶与缓坡可走（单步抬升 ≤.35m），更高的台基需跳上去
    const stepOK = (x, z) => !campus.isBlocked(x, z, pos.y) && campus.groundY(x, z, pos.y) - pos.y <= .35;
    if (stepOK(pos.x + mx, pos.z)) pos.x += mx;
    if (stepOK(pos.x, pos.z + mz)) pos.z += mz;
    // 面朝移动方向：前进/横移按移动方向转身；S 后退保持朝向，背向退出（不转身）
    if (f >= 0) {
      const targetFacing = Math.atan2(camFwd.x * (f / len) + camRight.x * (r / len), camFwd.z * (f / len) + camRight.z * (r / len));
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
  const gy = campus.groundY(pos.x, pos.z, pos.y);
  if (pos.y <= gy) { pos.y = gy; vy = 0; onGround = true; }
  else onGround = false;
  // 相机跟随位移，保持环绕角度
  moveDelta.copy(pos).sub(prevPos);
  camera.position.add(moveDelta);
  controls.target.set(pos.x, pos.y + 1.62, pos.z);
  walkBlend += ((speed > 0 ? 1 : 0) - walkBlend) * Math.min(1, dt * 10);
  player.update(dt, speed, walkBlend > .1, env.night);
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
let frames = 0;
function animate() {
  requestAnimationFrame(animate);
  const rawDt = Math.min(clock.getDelta(), .25);
  const dt = Math.min(rawDt, .06);
  const t = clock.elapsedTime;

  // time transition
  if (Math.abs(state.targetTime - state.time) > .002) {
    state.time = lerp(state.time, state.targetTime, 1 - Math.exp(-rawDt * 4.2));
    env.setTime(state.time, false);
  }
  // camera tween
  if (!freeCam) updatePlayer(rawDt);
  if (!freeCam) autoAlignCamera(rawDt);
  env.followCamera(camera);
  env.update(rawDt);
  campus.update(dt, t, { night: env.night, season: state.season });
  controls.update();
  if (!freeCam) autoLevelCamera(rawDt);
  if (!freeCam) avoidCameraClip();
  post.update(dt, { night: env.night, warmth: state.style === 'film' ? .55 : state.style === 'clear' ? -.16 : .02 });
  post.render(dt);
  labels.update(camera);
  // compass
  const dx = camera.position.x - controls.target.x, dz = camera.position.z - controls.target.z;
  const needle = document.querySelector('#compass .needle');
  if (needle) needle.style.transform = `translateX(-50%) rotate(${Math.atan2(dx, dz)}rad)`;
  frames++;
  if (frames === 3) {
    $('#loading').classList.add('hidden');
    window.__READY__ = true;
  }
}
animate();

/* debug hooks */
window.__ZH = {
  THREE, scene, camera, renderer, controls, env, post, campus, mats, state, labels, player, spawn,
  setTime: (t) => setTime(t, false),
  setMode, setStyle,
  setSeason: (s) => campus.setSeason(s),
  setDensity: (d) => { campus.setDensity(d); campus.people.setDensity(d); },
  setViewNow: (pos, target) => { freeCam = true; camera.position.set(...pos); controls.target.set(...target); controls.update(); },
  follow: () => { freeCam = false; const p = player.group.position; controls.target.set(p.x, p.y + 1.62, p.z); camera.position.copy(controls.target).add(CAM_OFFSET); },
  teleport: teleportNear,
  pos: () => player.group.position.toArray(),
  jump: () => { if (onGround) { vy = JUMP_V; onGround = false; } return { vy, onGround }; },
  phys: () => ({ vy, onGround, gy: campus.groundY(player.group.position.x, player.group.position.z, player.group.position.y), y: player.group.position.y, freeCam }),
  select: (id) => { const l = campus.landmarks.find(x => x.id === id); if (l) selectLandmark(l); },
  rendererInfo: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
};

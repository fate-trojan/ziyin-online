import * as THREE from 'three';
import { tbox, tcyl, mergeGeometriesSafe } from '../util.js';

export function addMerged(parent, geoms, mat, { cast = true, receive = true } = {}) {
  if (!geoms.length) return null;
  const g = mergeGeometriesSafe(geoms);
  const mesh = new THREE.Mesh(g, mat);
  mesh.castShadow = cast; mesh.receiveShadow = receive;
  parent.add(mesh);
  return mesh;
}

export function addBalustrade(parent, mat, points, y, {
  h = 1.05, postEvery = 1.7, postW = 0.2, railW = 0.14, addEnds = true, railMat = null
} = {}) {
  const geoms = [];
  for (let s = 0; s < points.length - 1; s++) {
    const [x1, z1] = points[s], [x2, z2] = points[s + 1];
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.2) continue;
    const ry = Math.atan2(dx, dz);
    const n = Math.max(1, Math.ceil(len / postEvery));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = x1 + dx * t, z = z1 + dz * t;
      geoms.push(tbox(postW, h, postW, x, y + h / 2, z, ry));
      // small cap
      geoms.push(tbox(postW * 1.35, 0.12, postW * 1.35, x, y + h + 0.06, z, ry));
    }
    const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
    geoms.push(tbox(railW, 0.16, len, mx, y + h - 0.02, mz, ry));
    geoms.push(tbox(railW * 1.15, 0.1, len, mx, y + h * 0.55, mz, ry));
    geoms.push(tbox(railW * 0.7, 0.08, len, mx, y + 0.16, mz, ry));
  }
  return addMerged(parent, geoms, railMat || mat);
}

export function addSteps(parent, mat, x, z, width, height, depth, steps = 5, { ry = 0, sideMat = null } = {}) {
  const geoms = [];
  const sh = height / steps, sd = depth / steps;
  for (let i = 0; i < steps; i++) {
    const y = height - sh * (i + 0.5);
    const zz = sd * (i + 0.5);
    geoms.push(tbox(width, sh, sd, 0, y, zz, 0));
  }
  const mesh = addMerged(parent, geoms, mat);
  if (mesh) { mesh.position.set(x, 0, z); mesh.rotation.y = ry; }
  return mesh;
}

export function addStonePlinth(parent, mat, w, d, h, x, z, y = 0) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  base.position.set(0, h / 2, 0); base.castShadow = true; base.receiveShadow = true;
  g.add(base);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.25, 0.12, d + 0.25), mat);
  cap.position.set(0, h + 0.06, 0); cap.castShadow = true; cap.receiveShadow = true;
  g.add(cap);
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

export function addSmokePuff(parent, x, y, z, tex) {
  const mat = new THREE.SpriteMaterial({ map: tex, color: 0xd8d4ca, transparent: true, opacity: 0.14, depthWrite: false });
  const s = new THREE.Sprite(mat);
  s.position.set(x, y, z);
  s.scale.set(2.2, 2.2, 1);
  parent.add(s);
  return s;
}

export function makeGlowSprite(tex, color = 0xffc06a, scale = 2.2, opacity = 0.6) {
  const mat = new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
  const s = new THREE.Sprite(mat);
  s.scale.set(scale, scale, 1);
  return s;
}

export function addLantern(parent, mats, x, y, z, { scale = 1, glowTex, register } = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.38 * scale, 12, 8), mats.lantern.clone());
  body.scale.y = 1.35;
  body.userData.baseEmissive = 2.2;
  g.add(body);
  const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.26 * scale, 0.3 * scale, 0.12 * scale, 10), mats.lanternGold.clone());
  capTop.position.y = 0.52 * scale; g.add(capTop);
  const capBottom = capTop.clone(); capBottom.position.y = -0.52 * scale; g.add(capBottom);
  const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.02, 0.55 * scale, 6), mats.lanternGold);
  tassel.position.y = -0.88 * scale; g.add(tassel);
  if (glowTex) {
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff9a4a, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(3.2 * scale, 3.2 * scale, 1);
    glow.position.y = -0.05;
    glow.userData.nightOpacity = 0.55;
    g.add(glow);
    g.userData.glow = glow;
  }
  parent.add(g);
  if (register) register(g);
  return g;
}

export function addStele(parent, mats, x, z, { w = 1.3, h = 2.6, d = 0.38, ry = 0, textMat = null } = {}) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(w * 1.55, 0.36, d * 2.2), mats.stone);
  base.position.y = 0.18; base.castShadow = true; base.receiveShadow = true; g.add(base);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats.stoneDark);
  slab.position.y = h / 2 + 0.3; slab.castShadow = true; g.add(slab);
  if (textMat) {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.78, h * 0.78), new THREE.MeshBasicMaterial({ map: textMat, transparent: false }));
    face.position.set(0, h / 2 + 0.3, d / 2 + 0.012); g.add(face);
  }
  g.position.set(x, 0, z); g.rotation.y = ry;
  parent.add(g);
  return g;
}

export function addPlaque(parent, mats, textMat, x, y, z, { w = 3.6, h = 0.9, ry = 0 } = {}) {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.28, h + 0.24, 0.16), mats.woodDark);
  frame.position.set(0, 0, -0.05); frame.castShadow = true; g.add(frame);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: textMat, roughness: 0.6, metalness: 0.05, emissive: 0x1a1209, emissiveIntensity: 0.2 }));
  face.position.set(0, 0, 0.05); g.add(face);
  g.position.set(x, y, z); g.rotation.y = ry;
  parent.add(g);
  return g;
}

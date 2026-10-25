import * as THREE from 'three';

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const damp = (cur, target, lambda, dt) => lerp(cur, target, 1 - Math.exp(-lambda * dt));

// deterministic RNG
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCanvas(w = 512, h = 512) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function canvasTexture(canvas, { repeat = [1, 1], srgb = true, anisotropy = 8 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = anisotropy;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

export function textTexture(text, {
  w = 512, h = 192, bg = '#191b1c', color = '#d9b46a', font = 'bold 84px "Songti SC", "STSong", serif',
  border = null, vertical = false, pad = 18, letterSpacing = 0
} = {}) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  if (border) {
    g.strokeStyle = border; g.lineWidth = 6; g.strokeRect(9, 9, w - 18, h - 18);
  }
  g.fillStyle = color;
  g.font = font;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (vertical) {
    const chars = [...text];
    const step = h / (chars.length + 0.4);
    chars.forEach((ch, i) => g.fillText(ch, w / 2, step * (i + 0.7)));
  } else {
    if (letterSpacing) {
      const total = [...text].reduce((s, ch) => s + g.measureText(ch).width + letterSpacing, -letterSpacing);
      let x = (w - total) / 2;
      for (const ch of text) {
        const cw = g.measureText(ch).width;
        g.fillText(ch, x + cw / 2, h / 2);
        x += cw + letterSpacing;
      }
    } else {
      g.fillText(text, w / 2, h / 2 + 2);
    }
  }
  return canvasTexture(c, { srgb: true });
}

export function addBox(parent, mat, w, h, d, x, y, z, ry = 0, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.castShadow = cast; m.receiveShadow = receive;
  parent.add(m);
  return m;
}

export function addCyl(parent, mat, rt, rb, h, x, y, z, seg = 12, { cast = true } = {}) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = cast; m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function mergeGroup(geometries, material, { cast = true, receive = true } = {}) {
  if (!geometries.length) return null;
  // each geometry must be non-indexed with position/normal/uv
  const merged = mergeGeometriesSafe(geometries);
  const mesh = new THREE.Mesh(merged, material);
  mesh.castShadow = cast; mesh.receiveShadow = receive;
  return mesh;
}

export function mergeGeometriesSafe(geometries) {
  if (!geometries || geometries.length === 0) {
    const empty = new THREE.BufferGeometry();
    empty.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
    empty.setAttribute('normal', new THREE.Float32BufferAttribute([], 3));
    empty.setAttribute('uv', new THREE.Float32BufferAttribute([], 2));
    return empty;
  }
  const attrs = ['position', 'normal', 'uv'];
  let total = 0;
  for (const g of geometries) {
    if (!g.index) total += g.attributes.position.count;
    else total += g.index.count;
  }
  const out = new THREE.BufferGeometry();
  for (const a of attrs) {
    const itemSize = geometries[0].attributes[a].itemSize;
    const arr = new Float32Array(total * itemSize);
    let off = 0;
    for (const g of geometries) {
      const src = g.attributes[a];
      if (g.index) {
        const idx = g.index.array;
        for (let i = 0; i < idx.length; i++) {
          const j = idx[i];
          for (let k = 0; k < itemSize; k++) arr[off++] = src.array[j * itemSize + k];
        }
      } else {
        arr.set(src.array, off); off += src.array.length;
      }
    }
    out.setAttribute(a, new THREE.BufferAttribute(arr, itemSize));
  }
  out.computeBoundingSphere();
  return out;
}

export function tbox(w, h, d, x, y, z, ry = 0, rx = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Matrix4();
  m.makeRotationFromEuler(new THREE.Euler(rx, ry, rz));
  m.setPosition(x, y, z);
  g.applyMatrix4(m);
  return g;
}

export function tcyl(rt, rb, h, x, y, z, seg = 10, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  const m = new THREE.Matrix4();
  m.makeRotationFromEuler(new THREE.Euler(rx, ry, rz));
  m.setPosition(x, y, z);
  g.applyMatrix4(m);
  return g;
}

export function projectOnGround(x, z) { return new THREE.Vector3(x, 0, z); }

export function disposeObject(obj) {
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
      else o.material.dispose();
    }
  });
}

export function makeLabelSprite(text, opts = {}) { return null; }

import * as THREE from 'three';
import { mergeGeometriesSafe } from '../util.js';

const TAU = Math.PI * 2;

function orientUp(g) {
  if (!g || !g.attributes || !g.attributes.position) return g;
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  const swapVerts = (a, b) => {
    for (const attr of [pos, uv, g.attributes.normal]) {
      if (!attr) continue;
      const n = attr.itemSize;
      for (let k = 0; k < n; k++) {
        const t = attr.array[a * n + k];
        attr.array[a * n + k] = attr.array[b * n + k];
        attr.array[b * n + k] = t;
      }
    }
  };
  const faceUp = (a, b, c) => {
    const ax = pos.getX(a), ay = pos.getY(a), az = pos.getZ(a);
    const bx = pos.getX(b), by = pos.getY(b), bz = pos.getZ(b);
    const cx = pos.getX(c), cy = pos.getY(c), cz = pos.getZ(c);
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const ny = uz * vx - ux * vz;
    return ny >= 0;
  };
  if (g.index) {
    const idx = g.index.array;
    for (let t = 0; t < idx.length; t += 3) {
      if (!faceUp(idx[t], idx[t + 1], idx[t + 2])) {
        const tmp = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = tmp;
      }
    }
    g.index.needsUpdate = true;
  } else {
    for (let t = 0; t < pos.count; t += 3) {
      if (!faceUp(t, t + 1, t + 2)) swapVerts(t + 1, t + 2);
    }
  }
  g.computeVertexNormals();
  return g;
}



function gridGeometry(rows, cols, fn) {
  // fn(i,j) -> {p:[x,y,z], uv:[u,v]}
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= rows; i++) {
    for (let j = 0; j <= cols; j++) {
      const r = fn(i / rows, j / cols, i, j);
      pos.push(r.p[0], r.p[1], r.p[2]);
      uv.push(r.uv[0], r.uv[1]);
    }
  }
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const a = i * (cols + 1) + j;
      const b = a + 1;
      const c = a + cols + 1;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function curveLift(t, power = 8) { return Math.pow(Math.max(0, Math.abs(t)), power); }

/** Truncated hip roof (a ring) from outer eave to an inner rectangle at height H. */
export function hipRingGeometry(Wo, Do, Wi, Di, H, { cornerLift = 1.0, sag = 0.16, steps = 18, depth = 6 } = {}) {
  const geos = [];
  // front z=+Do/2 -> +Di/2
  geos.push(gridGeometry(depth, steps, (q, u) => {
    const uu = u - 0.5;
    const xo = uu * Wo, xi = uu * Wi;
    const x = THREE.MathUtils.lerp(xo, xi, q);
    const z = THREE.MathUtils.lerp(Do / 2, Di / 2, q);
    const lift = cornerLift * curveLift(uu * 2) * Math.pow(1 - q, 1.7);
    const dip = -sag * (1 - Math.pow(uu * 2, 2)) * Math.pow(1 - q, 2.2);
    return { p: [x, H * Math.pow(q, 1.18) + lift + dip, z], uv: [uo(uu, Wo) / 2.2, (q * (Do / 2 - Di / 2 + H)) / 2.2] };
  }));
  // back z=-Do/2 -> -Di/2
  geos.push(gridGeometry(depth, steps, (q, u) => {
    const uu = u - 0.5;
    const xo = uu * Wo, xi = uu * Wi;
    const x = THREE.MathUtils.lerp(xo, xi, q);
    const z = -THREE.MathUtils.lerp(Do / 2, Di / 2, q);
    const lift = cornerLift * curveLift(uu * 2) * Math.pow(1 - q, 1.7);
    const dip = -sag * (1 - Math.pow(uu * 2, 2)) * Math.pow(1 - q, 2.2);
    return { p: [x, H * Math.pow(q, 1.18) + lift + dip, z], uv: [uo(uu, Wo) / 2.2, (q * (Do / 2 - Di / 2 + H)) / 2.2] };
  }));
  // right x=+Wo/2 -> +Wi/2
  geos.push(gridGeometry(depth, steps, (q, u) => {
    const uu = u - 0.5;
    const zo = uu * Do, zi = uu * Di;
    const z = THREE.MathUtils.lerp(zo, zi, q);
    const x = THREE.MathUtils.lerp(Wo / 2, Wi / 2, q);
    const lift = cornerLift * curveLift(uu * 2) * Math.pow(1 - q, 1.7);
    const dip = -sag * (1 - Math.pow(uu * 2, 2)) * Math.pow(1 - q, 2.2);
    return { p: [x, H * Math.pow(q, 1.18) + lift + dip, z], uv: [uo(uu, Do) / 2.2, (q * (Wo / 2 - Wi / 2 + H)) / 2.2] };
  }));
  // left
  geos.push(gridGeometry(depth, steps, (q, u) => {
    const uu = u - 0.5;
    const zo = uu * Do, zi = uu * Di;
    const z = THREE.MathUtils.lerp(zo, zi, q);
    const x = -THREE.MathUtils.lerp(Wo / 2, Wi / 2, q);
    const lift = cornerLift * curveLift(uu * 2) * Math.pow(1 - q, 1.7);
    const dip = -sag * (1 - Math.pow(uu * 2, 2)) * Math.pow(1 - q, 2.2);
    return { p: [x, H * Math.pow(q, 1.18) + lift + dip, z], uv: [uo(uu, Do) / 2.2, (q * (Wo / 2 - Wi / 2 + H)) / 2.2] };
  }));
  return orientUp(mergeGeometriesSafe(geos));
}

function uo(uu, W) { return uu * W; }

/** Gable roof surface (two curved slopes), eaves at y=0, ridge at y=H. */
export function gableRoofGeometry(W, D, H, { cornerLift = 0.75, sag = 0.12, steps = 20, depth = 10 } = {}) {
  const g = gridGeometry(depth, steps, (a, b) => {
    const z = (b - 0.5) * D;
    const x = (a - 0.5) * W;
    const t = Math.max(0, 1 - Math.abs(z) / (D / 2));
    const y = H * Math.pow(t, 1.15)
      + cornerLift * curveLift(x / (W / 2)) * curveLift(z / (D / 2), 6)
      - sag * Math.pow(1 - Math.pow(x / (W / 2), 2), 2) * Math.pow(Math.abs(z) / (D / 2), 7);
    return { p: [x, y, z], uv: [x / 2.2, (D / 2 - Math.abs(z)) / 2.2] };
  });
  return orientUp(g);
}

/** Full hip roof with a ridge segment. */
export function hipRoofGeometry(W, D, H, { ridgeRatio = 0.38, cornerLift = 0.85, sag = 0.1, steps = 22, depth = 14 } = {}) {
  const hw = W / 2, hd = D / 2, rh = W * ridgeRatio / 2;
  const g = gridGeometry(depth, steps, (a, b) => {
    const x = (a - 0.5) * W;
    const z = (b - 0.5) * D;
    const tz = 1 - Math.abs(z) / hd;
    const tx = 1 - Math.max(0, (Math.abs(x) - rh) / (hw - rh));
    let t = Math.max(0, Math.min(tz, tx));
    const y = H * Math.pow(t, 1.12)
      + cornerLift * curveLift(x / hw) * curveLift(z / hd, 6)
      - sag * Math.pow(1 - Math.pow(x / hw, 2), 2) * Math.pow(Math.abs(z) / hd, 7);
    return { p: [x, y, z], uv: [x / 2.2, (hd - Math.abs(z)) / 2.2] };
  });
  return orientUp(g);
}

export function makeRidgeTube(points, radius = 0.18, mat, parent, { tip = 0.7 } = {}) {
  const pts = points.map(p => new THREE.Vector3(...p));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.35);
  const geo = new THREE.TubeGeometry(curve, Math.max(10, pts.length * 5), radius, 5, false);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true; mesh.receiveShadow = true;
  parent.add(mesh);
  if (tip) {
    const end = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    const dir = new THREE.Vector3().subVectors(end, prev).normalize();
    const tipGeo = new THREE.ConeGeometry(radius * 1.5, tip, 5);
    const tipMesh = new THREE.Mesh(tipGeo, mat);
    tipMesh.position.copy(end).addScaledVector(dir, tip * 0.5);
    tipMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    tipMesh.castShadow = true;
    parent.add(tipMesh);
  }
  return mesh;
}

export function addChiwen(parent, x, y, z, dir, mat, scale = 1) {
  // stylized upturned ridge-end ornament
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = dir > 0 ? 0 : Math.PI;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42 * scale, 0.9 * scale, 0.55 * scale), mat);
  body.position.set(0, 0.28 * scale, 0);
  body.rotation.z = -0.24 * dir;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.28 * scale, 1.15 * scale, 4), mat);
  head.position.set(0.05 * scale, 0.95 * scale, 0);
  head.rotation.z = -0.4 * dir;
  head.castShadow = true;
  g.add(head);
  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.35 * scale, 0.09 * scale, 4, 8, Math.PI * 1.1), mat);
  tail.position.set(-0.05, 0.55 * scale, 0);
  tail.rotation.set(Math.PI / 2, 0, 0.2);
  g.add(tail);
  parent.add(g);
  return g;
}

export function addEaveFascia(parent, W, D, y, mat, { thickness = 0.3, inset = 0.12 } = {}) {
  const t = thickness;
  const pieces = [
    [W, t, inset, 0, y - t / 2, D / 2 - inset / 2],
    [W, t, inset, 0, y - t / 2, -D / 2 + inset / 2],
    [inset, t, D, W / 2 - inset / 2, y - t / 2, 0],
    [inset, t, D, -W / 2 + inset / 2, y - t / 2, 0]
  ];
  for (const [w, h, d, x, py, z] of pieces) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, py, z);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
  }
}

function gableWallGeometry(W, D, H, thickness = 0.25) {
  // vertical triangle at x = ±W/2, from y=0 to ridge H, z -D/2..D/2
  const half = D / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-half, 0);
  shape.lineTo(half, 0);
  shape.quadraticCurveTo(0, H * 1.02, -half, 0);
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 18 });
  g.rotateY(Math.PI / 2);
  g.translate(thickness / 2, 0, 0);
  return g;
}

/**
 * 歇山 roof: lower hip skirt + upper gable roof + gable walls + ridges.
 * The group's local origin is at the eave plane, centered.
 */
export function xieshanRoofGroup({
  W, D, H, skirtH = H * 0.48, gableWidth = W * 0.7,
  tileMat, ridgeMat, gableMat, fasciaMat, cornerLift = 0.9
} = {}) {
  const group = new THREE.Group();
  const outerW = W, outerD = D;
  const innerW = Math.max(W * 0.42, W - 2.2 * 2.2);
  const innerD = Math.max(D * 0.42, D - 2.0 * 2.2);
  const gableW = gableWidth;
  const gableD = innerD * 1.04;
  const lower = new THREE.Mesh(hipRingGeometry(outerW, outerD, innerW, innerD, skirtH, { cornerLift, steps: 22, depth: 5 }), tileMat);
  lower.castShadow = true; lower.receiveShadow = true;
  group.add(lower);
  addEaveFascia(group, outerW + 0.04, outerD + 0.04, 0, fasciaMat, { thickness: 0.28, inset: 0.16 });
  // lower hip ridges (4 corners)
  const ri = skirtH;
  const corners = [
    [innerW / 2, innerD / 2, ri, outerW / 2, outerD / 2],
    [innerW / 2, -innerD / 2, ri, outerW / 2, -outerD / 2],
    [-innerW / 2, innerD / 2, ri, -outerW / 2, outerD / 2],
    [-innerW / 2, -innerD / 2, ri, -outerW / 2, -outerD / 2]
  ];
  for (const [x1, z1, y1, x2, z2] of corners) {
    makeRidgeTube([
      [x1, y1 + 0.02, z1],
      [x1 * 0.82 + x2 * 0.18, y1 * 0.9, z1 * 0.82 + z2 * 0.18],
      [x2 * 0.97, 0.55, z2 * 0.97],
      [x2 * 1.02, 0.12, z2 * 1.02],
      [x2 * 1.06, 0.35, z2 * 1.06]
    ], 0.15, ridgeMat, group, { tip: 0.45 });
  }
  // upper gable roof, starting at skirtH
  const upper = new THREE.Mesh(gableRoofGeometry(gableW, gableD, H - skirtH, { cornerLift: cornerLift * 0.8, steps: 20, depth: 10 }), tileMat);
  upper.position.y = skirtH;
  upper.castShadow = true; upper.receiveShadow = true;
  group.add(upper);
  // gable walls at both ends
  if (gableMat) {
    const wallH = H - skirtH;
    const gw = gableWallGeometry(0, gableD, wallH, 0.34);
    const left = new THREE.Mesh(gw, gableMat);
    left.position.set(-gableW / 2 + 0.02, skirtH, 0);
    left.castShadow = true; left.receiveShadow = true;
    group.add(left);
    const right = new THREE.Mesh(gw, gableMat);
    right.position.set(gableW / 2 - 0.02, skirtH, 0);
    right.castShadow = true; right.receiveShadow = true;
    group.add(right);
    // bargeboards along gable slopes
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        makeRidgeTube([
          [sx * gableW / 2, skirtH + 0.05, sz * gableD / 2],
          [sx * gableW / 2, skirtH + (H - skirtH) * 0.55, sz * gableD * 0.24],
          [sx * gableW / 2, H + 0.06, 0]
        ], 0.1, ridgeMat, group, { tip: 0 });
      }
    }
    // circular medallion on gable
    const med = new THREE.Mesh(new THREE.CircleGeometry(0.52, 20), new THREE.MeshStandardMaterial({ color: 0xb08a45, metalness: .45, roughness: .45 }));
    med.position.set(gableW / 2 + 0.19, skirtH + (H - skirtH) * 0.42, 0);
    med.rotation.y = Math.PI / 2;
    group.add(med);
    const med2 = med.clone(); med2.position.x = -gableW / 2 - 0.19; med2.rotation.y = -Math.PI / 2; group.add(med2);
  }
  // main ridge
  const rl = gableW * 0.96;
  makeRidgeTube([
    [-rl / 2, H + 0.02, 0], [-rl / 2 + 0.12, H + 0.28, 0], [0, H + 0.34, 0],
    [rl / 2 - 0.12, H + 0.28, 0], [rl / 2, H + 0.02, 0]
  ], 0.2, ridgeMat, group, { tip: 0.55 });
  addChiwen(group, -rl / 2, H + 0.22, 0, -1, ridgeMat, 1.0);
  addChiwen(group, rl / 2, H + 0.22, 0, 1, ridgeMat, 1.0);
  return group;
}

/** Full hip roof group with ridges. */
export function hipRoofGroup({ W, D, H, tileMat, ridgeMat, fasciaMat, ridgeRatio = 0.4, cornerLift = 0.85 } = {}) {
  const group = new THREE.Group();
  const roof = new THREE.Mesh(hipRoofGeometry(W, D, H, { ridgeRatio, cornerLift }), tileMat);
  roof.castShadow = true; roof.receiveShadow = true;
  group.add(roof);
  addEaveFascia(group, W, D, 0, fasciaMat, { thickness: 0.24, inset: 0.12 });
  const rl = W * ridgeRatio;
  const hw = W / 2, hd = D / 2, rh = rl / 2;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    makeRidgeTube([
      [sx * rh, H + 0.02, 0],
      [sx * (rh + hw) / 2, H * 0.55, sz * hd * 0.5],
      [sx * hw * 0.99, 0.6, sz * hd * 0.99],
      [sx * hw * 1.03, 0.18, sz * hd * 1.03],
      [sx * hw * 1.07, 0.42, sz * hd * 1.07]
    ], 0.14, ridgeMat, group, { tip: 0.4 });
  }
  makeRidgeTube([
    [-rh, H + 0.02, 0], [-rh + 0.1, H + 0.25, 0], [0, H + 0.30, 0],
    [rh - 0.1, H + 0.25, 0], [rh, H + 0.02, 0]
  ], 0.18, ridgeMat, group, { tip: 0.5 });
  addChiwen(group, -rh, H + 0.2, 0, -1, ridgeMat, 0.85);
  addChiwen(group, rh, H + 0.2, 0, 1, ridgeMat, 0.85);
  return group;
}

/** Double-eave roof: lower hip ring at eaveY, upper xieshan at upperEaveY. */
export function doubleEaveRoof({
  W, D, innerW, innerD, lowerH, upperW, upperD, upperH,
  eaveY, upperEaveY, tileMat, ridgeMat, gableMat, fasciaMat
} = {}) {
  const group = new THREE.Group();
  group.position.y = eaveY;
  const lower = new THREE.Mesh(hipRingGeometry(W, D, innerW, innerD, lowerH, { cornerLift: 1.15, steps: 24, depth: 6 }), tileMat);
  lower.castShadow = true; lower.receiveShadow = true;
  group.add(lower);
  addEaveFascia(group, W, D, 0, fasciaMat, { thickness: 0.34, inset: 0.18 });
  // lower hip ridges
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    makeRidgeTube([
      [sx * innerW / 2, lowerH + 0.02, sz * innerD / 2],
      [sx * (innerW + W) / 4, lowerH * 0.55, sz * (innerD + D) / 4],
      [sx * W / 2 * 0.98, 0.6, sz * D / 2 * 0.98],
      [sx * W / 2 * 1.025, 0.18, sz * D / 2 * 1.025],
      [sx * W / 2 * 1.06, 0.42, sz * D / 2 * 1.06]
    ], 0.16, ridgeMat, group, { tip: 0.45 });
  }
  // upper roof
  const upperEaveLocal = upperEaveY - eaveY;
  const upper = xieshanRoofGroup({
    W: upperW, D: upperD, H: upperH, skirtH: upperH * 0.46,
    gableWidth: upperW * 0.72, tileMat, ridgeMat, gableMat, fasciaMat, cornerLift: 0.95
  });
  upper.position.y = upperEaveLocal;
  group.add(upper);
  return group;
}

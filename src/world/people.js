import * as THREE from 'three';
import { mergeGeometriesSafe, mulberry32, tcyl, tbox } from '../util.js';

const PATHS = [
  // main axis (gate to hall)
  [[-28, 150], [-28, 96], [-31, 80], [-31, 58], [-32, 40], [-34, 20], [-36, 2]],
  // around pond
  [[-44, 74], [-36, 84], [-20, 84], [-12, 74], [-20, 64], [-36, 64], [-44, 74]],
  // teaching courtyard
  [[-48, 52], [-18, 52], [-18, 8], [-48, 8], [-48, 52]],
  // track
  [[72, -74], [72, 90], [72, 90]],
  // gate plaza
  [[-52, 132], [-4, 132], [-4, 148], [-52, 148], [-52, 132]],
  // academy courtyard
  [[-112, 118], [-66, 118], [-66, 96], [-112, 96], [-112, 118]],
  // hill path
  [[18, -64], [30, -74], [40, -82], [47, -87]],
  // track south
  [[38, 96], [108, 96], [108, 60], [38, 60], [38, 96]],
];

function bodyGeo() {
  // torso + backpack merged
  const torso = new THREE.CapsuleGeometry(.19, .55, 4, 8);
  torso.translate(0, 1.05, 0);
  const bag = new THREE.BoxGeometry(.32, .4, .18);
  bag.translate(0, 1.08, -.2);
  return mergeGeometriesSafe([torso, bag]);
}

function legGeo() {
  const l = new THREE.BoxGeometry(.14, .78, .17); l.translate(-.1, .4, 0);
  const r = new THREE.BoxGeometry(.14, .78, .17); r.translate(.1, .4, 0);
  return mergeGeometriesSafe([l, r]);
}

export class People {
  constructor(scene, mats, count = 64) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.max = count;
    this.density = 1;
    this.night = 0;
    this.rnd = mulberry32(909);
    this.people = [];
    const start = PATHS[0];
    for (let i = 0; i < this.max; i++) {
      const path = PATHS[Math.floor(this.rnd() * PATHS.length)];
      this.people.push({
        path,
        t: this.rnd(),
        speed: .7 + this.rnd() * .8,
        offset: (this.rnd() - .5) * 2.4,
        phase: this.rnd() * 6.28,
        bag: this.rnd() < .7,
        dir: this.rnd() < .5 ? 1 : -1,
      });
    }
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf1efe6, roughness: .85 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xd8b18c, roughness: .8 });
    const legMat = new THREE.MeshStandardMaterial({ color: 0x2f3440, roughness: .9 });
    this.bodyMesh = new THREE.InstancedMesh(bodyGeo(), bodyMat, this.max);
    this.headMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(.16, 8, 6), headMat, this.max);
    this.legMesh = new THREE.InstancedMesh(legGeo(), legMat, this.max);
    for (const m of [this.bodyMesh, this.headMesh, this.legMesh]) {
      m.castShadow = true; m.receiveShadow = false; m.frustumCulled = false;
      this.group.add(m);
    }
    const colors = [0xf4f1e8, 0xdfe4e6, 0x9eb4c4, 0xcfd8d2, 0xe7dfd0, 0xb9c7d6];
    for (let i = 0; i < this.max; i++) {
      this.bodyMesh.setColorAt(i, new THREE.Color(colors[Math.floor(this.rnd() * colors.length)]));
    }
    this.bodyMesh.instanceColor.needsUpdate = true;
    this._dummy = new THREE.Object3D();
    this._a = new THREE.Vector3();
    this._b = new THREE.Vector3();
  }

  setDensity(d) { this.density = d; }
  setNight(n) { this.night = n; }

  update(dt, t) {
    const active = Math.floor(this.max * Math.min(1, Math.max(0, this.density)) * (1 - this.night * .45));
    this.bodyMesh.count = active; this.headMesh.count = active; this.legMesh.count = active;
    for (let i = 0; i < active; i++) {
      const p = this.people[i];
      const pts = p.path;
      let t0 = p.t;
      // travel along segment lengths
      const segs = [];
      let total = 0;
      for (let s = 0; s < pts.length - 1; s++) {
        const len = Math.hypot(pts[s + 1][0] - pts[s][0], pts[s + 1][1] - pts[s][1]);
        segs.push({ len, a: pts[s], b: pts[s + 1] }); total += len;
      }
      let d = ((t * p.speed + p.phase * 5) % total + total) % total;
      let seg = segs[0];
      for (const s of segs) { if (d <= s.len) { seg = s; break; } d -= s.len; }
      const k = Math.min(1, d / Math.max(.001, seg.len));
      const x = seg.a[0] + (seg.b[0] - seg.a[0]) * k;
      const z = seg.a[1] + (seg.b[1] - seg.a[1]) * k;
      const ang = Math.atan2(seg.b[0] - seg.a[0], seg.b[1] - seg.a[1]);
      const bob = Math.abs(Math.sin(t * 5 + p.phase)) * .035;
      const offX = Math.cos(ang) * p.offset, offZ = -Math.sin(ang) * p.offset;
      const ox = x + offX, oz = z + offZ;
      this._dummy.position.set(ox, bob, oz);
      this._dummy.rotation.y = ang + (p.dir < 0 ? Math.PI : 0);
      this._dummy.scale.setScalar(.95 + (i % 5) * .02);
      this._dummy.updateMatrix();
      this.bodyMesh.setMatrixAt(i, this._dummy.matrix);
      this.legMesh.setMatrixAt(i, this._dummy.matrix);
      this._dummy.position.y = bob + 1.74;
      this._dummy.updateMatrix();
      this.headMesh.setMatrixAt(i, this._dummy.matrix);
    }
    this.bodyMesh.instanceMatrix.needsUpdate = true;
    this.headMesh.instanceMatrix.needsUpdate = true;
    this.legMesh.instanceMatrix.needsUpdate = true;
  }
}

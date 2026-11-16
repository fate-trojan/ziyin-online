import * as THREE from 'three';
import { mulberry32 } from '../util.js';

/**
 * 剧本用动效集合：银杏飘落、鲤鱼跃起、鸟群飞过。
 * 全部由 dt 驱动，统一登记在 Effects.update 中；不参与碰撞。
 */
const RIVER_SURF = -1.2;

export class Effects {
  constructor(campus) {
    this.campus = campus;
    this.group = new THREE.Group();
    campus.group.add(this.group);
    this._buildGinkgo();
    this._buildFish();
    this._buildBirds();
  }

  /* ---------------- 银杏飘落 ---------------- */
  _buildGinkgo() {
    const N = 260;
    const geo = new THREE.PlaneGeometry(.34, .24);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xe0b548, roughness: .9, side: THREE.DoubleSide, transparent: true, opacity: 1,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, N);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.visible = false;
    this.group.add(mesh);
    const rnd = mulberry32(7712);
    const p = [];
    for (let i = 0; i < N; i++) {
      p.push({
        x: -40 + rnd() * 33, z: -88 + rnd() * 22,
        y: 7 + rnd() * 4.5,
        vy: .55 + rnd() * .55,
        sway: .25 + rnd() * .5,
        phase: rnd() * Math.PI * 2,
        spin: (rnd() - .5) * 2.6,
        rot: rnd() * Math.PI * 2,
        s: .7 + rnd() * .7,
        delay: rnd() * 2.2,
        landed: 0,
      });
    }
    this.ginkgo = { mesh, p, on: false, t: 0, dur: 7.5 };
    this._ginkgoDummy = new THREE.Object3D();
  }

  fallGinkgo(dur = 7.5) {
    const g = this.ginkgo;
    g.on = true; g.t = 0; g.dur = dur;
    g.mesh.visible = true;
    for (const q of g.p) {
      q.y = 7 + Math.random() * 4.5;
      q.landed = 0;
    }
  }

  _updateGinkgo(dt) {
    const g = this.ginkgo;
    if (!g.on) return;
    g.t += dt;
    const d = this._ginkgoDummy;
    let alive = 0;
    for (let i = 0; i < g.p.length; i++) {
      const q = g.p[i];
      if (g.t < q.delay) {
        d.position.set(q.x, q.y, q.z);
        d.scale.setScalar(0);
        d.updateMatrix();
        g.mesh.setMatrixAt(i, d.matrix);
        alive++;
        continue;
      }
      if (q.landed === 0) {
        q.y -= q.vy * dt;
        q.x += Math.sin(g.t * 1.3 + q.phase) * q.sway * dt + .12 * dt;
        q.rot += q.spin * dt;
        const gy = 0.05;
        if (q.y <= gy) { q.y = gy; q.landed = g.t; }
        alive++;
      } else {
        const age = g.t - q.landed;
        if (age > 2.6) continue;
        alive++;
      }
      const fade = q.landed ? Math.max(0, 1 - (g.t - q.landed) / 2.6) : 1;
      d.position.set(q.x, q.y, q.z);
      d.rotation.set(Math.sin(q.rot) * .9, q.rot * .7, Math.cos(q.rot) * .6);
      d.scale.setScalar(q.s * Math.min(1, fade * 1.6));
      d.updateMatrix();
      g.mesh.setMatrixAt(i, d.matrix);
    }
    g.mesh.instanceMatrix.needsUpdate = true;
    if (alive === 0 || g.t > g.dur) { g.on = false; g.mesh.visible = false; }
  }

  /* ---------------- 鲤鱼跃起 ---------------- */
  _buildFish() {
    const g = new THREE.Group();
    g.visible = false;
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(.28, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xd9542f, roughness: .42, metalness: .15 })
    );
    body.scale.set(.55, .62, 1.5);
    g.add(body);
    const tail = new THREE.Mesh(
      new THREE.ConeGeometry(.2, .42, 6),
      new THREE.MeshStandardMaterial({ color: 0xe2703f, roughness: .5, side: THREE.DoubleSide })
    );
    tail.rotation.x = -Math.PI / 2;
    tail.position.z = -.55;
    tail.scale.set(1, .35, 1);
    g.add(tail);
    const fin = new THREE.Mesh(
      new THREE.ConeGeometry(.12, .24, 5),
      new THREE.MeshStandardMaterial({ color: 0xef8a55, roughness: .5, side: THREE.DoubleSide })
    );
    fin.position.set(0, .18, .1);
    fin.rotation.z = Math.PI;
    g.add(fin);
    this.group.add(g);

    // 水花：一圈细小球，触发时向外抛起
    const splash = new THREE.Group();
    splash.visible = false;
    const smat = new THREE.MeshBasicMaterial({ color: 0xd8ecf2, transparent: true, opacity: .85, depthWrite: false });
    const drops = [];
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(.045 + Math.random() * .04, 6, 5), smat);
      splash.add(m);
      const a = Math.random() * Math.PI * 2;
      drops.push({ m, a, v: .5 + Math.random() * .8, h: .5 + Math.random() * .7, ph: Math.random() });
    }
    this.group.add(splash);
    this.fish = { g, splash, drops, mat: smat, on: false, t: 0, x: 0, z: 0, dir: 0 };
  }

  jumpFish(x, z, dir = 0) {
    const f = this.fish;
    f.on = true; f.t = 0; f.x = x; f.z = z; f.dir = dir;
    f.g.visible = true; f.splash.visible = true;
    f.mat.opacity = .85;
  }

  _updateFish(dt) {
    const f = this.fish;
    if (!f.on) return;
    f.t += dt;
    const T = 1.15;
    const u = Math.min(1, f.t / T);
    const y = RIVER_SURF + 2.9 * Math.sin(Math.PI * u);
    const dx = Math.sin(f.dir) * (u * 3.0 - 1.5);
    const dz = Math.cos(f.dir) * (u * 3.0 - 1.5);
    f.g.position.set(f.x + dx, y, f.z + dz);
    f.g.rotation.set(-Math.cos(Math.PI * u) * .55, f.dir, 0);
    f.g.rotation.z = Math.sin(u * 12) * .12;
    // 水花只在起跳和落水瞬间出现
    const sp = f.t < .35 ? 1 : f.t > T - .2 ? 1 : 0;
    f.splash.position.set(f.x - Math.sin(f.dir) * 1.4, RIVER_SURF + .02, f.z - Math.cos(f.dir) * 1.4);
    for (const d of f.drops) {
      const life = Math.min(1, f.t / .5) * (sp ? 1 : 0);
      d.m.position.set(Math.cos(d.a) * d.v * life, Math.max(0, Math.sin(d.ph * Math.PI) * d.h * life) + .02, Math.sin(d.a) * d.v * life);
      d.m.scale.setScalar(Math.max(.001, life));
    }
    f.mat.opacity = .85 * (1 - Math.min(1, f.t / T));
    if (u >= 1 && Math.sin(Math.PI * u) <= 0) {
      f.on = false; f.g.visible = false; f.splash.visible = false;
    }
  }

  /* ---------------- 鸟群飞过 ---------------- */
  _buildBirds() {
    const rnd = mulberry32(3321);
    const mat = new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: .85, side: THREE.DoubleSide });
    const birds = [];
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.ConeGeometry(.11, .5, 5), mat);
      body.rotation.x = Math.PI / 2;
      g.add(body);
      const wingGeo = new THREE.PlaneGeometry(.62, .16);
      const wl = new THREE.Mesh(wingGeo, mat);
      wl.position.x = -.32;
      const wr = new THREE.Mesh(wingGeo, mat);
      wr.position.x = .32;
      g.add(wl, wr);
      g.visible = false;
      this.group.add(g);
      birds.push({
        g, wl, wr,
        phase: rnd() * Math.PI * 2,
        off: new THREE.Vector3((rnd() - .5) * 10, (rnd() - .5) * 5, (rnd() - .5) * 8),
      });
    }
    this.birds = { list: birds, on: false, t: 0, from: null, to: null, dur: 9 };
  }

  flyBirds(from, to, dur = 9, spread = 1) {
    const b = this.birds;
    b.on = true; b.t = 0; b.dur = dur;
    b.spread = spread;
    b.from = new THREE.Vector3(...from);
    b.to = new THREE.Vector3(...to);
    for (const q of b.list) q.g.visible = true;
  }

  _updateBirds(dt) {
    const b = this.birds;
    if (!b.on) return;
    b.t += dt;
    const u = Math.min(1, b.t / b.dur);
    const e = u * u * (3 - 2 * u);
    for (const q of b.list) {
      const sp = b.spread || 1;
      const cu = Math.min(1, Math.max(0, e + (q.off.z * sp / 40)));
      const x = b.from.x + (b.to.x - b.from.x) * cu + q.off.x * .35 * sp;
      const z = b.from.z + (b.to.z - b.from.z) * cu + q.off.z * sp;
      const y = b.from.y + (b.to.y - b.from.y) * cu + q.off.y * sp + Math.sin(b.t * 1.4 + q.phase) * .55;
      q.g.position.set(x, y, z);
      const dir = Math.atan2(b.to.x - b.from.x, b.to.z - b.from.z);
      q.g.rotation.set(0, dir + Math.PI, 0);
      const flap = Math.sin(b.t * 9 + q.phase) * .7;
      q.wl.rotation.y = flap;
      q.wr.rotation.y = -flap;
      q.wl.rotation.z = Math.abs(flap) * .12;
      q.wr.rotation.z = -Math.abs(flap) * .12;
    }
    if (u >= 1) {
      b.on = false;
      for (const q of b.list) q.g.visible = false;
    }
  }

  update(dt) {
    this._updateGinkgo(dt);
    this._updateFish(dt);
    this._updateBirds(dt);
  }
}

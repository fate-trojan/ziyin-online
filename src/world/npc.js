import * as THREE from 'three';
import { createCharacter } from './character.js';

/**
 * 剧本里的铜像 NPC：可站立、可被主角带路跟随、可鞠躬。
 * 铜像直接用校园里的坐像模型（`model`），不做骨骼动画，跟随只做整体平移。
 * 跟随采用「面包屑」——记录主角走过的点列，NPC 沿同一轨迹退后 1.35m 走，
 * 因此上楼梯、穿门洞都不会卡墙，也不需要额外的寻路网格。
 */
const WALK_SPEED = 6.0;
const BACK_DIST = 1.35;

export class Npc {
  constructor(campus, { name, x, z, facing = 0, model = null, height = 0 }) {
    this.campus = campus;
    this.name = name;
    this.api = model ? null : createCharacter({ bronze: true, withLantern: false });
    this.group = new THREE.Group();
    this.model = model || this.api.group;
    // 铜像按真实身高缩放（殿内祭坛上的原像约 4.4m，离台后会穿门框与廊顶）
    if (height && this.model) {
      this.model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(this.model);
      const h = box.max.y - box.min.y;
      if (h > .01) this.model.scale.setScalar(height / h);
    }
    this.group.add(this.model);
    this.x = x; this.z = z;
    this.y = campus.groundY(x, z, 2);
    this.group.position.set(x, this.y, z);
    this.group.rotation.y = facing;
    this.facing = facing;
    campus.group.add(this.group);

    this.leader = null;
    this.trail = [];
    this.moving = false;
    this.speed = 0;
    this.bowT = -1;
  }

  /** 站到指定位置（切镜时用） */
  place(x, z, facing = this.facing, y = null) {
    this.x = x; this.z = z;
    this.y = y === null ? this.campus.groundY(x, z, 2) : y;
    this.group.position.set(x, this.y, z);
    this.facing = facing;
    this.group.rotation.y = facing;
    this.trail.length = 0;
    if (this.leader) this.trail.push(this.leader.position.clone());
  }

  startFollow(leader) {
    this.leader = leader;
    this.trail.length = 0;
    this.trail.push(leader.position.clone());
  }

  stopFollow() {
    this.leader = null;
    this.trail.length = 0;
    this.moving = false;
  }

  faceTo(x, z) {
    this.facing = Math.atan2(x - this.group.position.x, z - this.group.position.z);
    this.group.rotation.y = this.facing;
  }

  bow(dur = 1.5) {
    this.bowT = 0;
    this.bowDur = dur;
  }

  update(dt, camera, night = 0) {
    const p = this.group.position;
    let moving = false;
    let speed = 0;

    if (this.leader) {
      const lp = this.leader.position;
      const last = this.trail[this.trail.length - 1];
      if (!last || Math.hypot(lp.x - last.x, lp.z - last.z) > 0.22) {
        this.trail.push(lp.clone());
        if (this.trail.length > 400) this.trail.shift();
      }
      // 从队尾向前找：与最新点累计路程达到 1.35m 的那个点
      let target = null, acc = 0;
      for (let i = this.trail.length - 1; i > 0; i--) {
        const a = this.trail[i], b = this.trail[i - 1];
        const d = Math.hypot(a.x - b.x, a.z - b.z);
        acc += d;
        if (acc >= BACK_DIST) { target = b; break; }
      }
      if (target) {
        const dx = target.x - p.x, dz = target.z - p.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.02) {
          const stepLen = Math.min(dist, WALK_SPEED * dt);
          const nx = p.x + dx / dist * stepLen;
          const nz = p.z + dz / dist * stepLen;
          p.x = nx; p.z = nz;
          p.y = this.campus.groundY(nx, nz, p.y + 1);
          moving = true;
          speed = stepLen / Math.max(dt, 1e-4);
          this.facing = Math.atan2(dx, dz);
        }
      }
      if (!moving) this.faceTo(lp.x, lp.z);
    }

    this.group.rotation.y += Math.atan2(
      Math.sin(this.facing - this.group.rotation.y),
      Math.cos(this.facing - this.group.rotation.y)
    ) * Math.min(1, dt * 10);
    this.x = p.x; this.z = p.z; this.y = p.y;
    this.moving = moving;
    this.speed = speed;
    if (this.api) this.api.update(dt, speed, moving, night);

    // 鞠躬：向下 0.5s → 停留 → 回到站立。铜像没有骨骼，整体前倾一个小角度
    if (this.bowT >= 0) {
      this.bowT += dt;
      const t = this.bowT;
      const a = t < .5 ? t / .5 : t < .95 ? 1 : Math.max(0, 1 - (t - .95) / .55);
      const tilt = (this.api ? .62 : .17) * (a * a * (3 - 2 * a));
      if (this.api) this.api.rig.rotation.x = tilt;
      else this.model.rotation.x = tilt;
      if (t > 1.5) {
        this.bowT = -1;
        if (this.api) this.api.rig.rotation.x = 0;
        else this.model.rotation.x = 0;
      }
    }
  }
}

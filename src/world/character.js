import * as THREE from 'three';

/**
 * 全身灰白的竹节木偶人：分段竹节四肢、木榫关节、刻线五官，右手提灯。
 * 模型朝向 +Z，脚底在 y=0，身高约 1.82m。
 */
export function createCharacter() {
  const group = new THREE.Group();
  const rig = new THREE.Group();
  group.add(rig);

  const wood = new THREE.MeshStandardMaterial({ color: 0xd7d3ca, roughness: .88, metalness: .02 });
  const woodDark = new THREE.MeshStandardMaterial({ color: 0xb3aea4, roughness: .9 });
  const seam = new THREE.MeshStandardMaterial({ color: 0x8e897f, roughness: .82 });
  const carve = new THREE.MeshStandardMaterial({ color: 0x6f6a62, roughness: .95 });
  const eyeInk = new THREE.MeshStandardMaterial({ color: 0x3b3733, roughness: .6 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x9b978e, roughness: .5, metalness: .45 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffd79a, emissive: 0xffa64d, emissiveIntensity: 1.6, roughness: .35 });

  const add = (parent, geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // 竹节：一段圆柱 + 两端环形竹节圈
  const bamboo = (parent, y0, y1, r, mat = wood, ringR = null) => {
    const len = y1 - y0, mid = (y0 + y1) / 2;
    add(parent, new THREE.CylinderGeometry(r, r, len, 10), mat, 0, mid, 0);
    const rr = ringR ?? r * 1.12;
    for (const y of [y0, y1]) {
      const ring = add(parent, new THREE.TorusGeometry(rr, r * .11, 6, 12), woodDark, 0, y, 0);
      ring.rotation.x = Math.PI / 2;
    }
    return mid;
  };

  // 关节木榫：横向贯穿的圆盘
  const peg = (parent, x, y, z, r, mat = woodDark) => {
    const p = add(parent, new THREE.CylinderGeometry(r, r, .05, 12), mat, x, y, z);
    p.rotation.z = Math.PI / 2;
    return p;
  };

  // ---------- 躯干：三节竹子 ----------
  const hip = add(rig, new THREE.SphereGeometry(.115, 14, 12), wood, 0, .74, 0);
  hip.scale.set(1.15, .9, 1);
  bamboo(rig, .78, .96, .105);
  bamboo(rig, .96, 1.14, .115);
  bamboo(rig, 1.14, 1.3, .108);
  const chest = add(rig, new THREE.SphereGeometry(.13, 16, 12), wood, 0, 1.26, 0);
  chest.scale.set(1.25, .92, .95);
  // 前胸刻线，像木偶的开合缝
  add(rig, new THREE.BoxGeometry(.012, .40, .012), seam, 0, 1.02, .106);
  for (const y of [.88, 1.02, 1.16]) {
    const knob = add(rig, new THREE.SphereGeometry(.024, 8, 6), woodDark, 0, y, .112);
    knob.scale.z = .5;
  }

  // ---------- 颈与头 ----------
  bamboo(rig, 1.3, 1.4, .048, wood, .056);
  const head = add(rig, new THREE.SphereGeometry(.25, 22, 16), wood, 0, 1.6, 0);
  head.scale.set(.96, 1.04, .92);
  // 刻线眼：两道细长凹槽 + 深色瞳缝
  for (const s of [-1, 1]) {
    const lid = add(rig, new THREE.BoxGeometry(.085, .016, .012), carve, s * .083, 1.63, .215);
    lid.rotation.z = s * -.06;
    add(rig, new THREE.BoxGeometry(.026, .012, .012), eyeInk, s * .075, 1.628, .221);
    // 眼下的木偶刻痕
    add(rig, new THREE.BoxGeometry(.05, .008, .01), seam, s * .088, 1.585, .216);
  }
  // 鼻梁与嘴缝
  add(rig, new THREE.BoxGeometry(.016, .075, .018), carve, 0, 1.585, .232);
  add(rig, new THREE.BoxGeometry(.075, .012, .012), carve, 0, 1.535, .222);

  // ---------- 手臂：肩榫 + 三节竹子 ----------
  const makeArm = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * .215, 1.26, 0);
    rig.add(pivot);
    const shoulder = add(pivot, new THREE.SphereGeometry(.075, 12, 10), woodDark, 0, 0, 0);
    shoulder.scale.set(1, .9, .9);
    peg(pivot, side * .035, 0, 0, .04, seam);
    bamboo(pivot, -.08, -.2, .042);
    const elbow = add(pivot, new THREE.SphereGeometry(.05, 10, 8), woodDark, 0, -.235, 0);
    elbow.scale.set(1, 1.1, 1);
    bamboo(pivot, -.27, -.4, .04);
    const wrist = add(pivot, new THREE.SphereGeometry(.045, 10, 8), woodDark, 0, -.43, 0);
    wrist.scale.set(1, .85, 1);
    // 木偶手掌：两块小木板
    const hand = add(pivot, new THREE.BoxGeometry(.075, .085, .05), wood, 0, -.485, 0);
    hand.rotation.x = .06;
    add(pivot, new THREE.BoxGeometry(.02, .06, .045), wood, side * .045, -.47, 0).rotation.z = side * .35;
    return pivot;
  };
  const armL = makeArm(-1), armR = makeArm(1);

  // ---------- 腿：胯榫 + 三节竹子 ----------
  const makeLeg = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * .085, .74, 0);
    rig.add(pivot);
    peg(pivot, side * .03, -.02, 0, .045, seam);
    bamboo(pivot, -.06, -.24, .052);
    const knee = add(pivot, new THREE.SphereGeometry(.062, 12, 10), woodDark, 0, -.275, 0);
    knee.scale.set(1, 1.1, 1);
    bamboo(pivot, -.31, -.5, .05);
    const ankle = add(pivot, new THREE.SphereGeometry(.052, 10, 8), woodDark, 0, -.545, 0);
    ankle.scale.set(1, .8, 1);
    // 木屐式脚掌
    const foot = add(pivot, new THREE.BoxGeometry(.115, .07, .21), wood, 0, -.62, .045);
    foot.rotation.x = -.03;
    add(pivot, new THREE.BoxGeometry(.12, .02, .075), woodDark, 0, -.655, -.03);
    return pivot;
  };
  const legL = makeLeg(-1), legR = makeLeg(1);

  // ---------- 提灯（右手，灰白木框 + 暖光） ----------
  const lantern = new THREE.Group();
  lantern.position.set(0, -.5, .03);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(.05, .007, 6, 12), metal);
  handle.rotation.x = Math.PI / 2; handle.position.y = .055; lantern.add(handle);
  const cageTop = new THREE.Mesh(new THREE.CylinderGeometry(.05, .068, .045, 8), woodDark);
  cageTop.position.y = -.06; lantern.add(cageTop);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(.042, .048, .1, 8), lampMat);
  glass.position.y = -.13; lantern.add(glass);
  const cageBase = new THREE.Mesh(new THREE.CylinderGeometry(.068, .056, .03, 8), woodDark);
  cageBase.position.y = -.205; lantern.add(cageBase);
  // 提灯暖光：夜里给出脚下的一圈光
  const lampLight = new THREE.PointLight(0xffb066, 0, 18, 1.8);
  lampLight.position.y = -.13;
  lantern.add(lampLight);
  armR.add(lantern);

  // 影子贴片，避免小人悬空时缺少落地感
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(.46, 20),
    new THREE.MeshBasicMaterial({ color: 0x1a2018, transparent: true, opacity: .26, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = .03;
  group.add(shadow);

  let phase = 0, lampT = 0;
  const api = {
    group,
    rig,
    /** speed: 米/秒；moving: 是否在移动；night: 0-1 夜间权重 */
    update(dt, speed, moving, night = 0) {
      const k = moving ? 1 : 0;
      phase += dt * (moving ? 3.2 + speed * .42 : 1.6);
      lampT += dt;
      const amp = moving ? .62 : 0;
      legL.rotation.x = Math.sin(phase) * amp;
      legR.rotation.x = -Math.sin(phase) * amp;
      armL.rotation.x = -Math.sin(phase) * amp * .72;
      armR.rotation.x = Math.sin(phase) * amp * .5 - .08 * k;
      armL.rotation.z = .05; armR.rotation.z = -.05;
      // 木偶的僵硬感：步频略碎，上下浮动更小
      rig.position.y = -.075 + Math.abs(Math.sin(phase)) * .022 * k;
      rig.rotation.z = Math.sin(phase * .5) * .008 * k;
      shadow.position.y = .03;
      // 提灯亮起 + 轻微摇曳
      lampLight.intensity = night * (2.0 + Math.sin(lampT * 7.3) * .18 + Math.sin(lampT * 13.1) * .08);
      lampMat.emissiveIntensity = .35 + night * 1.6;
      // 夜色里给灰白木质一点极弱的自发光，避免完全糊黑
      wood.emissive.setRGB(.09 * night, .075 * night, .06 * night);
      woodDark.emissive.setRGB(.06 * night, .05 * night, .04 * night);
    },
  };
  return api;
}

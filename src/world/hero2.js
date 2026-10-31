import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

/**
 * 主角二号：Hi3D 生成的机械师（6 件拆件 + 2048 贴图，541KB）。
 * 与原竹节木偶保持同一接口：group / rig / update(dt, speed, moving, night)。
 * 朝向 +Z，脚底 y = 0，身高 1.82m。
 */
const MODEL_H = 1.82;

// 关节坐标取自拆件缝隙（模型归一化高度 1.0、y∈[-0.5,0.5]）
const JOINTS = {
  RightLeg: [-0.0868, -0.1960, -0.0737],
  LeftLeg: [0.0621, -0.1966, -0.0543],
  RightArm: [-0.0814, 0.2197, -0.0894],
  LeftArm: [0.0585, 0.2156, -0.0663],
  Head: [-0.0184, 0.2640, -0.0580],
};

export function createHero2() {
  const group = new THREE.Group();
  const rig = new THREE.Group();
  rig.scale.setScalar(MODEL_H);
  rig.position.y = MODEL_H * 0.5;   // 模型 y∈[-0.5,0.5] → 脚底贴地
  group.add(rig);

  // 落地影子
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(.46, 20),
    new THREE.MeshBasicMaterial({ color: 0x1a2018, transparent: true, opacity: .26, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = .03;
  group.add(shadow);

  const pivots = {};
  let material = null;
  let baseY = MODEL_H * 0.5;   // 载入后按实际包围盒校正，保证脚底贴地
  let phase = 0, idle = 0;

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load(`${import.meta.env.BASE_URL}models/hero2.glb`, (gltf) => {
    const model = gltf.scene;
    const bb = new THREE.Box3().setFromObject(model);
    baseY = -bb.min.y * MODEL_H;
    rig.position.y = baseY;
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      material = o.material;
      if (material.map) material.map.anisotropy = 4;
    });
    rig.add(model);
    for (const name of Object.keys(JOINTS)) {
      const node = model.getObjectByName(name);
      const mesh = node && node.getObjectByProperty('isMesh', true);
      if (!mesh) continue;
      const pivot = new THREE.Group();
      pivot.position.fromArray(JOINTS[name]);
      model.add(pivot);
      pivot.attach(mesh);   // 保留世界变换，枢轴落在关节处
      pivots[name] = pivot;
    }
    api.ready = true;
  }, undefined, (e) => console.warn('hero2 加载失败', e));

  const api = {
    group,
    rig,
    ready: false,
    /** speed: 米/秒；moving: 是否在移动；night: 0-1 夜间权重 */
    update(dt, speed, moving, night = 0) {
      phase += dt * (moving ? 3.4 + speed * .5 : 1.2);
      idle += dt;
      const k = moving ? 1 : 0;
      const amp = moving ? .34 : 0;
      if (pivots.RightLeg) {
        pivots.RightLeg.rotation.x = Math.sin(phase) * amp;
        pivots.LeftLeg.rotation.x = -Math.sin(phase) * amp;
        // 双手在身前持物，双臂同相小幅摆动，保持合手姿态
        pivots.RightArm.rotation.x = Math.sin(phase) * .05 * k;
        pivots.LeftArm.rotation.x = Math.sin(phase) * .05 * k;
        pivots.RightArm.rotation.z = Math.sin(phase * .5) * .02 * k;
        pivots.LeftArm.rotation.z = -Math.sin(phase * .5) * .02 * k;
        pivots.Head.rotation.y = Math.sin(idle * .7) * .05;
      }
      rig.position.y = baseY + (moving
        ? Math.abs(Math.sin(phase)) * .022
        : Math.sin(idle * 1.5) * .006);
      rig.rotation.z = Math.sin(phase * .5) * .006 * k;
      shadow.position.y = .03;
      if (material) {
        // 夜里给一点极弱自发光，避免整块糊黑；过强会把材质照成一片灰白
        material.emissive.setRGB(.028 * night, .022 * night, .018 * night);
      }
    },
  };
  return api;
}

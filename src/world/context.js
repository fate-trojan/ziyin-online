import * as THREE from 'three';
import { studyPondOutline } from './buildings.js';

/** 闭环内地面：校园草坪按边界多边形铺设；环外只有雾墙背景地面（900×900） */
export class Context {
  constructor(scene, mats, boundary) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.mats = mats;
    this.boundary = boundary;
    this._buildGround();
  }

  _buildGround() {
    // 沁园整体下沉 1m：两片地面在此矩形内开洞，下沉盆地由 Campus 补齐
    const HOLE = { x0: -72.4, x1: -55.9, z0: -51, z1: -24 };
    const addHole = (s, dx = 0, dz = 0) => {
      const p = new THREE.Path();
      const hx0 = HOLE.x0 - dx, hx1 = HOLE.x1 - dx;
      const hy0 = -(HOLE.z1 - dz), hy1 = -(HOLE.z0 - dz);
      p.moveTo(hx0, hy0); p.lineTo(hx0, hy1); p.lineTo(hx1, hy1); p.lineTo(hx1, hy0); p.closePath();
      s.holes.push(p);
    };
    // 自习室东南石桥水池：水面低于地面 .5m，按池岸压顶外缘开洞，否则地面会盖住水面
    const addPondHole = (s, dx = 0, dz = 0) => {
      const p = new THREE.Path();
      studyPondOutline(1.2, 56).forEach(([x, z], i) => {
        const px = x - dx, py = -(z - dz);
        if (i) p.lineTo(px, py); else p.moveTo(px, py);
      });
      p.closePath();
      s.holes.push(p);
    };
    // 雾墙外侧的背景地面
    const W = 900, D = 900;
    const bg = new THREE.Shape();
    bg.moveTo(-W / 2, -D / 2); bg.lineTo(W / 2, -D / 2);
    bg.lineTo(W / 2, D / 2); bg.lineTo(-W / 2, D / 2); bg.closePath();
    // 背景地面整体平移 (29, -8)，开洞需按同一偏移换算，否则洞落在别处、沁园水面被压住
    addHole(bg, 29, -8);
    addPondHole(bg, 29, -8);
    const bgGeo = new THREE.ShapeGeometry(bg, 1);
    bgGeo.rotateX(-Math.PI / 2);
    const pos = bgGeo.attributes.position, uv = bgGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + W / 2) / W, (pos.getZ(i) + D / 2) / D);
    uv.needsUpdate = true;
    const mat = this.mats.ground.clone();
    mat.map = mat.map.clone(); mat.map.repeat.set(20, 20); mat.map.needsUpdate = true; mat.color = new THREE.Color(0xc2c9b4);
    const ground = new THREE.Mesh(bgGeo, mat);
    ground.position.set(29, -0.06, -8); ground.receiveShadow = true;
    this.group.add(ground);

    // 校园草坪：即闭环本体，边界多边形内满铺（不越出红线）
    const lawnShape = new THREE.Shape();
    this.boundary.forEach(([x, z], i) => { if (i) lawnShape.lineTo(x, -z); else lawnShape.moveTo(x, -z); });
    lawnShape.closePath();
    addHole(lawnShape);
    addPondHole(lawnShape);
    const lawnGeo = new THREE.ShapeGeometry(lawnShape, 1);
    lawnGeo.rotateX(-Math.PI / 2);
    const lawn = new THREE.Mesh(lawnGeo, this.mats.grass);
    lawn.position.y = 0.015; lawn.receiveShadow = true;
    this.group.add(lawn);
  }
}

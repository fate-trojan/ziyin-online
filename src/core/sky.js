import * as THREE from 'three';
import { clamp, lerp, smoothstep } from '../util.js';

const KEYS = [
  { t: 0.0,  top: '#070c18', hor: '#101827', fog: '#141b28', sun: '#9fb4e8', hemiSky: '#1b2942', hemiGround: '#121416', sunI: 0.0, hemiI: 0.16, amb: 0.10, exp: 1.25 },
  { t: 4.8,  top: '#0a1325', hor: '#1e2740', fog: '#1b2231', sun: '#a8bde8', hemiSky: '#24334c', hemiGround: '#151719', sunI: 0.0, hemiI: 0.18, amb: 0.10, exp: 1.25 },
  { t: 5.8,  top: '#2a3d62', hor: '#a06f6e', fog: '#6c6068', sun: '#ffb07a', hemiSky: '#4a5874', hemiGround: '#26221f', sunI: 0.35, hemiI: 0.32, amb: 0.12, exp: 1.2 },
  { t: 6.6,  top: '#607b9f', hor: '#e7a984', fog: '#a8948a', sun: '#ffc189', hemiSky: '#8ea3b8', hemiGround: '#3b3730', sunI: 1.4, hemiI: 0.52, amb: 0.16, exp: 1.12 },
  { t: 8.0,  top: '#7fa8cd', hor: '#d9d6c2', fog: '#a6b0a8', sun: '#ffe6bd', hemiSky: '#b8cfe0', hemiGround: '#4f5140', sunI: 2.5, hemiI: 0.72, amb: 0.18, exp: 1.05 },
  { t: 11.5, top: '#4f86c0', hor: '#b7d0e4', fog: '#a9b9bd', sun: '#fff8e9', hemiSky: '#c6ddec', hemiGround: '#5b5d48', sunI: 3.0, hemiI: 0.82, amb: 0.20, exp: 1.0 },
  { t: 15.0, top: '#6f9fc9', hor: '#e3ddc8', fog: '#aeb8b0', sun: '#fff0cf', hemiSky: '#c2d7e5', hemiGround: '#5b5947', sunI: 2.9, hemiI: 0.78, amb: 0.19, exp: 1.0 },
  { t: 17.2, top: '#7999ba', hor: '#efcf9f', fog: '#b8a78f', sun: '#ffe0a8', hemiSky: '#c0c6cc', hemiGround: '#5d5544', sunI: 2.2, hemiI: 0.66, amb: 0.17, exp: 1.03 },
  { t: 18.3, top: '#657897', hor: '#f0a272', fog: '#9e7f6d', sun: '#ffb26d', hemiSky: '#a4a6b1', hemiGround: '#4c4439', sunI: 1.25, hemiI: 0.52, amb: 0.15, exp: 1.08 },
  { t: 19.1, top: '#3a4568', hor: '#c1705d', fog: '#7f6661', sun: '#ff8b58', hemiSky: '#657089', hemiGround: '#302c29', sunI: 0.42, hemiI: 0.34, amb: 0.12, exp: 1.16 },
  { t: 19.9, top: '#263c62', hor: '#5a6a88', fog: '#3a465e', sun: '#a6b8e8', hemiSky: '#4b6084', hemiGround: '#1f232a', sunI: 0.0, hemiI: 0.62, amb: 0.26, exp: 1.36 },
  { t: 21.5, top: '#16243f', hor: '#30405e', fog: '#28344a', sun: '#9fb4e8', hemiSky: '#3c5276', hemiGround: '#1a1e24', sunI: 0.0, hemiI: 0.58, amb: 0.26, exp: 1.42 },
  { t: 24.0, top: '#12203a', hor: '#283752', fog: '#222d42', sun: '#9fb4e8', hemiSky: '#354a6c', hemiGround: '#171b21', sunI: 0.0, hemiI: 0.52, amb: 0.23, exp: 1.4 }
];

function palette(t) {
  let a = KEYS[0], b = KEYS[KEYS.length - 1];
  for (let i = 0; i < KEYS.length - 1; i++) {
    if (t >= KEYS[i].t && t <= KEYS[i + 1].t) { a = KEYS[i]; b = KEYS[i + 1]; break; }
  }
  const k = clamp((t - a.t) / Math.max(0.0001, b.t - a.t), 0, 1);
  const mix = (key) => new THREE.Color(a[key]).lerp(new THREE.Color(b[key]), k);
  return {
    top: mix('top'), hor: mix('hor'), fog: mix('fog'), sun: mix('sun'),
    hemiSky: mix('hemiSky'), hemiGround: mix('hemiGround'),
    sunI: lerp(a.sunI, b.sunI, k), hemiI: lerp(a.hemiI, b.hemiI, k), amb: lerp(a.amb, b.amb, k), exp: lerp(a.exp, b.exp, k)
  };
}

const skyVert = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_Position.z = gl_Position.w;
  }
`;

const skyFrag = /* glsl */`
  precision highp float;
  varying vec3 vDir;
  uniform vec3 topColor, horizonColor, sunColor, moonColor, cloudColor;
  uniform vec3 sunDir, moonDir;
  uniform float night, cloudCover, time, starIntensity;

  float hash21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
  float hash31(vec3 p){ p = fract(p*0.3183099 + .1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
  float noise2(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f*f*(3.0-2.0*f);
    float a = hash21(i), b = hash21(i+vec2(1,0)), c = hash21(i+vec2(0,1)), d = hash21(i+vec2(1,1));
    return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
  }
  float fbm2(vec2 p){
    float v = 0.0, a = 0.5;
    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
    for(int i=0;i<5;i++){ v += a*noise2(p); p = rot*p*2.02 + 13.7; a *= 0.5; }
    return v;
  }
  void main(){
    vec3 d = normalize(vDir);
    float h = clamp(d.y, -0.08, 1.0);
    float grad = pow(clamp(h,0.0,1.0), 0.55);
    vec3 col = mix(horizonColor, topColor, grad);

    // sun & moon
    float sd = clamp(dot(d, normalize(sunDir)), 0.0, 1.0);
    float dayGlow = pow(sd, 8.0) * (1.0-night);
    col += sunColor * pow(sd, 900.0) * 2.8 * (1.0-night*0.75);
    col += sunColor * dayGlow * 0.30;

    float md = clamp(dot(d, normalize(moonDir)), 0.0, 1.0);
    col += moonColor * pow(md, 1200.0) * 2.2 * night;
    col += moonColor * pow(md, 40.0) * 0.10 * night;
    float moonDisc = smoothstep(0.99955, 0.99975, md);
    col = mix(col, vec3(0.92,0.94,1.0)*1.5, moonDisc*night);

    // stars
    if (night > 0.02 && d.y > 0.0) {
      vec3 q = d * 360.0;
      vec3 cell = floor(q);
      float r = hash31(cell);
      vec3 f = fract(q) - 0.5;
      float star = smoothstep(0.22, 0.0, length(f)) * step(0.9965, r);
      float tw = 0.65 + 0.35 * sin(time*1.7 + r*100.0);
      col += vec3(0.85,0.90,1.0) * star * tw * night * starIntensity;
    }

    // clouds — projected dome, soft fbm
    if (cloudCover > 0.001) {
      vec2 cp = d.xz / (max(d.y, 0.035) + 0.28) * 0.62;
      vec2 drift = vec2(time*0.0035, time*0.0012);
      float c = fbm2(cp*1.35 + drift);
      float c2 = fbm2(cp*3.1 - drift*1.7 + 7.3);
      c = c*0.72 + c2*0.28;
      float mask = smoothstep(0.52, 0.78, c) * smoothstep(0.015, 0.11, d.y);
      float rim = pow(clamp(dot(d, normalize(sunDir)),0.0,1.0), 3.0) * (1.0-night);
      vec3 cc = mix(cloudColor, sunColor, rim*0.30);
      col = mix(col, cc, mask * cloudCover * 0.9);
      // warm underside near horizon
      col = mix(col, horizonColor*1.02, mask*cloudCover*smoothstep(0.30,0.02,d.y)*0.4);
    }

    // horizon haze
    float haze = smoothstep(0.22, -0.02, h);
    col = mix(col, horizonColor, haze*0.38);
    // very subtle dithering
    float dith = (hash21(gl_FragCoord.xy)-0.5)/255.0;
    col += dith;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export class Environment {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.time = 15.4;
    this.night = 0;
    this.userExposure = 1;
    this.userSun = 1;
    this.userAmbient = 1;
    this.userFog = 1;

    const geo = new THREE.SphereGeometry(2400, 48, 28);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: skyVert,
      fragmentShader: skyFrag,
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color('#6f9fc9') },
        horizonColor: { value: new THREE.Color('#e3ddc8') },
        sunColor: { value: new THREE.Color('#fff0cf') },
        moonColor: { value: new THREE.Color('#b9c8ff') },
        cloudColor: { value: new THREE.Color('#f2eee2') },
        sunDir: { value: new THREE.Vector3(0, 1, 0) },
        moonDir: { value: new THREE.Vector3(-0.4, 0.7, 0.5).normalize() },
        night: { value: 0 },
        cloudCover: { value: 0.45 },
        time: { value: 0 },
        starIntensity: { value: 1.0 }
      }
    });
    this.sky = new THREE.Mesh(geo, this.mat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -100;
    scene.add(this.sky);

    this.hemi = new THREE.HemisphereLight(0xc6ddec, 0x5b5d48, 0.8);
    scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight(0xffffff, 0.18);
    scene.add(this.ambient);

    this.sun = new THREE.DirectionalLight(0xfff1d6, 3.0);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 10;
    this.sun.shadow.camera.far = 900;
    this.sun.shadow.camera.left = -260;
    this.sun.shadow.camera.right = 260;
    this.sun.shadow.camera.top = 260;
    this.sun.shadow.camera.bottom = -260;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.5;
    this.target = new THREE.Object3D();
    this.target.position.set(0, 0, 0);
    scene.add(this.target);
    this.sun.target = this.target;
    scene.add(this.sun);

    this.moon = new THREE.DirectionalLight(0x9db4e8, 0.0);
    scene.add(this.moon);
    this.moon.target = this.target;

    this.scene.fog = new THREE.FogExp2(new THREE.Color('#aeb8b0'), 0.0016);
    this._t = 0;
    this._lastPalette = null;
    this.nightObjects = [];
    this.update(0, true);
  }

  registerNight(emitters, lights) {
    this.nightObjects.push({ emitters, lights });
  }

  setTime(t, immediate = false) {
    this.time = clamp(t, 0, 24);
    this._immediate = immediate;
  }

  get sunDirection() {
    const dayT = clamp((this.time - 6) / 12, 0, 1);
    const elev = Math.sin(dayT * Math.PI) * 1.09 - 0.075;
    const az = lerp(-Math.PI * 0.52, Math.PI * 0.52, dayT);
    return new THREE.Vector3(Math.sin(az) * Math.cos(elev), Math.sin(elev), Math.cos(az) * Math.cos(elev)).normalize();
  }

  update(dt, immediate = false) {
    this._t += dt;
    const p = palette(this.time);
    const sunDir = this.sunDirection;
    const elev = sunDir.y;
    const nightTarget = 1 - smoothstep(-0.06, 0.16, elev);
    this.night = immediate || this._immediate ? nightTarget : lerp(this.night, nightTarget, 1 - Math.exp(-dt * 3.2));
    if (immediate) this.night = nightTarget;
    this._immediate = false;

    const night = this.night;
    // 夜间天穹与雾色压至近黑，避免夜空泛灰
    const nightDim = smoothstep(0.45, 0.98, night);
    p.top.multiplyScalar(1 - nightDim * 0.97);
    p.hor.multiplyScalar(1 - nightDim * 0.97);
    p.fog.multiplyScalar(1 - nightDim * 0.93);
    this.mat.uniforms.topColor.value.copy(p.top);
    this.mat.uniforms.horizonColor.value.copy(p.hor);
    this.mat.uniforms.sunColor.value.copy(p.sun);
    this.mat.uniforms.moonColor.value.copy(new THREE.Color('#b9c8ff'));
    this.mat.uniforms.cloudColor.value.copy(p.top).lerp(new THREE.Color('#f4efe4'), 0.45 + 0.4 * (1 - night));
    this.mat.uniforms.sunDir.value.copy(sunDir);
    const moonDir = new THREE.Vector3(-0.38, 0.62, -0.55).normalize();
    this.mat.uniforms.moonDir.value.copy(moonDir);
    this.mat.uniforms.night.value = night;
    this.mat.uniforms.time.value = this._t;
    this.mat.uniforms.cloudCover.value = 0.38 + 0.18 * Math.sin(this._t * 0.006);

    this.sun.position.copy(sunDir).multiplyScalar(420);
    this.sun.color.copy(p.sun);
    this.sun.intensity = p.sunI * 1.10 * this.userSun * (1 - night * 0.96);
    this.sun.castShadow = this.sun.intensity > 0.15;
    this.moon.position.copy(moonDir).multiplyScalar(380);
    this.moon.intensity = night * 1.5;
    this.hemi.color.copy(p.hemiSky);
    this.hemi.groundColor.copy(p.hemiGround);
    this.hemi.intensity = p.hemiI * 0.72 * (0.55 + 0.45 * this.userAmbient);
    this.ambient.color.copy(p.hemiSky).lerp(new THREE.Color('#ffffff'), 0.5);
    this.ambient.intensity = p.amb * 0.70 * this.userAmbient;

    this.scene.fog.color.copy(p.fog);
    this.scene.fog.density = (0.00058 + night * 0.00045) * this.userFog;
    this.renderer.toneMappingExposure = p.exp * this.userExposure;

    this.sky.position.copy(this.renderer.xr?.isPresenting ? new THREE.Vector3() : this._cameraPos || new THREE.Vector3());
    for (const group of this.nightObjects) {
      const e = smoothstep(0.15, 0.85, night);
      for (const em of group.emitters) {
        if (!em) continue;
        const mat = em.material;
        if (em.isSprite && mat) {
          mat.opacity = (em.userData.nightOpacity ?? 0) * e;
        } else if (mat && mat.emissiveIntensity !== undefined) {
          mat.emissiveIntensity = (em.userData.baseEmissive ?? 1) * e;
        }
      }
      for (const li of group.lights) {
        if (li) li.intensity = li.userData.baseIntensity * e;
      }
    }
    this._lastPalette = p;
  }

  followCamera(camera) {
    this._cameraPos = camera.position;
    this.sky.position.copy(camera.position);
  }
}

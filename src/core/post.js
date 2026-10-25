import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uNight: { value: 0 },
    uTilt: { value: 0.55 },
    uGrain: { value: 0.035 },
    uVignette: { value: 0.32 },
    uWarmth: { value: 0.0 },
    uSaturation: { value: 1.02 }
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: /* glsl */`
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uTime, uNight, uTilt, uGrain, uVignette, uWarmth, uSaturation;
    varying vec2 vUv;
    float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
    void main(){
      vec2 uv = vUv;
      float d = abs(uv.y - 0.50);
      float blur = smoothstep(0.20, 0.52, d) * uTilt;
      vec3 col = vec3(0.0);
      float wsum = 0.0;
      for(int i=-5;i<=5;i++){
        float fi=float(i);
        float wt=exp(-fi*fi*0.16);
        vec2 off = vec2(0.0, fi*0.0022*blur);
        col += texture2D(tDiffuse, uv+off).rgb * wt;
        wsum += wt;
      }
      col /= wsum;
      // slight horizontal softening, strongest at edges
      vec3 side = (texture2D(tDiffuse, uv+vec2(0.0022*blur,0.0)).rgb + texture2D(tDiffuse, uv-vec2(0.0022*blur,0.0)).rgb)*0.5;
      col = mix(col, side, 0.30);
      // vignette
      float vig = smoothstep(0.92, 0.28, length((uv-0.5)*vec2(1.0,1.06)));
      col *= mix(1.0-uVignette, 1.0, vig);
      // subtle warm/cool grade
      col = mix(col, col*vec3(1.035,1.0,0.955), clamp(uWarmth,0.0,1.0));
      col = mix(col, col*vec3(0.94,0.98,1.06), clamp(-uWarmth,0.0,1.0));
      // gentle S-curve / saturation
      float lum = dot(col, vec3(0.2126,0.7152,0.0722));
      col = mix(vec3(lum), col, uSaturation);
      col = clamp(col, 0.0, 4.0);
      // film grain
      float g = hash(uv*uResolution + uTime*13.7)-0.5;
      col += g*uGrain*(0.35+0.65*(1.0-lum));
      gl_FragColor = vec4(col,1.0);
    }
  `
};

export class Post {
  constructor(renderer, scene, camera, { mobile = false } = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.mobile = mobile;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const type = renderer.capabilities.isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType;
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, {
      type,
      samples: mobile ? 0 : 4,
      colorSpace: THREE.LinearSRGBColorSpace
    });
    this.composer = new EffectComposer(renderer, rt);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.36, 0.62, 0.82);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.output = new OutputPass();
    this.composer.addPass(this.output);
    this.bloomEnabled = true;
    this.tilt = mobile ? 0.42 : 0.55;
    this.time = 0;
  }

  setSize(w, h, dpr) {
    this.composer.setSize(w, h);
    const db = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.grade.uniforms.uResolution.value.set(db.x, db.y);
    this.bloom.resolution.set(db.x, db.y);
  }

  setQuality({ bloom = true, tilt = this.tilt, grain = this.mobile ? 0.025 : 0.035 } = {}) {
    this.bloomEnabled = bloom;
    this.bloom.enabled = bloom;
    this.tilt = tilt;
    this.grade.uniforms.uTilt.value = tilt;
    this.grade.uniforms.uGrain.value = grain;
  }

  update(dt, { night = 0, warmth = 0 } = {}) {
    this.time += dt;
    const g = this.grade.uniforms;
    g.uTime.value = this.time;
    g.uNight.value = night;
    g.uWarmth.value = warmth;
    this.bloom.strength = (0.30 + 0.62 * night) * (this.mobile ? 0.85 : 1.0);
    this.bloom.threshold = 0.85 - 0.30 * night;
    this.bloom.radius = 0.55 + 0.18 * night;
  }

  render(dt) { this.composer.render(dt); }
}

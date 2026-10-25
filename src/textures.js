import * as THREE from 'three';
import { makeCanvas, canvasTexture, mulberry32 } from './util.js';

function noiseOverlay(g, w, h, rnd, alpha = 0.06, count = 12000, light = true) {
  for (let i = 0; i < count; i++) {
    const x = rnd() * w, y = rnd() * h, r = 0.4 + rnd() * 1.4;
    g.fillStyle = light ? `rgba(255,255,255,${rnd() * alpha})` : `rgba(0,0,0,${rnd() * alpha})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
}

export function makeRoofTextures() {
  const w = 512, h = 512;
  const c = makeCanvas(w, h), g = c.getContext('2d');
  g.fillStyle = '#59605f'; g.fillRect(0, 0, w, h);
  const rows = 10, rowH = h / rows;
  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    const grad = g.createLinearGradient(0, y, 0, y + rowH);
    grad.addColorStop(0, '#757c79');
    grad.addColorStop(0.28, '#646b69');
    grad.addColorStop(0.75, '#4b5252');
    grad.addColorStop(1, '#3b4242');
    g.fillStyle = grad;
    g.fillRect(0, y, w, rowH);
    // individual curved tiles
    const tw = 48;
    for (let x = 0; x < w; x += tw) {
      g.save();
      g.translate(x, y);
      g.beginPath();
      g.moveTo(0, rowH);
      g.quadraticCurveTo(tw / 2, -rowH * 0.22, tw, rowH);
      g.closePath();
      g.fillStyle = 'rgba(24,30,30,0.25)'; g.fill();
      g.strokeStyle = 'rgba(190,198,192,0.17)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(3, rowH); g.quadraticCurveTo(tw / 2, -rowH * 0.16, tw - 3, rowH); g.stroke();
      g.restore();
    }
    // horizontal shadow line under each course
    g.fillStyle = 'rgba(12,16,16,0.35)';
    g.fillRect(0, y + rowH - 3, w, 3);
  }
  noiseOverlay(g, w, h, mulberry32(8), 0.05, 8000, false);
  const map = canvasTexture(c, { repeat: [1, 1] });

  // bump
  const bc = makeCanvas(w, h), bg = bc.getContext('2d');
  bg.fillStyle = '#888'; bg.fillRect(0, 0, w, h);
  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    for (let x = 0; x < w; x += 48) {
      const lg = bg.createRadialGradient(x + 24, y + rowH * 0.55, 1, x + 24, y + rowH * 0.55, 30);
      lg.addColorStop(0, '#f2f2f2'); lg.addColorStop(1, '#555');
      bg.fillStyle = lg;
      bg.beginPath(); bg.ellipse(x + 24, y + rowH * 0.72, 22, 16, 0, 0, Math.PI * 2); bg.fill();
    }
  }
  const bump = new THREE.CanvasTexture(bc);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  return { map, bump };
}

export function makePlasterTexture(base = '#e7e2d6', repeat = [1, 1]) {
  const w = 512, h = 512;
  const c = makeCanvas(w, h), g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  const rnd = mulberry32(11);
  for (let i = 0; i < 60; i++) {
    const x = rnd() * w, y = rnd() * h, r = 20 + rnd() * 90;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${rnd() > .5 ? '90,88,78' : '255,255,250'},${0.015 + rnd() * 0.035})`);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  noiseOverlay(g, w, h, rnd, 0.07, 20000, false);
  noiseOverlay(g, w, h, rnd, 0.06, 12000, true);
  return canvasTexture(c, { repeat });
}

export function makeStoneTexture(base = '#8d8a80', repeat = [1, 1]) {
  const w = 512, h = 512;
  const c = makeCanvas(w, h), g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  const rnd = mulberry32(23);
  for (let i = 0; i < 8000; i++) {
    const v = 110 + Math.floor(rnd() * 100);
    g.fillStyle = `rgba(${v},${v - 2},${v - 8},${0.05 + rnd() * 0.16})`;
    g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  // faint joints
  g.strokeStyle = 'rgba(52,50,45,0.22)'; g.lineWidth = 2;
  for (let y = 0; y < h; y += 128) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
  }
  for (let y = 0; y < h; y += 128) {
    const off = (y / 128) % 2 ? 64 : 0;
    for (let x = off; x < w; x += 256) {
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 128); g.stroke();
    }
  }
  return canvasTexture(c, { repeat });
}

export function makeBrickTexture(color = '#9b5a46', repeat = [1, 1]) {
  const w = 512, h = 512;
  const c = makeCanvas(w, h), g = c.getContext('2d');
  g.fillStyle = '#d8d0c2'; g.fillRect(0, 0, w, h);
  const rnd = mulberry32(33);
  const bw = 64, bh = 26;
  for (let y = 0; y < h; y += bh + 3) {
    const off = ((y / (bh + 3)) % 2) * (bw / 2);
    for (let x = -bw; x < w; x += bw + 3) {
      const v = -12 + rnd() * 24;
      const col = new THREE.Color(color);
      col.offsetHSL(0, (rnd() - .5) * .06, v / 255);
      g.fillStyle = `#${col.getHexString()}`;
      g.fillRect(x + off, y, bw, bh);
      g.fillStyle = `rgba(0,0,0,${0.02 + rnd() * 0.08})`;
      g.fillRect(x + off, y + bh - 4, bw, 4);
    }
  }
  noiseOverlay(g, w, h, rnd, 0.08, 15000, false);
  return canvasTexture(c, { repeat });
}

export function makeWoodTexture(color = '#6c2b25', repeat = [1, 1]) {
  const w = 512, h = 512;
  const c = makeCanvas(w, h), g = c.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, w, h);
  const rnd = mulberry32(44);
  for (let i = 0; i < 120; i++) {
    const y = rnd() * h;
    g.strokeStyle = `rgba(${rnd() > .5 ? '20,8,6' : '200,130,100'},${0.03 + rnd() * 0.08})`;
    g.lineWidth = 0.5 + rnd() * 2.2;
    g.beginPath();
    g.moveTo(0, y);
    g.bezierCurveTo(w * .3, y + (rnd() - .5) * 20, w * .7, y + (rnd() - .5) * 22, w, y + (rnd() - .5) * 12);
    g.stroke();
  }
  return canvasTexture(c, { repeat });
}

export function makeLatticeTexture({
  w = 512, h = 512, bg = '#3a1c18', line = '#b98a54', cols = 8, rows = 12,
  diamond = false, border = true, repeat = [1, 1], transparent = false
} = {}) {
  const c = makeCanvas(w, h), g = c.getContext('2d');
  if (!transparent) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  g.strokeStyle = line; g.lineWidth = 4;
  if (diamond) {
    const step = 48;
    for (let x = -h; x < w + h; x += step) {
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x + h, h); g.stroke();
      g.beginPath(); g.moveTo(x, h); g.lineTo(x + h, 0); g.stroke();
    }
  } else {
    const cw = w / cols, ch = h / rows;
    for (let i = 0; i <= cols; i++) {
      g.lineWidth = i === 0 || i === cols ? 10 : 3.5;
      g.beginPath(); g.moveTo(i * cw, 0); g.lineTo(i * cw, h); g.stroke();
    }
    for (let j = 0; j <= rows; j++) {
      g.lineWidth = j === 0 || j === rows ? 10 : 3.5;
      g.beginPath(); g.moveTo(0, j * ch); g.lineTo(w, j * ch); g.stroke();
    }
    // small decorative squares
    g.lineWidth = 2;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const cx = (i + .5) * cw, cy = (j + .5) * ch, s = Math.min(cw, ch) * .24;
      g.strokeRect(cx - s, cy - s, s * 2, s * 2);
    }
  }
  if (border) {
    g.strokeStyle = '#2a1210'; g.lineWidth = 20; g.strokeRect(0, 0, w, h);
    g.strokeStyle = line; g.lineWidth = 5; g.strokeRect(12, 12, w - 24, h - 24);
  }
  return canvasTexture(c, { repeat });
}

export function makeGroundTexture(repeat = [1, 1]) {
  const w = 512, h = 512;
  const c = makeCanvas(w, h), g = c.getContext('2d');
  g.fillStyle = '#6d7b5c'; g.fillRect(0, 0, w, h);
  const rnd = mulberry32(55);
  for (let i = 0; i < 50000; i++) {
    const v = rnd();
    g.fillStyle = v < .5 ? `rgba(46,60,38,${.03 + rnd() * .12})` : `rgba(142,151,110,${.02 + rnd() * .09})`;
    g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 3);
  }
  for (let i = 0; i < 500; i++) {
    g.fillStyle = `rgba(80,100,55,${.04 + rnd() * .08})`;
    g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 3 + rnd() * 14, 1 + rnd() * 3, rnd() * 3, 0, Math.PI * 2); g.fill();
  }
  return canvasTexture(c, { repeat });
}

export function makePathTexture(repeat = [1, 1]) {
  const w = 512, h = 512;
  const c = makeCanvas(w, h), g = c.getContext('2d');
  g.fillStyle = '#a7a195'; g.fillRect(0, 0, w, h);
  const rnd = mulberry32(66);
  const sw = 128, sh = 64;
  for (let y = 0; y < h; y += sh) {
    const off = (y / sh) % 2 ? sw / 2 : 0;
    for (let x = -sw; x < w; x += sw) {
      const v = 150 + Math.floor(rnd() * 35);
      g.fillStyle = `rgb(${v},${v - 3},${v - 10})`;
      g.fillRect(x + off + 2, y + 2, sw - 4, sh - 4);
      g.fillStyle = 'rgba(255,255,255,0.09)';
      g.fillRect(x + off + 4, y + 4, sw - 8, 2);
    }
  }
  noiseOverlay(g, w, h, rnd, 0.07, 14000, false);
  return canvasTexture(c, { repeat });
}

export function makeAsphaltTexture(repeat = [1, 1]) {
  const w = 256, h = 256;
  const c = makeCanvas(w, h), g = c.getContext('2d');
  g.fillStyle = '#3d4142'; g.fillRect(0, 0, w, h);
  const rnd = mulberry32(77);
  for (let i = 0; i < 12000; i++) {
    const v = 40 + rnd() * 80;
    g.fillStyle = `rgba(${v},${v},${v},${.05 + rnd() * .2})`;
    g.fillRect(rnd() * w, rnd() * h, 1, 1);
  }
  return canvasTexture(c, { repeat });
}

export function makeWaterNormal(repeat = [1, 1]) {
  const w = 256, h = 256;
  const c = makeCanvas(w, h), g = c.getContext('2d');
  const img = g.createImageData(w, h);
  const rnd = mulberry32(88);
  const field = new Float32Array(w * h);
  for (let i = 0; i < field.length; i++) field[i] = rnd();
  // smooth a few times
  const sm = new Float32Array(w * h);
  for (let pass = 0; pass < 4; pass++) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        s += field[((y + dy + h) % h) * w + ((x + dx + w) % w)];
      }
      sm[y * w + x] = s / 9;
    }
    field.set(sm);
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const l = field[y * w + (x - 1 + w) % w], r = field[y * w + (x + 1) % w];
    const u = field[((y - 1 + h) % h) * w + x], d = field[((y + 1) % h) * w + x];
    const nx = (l - r) * 3.0, ny = (u - d) * 3.0;
    const i = (y * w + x) * 4;
    img.data[i] = 128 + nx * 127;
    img.data[i + 1] = 128 + ny * 127;
    img.data[i + 2] = 255;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  return t;
}

export function makeWeatheredRoofTexture() {
  const w = 512, h = 512;
  const c = makeCanvas(w, h), g = c.getContext('2d');
  const rnd = mulberry32(2026);
  // 旧镀锌铁皮基色：浅灰带轻微冷暖变化
  g.fillStyle = '#b4b1a8'; g.fillRect(0, 0, w, h);
  const base = g.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, 'rgba(196,193,184,.5)');
  base.addColorStop(.5, 'rgba(158,157,150,.35)');
  base.addColorStop(1, 'rgba(188,183,172,.45)');
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  // 铁皮拼缝（横向板缝 + 细竖缝）
  g.strokeStyle = 'rgba(76,74,68,.28)'; g.lineWidth = 1.6;
  for (let y = 0; y < h; y += 38) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  for (let x = 0; x < w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  // 不规则锈斑：集中在板缝与搭接处，边缘晕开
  for (let i = 0; i < 34; i++) {
    const x = rnd() * w, y = Math.round(rnd() * h / 38) * 38;
    const rx = 26 + rnd() * 90, ry = 10 + rnd() * 26;
    const rg = g.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
    const a = .18 + rnd() * .3;
    rg.addColorStop(0, `rgba(118,64,40,${a})`);
    rg.addColorStop(.55, `rgba(132,78,50,${a * .55})`);
    rg.addColorStop(1, 'rgba(140,86,56,0)');
    g.save(); g.translate(x, y); g.scale(1, ry / rx); g.translate(-x, -y);
    g.fillStyle = rg; g.beginPath(); g.arc(x, y, rx, 0, Math.PI * 2); g.fill(); g.restore();
  }
  // 锈水下淌痕迹
  for (let i = 0; i < 26; i++) {
    const x = rnd() * w, y = rnd() * h * .8, len = 24 + rnd() * 90;
    const lg = g.createLinearGradient(0, y, 0, y + len);
    lg.addColorStop(0, `rgba(120,68,44,${.16 + rnd() * .18})`);
    lg.addColorStop(1, 'rgba(120,68,44,0)');
    g.fillStyle = lg; g.fillRect(x, y, 1.4 + rnd() * 3.2, len);
  }
  // 少量泛白氧化斑
  for (let i = 0; i < 16; i++) {
    const x = rnd() * w, y = rnd() * h, r = 16 + rnd() * 50;
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `rgba(238,235,226,${.12 + rnd() * .18})`);
    rg.addColorStop(1, 'rgba(238,235,226,0)');
    g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  noiseOverlay(g, w, h, rnd, 0.045, 6000, false);
  return canvasTexture(c, { repeat: [3, 2] });
}

/** 体艺馆等大跨度建筑的灰色石材幕墙：大块石板 + 深缝 + 轻微色差 */
export function makeStonePanelTexture() {
  const w = 512, h = 512;
  const c = makeCanvas(w, h), g = c.getContext('2d');
  const rnd = mulberry32(4411);
  g.fillStyle = '#a7a7a1'; g.fillRect(0, 0, w, h);
  // 大板色差
  for (let y = 0; y < h; y += 64) {
    for (let x = 0; x < w; x += 128) {
      const v = 158 + rnd() * 26 | 0;
      g.fillStyle = `rgba(${v},${v},${v - 4},${.25 + rnd() * .2})`;
      g.fillRect(x + 1, y + 1, 126, 62);
    }
  }
  // 石纹斑驳
  for (let i = 0; i < 220; i++) {
    const x = rnd() * w, y = rnd() * h, r = 3 + rnd() * 16;
    g.fillStyle = rnd() > .5 ? `rgba(90,92,90,${rnd() * .12})` : `rgba(220,218,210,${rnd() * .12})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // 板缝
  g.strokeStyle = 'rgba(58,60,58,.5)'; g.lineWidth = 2;
  for (let y = 0; y <= h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  for (let x = 0; x <= w; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  noiseOverlay(g, w, h, rnd, 0.035, 5000, false);
  return canvasTexture(c, { repeat: [3, 2] });
}

export function makeFacadeTexture({
  w = 512, h = 1024, floors = 4, bays = 8, style = 'redbrick', night = false, seed = 1
} = {}) {
  const c = makeCanvas(w, h), g = c.getContext('2d');
  const rnd = mulberry32(seed * 997 + (night ? 5 : 0));
  const campus = style === 'campus';
  const base = campus ? '#f2eee5' : style === 'redbrick' ? '#9a5b47' : style === 'grey' ? '#b9b3a4' : '#d8d2c2';
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  if (!campus) {
    if (style === 'redbrick') {
      const bh = 10;
      for (let y = 0; y < h; y += bh) {
        g.fillStyle = `rgba(0,0,0,${.025 + rnd() * .03})`; g.fillRect(0, y, w, 1);
        for (let x = -20; x < w; x += 40) {
          g.fillStyle = `rgba(255,235,220,${rnd() * .035})`; g.fillRect(x + ((y / bh) % 2) * 20, y, 38, bh - 1);
        }
      }
    } else {
      noiseOverlay(g, w, h, rnd, 0.06, 5000, false);
    }
  } else {
    noiseOverlay(g, w, h, rnd, 0.035, 7000, false);
    for (let i = 0; i < 22; i++) {
      g.fillStyle = `rgba(90,80,65,${.012 + rnd() * .02})`;
      g.beginPath(); g.ellipse(rnd() * w, rnd() * h, 12 + rnd() * 60, 5 + rnd() * 18, rnd() * 3, 0, Math.PI * 2); g.fill();
    }
  }
  const bandH = campus ? 8 : 10;
  const topPad = campus ? 30 : 26, floorH = (h - topPad - 28) / floors;
  for (let f = 0; f <= floors; f++) {
    const y = topPad + f * floorH;
    g.fillStyle = campus ? '#8d5245' : '#e9e4d7';
    g.fillRect(0, y - bandH / 2, w, bandH);
    g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(0, y + bandH / 2 - 2, w, 2);
    if (campus) { g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, y - bandH / 2, w, 1); }
  }
  const bayW = w / bays;
  for (let f = 0; f < floors; f++) {
    for (let b = 0; b < bays; b++) {
      const x = b * bayW + bayW * .17;
      const y = topPad + f * floorH + floorH * .26;
      const ww = bayW * .66, wh = floorH * .46;
      if (campus) {
        // red-brown window surround
        g.fillStyle = '#8d5245'; g.fillRect(x - 4, y - 4, ww + 8, wh + 8);
        g.fillStyle = '#efe9da'; g.fillRect(x - 1, y - 1, ww + 2, wh + 2);
      } else {
        g.fillStyle = '#d6d0c3'; g.fillRect(x - 5, y - 5, ww + 10, wh + 10);
      }
      const isLit = night && rnd() < 0.5;
      if (isLit) {
        const gr = g.createLinearGradient(x, y, x, y + wh);
        gr.addColorStop(0, '#ffe6a8'); gr.addColorStop(1, '#f5b75d');
        g.fillStyle = gr;
      } else {
        const gr = g.createLinearGradient(x, y, x + ww, y + wh);
        gr.addColorStop(0, night ? '#1b2733' : '#4c5b64');
        gr.addColorStop(.55, night ? '#273846' : '#7d949b');
        gr.addColorStop(1, night ? '#16202a' : '#3f4f58');
        g.fillStyle = gr;
      }
      g.fillRect(x, y, ww, wh);
      g.strokeStyle = campus ? 'rgba(238,233,221,0.85)' : night ? 'rgba(20,26,30,0.9)' : 'rgba(60,75,78,0.65)';
      g.lineWidth = campus ? 4 : 3;
      g.beginPath(); g.moveTo(x + ww / 2, y); g.lineTo(x + ww / 2, y + wh); g.stroke();
      g.beginPath(); g.moveTo(x, y + wh / 2); g.lineTo(x + ww, y + wh / 2); g.stroke();
      if (isLit) {
        g.fillStyle = 'rgba(255,220,160,0.16)'; g.fillRect(x - 10, y - 10, ww + 20, wh + 20);
      }
      g.fillStyle = campus ? 'rgba(255,255,250,0.55)' : 'rgba(255,255,245,0.35)';
      g.fillRect(x - 8, y + wh + 5, ww + 16, 5);
    }
  }
  if (campus) {
    // slender vertical pilasters between bays
    g.fillStyle = 'rgba(157,90,72,0.85)';
    for (let b = 0; b <= bays; b++) g.fillRect(b * bayW - 1, topPad, 2, h - topPad - 28);
    // roof fascia and base
    g.fillStyle = '#8d5245'; g.fillRect(0, 0, w, 12);
    g.fillStyle = '#e9e4d8'; g.fillRect(0, 12, w, topPad - 12);
    g.fillStyle = '#b9b2a4'; g.fillRect(0, h - 30, w, 30);
    g.fillStyle = 'rgba(80,70,55,0.18)'; g.fillRect(0, h - 34, w, 4);
  } else {
    g.fillStyle = style === 'redbrick' ? '#6d6a60' : '#9d998d';
    g.fillRect(0, h - 20, w, 20);
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, h - 24, w, 4);
  }
  const map = canvasTexture(c);
  return { map };
}

export function makeNightGlowTexture() {
  const s = 128;
  const c = makeCanvas(s, s), g = c.getContext('2d');
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, 'rgba(255,235,190,1)');
  gr.addColorStop(0.18, 'rgba(255,205,125,0.75)');
  gr.addColorStop(0.5, 'rgba(255,170,80,0.22)');
  gr.addColorStop(1, 'rgba(255,150,60,0)');
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
  return canvasTexture(c);
}

export function makeLeafTexture(color = '#ffffff') {
  const s = 64;
  const c = makeCanvas(s, s), g = c.getContext('2d');
  g.clearRect(0, 0, s, s);
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(s / 2, s / 2, s * .28, s * .13, Math.PI / 4, 0, Math.PI * 2);
  g.fill();
  return canvasTexture(c);
}

export function makeFacadeEmissive({ w = 512, h = 1024, floors = 4, bays = 8, seed = 1 } = {}) {
  const c = makeCanvas(w, h), g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
  const rnd = mulberry32(seed * 997 + 5);
  const topPad = 26, floorH = (h - topPad - 26) / floors;
  const bayW = w / bays;
  for (let f = 0; f < floors; f++) {
    for (let b = 0; b < bays; b++) {
      const x = b * bayW + bayW * .18;
      const y = topPad + f * floorH + floorH * .22;
      const ww = bayW * .64, wh = floorH * .5;
      const isLit = rnd() < 0.55;
      if (!isLit) continue;
      const gr = g.createLinearGradient(x, y, x, y + wh);
      gr.addColorStop(0, '#ffe8b0'); gr.addColorStop(1, '#f3a94f');
      g.fillStyle = gr; g.fillRect(x, y, ww, wh);
      g.fillStyle = 'rgba(255,180,90,0.20)';
      g.fillRect(x - 10, y - 10, ww + 20, wh + 20);
      g.strokeStyle = 'rgba(40,20,5,0.9)'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(x + ww / 2, y); g.lineTo(x + ww / 2, y + wh); g.stroke();
    }
  }
  return canvasTexture(c, { srgb: true });
}

export function makeGlowSpriteTexture(color = '255,190,110') {
  const s = 128;
  const c = makeCanvas(s, s), g = c.getContext('2d');
  const gr = g.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2);
  gr.addColorStop(0, `rgba(${color},0.95)`);
  gr.addColorStop(0.25, `rgba(${color},0.42)`);
  gr.addColorStop(0.55, `rgba(${color},0.12)`);
  gr.addColorStop(1, `rgba(${color},0)`);
  g.fillStyle = gr; g.fillRect(0,0,s,s);
  return canvasTexture(c, { srgb: true });
}

/** 大成殿内墙：金木画框成排的孔子圣迹图（低分辨率示意，不画具体人物） */
export function makeMuralTexture() {
  const w = 2048, h = 320;
  const c = makeCanvas(w, h), g = c.getContext('2d');
  const rnd = mulberry32(97);
  g.fillStyle = '#2a1712'; g.fillRect(0, 0, w, h);
  const cols = 8, rows = 2, mx = 14, my = 14;
  const cw = (w - mx * 2) / cols, ch = (h - my * 2) / rows;
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < cols; i++) {
      const x = mx + i * cw, y = my + r * ch;
      g.fillStyle = '#1a0d0a'; g.fillRect(x + 2, y + 2, cw - 4, ch - 4);
      const px = x + 8, py = y + 8, pw = cw - 16, ph = ch - 16;
      const grad = g.createLinearGradient(px, py, px + pw, py + ph);
      grad.addColorStop(0, '#c9a86b');
      grad.addColorStop(.45, ['#8a6a3f', '#7a5a36', '#6f5030', '#94744a'][Math.floor(rnd() * 4)]);
      grad.addColorStop(1, '#3a2415');
      g.fillStyle = grad; g.fillRect(px, py, pw, ph);
      g.fillStyle = 'rgba(220,196,150,.22)'; g.fillRect(px, py, pw, ph * .32);
      g.fillStyle = 'rgba(50,32,20,.55)';
      g.beginPath(); g.moveTo(px, py + ph * .72);
      for (let k = 0; k < 5; k++) g.lineTo(px + pw * (k + .5) / 5, py + ph * (.52 + rnd() * .16));
      g.lineTo(px + pw, py + ph * .75); g.lineTo(px + pw, py + ph); g.lineTo(px, py + ph); g.closePath(); g.fill();
      const n = 2 + Math.floor(rnd() * 3);
      for (let k = 0; k < n; k++) {
        const fx = px + pw * (.12 + rnd() * .72), fy = py + ph * (.5 + rnd() * .28);
        g.fillStyle = 'rgba(28,16,10,.8)';
        g.beginPath(); g.ellipse(fx, fy, 5 + rnd() * 3, 14 + rnd() * 6, 0, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(fx, fy - 15, 4, 0, Math.PI * 2); g.fill();
      }
      g.strokeStyle = 'rgba(196,152,82,.55)'; g.lineWidth = 2; g.strokeRect(px + 1.5, py + 1.5, pw - 3, ph - 3);
      for (let k = 0; k < 40; k++) {
        g.fillStyle = `rgba(30,18,10,${.03 + rnd() * .07})`;
        g.fillRect(px + rnd() * pw, py + rnd() * ph, 1.5, 1.5);
      }
    }
  }
  g.fillStyle = '#2b1410';
  for (let i = 1; i < cols; i++) g.fillRect(mx + i * cw - 3, 0, 6, h);
  g.fillRect(0, my + ch - 3, w, 6);
  g.fillStyle = '#160b08'; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10);
  return canvasTexture(c, { repeat: [1, 1] });
}

/** 大成殿天花两坡的蓝白椽花带（可沿长向重复） */
export function makeCofferTexture() {
  const s = 256;
  const c = makeCanvas(s, s), g = c.getContext('2d');
  g.fillStyle = '#263e58'; g.fillRect(0, 0, s, s);
  g.strokeStyle = 'rgba(230,235,225,.72)'; g.lineWidth = 3;
  for (let i = -s; i <= s; i += 32) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i + s, s); g.stroke();
    g.beginPath(); g.moveTo(i, s); g.lineTo(i + s, 0); g.stroke();
  }
  g.fillStyle = 'rgba(240,238,220,.85)';
  for (let x = 0; x <= s; x += 32) for (let y = 0; y <= s; y += 32) {
    g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = 'rgba(200,160,90,.55)';
  for (let x = 16; x < s; x += 32) for (let y = 16; y < s; y += 32) g.fillRect(x - 2, y - 2, 4, 4);
  return canvasTexture(c, { repeat: [1, 1] });
}

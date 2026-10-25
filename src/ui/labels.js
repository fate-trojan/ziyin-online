import * as THREE from 'three';

const isMobile = matchMedia('(max-width: 820px), (pointer: coarse)').matches;

export class Labels {
  constructor(container, camera, landmarks, { onSelect, onHover } = {}) {
    this.container = container;
    this.camera = camera;
    this.landmarks = landmarks;
    this.onSelect = onSelect;
    this.onHover = onHover;
    this.enabled = true;
    this.items = [];
    this.activeId = null;
    this._v = new THREE.Vector3();
    for (const l of landmarks) {
      const el = document.createElement('button');
      el.className = 'label' + (l.priority === 1 ? ' primary' : '');
      el.dataset.id = l.id;
      el.innerHTML = `<span class="label-dot"></span><span class="label-pill"><span class="label-name">${l.name}</span><span class="label-en">${l.en}</span></span>`;
      el.addEventListener('click', (e) => { e.stopPropagation(); this.select(l.id); });
      el.addEventListener('mouseenter', () => this.onHover?.(l));
      el.addEventListener('mouseleave', () => this.onHover?.(null));
      container.appendChild(el);
      this.items.push({ l, el });
    }
  }

  setEnabled(v) {
    this.enabled = v;
    this.container.style.display = v ? 'block' : 'none';
  }

  select(id) {
    this.activeId = id;
    for (const it of this.items) it.el.classList.toggle('active', it.l.id === id);
    const l = this.landmarks.find(x => x.id === id);
    if (l) this.onSelect?.(l);
  }

  update(camera) {
    if (!this.enabled) return;
    const w = innerWidth, h = innerHeight;
    const placed = [];
    const list = [];
    for (const it of this.items) {
      const { l, el } = it;
      this._v.set(l.pos[0], l.pos[1], l.pos[2]).project(camera);
      const visible = this._v.z > -1 && this._v.z < 1 && Math.abs(this._v.x) < 1.06 && Math.abs(this._v.y) < 1.04;
      if (!visible) { el.style.opacity = '0'; el.style.pointerEvents = 'none'; continue; }
      const x = (this._v.x * .5 + .5) * w;
      const y = (-this._v.y * .5 + .5) * h;
      list.push({ l, el, x, y, z: this._v.z });
    }
    list.sort((a, b) => a.y - b.y);
    for (const it of list) {
      let y = it.y;
      const priority = it.l.priority === 1;
      const wBox = priority ? 100 : 78, hBox = 34;
      for (let guard = 0; guard < 6; guard++) {
        const hit = placed.some(p => Math.abs(p.x - it.x) < wBox && Math.abs(p.y - y) < hBox);
        if (!hit) break;
        y -= priority ? 26 : 32;
      }
      placed.push({ x: it.x, y });
      it.el.style.opacity = priority ? '1' : (isMobile ? '0' : '.7');
      it.el.style.pointerEvents = priority || !isMobile ? 'auto' : 'none';
      it.el.style.left = `${it.x}px`; it.el.style.top = `${y}px`;
      it.el.style.zIndex = String(1000 - Math.round(it.z * 100));
    }
  }
}

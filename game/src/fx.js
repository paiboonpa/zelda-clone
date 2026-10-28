import * as THREE from 'three';
import { TAU } from './util.js';
import { BushCutEffects } from './bush-cut.js';

const MAX = 2500;

/** Pooled additive point particles plus streaks, rings and a sword trail. */
export class FX {
  constructor(scene) {
    this.scene = scene;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 4);
    this.size = new Float32Array(MAX);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 800 } },
      vertexShader: `attribute float size; attribute vec4 pcolor; varying vec4 vC; uniform float uScale;
        void main(){ vC=pcolor; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=size*uScale/max(0.1,-mv.z); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying vec4 vC; void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,.0,d); gl_FragColor=vec4(vC.rgb*(1.+ (1.-d*2.)*.6), vC.a*a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    scene.add(this.points);
    this.parts = [];
    for (let i = 0; i < MAX; i++) this.parts.push({ life: 0 });
    this.cursor = 0;
    this.meshes = [];
    this.streakTex = makeStreakTexture();
    this.trail = new Trail(scene);
    this.bushCuts = new BushCutEffects(scene);
  }

  setScale(h, fov) { this.mat.uniforms.uScale.value = h / 2 / Math.tan(fov * Math.PI / 360); }

  attach(scene) {
    this.scene = scene;
    scene.add(this.points);
    this.trail.attach(scene);
    this.bushCuts.attach(scene);
    for (const m of this.meshes) m.mesh.removeFromParent();
    this.meshes.length = 0;
    for (const p of this.parts) p.life = 0;
  }

  emit(x, y, z, o) {
    const p = this.parts[this.cursor];
    this.cursor = (this.cursor + 1) % MAX;
    p.x = x; p.y = y; p.z = z;
    p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0;
    p.life = p.max = o.life || 1;
    p.s0 = o.size ?? 0.2; p.s1 = o.size1 ?? 0;
    p.r = o.color[0]; p.g = o.color[1]; p.b = o.color[2]; p.a = o.alpha ?? 1;
    p.grav = o.gravity || 0; p.drag = o.drag || 0;
    p.swirl = o.swirl || 0; p.cx = o.cx ?? x; p.cz = o.cz ?? z;
  }

  burst(x, y, z, { count = 20, color = [1, 1, 1], speed = 4, life = 0.6, size = 0.2, size1 = 0, gravity = 0, up = 0, spread = 1, drag = 1, jitter = 0.3, alpha = 1 } = {}) {
    for (let i = 0; i < count; i++) {
      const th = Math.random() * TAU, ph = Math.acos(Math.random() * 2 - 1);
      const s = speed * (0.4 + Math.random() * 0.6);
      const c = color.length === 2 ? (Math.random() < 0.5 ? color[0] : color[1]) : color;
      this.emit(x + (Math.random() - 0.5) * jitter, y + (Math.random() - 0.5) * jitter, z + (Math.random() - 0.5) * jitter, {
        vx: Math.sin(ph) * Math.cos(th) * s * spread, vy: Math.cos(ph) * s * spread + up, vz: Math.sin(ph) * Math.sin(th) * s * spread,
        life: life * (0.6 + Math.random() * 0.6), size, size1, color: c, gravity, drag, alpha,
      });
    }
  }

  // ---- presets -----------------------------------------------------------
  hit(x, y, z, dirYaw = 0) {
    this.burst(x, y, z, { count: 26, color: [[1, 0.85, 0.95], [1, 0.4, 0.65]], speed: 9, life: 0.35, size: 0.18, drag: 4 });
    this.streak(x, y, z, dirYaw + Math.PI / 2, [1, 0.45, 0.75], 3.2, 0.26);
    this.streak(x, y, z, dirYaw + Math.PI / 2 + 0.9, [1, 0.9, 1], 2.0, 0.2);
  }
  clink(x, y, z) { this.burst(x, y, z, { count: 14, color: [1, 0.95, 0.6], speed: 6, life: 0.25, size: 0.12, drag: 3, gravity: -10 }); }
  defeat(x, y, z) {
    this.burst(x, y + 0.5, z, { count: 90, color: [[0.55, 0.2, 1], [0.9, 0.35, 1]], speed: 4, life: 1.1, size: 0.35, up: 2, drag: 1.5 });
    for (let i = 0; i < 40; i++) this.emit(x, y + Math.random() * 2, z, { vx: 0, vy: 2 + Math.random() * 3, vz: 0, life: 1.2, size: 0.25, color: [0.4, 0.15, 1], swirl: 6, cx: x, cz: z, drag: 0.5 });
    this.streak(x, y + 1, z, 0, [1, 0.5, 0.9], 6, 0.4, true);
    this.ring(x, y + 0.05, z, [0.6, 0.3, 1], 3, 0.6);
  }
  spin(x, y, z) {
    this.ring(x, y + 0.6, z, [0.4, 0.75, 1], 3.6, 0.45);
    this.ring(x, y + 0.3, z, [0.7, 0.5, 1], 3.0, 0.55);
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * TAU, r = 1 + Math.random() * 2.2;
      this.emit(x + Math.cos(a) * r, y + 0.4 + Math.random() * 0.6, z + Math.sin(a) * r, { vx: -Math.sin(a) * 6, vy: Math.random(), vz: Math.cos(a) * 6, life: 0.5, size: 0.22, color: Math.random() < 0.5 ? [0.45, 0.8, 1] : [0.8, 0.55, 1], drag: 3 });
    }
  }
  charge(x, y, z, ready) {
    const c = ready ? [0.5, 0.85, 1] : [0.35, 0.55, 1];
    this.emit(x + (Math.random() - 0.5) * 0.3, y + (Math.random() - 0.5) * 0.3, z + (Math.random() - 0.5) * 0.3, { vy: 0.6, life: 0.35, size: ready ? 0.22 : 0.12, color: c });
  }
  dust(x, y, z, color = [0.75, 0.68, 0.55], n = 8) { this.burst(x, y + 0.1, z, { count: n, color, speed: 1.6, life: 0.6, size: 0.35, size1: 0.6, up: 0.6, drag: 3, alpha: 0.4 }); }
  cutBush(mesh, yaw = 0) {
    this.bushCuts.cut(mesh, yaw);
    this.dust(mesh.position.x, mesh.position.y, mesh.position.z, [.4,.48,.25], 5);
  }
  leaves(x, y, z) { this.burst(x, y + 0.3, z, { count: 18, color: [[0.35, 0.75, 0.25], [0.55, 0.85, 0.3]], speed: 4, life: 0.9, size: 0.14, gravity: -6, up: 3, drag: 1.5 }); }
  splash(x, y, z) { this.burst(x, y, z, { count: 14, color: [0.75, 0.9, 1], speed: 2.5, life: 0.5, size: 0.12, gravity: -12, up: 3, drag: 0.5 }); }
  sparkle(x, y, z, color = [0.6, 1, 0.6]) { this.burst(x, y, z, { count: 12, color, speed: 2.5, life: 0.5, size: 0.14, up: 1, drag: 2 }); }
  rocks(x, y, z) { this.burst(x, y + 0.2, z, { count: 24, color: [0.55, 0.52, 0.48], speed: 5, life: 0.8, size: 0.2, gravity: -16, up: 3, drag: 0.5 }); this.dust(x, y, z, [0.7, 0.68, 0.6], 10); }
  mote(x, y, z, color = [1, 0.85, 0.4]) { this.emit(x, y, z, { vx: (Math.random() - 0.5) * 0.3, vy: 0.2 + Math.random() * 0.2, vz: (Math.random() - 0.5) * 0.3, life: 4, size: 0.08, color, alpha: 0.8 }); }

  streak(x, y, z, yaw, color, len, life, vertical = false) {
    const mat = new THREE.MeshBasicMaterial({ map: this.streakTex, color: new THREE.Color(...color), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.35), mat);
    mesh.position.set(x, y, z);
    if (vertical) mesh.rotation.set(0, Math.random() * TAU, Math.PI / 2);
    else mesh.rotation.set((Math.random() - 0.5) * 1.2, yaw, (Math.random() - 0.5) * 1.4);
    this.scene.add(mesh);
    this.meshes.push({ mesh, life, max: life, kind: 'streak' });
  }
  ring(x, y, z, color, radius, life) {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(...color), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.meshes.push({ mesh, life, max: life, kind: 'ring', radius });
  }

  update(dt) {
    const P = this.pos, C = this.col, S = this.size;
    for (let i = 0; i < MAX; i++) {
      const p = this.parts[i];
      if (p.life <= 0) { S[i] = 0; C[i * 4 + 3] = 0; continue; }
      p.life -= dt;
      const k = Math.max(0, 1 - p.drag * dt);
      p.vx *= k; p.vy = p.vy * k + p.grav * dt; p.vz *= k;
      if (p.swirl) {
        const dx = p.x - p.cx, dz = p.z - p.cz;
        p.vx = -dz * p.swirl * 0.3 - dx * 0.5; p.vz = dx * p.swirl * 0.3 - dz * 0.5;
        const r = Math.hypot(dx, dz);
        if (r < 0.3) { p.vx += (Math.random() - 0.5) * 3; p.vz += (Math.random() - 0.5) * 3; }
      }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const t = 1 - p.life / p.max;
      P[i * 3] = p.x; P[i * 3 + 1] = p.y; P[i * 3 + 2] = p.z;
      C[i * 4] = p.r; C[i * 4 + 1] = p.g; C[i * 4 + 2] = p.b; C[i * 4 + 3] = p.a * Math.min(1, (1 - t) * 2);
      S[i] = p.s0 + (p.s1 - p.s0) * t;
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true; g.attributes.pcolor.needsUpdate = true; g.attributes.size.needsUpdate = true;
    for (let i = this.meshes.length - 1; i >= 0; i--) {
      const m = this.meshes[i];
      m.life -= dt;
      const t = 1 - m.life / m.max;
      if (m.kind === 'ring') { const s = 0.3 + t * m.radius; m.mesh.scale.set(s, s, s); }
      else m.mesh.scale.set(1 + t * 0.6, 1 - t * 0.7, 1);
      m.mesh.material.opacity = Math.max(0, 1 - t);
      if (m.life <= 0) { m.mesh.removeFromParent(); m.mesh.geometry.dispose(); m.mesh.material.dispose(); this.meshes.splice(i, 1); }
    }
    this.trail.update(dt);
    this.bushCuts.update(dt);
  }
}

function makeStreakTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 16;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 128, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 16);
  const v = x.getImageData(0, 0, 128, 16);
  for (let yy = 0; yy < 16; yy++) for (let xx = 0; xx < 128; xx++) { const f = 1 - Math.abs(yy - 7.5) / 8; v.data[(yy * 128 + xx) * 4 + 3] *= f * f; }
  x.putImageData(v, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Ribbon following the sword between base and tip samples. */
class Trail {
  constructor(scene) {
    this.n = 14;
    this.samples = [];
    const g = new THREE.BufferGeometry();
    this.posArr = new Float32Array(this.n * 2 * 3);
    this.alphaArr = new Float32Array(this.n * 2);
    g.setAttribute('position', new THREE.BufferAttribute(this.posArr, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alphaArr, 1).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    for (let i = 0; i < this.n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0.85, 0.95, 1) } },
      vertexShader: 'attribute float alpha; varying float vA; void main(){ vA=alpha; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: 'uniform vec3 uColor; varying float vA; void main(){ gl_FragColor=vec4(uColor, vA); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }
  attach(scene) { scene.add(this.mesh); this.samples.length = 0; }
  push(base, tip, color) {
    this.samples.unshift({ b: base.clone(), t: tip.clone(), age: 0 });
    if (this.samples.length > this.n) this.samples.pop();
    if (color) this.mat.uniforms.uColor.value.setRGB(...color);
  }
  update(dt) {
    for (const s of this.samples) s.age += dt;
    while (this.samples.length && this.samples[this.samples.length - 1].age > 0.16) this.samples.pop();
    const P = this.posArr, A = this.alphaArr;
    for (let i = 0; i < this.n; i++) {
      const s = this.samples[Math.min(i, this.samples.length - 1)];
      if (!s || this.samples.length < 2) { A[i * 2] = A[i * 2 + 1] = 0; continue; }
      P.set([s.b.x, s.b.y, s.b.z], i * 6); P.set([s.t.x, s.t.y, s.t.z], i * 6 + 3);
      const a = Math.max(0, 1 - s.age / 0.16) * (1 - i / this.n) * 0.75;
      A[i * 2] = a * 0.1; A[i * 2 + 1] = a;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.alpha.needsUpdate = true;
  }
}

import * as THREE from 'three';
import * as M from './models.js';
import { clamp, rng } from './util.js';
import { tex, bump } from './textures.js';

/**
 * Runtime for one scene: terrain, collision, props and the authoring API scene
 * definitions call from build(). Collision uses circles, boxes, a bounds shape and
 * walkable platforms on top of a height function.
 */
export class World {
  constructor(def, game) {
    this.def = def;
    this.game = game;
    this.scene = new THREE.Scene();
    this.circles = []; this.boxes = []; this.platforms = []; this.water = [];
    this.occluders = []; this.portals = []; this.npcs = []; this.enemies = [];
    this.bushes = []; this.rocks = []; this.chests = []; this.signs = []; this.pickups = [];
    this.triggers = []; this.mapMarks = []; this.animated = [];
    this.heightFn = def.height || (() => 0);
    this.bounds = def.bounds;
    this.rand = rng(def.seed || 7);
    this.buildEnvironment();
    game.world = this;
    def.build(this, game);
  }

  // ------------------------------------------------------------ environment
  buildEnvironment() {
    const d = this.def, s = this.scene;
    s.fog = new THREE.Fog(d.fog.color, d.fog.near, d.fog.far);
    s.background = new THREE.Color(d.fog.color);
    if (d.sky) {
      const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 12), new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: { top: { value: new THREE.Color(d.sky.top) }, bottom: { value: new THREE.Color(d.sky.bottom) } },
        vertexShader: 'varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
        fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vP;
          float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
          float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
            return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
          float fbm(vec2 p){ float s=0., a=.5; for(int k=0;k<5;k++){ s+=a*n(p); p*=2.03; a*=.5; } return s; }
          void main(){ float t=clamp(vP.y*1.6+0.15,0.,1.); vec3 c=mix(bottom,top,t);
            vec2 q=vP.xz/(vP.y+0.18)*1.4;
            float cl=smoothstep(.48,.78, fbm(q))*smoothstep(0.02,.25,vP.y);
            c=mix(c, vec3(1.,.99,.97), cl*${d.sky.clouds ?? 0.0});
            gl_FragColor=vec4(c,1.);
            #include <colorspace_fragment>
          }`,
      }));
      sky.renderOrder = -1; s.add(sky); this.sky = sky;
    }
    const L = d.light;
    s.add(new THREE.HemisphereLight(L.sky, L.ground, L.hemi));
    const sun = new THREE.DirectionalLight(L.sun, L.sunI);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = sc.bottom = -26; sc.right = sc.top = 26; sc.near = 1; sc.far = 120;
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
    s.add(sun); s.add(sun.target);
    this.sun = sun; this.sunDir = new THREE.Vector3(...L.dir).normalize();

    // Terrain mesh sampled from the height and color functions.
    const g = d.ground;
    const geo = new THREE.PlaneGeometry(g.size, g.size, g.seg, g.seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + (g.cx || 0), z = pos.getZ(i) + (g.cz || 0);
      const h = this.heightFn(x, z);
      pos.setXYZ(i, x, h, z);
      const c = g.color(x, z, h);
      colors.set(c, i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const tmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
    if (g.tex) {
      const rep = g.size / (g.texScale || 3);
      tmat.map = tex(g.tex, rep, rep);
      tmat.bumpMap = bump(g.tex, rep, rep); tmat.bumpScale = 2;
    }
    const terrain = new THREE.Mesh(geo, tmat);
    terrain.receiveShadow = true;
    s.add(terrain);
    this.terrain = terrain;
  }

  // ------------------------------------------------------------- authoring
  add(obj, x = 0, z = 0, yaw = 0, y = null) {
    obj.position.set(x, y ?? this.heightFn(x, z), z);
    obj.rotation.y = yaw;
    this.scene.add(obj);
    return obj;
  }
  circle(x, z, r, occlude = null) { this.circles.push({ x, z, r }); if (occlude) this.occluders.push(occlude); }
  box(x, z, hw, hd, yaw = 0, top = 99) { this.boxes.push({ x, z, hw, hd, c: Math.cos(yaw), s: Math.sin(yaw), top }); }
  /** Solid walkable block: collides below its top, can be stood on. */
  platform(x, z, hw, hd, top, color = '#8a857a', visible = true) {
    this.platforms.push({ x, z, hw, hd, top });
    if (visible) {
      const base = this.heightFn(x, z) - 1;
      const m = new THREE.Mesh(new THREE.BoxGeometry(hw * 2, top - base, hd * 2), M.mat(color, { flat: true }));
      m.position.set(x, (top + base) / 2, z);
      m.castShadow = m.receiveShadow = true;
      this.scene.add(m);
      this.occluders.push(m);
      return m;
    }
  }
  waterRect(x, z, w, d, y, color = '#3f7fa8') {
    this.water.push({ x, z, hw: w / 2, hd: d / 2, y });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d, 1, 1), new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.78, roughness: 0.08, metalness: 0.3 }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true;
    this.scene.add(m);
    this.animated.push((t) => { m.material.color.setHSL(0.56, 0.45, 0.42 + Math.sin(t * 1.3 + x) * 0.02); });
    return m;
  }
  prop(obj, x, z, yaw = 0, r = 0, y = null) {
    this.add(obj, x, z, yaw, y);
    if (r > 0) { this.circle(x, z, r); this.occluders.push(obj); }
    return obj;
  }
  scatter(n, fn, accept) {
    for (let i = 0, tries = 0; i < n && tries < n * 30; tries++) {
      const [x, z] = this.randomPoint();
      if (accept && !accept(x, z)) continue;
      fn(x, z, i, this.rand()); i++;
    }
  }
  randomPoint() {
    const b = this.bounds;
    if (b.type === 'circle') { const a = this.rand() * Math.PI * 2, r = Math.sqrt(this.rand()) * (b.r - 1); return [b.x + Math.cos(a) * r, b.z + Math.sin(a) * r]; }
    return [b.x0 + this.rand() * (b.x1 - b.x0), b.z0 + this.rand() * (b.z1 - b.z0)];
  }
  grass(count, accept, colors = ['#4f9a3a', '#5fae44', '#3f8a32', '#6ab84a'], h = 0.5) {
    const geo = new THREE.ConeGeometry(0.035, h, 3); geo.translate(0, h / 2, 0);
    const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 1 }), count);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
    let n = 0;
    for (let tries = 0; n < count && tries < count * 8; tries++) {
      const [x, z] = this.randomPoint();
      if (accept && !accept(x, z)) continue;
      e.set((this.rand() - 0.5) * 0.5, this.rand() * 6, (this.rand() - 0.5) * 0.5); q.setFromEuler(e);
      const s = 0.45 + this.rand() * 0.6;
      m4.compose(new THREE.Vector3(x, this.heightFn(x, z) - 0.02, z), q, new THREE.Vector3(s, s, s));
      im.setMatrixAt(n, m4); im.setColorAt(n, col.set(colors[n % colors.length])); n++;
    }
    im.count = n; im.receiveShadow = true;
    this.scene.add(im);
  }
  bush(x, z) {
    const m = this.add(M.bush(this.rand() * 6), x, z);
    this.bushes.push({ x, z, mesh: m, alive: true, r: 0.5 });
  }
  liftable(x, z) {
    const m = this.add(M.liftRock(), x, z);
    const r = { x, z, mesh: m, alive: true, r: 0.45 };
    this.rocks.push(r);
    return r;
  }
  chest(x, z, yaw, id, reward) {
    const m = this.add(M.chest(), x, z, yaw);
    const opened = !!this.game.save.flags['chest_' + id];
    if (opened) m.userData.lid.rotation.x = -1.9;
    this.box(x, z, 0.6, 0.42, yaw);
    this.chests.push({ x, z, yaw, mesh: m, id, reward, opened });
    this.mapMarks.push({ x, z, color: '#e9c869' });
  }
  sign(x, z, yaw, label, text) {
    this.add(M.sign(label), x, z, yaw);
    this.circle(x, z, 0.3);
    this.signs.push({ x, z, yaw, text });
  }
  portal(x, z, r, to, spawn, opts = {}) {
    this.portals.push({ x, z, r, to, spawn, ...opts });
    this.mapMarks.push({ x, z, color: '#8fe3c0', portal: true });
  }
  trigger(x, z, r, fn, once = true) { this.triggers.push({ x, z, r, fn, once, done: false }); }
  npc(n) { this.npcs.push(n); this.scene.add(n.root); return n; }
  enemy(e) { this.enemies.push(e); this.scene.add(e.root); return e; }

  // ------------------------------------------------------------- queries
  inWater(x, z) {
    for (const w of this.water) if (Math.abs(x - w.x) < w.hw && Math.abs(z - w.z) < w.hd) return w;
    return null;
  }
  /** Highest walkable surface at (x,z) that is not far above `fromY`. */
  groundAt(x, z, fromY = Infinity, step = 0.5) {
    let h = this.heightFn(x, z);
    for (const p of this.platforms) {
      if (Math.abs(x - p.x) <= p.hw && Math.abs(z - p.z) <= p.hd && p.top <= fromY + step) h = Math.max(h, p.top);
    }
    return h;
  }
  surfaceAt(x, z, y) {
    const w = this.inWater(x, z);
    if (w && y < w.y - 0.05) return 'water';
    return this.def.surface ? this.def.surface(x, z) : 'grass';
  }
  /** Push a circle at (x,z) radius r, standing at height y, out of all solids. */
  resolve(p, r, y = 0, step = 0.5) {
    for (const c of this.circles) {
      const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + r;
      if (d < m && d > 1e-6) { p.x = c.x + dx / d * m; p.z = c.z + dz / d * m; }
    }
    for (const b of this.boxes) if (y < b.top) this.pushBox(p, r, b);
    for (const pl of this.platforms) if (y < pl.top - step) this.pushBox(p, r, { x: pl.x, z: pl.z, hw: pl.hw, hd: pl.hd, c: 1, s: 0 });
    const B = this.bounds;
    if (B.type === 'circle') {
      const dx = p.x - B.x, dz = p.z - B.z, d = Math.hypot(dx, dz);
      if (d > B.r - r) { p.x = B.x + dx / d * (B.r - r); p.z = B.z + dz / d * (B.r - r); }
    } else {
      p.x = clamp(p.x, B.x0 + r, B.x1 - r); p.z = clamp(p.z, B.z0 + r, B.z1 - r);
    }
  }
  pushBox(p, r, b) {
    const dx = p.x - b.x, dz = p.z - b.z;
    const lx = dx * b.c - dz * b.s, lz = dx * b.s + dz * b.c;
    const cx = clamp(lx, -b.hw, b.hw), cz = clamp(lz, -b.hd, b.hd);
    let ox = lx - cx, oz = lz - cz, d = Math.hypot(ox, oz);
    if (d >= r) return;
    let nx, nz;
    if (d > 1e-6) { nx = cx + ox / d * r; nz = cz + oz / d * r; }
    else {
      const px = b.hw - Math.abs(lx), pz = b.hd - Math.abs(lz);
      if (px < pz) { nx = Math.sign(lx || 1) * (b.hw + r); nz = lz; } else { nx = lx; nz = Math.sign(lz || 1) * (b.hd + r); }
    }
    p.x = b.x + nx * b.c + nz * b.s; p.z = b.z - nx * b.s + nz * b.c;
  }
}

import * as THREE from 'three';

// Original procedural textures, generated once at load into tileable canvases.
// Values stay near-neutral so material colors tint them; each also serves as a bump map.
const SIZE = 256;
const cache = new Map();

function hash(x, y, s) {
  const h = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return h - Math.floor(h);
}
/** Tileable value noise with integer period p. */
function pnoise(x, y, p, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const m = (a) => ((a % p) + p) % p;
  const a = hash(m(xi), m(yi), s), b = hash(m(xi + 1), m(yi), s), c = hash(m(xi), m(yi + 1), s), d = hash(m(xi + 1), m(yi + 1), s);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}
function pfbm(x, y, p, oct = 4, s = 0) {
  let t = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) { t += pnoise(x * f, y * f, p * f, s + i) * amp; norm += amp; amp *= 0.5; f *= 2; }
  return t / norm;
}
/** Tileable cellular noise: distance to nearest and second-nearest feature point. */
function cells(n, seed) {
  const pts = [];
  for (let i = 0; i < n; i++) pts.push([hash(i, 1, seed), hash(i, 2, seed)]);
  return (u, v) => {
    let d1 = 9, d2 = 9, id = 0;
    for (let i = 0; i < pts.length; i++) {
      let dx = Math.abs(u - pts[i][0]), dy = Math.abs(v - pts[i][1]);
      dx = Math.min(dx, 1 - dx); dy = Math.min(dy, 1 - dy);
      const d = dx * dx + dy * dy;
      if (d < d1) { d2 = d1; d1 = d; id = i; } else if (d < d2) d2 = d;
    }
    return [Math.sqrt(d1), Math.sqrt(d2), id];
  };
}
const clamp01 = (v) => Math.max(0, Math.min(1, v));

const GEN = {
  bark(u, v) {
    const streak = pfbm(u * 6, v * 1.5, 6, 4, 1);
    const crack = Math.abs(pfbm(u * 10, v * 2, 10, 3, 2) - 0.5) < 0.04 ? 0.45 : 1;
    const knot = pfbm(u * 3, v * 3, 3, 2, 3);
    return [0.55 + streak * 0.5 * crack + (knot > 0.72 ? -0.15 : 0)];
  },
  leaf(u, v) {
    const c = cells.leaf(u, v);
    const vein = Math.abs(((c[2] * 0.37) % 1) - 0.5) * 0.2;
    return [0.55 + (1 - c[0] * 6) * 0.25 + hash(c[2], 0, 9) * 0.3 - vein];
  },
  grass(u, v) {
    const n = pfbm(u * 8, v * 8, 8, 4, 4);
    const speck = pfbm(u * 48, v * 48, 48, 2, 5);
    const clump = pfbm(u * 20, v * 20, 20, 2, 26);
    return [0.6 + n * 0.3 + (speck - 0.5) * 0.3 + (clump > 0.62 ? 0.08 : 0)];
  },
  dirt(u, v) {
    const n = pfbm(u * 8, v * 8, 8, 5, 6);
    const c = cells.pebble(u, v);
    const pebble = c[0] < 0.018 ? 0.18 : 0;
    return [0.6 + n * 0.35 + pebble];
  },
  cobble(u, v) {
    const c = cells.cobble(u, v);
    const edge = c[1] - c[0];
    const mortar = edge < 0.02 ? 0.35 : edge < 0.04 ? 0.7 : 1;
    const n = pfbm(u * 16, v * 16, 16, 3, 7);
    return [(0.65 + hash(c[2], 3, 7) * 0.25 + n * 0.15) * mortar];
  },
  bricks(u, v) {
    const rows = 8, row = Math.floor(v * rows);
    const off = row % 2 ? 0.125 : 0;
    const bu = ((u + off) * 4) % 1, bv = (v * rows) % 1;
    const mortar = bu < 0.04 || bv < 0.08 ? 0.55 : 1;
    const id = Math.floor((u + off) * 4) + row * 7;
    return [(0.7 + hash(id % 32, row, 8) * 0.2 + pfbm(u * 16, v * 16, 16, 3, 9) * 0.15) * mortar];
  },
  plaster(u, v) { return [0.82 + pfbm(u * 6, v * 6, 6, 5, 10) * 0.2 - (pfbm(u * 32, v * 32, 32, 2, 11) > 0.75 ? 0.06 : 0)]; },
  wood(u, v) {
    const planks = 6, pv = (v * planks) % 1, id = Math.floor(v * planks);
    const gap = pv < 0.05 ? 0.45 : 1;
    const grain = Math.sin((u * 30 + pfbm(u * 4, v * 24, 4, 3, 12 + id) * 6) * 2.5) * 0.08;
    return [(0.72 + grain + hash(id, 0, 13) * 0.15) * gap];
  },
  tiles(u, v) {
    const rows = 10, row = Math.floor(v * rows), off = row % 2 ? 0.5 : 0;
    const tu = ((u * 8 + off) % 1) - 0.5, tv = (v * rows) % 1;
    const curve = tv - (1 - tu * tu * 2) * 0.7;
    const edge = curve > 0 ? 0.55 : 1;
    return [(0.75 + hash(Math.floor(u * 8 + off), row, 14) * 0.2) * edge * (0.85 + tv * 0.15)];
  },
  sand(u, v) {
    const warp = pfbm(u * 4, v * 4, 4, 3, 15) * 3;
    return [0.8 + Math.sin((v * 22 + warp) * Math.PI * 2) * 0.06 + pfbm(u * 64, v * 64, 64, 2, 16) * 0.12];
  },
  strata(u, v) {
    const w = pfbm(u * 4, v * 2, 4, 3, 17) * 0.15;
    const band = Math.sin((v + w) * 26) * 0.12 + pfbm(u * 2, (v + w) * 18, 2, 3, 18) * 0.2;
    const crack = Math.abs(pfbm(u * 8, v * 8, 8, 3, 19) - 0.5) < 0.025 ? 0.6 : 1;
    return [(0.72 + band) * crack];
  },
  rock(u, v) {
    const c = cells.rock(u, v);
    const crack = c[1] - c[0] < 0.015 ? 0.55 : 1;
    return [(0.6 + pfbm(u * 8, v * 8, 8, 5, 20) * 0.4) * crack];
  },
  cloth(u, v) {
    const wx = Math.sin(u * SIZE * 0.9) * 0.5 + 0.5, wy = Math.sin(v * SIZE * 0.9) * 0.5 + 0.5;
    return [0.78 + (wx * wy) * 0.12 + pfbm(u * 8, v * 8, 8, 3, 21) * 0.12];
  },
  moss(u, v) {
    const n = pfbm(u * 6, v * 6, 6, 5, 22);
    return [0.55 + n * 0.45 + (pfbm(u * 48, v * 48, 48, 2, 23) - 0.5) * 0.2];
  },
  skin(u, v) { return [0.93 + pfbm(u * 12, v * 12, 12, 3, 24) * 0.07]; },
  metal(u, v) { return [0.8 + pfbm(u * 2, v * 40, 2, 3, 25) * 0.2]; },
};
cells.leaf = cells(70, 1);
cells.pebble = cells(40, 2);
cells.cobble = cells(28, 3);
cells.rock = cells(18, 4);

function build(name) {
  const size = name === 'leaf' ? 512 : SIZE;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const fn = GEN[name];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const v = (0.3 + 0.7 * clamp01(fn(x / size, y / size)[0])) * 255;
    const i = (y * size + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  if (name === 'leaf') {
    // Overlapping leaf silhouettes avoid a cellular, stone-like canopy surface.
    for(let i=0;i<1200;i++) {
      const x=hash(i,1,31)*size,y=hash(i,2,31)*size;
      const w=9+hash(i,3,31)*9,h=17+hash(i,4,31)*17;
      for(const ox of [-size,0,size])for(const oy of [-size,0,size]) {
        ctx.save();ctx.translate(x+ox,y+oy);ctx.rotate(hash(i,5,31)*Math.PI*2);
        const light=Math.round(132+hash(i,6,31)*100);ctx.fillStyle=`rgb(${light},${light},${light})`;
        ctx.beginPath();ctx.moveTo(0,-h/2);ctx.quadraticCurveTo(w,h*.05,0,h/2);ctx.quadraticCurveTo(-w,-h*.05,0,-h/2);ctx.fill();
        ctx.strokeStyle=`rgb(${light+15},${light+15},${light+15})`;ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(0,-h*.4);ctx.lineTo(0,h*.4);ctx.stroke();ctx.restore();
      }
    }
  }
  return c;
}

/** Shared canvas per texture name; each (name, repeat) pair gets its own texture object. */
export function tex(name, rx = 1, ry = rx) {
  const key = `${name}:${rx}:${ry}`;
  if (cache.has(key)) return cache.get(key);
  if (!cache.has(name)) cache.set(name, build(name));
  const t = new THREE.CanvasTexture(cache.get(name));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  cache.set(key, t);
  return t;
}
/** Linear copy for bump mapping. */
export function bump(name, rx = 1, ry = rx) {
  const key = `bump:${name}:${rx}:${ry}`;
  if (cache.has(key)) return cache.get(key);
  const t = tex(name, rx, ry).clone();
  t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true;
  cache.set(key, t);
  return t;
}

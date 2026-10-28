import * as THREE from 'three';

// Authored, tileable hero materials. Keep color and linear data maps separate.
const SIZE = 1024, TAU = Math.PI * 2, cache = new Map();
const noise = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
function texture(canvas, color = false) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.name = 'Hero surface';
  return t;
}

export function heroSurface(kind) {
  if (cache.has(kind)) return cache.get(kind);
  const canvases = Array.from({length: 3}, () => {
    const c = document.createElement('canvas'); c.width = c.height = SIZE; return c;
  });
  const contexts = canvases.map(c => c.getContext('2d'));
  const images = contexts.map(c => c.createImageData(SIZE, SIZE));
  const palette = {
    cloth: [190, 201, 170], linen: [224, 215, 193], leather: [190, 155, 119],
    hair: [228, 193, 128], skin: [251, 233, 219], steel: [214, 225, 232],
  }[kind];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const u = x / SIZE, v = y / SIZE, grain = noise(x, y) - .5;
    let tone = 1, height = .5, rough = .8;
    if (kind === 'cloth' || kind === 'linen') {
      const warp = Math.cos(u * TAU * 128), weft = Math.cos(v * TAU * 128);
      const twill = Math.sin((u * 128 + v * 128) * Math.PI);
      height = .5 + warp * .12 + weft * .12 + twill * .05;
      tone = .94 + (height - .5) * .15 + grain * .035 + Math.sin(u * TAU * 5) * Math.cos(v * TAU * 3) * .025;
      rough = .88 + (height - .5) * .12;
    } else if (kind === 'leather') {
      const pores = Math.pow(Math.max(0, noise(x >> 1, y >> 1) - .5) * 2, 6);
      const crease = Math.pow(.5 + .5 * Math.sin(u * TAU * 9 + Math.sin(v * TAU * 3) * 2), 24);
      height = .55 - pores * .3 - crease * .1 + grain * .08;
      tone = .94 - crease * .08 - pores * .1 + grain * .055;
      rough = .65 + pores * .2 + crease * .1;
    } else if (kind === 'hair') {
      const strands = Math.sin(u * TAU * 92 + Math.sin(v * TAU * 2) * .7);
      const locks = Math.cos(u * TAU * 14 + Math.sin(v * TAU) * .3);
      height = .5 + strands * .12 + locks * .1;
      tone = .89 + strands * .055 + locks * .09 + grain * .025;
      rough = .49 + strands * .08;
    } else if (kind === 'skin') {
      height = .5 + grain * .1;
      tone = .98 + grain * .013 + Math.cos(u * TAU * 2) * Math.sin(v * TAU) * .012;
      rough = .69 + grain * .06;
    } else if (kind === 'steel') {
      const brushed = noise(x, 0) - .5;
      height = .5 + brushed * .12 + grain * .025;
      tone = .94 + brushed * .045 + Math.cos(u * TAU * 2) * .035;
      rough = .32 + brushed * .12;
    }
    const i = (y * SIZE + x) * 4;
    for (let ch = 0; ch < 3; ch++) {
      images[0].data[i + ch] = palette[ch] * tone;
      images[1].data[i + ch] = height * 255;
      images[2].data[i + ch] = rough * 255;
    }
    for (const img of images) img.data[i + 3] = 255;
  }
  contexts.forEach((c, i) => c.putImageData(images[i], 0, 0));
  const maps = {map: texture(canvases[0], true), bumpMap: texture(canvases[1]), roughnessMap: texture(canvases[2])};
  for (const [name, t] of Object.entries(maps)) t.name = `Hero ${kind} ${name}`;
  cache.set(kind, maps);
  return maps;
}

export function heroShieldSurface() {
  if (cache.has('shield')) return cache.get('shield');
  const c = document.createElement('canvas'); c.width = c.height = SIZE;
  const ctx = c.getContext('2d'), img = ctx.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const u = x / SIZE, v = y / SIZE;
    const warp = u + Math.sin(v * 13 + u * 8) * .009 + Math.sin(v * 27) * .002;
    const knot = Math.sin(Math.hypot((u - .67) * 1.7, (v - .38) * .45) * 185) * Math.exp(-Math.abs(u - .67) * 24) * .075;
    const grain = Math.sin(warp * 185) * .07 + Math.sin(warp * 390) * .045 + Math.sin(warp * 1350) * .018 + knot;
    const board = Math.floor(u * 5), edge = (u * 5) % 1;
    const join = edge < .012 || edge > .992 ? .48 : 1;
    const tone = (.94 + grain + (noise(board, 3) - .5) * .22 + (noise(x, y) - .5) * .035) * join;
    const i = (y * SIZE + x) * 4;
    img.data[i] = 155 * tone; img.data[i+1] = 107 * tone; img.data[i+2] = 61 * tone; img.data[i+3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  // A painted, slightly worn red spiral with a warm ivory keyline.
  ctx.save(); ctx.translate(512, 490); ctx.lineCap = 'round';
  const spiral = () => {
    ctx.beginPath();
    for (let i = 0; i <= 360; i++) {
      const a = i / 360 * Math.PI * 3.9, r = 20 + i / 360 * 272;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
  };
  ctx.strokeStyle = '#d6b988'; ctx.lineWidth = 59; spiral(); ctx.stroke();
  ctx.strokeStyle = '#a13e30'; ctx.lineWidth = 38; spiral(); ctx.stroke(); ctx.restore();
  const maps = {map: texture(c, true)};
  // Relief follows wood only: the painted emblem must not become a deep groove.
  const h = document.createElement('canvas'); h.width = h.height = SIZE;
  const hc = h.getContext('2d');
  for (let i = 0; i < img.data.length; i += 4) {
    const value = img.data[i] * .65 + 40;
    img.data[i] = img.data[i+1] = img.data[i+2] = value;
  }
  hc.putImageData(img, 0, 0); maps.bumpMap = texture(h);
  cache.set('shield', maps); return maps;
}

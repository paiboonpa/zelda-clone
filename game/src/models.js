import * as THREE from 'three';
import { TAU } from './util.js';
import { tex, bump } from './textures.js';

// Procedural, original low-poly assets. Every model faces +z at yaw 0.
const matCache = new Map();
export function mat(color, o = {}) {
  const key = color + JSON.stringify(o);
  if (!matCache.has(key)) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.85, metalness: o.metal ?? 0, emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1, flatShading: o.flat ?? false, transparent: o.opacity != null, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide });
    if (o.tex) {
      const [rx, ry] = o.rep || [1, 1];
      m.map = tex(o.tex, rx, ry);
      m.bumpMap = bump(o.tex, rx, ry); m.bumpScale = o.bump ?? 1.5;
    }
    matCache.set(key, m);
  }
  return matCache.get(key);
}
function mesh(geo, material, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = true;
  return m;
}
const G = {
  sphere: new THREE.SphereGeometry(1, 16, 12),
  sphereLo: new THREE.SphereGeometry(1, 8, 6),
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
  cylLo: new THREE.CylinderGeometry(1, 1, 1, 7),
  cone: new THREE.ConeGeometry(1, 1, 12),
  coneLo: new THREE.ConeGeometry(1, 1, 6),
  ico: new THREE.IcosahedronGeometry(1, 0),
  ico1: new THREE.IcosahedronGeometry(1, 1),
  dodec: new THREE.DodecahedronGeometry(1, 0),
};
function scaled(geo, material, sx, sy, sz, x = 0, y = 0, z = 0, shadow = true) {
  const m = mesh(geo, material, x, y, z, shadow);
  m.scale.set(sx, sy, sz);
  return m;
}
function limb(r, len, material, y0 = 0) {
  const m = scaled(G.cyl, material, r, len, r, 0, y0 - len / 2, 0);
  return m;
}

// ---------------------------------------------------------------- characters
export function makeHumanoid(o = {}) {
  const c = Object.assign({ skin: '#f0c49a', hair: '#e8c45a', top: '#3f8a3a', pants: '#e8dfc8', boots: '#6b4426', hat: 'cap', hatColor: null, scale: 1, dress: false, belt: '#6b4426', build: 1 }, o);
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const skin = mat(c.skin, { tex: 'skin', bump: 0.3 }), top = mat(c.top, { tex: 'cloth', rep: [3, 3], bump: 0.6 }), pants = mat(c.pants, { tex: 'cloth', rep: [2, 2], bump: 0.5 }), boots = mat(c.boots, { tex: 'wood', rep: [1, 1], bump: 0.6, rough: 0.7 }), hair = mat(c.hair, { tex: 'bark', rep: [3, 2], bump: 0.8, rough: 0.6 });

  const legL = new THREE.Group(); legL.position.set(0.09, 0.55, 0);
  const legR = new THREE.Group(); legR.position.set(-0.09, 0.55, 0);
  for (const leg of [legL, legR]) {
    leg.add(limb(0.065 * c.build, 0.46, pants));
    leg.add(scaled(G.box, boots, 0.13, 0.14, 0.2, 0, -0.48, 0.03));
    body.add(leg);
  }
  const torso = new THREE.Group(); torso.position.y = 0.55; body.add(torso);
  const tunicGeo = new THREE.CylinderGeometry(0.15 * c.build, c.dress ? 0.32 : 0.23 * c.build, c.dress ? 0.62 : 0.46, 12);
  const tunic = mesh(tunicGeo, top, 0, c.dress ? 0.12 : 0.18, 0); torso.add(tunic);
  torso.add(scaled(G.cyl, mat(c.belt), 0.205 * c.build, 0.05, 0.205 * c.build, 0, 0.12, 0));

  const head = new THREE.Group(); head.position.y = 0.44; torso.add(head);
  head.add(scaled(G.sphere, skin, 0.17, 0.18, 0.17, 0, 0.17, 0));
  const eye = mat('#1b2430');
  head.add(scaled(G.sphereLo, eye, 0.022, 0.032, 0.015, 0.06, 0.18, 0.155, false));
  head.add(scaled(G.sphereLo, eye, 0.022, 0.032, 0.015, -0.06, 0.18, 0.155, false));
  head.add(scaled(G.sphereLo, skin, 0.03, 0.03, 0.03, 0, 0.13, 0.17, false));
  // Ears and hair
  head.add(scaled(G.coneLo, skin, 0.04, 0.12, 0.03, 0.17, 0.18, -0.01).rotateZ(-1.2));
  head.add(scaled(G.coneLo, skin, 0.04, 0.12, 0.03, -0.17, 0.18, -0.01).rotateZ(1.2));
  head.add(scaled(G.sphere, hair, 0.18, 0.13, 0.18, 0, 0.26, -0.02));
  head.add(scaled(G.sphere, hair, 0.16, 0.09, 0.06, 0, 0.27, 0.12));
  if (c.hat === 'cap') {
    const capMat = mat(c.hatColor || c.top, { tex: 'cloth', rep: [3, 3], bump: 0.6 });
    const cap = new THREE.Group(); cap.position.set(0, 0.3, -0.02); cap.rotation.x = -0.5; head.add(cap);
    cap.add(scaled(G.cone, capMat, 0.18, 0.5, 0.18, 0, 0.18, 0));
    const tip = new THREE.Group(); tip.position.set(0, 0.42, 0); tip.rotation.x = -0.8; cap.add(tip);
    tip.add(scaled(G.cone, capMat, 0.07, 0.25, 0.07, 0, 0.1, 0));
    head.userData.capTip = tip;
  } else if (c.hat === 'band') {
    head.add(scaled(G.cyl, mat(c.hatColor || '#c94a3a'), 0.185, 0.04, 0.185, 0, 0.27, 0));
  } else if (c.hat === 'helmet') {
    head.add(scaled(G.sphere, mat('#8a8f99', { metal: 0.6, rough: 0.4 }), 0.2, 0.15, 0.2, 0, 0.28, 0));
    head.add(scaled(G.cone, mat('#c33'), 0.04, 0.18, 0.04, 0, 0.47, 0));
  } else if (c.hat === 'bun') {
    head.add(scaled(G.sphere, hair, 0.1, 0.1, 0.1, 0, 0.33, -0.12));
  } else if (c.hat === 'long') {
    head.add(scaled(G.sphere, hair, 0.19, 0.28, 0.12, 0, 0.1, -0.1));
  }

  const armL = new THREE.Group(); armL.position.set(0.21 * c.build, 0.4, 0); armL.rotation.order = 'YXZ';
  const armR = new THREE.Group(); armR.position.set(-0.21 * c.build, 0.4, 0); armR.rotation.order = 'YXZ';
  for (const arm of [armL, armR]) {
    arm.add(scaled(G.sphere, top, 0.075, 0.075, 0.075));
    arm.add(limb(0.05, 0.36, skin));
    const hand = scaled(G.sphereLo, skin, 0.06, 0.06, 0.06, 0, -0.39, 0);
    arm.add(hand);
    arm.userData.hand = hand;
    torso.add(arm);
  }
  root.scale.setScalar(c.scale);
  return { root, body, torso, head, armL, armR, legL, legR };
}

export function makeHero() {
  const rig = makeHumanoid({ hat: 'cap', top: '#3b7d34', hair: '#e6c15a' });
  // Sword: hilt at origin, blade along +y.
  const sword = new THREE.Group();
  sword.add(scaled(G.cyl, mat('#5a3a1e'), 0.025, 0.14, 0.025, 0, 0.0, 0));
  sword.add(scaled(G.box, mat('#c9a640', { metal: 0.7, rough: 0.35 }), 0.18, 0.03, 0.05, 0, 0.08, 0));
  const blade = scaled(G.box, mat('#e4edf2', { metal: 0.9, rough: 0.2 }), 0.045, 0.62, 0.012, 0, 0.4, 0);
  sword.add(blade);
  sword.add(scaled(G.coneLo, mat('#e4edf2', { metal: 0.9, rough: 0.2 }), 0.032, 0.08, 0.008, 0, 0.75, 0));
  const glow = scaled(G.box, new THREE.MeshBasicMaterial({ color: 0x7fc8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), 0.1, 0.72, 0.05, 0, 0.42, 0, false);
  sword.add(glow);
  sword.position.y = -0.39;
  rig.armR.add(sword);
  sword.userData.base = new THREE.Vector3(0, 0.12, 0);
  sword.userData.tip = new THREE.Vector3(0, 0.78, 0);
  // Shield: thin disc whose faces point along local ±y.
  const shield = new THREE.Group();
  const face = new THREE.Group(); shield.add(face);
  face.add(scaled(G.cyl, mat('#7a4f28', { tex: 'wood', rep: [1, 1] }), 0.22, 0.035, 0.26));
  face.add(scaled(G.cyl, mat('#c9a640', { metal: 0.6, rough: 0.4 }), 0.235, 0.025, 0.275, 0, 0.002, 0));
  face.add(scaled(G.sphereLo, mat('#b83228'), 0.07, 0.03, 0.07, 0, -0.03, 0.02));
  face.add(scaled(G.box, mat('#c9a640', { metal: 0.6 }), 0.035, 0.012, 0.3, 0, -0.025, 0));
  shield.position.set(0.05, -0.3, 0);
  rig.armL.add(shield);
  return Object.assign(rig, { sword, shield, glow });
}

export function makeWisp(color = 0xbff6ff) {
  const g = new THREE.Group();
  const core = mesh(new THREE.SphereGeometry(0.08, 12, 8), new THREE.MeshBasicMaterial({ color }), 0, 0, 0, false);
  g.add(core);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.set(0.9, 0.9, 1); g.add(halo);
  const wingMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
  const wings = [];
  for (let i = 0; i < 4; i++) {
    const w = new THREE.Mesh(new THREE.CircleGeometry(0.11, 10), wingMat);
    w.scale.set(1, 0.5, 1);
    const p = new THREE.Group(); p.add(w); w.position.x = (i % 2 ? -1 : 1) * 0.11; w.position.y = i < 2 ? 0.05 : -0.04;
    g.add(p); wings.push(p);
  }
  g.userData = { wings, halo, core };
  return g;
}

let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

// ------------------------------------------------------------------ enemies
export function makeThornmaw() {
  const root = new THREE.Group();
  const leafMat = mat('#2f6a2a', { tex: 'leaf', rep: [2, 2] }), stemMat = mat('#3f7a33', { tex: 'bark', rep: [2, 1], bump: 0.8 });
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * TAU;
    const leaf = scaled(G.sphere, leafMat, 0.22, 0.04, 0.6, Math.sin(a) * 0.45, 0.05, Math.cos(a) * 0.45);
    leaf.rotation.y = a; root.add(leaf);
  }
  const segs = [];
  let parent = root;
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Group(); s.position.y = i === 0 ? 0.05 : 0.45;
    s.add(scaled(G.cylLo, stemMat, 0.07 - i * 0.008, 0.47, 0.07 - i * 0.008, 0, 0.225, 0));
    parent.add(s); segs.push(s); parent = s;
  }
  const head = new THREE.Group(); head.position.y = 0.5; parent.add(head);
  const petal = mat('#4a2a78', { rough: 0.6, tex: 'moss', rep: [3, 3] }), mouth = mat('#c42a3a', { tex: 'skin', rough: 0.4 }), tooth = mat('#f2ead8');
  const upper = new THREE.Group(); upper.position.z = -0.25; head.add(upper);
  const lower = new THREE.Group(); lower.position.z = -0.25; head.add(lower);
  const hemi = new THREE.SphereGeometry(0.42, 16, 8, 0, TAU, 0, Math.PI / 2);
  const up = mesh(hemi, petal, 0, 0, 0.25); up.scale.set(1, 0.7, 1.2); upper.add(up);
  const upIn = mesh(hemi, mouth, 0, -0.01, 0.25); upIn.scale.set(0.92, -0.08, 1.1); upper.add(upIn);
  const lo = mesh(hemi, mouth, 0, 0, 0.25); lo.scale.set(0.95, -0.55, 1.15); lower.add(lo);
  for (let i = 0; i < 9; i++) {
    const a = (i / 8 - 0.5) * 2.6;
    upper.add(scaled(G.coneLo, tooth, 0.03, 0.12, 0.03, Math.sin(a) * 0.36, -0.05, 0.25 + Math.cos(a) * 0.42).rotateX(Math.PI));
    lower.add(scaled(G.coneLo, tooth, 0.03, 0.1, 0.03, Math.sin(a) * 0.33, 0.04, 0.25 + Math.cos(a) * 0.4));
  }
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU;
    const spot = scaled(G.sphereLo, mat('#d9b3ff', { emissive: '#5a2a9a', ei: 0.4 }), 0.05, 0.02, 0.05, Math.cos(a) * 0.28, 0.24, 0.25 + Math.sin(a) * 0.32);
    upper.add(spot);
  }
  return { root, segs, head, upper, lower };
}

export function makeSprout() {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  body.add(scaled(G.sphere, mat('#7a8a3a', { tex: 'bark', rep: [3, 2] }), 0.36, 0.32, 0.36, 0, 0.32, 0));
  body.add(scaled(G.sphere, mat('#a7b85a'), 0.25, 0.2, 0.2, 0, 0.3, 0.18));
  const eyeW = mat('#fffbe6'), eyeB = mat('#120c08');
  for (const s of [-1, 1]) {
    body.add(scaled(G.sphereLo, eyeW, 0.08, 0.1, 0.05, s * 0.13, 0.42, 0.3, false));
    body.add(scaled(G.sphereLo, eyeB, 0.04, 0.06, 0.03, s * 0.13, 0.42, 0.34, false));
  }
  body.add(scaled(G.cyl, mat('#2a1a10'), 0.08, 0.06, 0.08, 0, 0.26, 0.34).rotateX(Math.PI / 2));
  const crest = new THREE.Group(); crest.position.y = 0.6; body.add(crest);
  for (let i = 0; i < 3; i++) {
    const leaf = scaled(G.sphere, mat('#3c9a3a'), 0.1, 0.03, 0.32, 0, 0.05, 0.2);
    const p = new THREE.Group(); p.rotation.y = i / 3 * TAU; p.rotation.x = -0.5; p.add(leaf); crest.add(p);
  }
  return { root, body, crest };
}

export function makeHoverBloom() {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  body.add(scaled(G.sphere, mat('#4f8a34', { tex: 'moss', rep: [3, 3] }), 0.36, 0.42, 0.36));
  body.add(scaled(G.cyl, mat('#3a2a1a'), 0.12, 0.3, 0.12, 0, 0, 0.36).rotateX(Math.PI / 2));
  body.add(scaled(G.cyl, mat('#100804'), 0.08, 0.02, 0.08, 0, 0, 0.52).rotateX(Math.PI / 2));
  const eyeMat = mat('#ffcf3a', { emissive: '#ff9a00', ei: 0.8 });
  for (const s of [-1, 1]) body.add(scaled(G.sphereLo, eyeMat, 0.05, 0.05, 0.03, s * 0.15, 0.15, 0.31, false));
  const rotor = new THREE.Group(); rotor.position.y = 0.45; body.add(rotor);
  for (let i = 0; i < 6; i++) {
    const p = new THREE.Group(); p.rotation.y = i / 6 * TAU;
    p.add(scaled(G.sphere, mat(i % 2 ? '#e9c23a' : '#d4562a'), 0.12, 0.025, 0.42, 0, 0, 0.4));
    rotor.add(p);
  }
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * TAU;
    const r = scaled(G.cylLo, mat('#6a5030'), 0.025, 0.5, 0.025, Math.cos(a) * 0.15, -0.55, Math.sin(a) * 0.15);
    r.rotation.z = Math.cos(a) * 0.3; body.add(r);
  }
  return { root, body, rotor };
}

export function makeSeed() {
  return scaled(G.sphere, mat('#6a4a2a', { emissive: '#3a1a00', ei: 0.5 }), 0.13, 0.13, 0.13);
}

// --------------------------------------------------------------------- props
export function giantTrunk(h = 18, r = 2.2) {
  const g = new THREE.Group();
  const bark = mat('#6a5038', { tex: 'bark', rep: [3, 4], bump: 3 });
  g.add(scaled(G.cylLo, bark, r * 0.8, h, r, 0, h / 2, 0));
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * TAU + 0.3;
    const root = scaled(G.coneLo, bark, r * 0.35, 3, r * 0.35, Math.cos(a) * r * 0.9, 0.8, Math.sin(a) * r * 0.9);
    root.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
    g.add(root);
  }
  const canopy = mat('#3a6a2c', { flat: true, tex: 'leaf', rep: [4, 4], bump: 2 });
  for (let i = 0; i < 4; i++) g.add(scaled(G.ico, canopy, 5 + i, 3, 5 + i, Math.sin(i * 2) * 3, h - 1 + i * 1.5, Math.cos(i * 2) * 3, false));
  return g;
}

export function treeHouse(color = '#6a4a30', door = '#7a2a1a') {
  const g = new THREE.Group();
  const bark = mat(color, { tex: 'bark', rep: [4, 2], bump: 3 });
  g.add(scaled(G.cylLo, bark, 3, 6, 3.4, 0, 3, 0));
  g.add(scaled(G.cylLo, bark, 2.2, 4, 2.4, 0, 7.5, 0));
  g.add(scaled(G.ico, mat('#4a7a34', { flat: true, tex: 'moss', rep: [3, 3], bump: 2 }), 4.5, 2.8, 4.5, 0, 10, 0));
  g.add(scaled(G.box, mat(door, { tex: 'wood', rep: [1, 1] }), 1.3, 2.1, 0.3, 0, 1.05, 3.25));
  g.add(scaled(G.box, mat('#3a2414'), 1.5, 0.2, 0.35, 0, 2.15, 3.25));
  const win = mat('#ffd27a', { emissive: '#ffb347', ei: 0.9 });
  g.add(scaled(G.cyl, win, 0.45, 0.2, 0.45, 1.8, 3.6, 2.7).rotateX(Math.PI / 2).rotateZ(0.6));
  g.add(lamp(1.3, 2.6, 3.5));
  return g;
}

export function lamp(x, y, z) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  g.add(scaled(G.sphere, mat('#ffcf6a', { emissive: '#ffa23a', ei: 1.6 }), 0.16, 0.22, 0.16, 0, 0, 0, false));
  g.add(scaled(G.cone, mat('#3a2a14'), 0.12, 0.1, 0.12, 0, 0.24, 0, false));
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffb35a, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.set(1.4, 1.4, 1); g.add(s);
  return g;
}

export function rock(s = 1, color = '#7b7a72', seed = 0) {
  const m = scaled(G.dodec, mat(color, { flat: true, tex: 'rock', rep: [1, 1], bump: 2 }), s, s * 0.7, s * 1.1, 0, s * 0.35, 0);
  m.rotation.set(seed, seed * 2.3, seed * 0.7);
  return m;
}
export function liftRock() {
  const g = new THREE.Group();
  g.add(scaled(G.ico1, mat('#d8d6cc', { flat: true, rough: 0.7, tex: 'rock', bump: 1 }), 0.42, 0.32, 0.4, 0, 0.3, 0));
  return g;
}
export function bush(seed = 0) {
  const g = new THREE.Group();
  const m = mat(seed % 2 ? '#3f8a34' : '#4a9a3a', { flat: true, tex: 'leaf', rep: [1, 1], bump: 2 });
  g.add(scaled(G.ico, m, 0.45, 0.4, 0.45, 0, 0.35, 0));
  g.add(scaled(G.ico, m, 0.32, 0.3, 0.32, 0.25, 0.3, 0.15));
  g.add(scaled(G.ico, m, 0.3, 0.28, 0.3, -0.2, 0.28, -0.18));
  g.rotation.y = seed;
  return g;
}
export function roundTree(s = 1, seed = 0) {
  const g = new THREE.Group();
  g.add(scaled(G.cylLo, mat('#5b4330', { tex: 'bark', rep: [1, 2] }), 0.25 * s, 3 * s, 0.3 * s, 0, 1.5 * s, 0));
  const leaf = mat(seed % 2 ? '#4f8a3a' : '#5d9a40', { flat: true, tex: 'leaf', rep: [2, 2], bump: 2 });
  g.add(scaled(G.ico, leaf, 1.8 * s, 1.5 * s, 1.8 * s, 0, 3.8 * s, 0));
  g.add(scaled(G.ico, leaf, 1.2 * s, 1 * s, 1.2 * s, 0.9 * s, 3.2 * s, 0.5 * s));
  return g;
}
export function pine(s = 1) {
  const g = new THREE.Group();
  g.add(scaled(G.cylLo, mat('#4a3424'), 0.2 * s, 2 * s, 0.2 * s, 0, 1 * s, 0));
  const leaf = mat('#2e5a32', { flat: true, tex: 'leaf', rep: [2, 2], bump: 2 });
  for (let i = 0; i < 3; i++) g.add(scaled(G.coneLo, leaf, (1.4 - i * 0.35) * s, 2 * s, (1.4 - i * 0.35) * s, 0, (2.2 + i * 1.1) * s, 0));
  return g;
}

export function chest() {
  const g = new THREE.Group();
  const wood = mat('#7a4a22', { tex: 'wood' }), trim = mat('#c9a640', { metal: 0.6, rough: 0.4 });
  g.add(scaled(G.box, wood, 1.1, 0.6, 0.75, 0, 0.3, 0));
  const lid = new THREE.Group(); lid.position.set(0, 0.6, -0.375); g.add(lid);
  lid.add(scaled(G.cyl, wood, 0.375, 1.1, 0.375, 0, 0, 0.375).rotateZ(Math.PI / 2));
  lid.add(scaled(G.box, trim, 0.15, 0.2, 0.06, 0, -0.05, 0.76));
  for (const x of [-0.45, 0.45]) g.add(scaled(G.box, trim, 0.08, 0.62, 0.77, x, 0.3, 0));
  g.userData.lid = lid;
  return g;
}

export function sign(text) {
  const g = new THREE.Group();
  g.add(scaled(G.cylLo, mat('#5a3a1e'), 0.06, 1.3, 0.06, 0, 0.65, 0));
  g.add(scaled(G.box, mat('#9a6a3a', { tex: 'wood' }), 1.1, 0.6, 0.08, 0, 1.25, 0));
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const x = c.getContext('2d'); x.fillStyle = '#9a6a3a'; x.fillRect(0, 0, 256, 128);
  x.fillStyle = '#2a1608'; x.font = 'bold 34px Trebuchet MS'; x.textAlign = 'center';
  text.split('\n').forEach((l, i, a) => x.fillText(l, 128, 64 + (i - (a.length - 1) / 2) * 38 + 12));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  g.add(mesh(new THREE.PlaneGeometry(1.05, 0.55), new THREE.MeshStandardMaterial({ map: t }), 0, 1.25, 0.045, false));
  return g;
}

export function house(w, d, h, seed = 0) {
  const g = new THREE.Group();
  const walls = ['#e9dcc0', '#dccfb5', '#efe2c8', '#d8c3a0'][seed % 4];
  const roofs = ['#a5432e', '#8a3a2a', '#b85a36', '#6a4a8a'][seed % 4];
  g.add(scaled(G.box, mat('#8f8a80', { tex: 'bricks', rep: [3, 1] }), w + 0.2, 1.2, d + 0.2, 0, 0.6, 0));
  g.add(scaled(G.box, mat(walls, { tex: 'plaster', rep: [2, 2] }), w, h - 1.2, d, 0, 1.2 + (h - 1.2) / 2, 0));
  const timber = mat('#4a3020', { tex: 'wood', rep: [1, 3] });
  for (let i = 0; i <= 3; i++) {
    const x = -w / 2 + (w / 3) * i;
    g.add(scaled(G.box, timber, 0.18, h - 1.2, 0.08, x, 1.2 + (h - 1.2) / 2, d / 2 + 0.03, false));
    g.add(scaled(G.box, timber, 0.18, h - 1.2, 0.08, x, 1.2 + (h - 1.2) / 2, -d / 2 - 0.03, false));
  }
  g.add(scaled(G.box, timber, w, 0.18, 0.1, 0, h * 0.6, d / 2 + 0.04, false));
  const roofGeo = new THREE.CylinderGeometry(0.01, 1, 1, 4, 1);
  const roof = mesh(roofGeo, mat(roofs, { flat: true, tex: 'tiles', rep: [3, 3], bump: 2 }), 0, h + w * 0.28, 0);
  roof.scale.set(w * 0.78, w * 0.56, d * 0.78); roof.rotation.y = Math.PI / 4; g.add(roof);
  g.add(scaled(G.box, mat('#5a3a20'), 1.1, 2, 0.12, 0, 1, d / 2 + 0.06));
  const win = mat('#9ac6e8', { emissive: '#2a4a6a', ei: 0.3 });
  for (const x of [-w / 3, w / 3]) {
    g.add(scaled(G.box, win, 0.8, 0.9, 0.08, x, h * 0.72, d / 2 + 0.05, false));
    g.add(scaled(G.box, mat('#6a8a3a'), 1, 0.25, 0.3, x, h * 0.72 - 0.55, d / 2 + 0.15, false));
    g.add(scaled(G.sphereLo, mat(['#e35a7a', '#f2c23a', '#c64ae0'][(seed + Math.round(x)) % 3 + 0 | 0] || '#e35a7a'), 0.45, 0.15, 0.12, x, h * 0.72 - 0.38, d / 2 + 0.2, false));
  }
  return g;
}

export function stall(color = '#c33a3a') {
  const g = new THREE.Group();
  const wood = mat('#6a4a2a', { tex: 'wood' });
  for (const [x, z] of [[-1.2, -0.7], [1.2, -0.7], [-1.2, 0.7], [1.2, 0.7]]) g.add(scaled(G.cylLo, wood, 0.06, 2.4, 0.06, x, 1.2, z));
  g.add(scaled(G.box, wood, 2.6, 0.9, 1.4, 0, 0.45, 0));
  const awn = scaled(G.box, mat(color, { tex: 'cloth', rep: [6, 4] }), 2.9, 0.08, 1.9, 0, 2.45, 0.1); awn.rotation.x = 0.18; g.add(awn);
  const goods = ['#e34a3a', '#f2c23a', '#7ac24a', '#e88a2a'];
  for (let i = 0; i < 6; i++) g.add(scaled(G.sphereLo, mat(goods[i % 4]), 0.16, 0.16, 0.16, -0.9 + i * 0.36, 1.0, (i % 2) * 0.3 - 0.15));
  return g;
}

export function fountain() {
  const g = new THREE.Group();
  const stone = mat('#b8b2a4', { rough: 0.9, tex: 'bricks', rep: [4, 1] });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.3, 8, 32), stone); ring.rotation.x = Math.PI / 2; ring.position.y = 0.55; ring.castShadow = true; g.add(ring);
  g.add(scaled(G.cyl, stone, 3, 0.4, 3, 0, 0.2, 0));
  g.add(scaled(G.cyl, mat('#4a8ac8', { rough: 0.1, metal: 0.2, opacity: 0.8 }), 2.8, 0.05, 2.8, 0, 0.6, 0, false));
  g.add(scaled(G.cyl, stone, 0.35, 2.2, 0.35, 0, 1.4, 0));
  g.add(scaled(G.cyl, stone, 1.1, 0.25, 1.1, 0, 2.4, 0));
  g.add(scaled(G.sphere, stone, 0.3, 0.3, 0.3, 0, 2.8, 0));
  return g;
}

export function bunting(x1, z1, x2, z2, h) {
  const g = new THREE.Group();
  const n = Math.max(4, Math.round(Math.hypot(x2 - x1, z2 - z1) / 0.8));
  const colors = ['#d23a3a', '#3a6ad2', '#e8c43a', '#3aa85a', '#f2f2f2'];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.25, 0, 0, 0.25, 0, 0, 0, -0.45, 0], 3));
  geo.computeVertexNormals();
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const sag = Math.sin(t * Math.PI) * 1.2;
    const m = mesh(geo, mat(colors[i % colors.length], { side: THREE.DoubleSide }), x1 + (x2 - x1) * t, h - sag, z1 + (z2 - z1) * t, false);
    m.rotation.y = Math.atan2(x2 - x1, z2 - z1) + Math.PI / 2;
    g.add(m);
  }
  return g;
}

export function arch(color = '#8a8478', w = 4, h = 4.5) {
  const g = new THREE.Group();
  const s = mat(color, { tex: 'bricks', rep: [1, 4] });
  g.add(scaled(G.box, s, 0.9, h, 0.9, -w / 2, h / 2, 0));
  g.add(scaled(G.box, s, 0.9, h, 0.9, w / 2, h / 2, 0));
  g.add(scaled(G.box, s, w + 1.4, 0.9, 1.1, 0, h + 0.3, 0));
  return g;
}

export function castle() {
  const g = new THREE.Group();
  const stone = mat('#c9c3b5', { tex: 'bricks', rep: [8, 4] }), roof = mat('#4a5a8a', { flat: true, tex: 'tiles', rep: [3, 3] });
  g.add(scaled(G.box, stone, 60, 12, 4, 0, 6, 10));
  for (let i = -3; i <= 3; i++) {
    g.add(scaled(G.cyl, stone, 3, 16, 3, i * 10, 8, 10));
    g.add(scaled(G.cone, roof, 3.6, 5, 3.6, i * 10, 18.5, 10));
  }
  g.add(scaled(G.box, stone, 22, 26, 16, 0, 13, -10));
  for (const [x, z, h] of [[-9, -16, 34], [9, -16, 34], [0, -6, 42], [-9, -2, 30], [9, -2, 30]]) {
    g.add(scaled(G.cyl, stone, 2.6, h, 2.6, x, h / 2, z));
    g.add(scaled(G.cone, roof, 3.2, 7, 3.2, x, h + 3.5, z));
  }
  return g;
}

export function mountain(r, h, color = '#7a8a9a', snow = true) {
  const g = new THREE.Group();
  g.add(scaled(G.coneLo, mat(color, { flat: true, tex: 'strata', rep: [10, 6], bump: 0.2 }), r, h, r, 0, h / 2, 0, false));
  if (snow) g.add(scaled(G.coneLo, mat('#eef2f6', { flat: true }), r * 0.3, h * 0.3, r * 0.3, 0, h * 0.86, 0, false));
  return g;
}

export function cliff(w, h, d, seed = 0) {
  const g = new THREE.Group();
  const layers = ['#b85a3a', '#c8764a', '#a24a32', '#d08a5a'];
  let y = 0, i = 0;
  while (y < h) {
    const lh = 1.5 + ((seed + i) % 3);
    const m = scaled(G.box, mat(layers[(seed + i) % 4], { flat: true, tex: 'strata', rep: [2, 1], bump: 3 }), w * (1 - i * 0.04), Math.min(lh, h - y), d * (1 - i * 0.05), (i % 2 - 0.5) * 0.6, y + Math.min(lh, h - y) / 2, 0);
    g.add(m); y += lh; i++;
  }
  return g;
}

export function rootArch(len, thick, color = '#4a3424') {
  return scaled(G.cylLo, mat(color, { tex: 'bark', rep: [2, 4], bump: 3 }), thick, len, thick * 1.2);
}

export function shelf() {
  const g = new THREE.Group();
  const wood = mat('#6a4224', { tex: 'wood' });
  g.add(scaled(G.box, wood, 2.6, 3, 0.4, 0, 1.5, 0));
  const items = ['#c93a3a', '#3a8ac9', '#e8c43a', '#5ac24a', '#c97a3a', '#9a5ac9'];
  for (let r = 0; r < 3; r++) {
    g.add(scaled(G.box, mat('#8a5a30'), 2.6, 0.06, 0.5, 0, 0.7 + r * 0.85, 0.15));
    for (let i = 0; i < 4; i++) g.add(scaled(i % 2 ? G.sphereLo : G.cylLo, mat(items[(r * 4 + i) % items.length]), 0.13, 0.18, 0.13, -0.9 + i * 0.6, 0.88 + r * 0.85, 0.2));
  }
  return g;
}

export function barrel() {
  const g = new THREE.Group();
  g.add(scaled(G.cyl, mat('#7a5230', { tex: 'wood', rep: [3, 1] }), 0.4, 0.9, 0.4, 0, 0.45, 0));
  for (const y of [0.15, 0.75]) g.add(scaled(G.cyl, mat('#3a3a3a', { metal: 0.6 }), 0.42, 0.05, 0.42, 0, y, 0));
  return g;
}
export function crate() { return scaled(G.box, mat('#9a7040', { tex: 'wood' }), 0.8, 0.8, 0.8, 0, 0.4, 0); }

export function gemMesh(kind) {
  const color = { green: '#3ad35a', blue: '#3a7ae8', red: '#e83a4a' }[kind];
  const m = scaled(G.ico, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5, metalness: 0.3, roughness: 0.2, flatShading: true }), 0.13, 0.24, 0.13, 0, 0, 0, true);
  return m;
}
let heartGeo = null;
export function heartMesh() {
  if (!heartGeo) {
    const s = new THREE.Shape();
    s.moveTo(0, -0.3); s.bezierCurveTo(-0.35, -0.05, -0.3, 0.25, 0, 0.12); s.bezierCurveTo(0.3, 0.25, 0.35, -0.05, 0, -0.3);
    heartGeo = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 });
    heartGeo.center();
  }
  return mesh(heartGeo, new THREE.MeshStandardMaterial({ color: '#e8344a', emissive: '#801020', emissiveIntensity: 0.6, roughness: 0.3 }));
}

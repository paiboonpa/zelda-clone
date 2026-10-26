import * as THREE from 'three';
import * as M from './models.js';
import { NPC } from './npc.js';
import { Thornmaw, Sprout, HoverBloom } from './enemies.js';
import { fbm, distToPaths, hexToRgb, mixRgb, smooth, clamp, TAU, angleDiff } from './util.js';

const say = (who, text) => ({ who, text });
const run = (fn) => ({ run: fn });
const GLIM = 'Glim';

// ======================================================================= village
const streamZ = (x) => 2 + Math.sin(x * 0.12) * 1.6;
const VPATHS = [
  [[-14, 11], [-6, 9.5], [0, 8], [0, 2], [0, -6], [8, -7.5], [14.5, -6.5]],
  [[0, -6], [-10, -11], [-21, -16]],
  [[0, -6], [0, -20], [0, -39]],
  [[0, 8], [10, 12], [20, 8]],
];
const vHeight = (x, z) => {
  let h = 0.15 + fbm(x * 0.07, z * 0.07) * 0.35;
  const pd = distToPaths(x, z, VPATHS);
  if (pd < 2.5) h = h * (pd / 2.5) + 0.12 * (1 - pd / 2.5);
  const ds = Math.abs(z - streamZ(x));
  if (ds < 2.6) h -= Math.pow(1 - ds / 2.6, 1.5) * 1.05;
  const r = Math.hypot(x, z);
  if (r > 33) h += Math.min(r - 33, 12) * 0.35;
  return h;
};

export const SCENES = {};

SCENES.village = {
  name: 'Leafshade Village', sub: 'Home of the forest children', music: 'forest', amb: 'forest', seed: 11,
  fog: { color: '#8f8e78', near: 10, far: 72 },
  sky: { top: '#a4b0a2', bottom: '#c4c2aa', clouds: 0.15 },
  light: { sky: '#e8ecd8', ground: '#3a4a26', hemi: 0.85, sun: '#ffe6b8', sunI: 2.4, dir: [0.5, 1, 0.35] },
  ground: {
    size: 96, seg: 120, tex: 'grass', texScale: 2.5,
    color: (x, z, h) => {
      const pd = distToPaths(x, z, VPATHS);
      const grass = mixRgb(hexToRgb('#4a6e30'), hexToRgb('#6a7e3e'), (fbm(x * 0.3, z * 0.3) + 1) / 2);
      const dirt = mixRgb(hexToRgb('#75684e'), hexToRgb('#8a7c62'), (fbm(x * 0.9, z * 0.9) + 1) / 2);
      let c = mixRgb(dirt, grass, smooth(clamp((pd - 0.8) / 1.4, 0, 1)));
      if (h < -0.2) c = mixRgb(c, hexToRgb('#5a5040'), clamp(-h - 0.2, 0, 1));
      return c;
    },
  },
  height: vHeight,
  surface: (x, z) => (distToPaths(x, z, VPATHS) < 1.4 ? 'dirt' : 'grass'),
  bounds: { type: 'circle', x: 0, z: 0, r: 37.5 },
  mapPaths: VPATHS,
  spawns: {
    start: { x: -13, z: 10, yaw: Math.PI },
    fromShop: { x: 13.2, z: -6.6, yaw: -1.08 + Math.PI },
    fromHollow: { x: -20.5, z: -15, yaw: 0.93 },
    fromField: { x: 0, z: -35, yaw: 0 },
  },
  build(w, game) {
    const S = game.save;
    w.waterRect(0, 2, 80, 6.6, -0.38);
    // Bridge across the stream
    w.platform(0, 2, 1.5, 3.2, 0.32, '#7a5530');
    for (const sx of [-1.45, 1.45]) for (const sz of [-2.8, 0, 2.8]) w.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.9, 0.15), M.mat('#5a3a1e')), { castShadow: true }), sx, 2 + sz, 0, 0.7);

    // Ring of giant trees enclosing the village, open to the north.
    for (let a = 0; a < TAU; a += 0.24) {
      if (Math.abs(angleDiff(a, -Math.PI / 2)) < 0.16) continue;
      const r = 40 + Math.sin(a * 5) * 1.5;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      w.prop(M.giantTrunk(16 + Math.sin(a * 3) * 4, 2.4), x, z, a, 0);
    }
    for (const x of [-4.5, 4.5]) w.prop(M.giantTrunk(18, 2), x, -38.5, 0, 2.2);
    w.portal(0, -37.2, 1.6, 'field', 'fromVillage', { label: 'Greenreach Field' });
    w.sign(-3, -27, 0, 'Greenreach\nField ↑', 'North: Greenreach Field. Beyond it, Brightwall Market.');

    // Houses
    const houses = [[-17.5, 15.5, '#6a4a30', '#7a2a1a'], [-22, -1, '#5e4430', '#2a5a7a'], [12, 23, '#6a4c34', '#7a5a1a'], [-10, 25, '#5a4030', '#6a2a5a']];
    for (const [x, z, c, d] of houses) {
      const yaw = Math.atan2(-x, 8 - z);
      w.prop(M.treeHouse(c, d), x, z, yaw, 3.4);
    }
    const shopYaw = Math.atan2(-17, 9);
    w.prop(M.treeHouse('#704c2c', '#2a6a3a'), 17, -9, shopYaw, 3.4);
    w.add(M.sign('Shop'), 17 + Math.sin(shopYaw) * 3.6 + Math.cos(shopYaw) * 1.6, -9 + Math.cos(shopYaw) * 3.6 - Math.sin(shopYaw) * 1.6, shopYaw);
    w.portal(17 + Math.sin(shopYaw) * 3.75, -9 + Math.cos(shopYaw) * 3.75, 0.9, 'shop', 'fromVillage', { label: 'Enter shop' });

    // Root Hollow entrance
    const hy = Math.atan2(23, 17);
    w.prop(M.rock(5, '#5a5248', 1), -27, -20, 0, 4.2);
    w.prop(M.rock(3.5, '#5f574c', 2), -21, -22.5, 0, 2.6);
    w.prop(M.rock(3.5, '#5f574c', 3), -28.5, -13.5, 0, 2.6);
    const ar = w.add(M.arch('#4a3424', 3, 3.6), -23.6, -17.8, hy);
    w.occluders.push(ar);
    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.8), new THREE.MeshBasicMaterial({ color: 0x050403 }));
    w.add(mouth, -24.1, -18.2, hy, vHeight(-24, -18) + 1.8);
    w.portal(-23.2, -17.4, 1.2, 'hollow', 'fromVillage', { label: 'Enter the hollow' });
    w.sign(-18.5, -13, hy, 'Root\nHollow', 'Root Hollow. Snapping plants grow inside. Mind your fingers.');

    // Lookout: stepping platforms up to a chest.
    w.platform(21, 9, 1.1, 1.1, 0.45, '#7d786c');
    w.platform(23.2, 11, 1, 1, 0.95, '#837d70');
    w.platform(25.4, 13.6, 1, 1, 1.8, '#7a756a');
    w.platform(28, 16.5, 1.7, 1.7, 2.6, '#857f72');
    w.chest(28, 16.8, -0.8, 'lookout', { gems: 10 });
    w.chests[w.chests.length - 1].mesh.position.y = 2.6;
    w.sign(19.5, 7, 0.4, 'Lookout', 'Jump up the stones with SPACE.');

    // Lifting rocks around Tobin
    for (const [x, z] of [[5.5, 18], [9, 19.5], [4, 21], [8.5, 22.5]]) w.liftable(x, z);

    // Decor and cuttables
    w.scatter(14, (x, z, i, r) => w.prop(M.rock(0.5 + r * 0.9, '#7d7a70', i), x, z, r * 6, 0.5 + r * 0.6), (x, z) => distToPaths(x, z, VPATHS) > 3 && Math.abs(z - streamZ(x)) > 3.5 && Math.hypot(x, z) < 31 && clearOf(w, x, z, 2.5));
    w.scatter(34, (x, z) => w.bush(x, z), (x, z) => distToPaths(x, z, VPATHS) > 2 && Math.abs(z - streamZ(x)) > 3.2 && Math.hypot(x, z) < 33 && clearOf(w, x, z, 1.2));
    w.grass(6000, (x, z) => distToPaths(x, z, VPATHS) > 1.5 && Math.abs(z - streamZ(x)) > 2.4 && clearOf(w, x, z, 0.4));
    for (const [x, z] of [[-6, 4.5], [6, 5], [-2, -14], [4, -24], [10, -2]]) {
      w.add(M.lamp(0, 2.2, 0), x, z, 0, vHeight(x, z));
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.1), M.mat('#4a3020')); post.castShadow = true;
      w.add(post, x, z, 0, vHeight(x, z) + 1.05);
    }

    // Sun shafts through the canopy haze
    for (const [x, z] of [[-6, 0], [8, -14], [-14, -8], [12, 14], [2, 20], [-20, 8]]) {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1, 3, 22, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.03, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
      shaft.position.set(x, 10, z); shaft.rotation.set(0.25, 0, -0.3); w.scene.add(shaft);
    }

    // Villagers
    w.npc(new NPC(game, { name: 'Saya', x: -4.5, z: 11.5, yaw: 0.5, look: { top: '#4f9a42', hair: '#8fd36a', hat: 'band', hatColor: '#e8c43a', dress: true }, bark: 'Morning, sleepyhead!', talk: sayaTalk }));
    w.npc(new NPC(game, { name: 'Tobin', x: 7, z: 16.5, yaw: -2.6, look: { top: '#3f7a8a', hair: '#b5652a', hat: 'cap', hatColor: '#c94a3a', scale: 0.9 }, bark: 'Rocks are heavier than they look!', talk: tobinTalk }));
    w.npc(new NPC(game, { name: 'Wren', x: -9, z: -6, wander: 4, look: { top: '#6a8a3a', hair: '#e0d06a', hat: 'bun', dress: true }, bark: 'Do you hear the forest humming?', talk: () => [say('Wren', 'The old trees are restless lately. Glim feels it too, doesn\'t she?'), say(GLIM, 'Hey! I feel lots of things.')] }));
    const brann = w.npc(new NPC(game, { name: 'Brann', x: S.flags.brann ? 4.5 : 0, z: S.flags.brann ? -28.5 : -31.5, yaw: 0, look: { top: '#2f5a2a', hair: '#e2742a', hat: 'cap', hatColor: '#2f5a2a', build: 1.1 }, bark: S.flags.brann ? 'Hmph.' : 'Nobody gets past me!', talk: () => brannTalk(game, brann) }));

    w.def.ambient = (fx, p, dt) => { if (Math.random() < dt * 6) fx.mote(p.pos.x + (Math.random() - 0.5) * 16, p.pos.y + 0.5 + Math.random() * 3, p.pos.z + (Math.random() - 0.5) * 16); };
  },
  onEnter(game) {
    if (!game.save.flags.intro) {
      game.save.flags.intro = true;
      game.dialog.start([
        say(GLIM, 'Hey! Hey, wake up! You slept right through the morning!'),
        say(GLIM, 'I\'m *Glim*, remember? Your very own wisp. Today\'s the day you leave Leafshade and see the world!'),
        say(GLIM, 'But *Brann* is guarding the north passage again. He won\'t let anyone through without a *sword and a shield*.'),
        say(GLIM, 'You have a sword. The shop sells an *Oak Shield* for *30 gems*. Cut grass, open chests, and explore the *Root Hollow* to collect them!'),
      ]);
    }
  },
};

function clearOf(w, x, z, pad) {
  for (const c of w.circles) if (Math.hypot(x - c.x, z - c.z) < c.r + pad) return false;
  for (const p of w.platforms) if (Math.abs(x - p.x) < p.hw + pad && Math.abs(z - p.z) < p.hd + pad) return false;
  for (const r of w.rocks) if (Math.hypot(x - r.x, z - r.z) < pad + 0.6) return false;
  for (const p of w.portals) if (Math.hypot(x - p.x, z - p.z) < p.r + pad) return false;
  return true;
}

function sayaTalk(game) {
  const S = game.save;
  const menu = () => [{
    who: 'Saya', text: S.hasShield ? 'You got a shield! Want a quick refresher?' : 'Need some advice before you head out?',
    choices: [
      { label: 'How do I fight?', run: () => [say('Saya', 'Press *Q* to *lock on* to whatever Glim flies over. You\'ll circle it and always face it.'), say('Saya', 'Swing with the *left mouse button*. Press again for a combo. *Hold* it after a swing to charge a *spin attack*, then let go!'), ...menu()] },
      { label: 'How do I defend?', run: () => [say('Saya', 'Hold the *right mouse button* to raise a shield. While locked on, tap *Space* with a direction to dodge.'), say('Saya', S.hasShield ? 'Shields even bounce seeds back at whoever spat them!' : 'Of course, you need a shield first. The shop has one!'), ...menu()] },
      { label: 'See you later!', run: () => [say('Saya', 'Don\'t forget about us when you\'re out there, okay?')] },
    ],
  }];
  return menu();
}

function tobinTalk(game) {
  return [
    say('Tobin', 'Watch this! Stand right in front of a rock and press *E* to pick it up.'),
    say('Tobin', 'Then press *E* or swing to *throw* it! Sometimes there\'s something hiding under them.'),
  ];
}

function brannTalk(game, brann) {
  const S = game.save;
  if (S.flags.brann) return [say('Brann', 'What, you still here? Go on, before I change my mind.')];
  if (!S.hasShield) return [
    say('Brann', 'Hold it! Nobody passes without a *sword* and a *shield*. Them\'s the rules.'),
    say('Brann', 'A sword, sure, but where\'s your shield? Ha! Come back when you\'re properly equipped.'),
  ];
  return [
    say('Brann', 'Wha—? Is that an *Oak Shield*? And a sword too...'),
    say('Brann', '...Fine! Go on through. But don\'t think this makes you better than me!'),
    run(() => {
      S.flags.brann = true; brann.bark = 'Hmph.'; brann.moveTo(4.5, -28.5);
      game.saveGame(); game.ui.toast('The north passage is open!');
    }),
  ];
}

// ========================================================================= shop
SCENES.shop = {
  name: 'Leafshade Shop', music: 'shop', amb: 'room', interior: true, ceiling: 4.4, seed: 3,
  fog: { color: '#382311', near: 14, far: 40 },
  light: { sky: '#ffe2b0', ground: '#3a2414', hemi: 0.9, sun: '#ffd49a', sunI: 0.8, dir: [0.3, 1, 0.6] },
  ground: { size: 18, seg: 36, tex: 'wood', texScale: 4, color: (x, z) => mixRgb(hexToRgb('#7a5230'), hexToRgb('#6a4426'), (Math.floor(x * 1.5) % 2 === 0) ? 0 : 1) },
  height: () => 0,
  surface: () => 'stone',
  bounds: { type: 'circle', x: 0, z: 0, r: 7.2 },
  spawns: { fromVillage: { x: 0, z: 5.6, yaw: Math.PI } },
  build(w, game) {
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(7.6, 7.6, 6, 28, 1, true), M.mat('#5a3a22', { side: THREE.BackSide }));
    w.add(wall, 0, 0, 0, 3);
    const ceil = new THREE.Mesh(new THREE.CircleGeometry(7.6, 28), M.mat('#3a2414', { side: THREE.DoubleSide }));
    ceil.rotation.x = Math.PI / 2; w.add(ceil, 0, 0, 0, 5.2); ceil.rotation.x = Math.PI / 2;
    const rug = new THREE.Mesh(new THREE.CircleGeometry(2.4, 24), M.mat('#8a2a2a')); rug.rotation.x = -Math.PI / 2; w.add(rug, 0, 2.2, 0, 0.02); rug.rotation.x = -Math.PI / 2;
    const counter = new THREE.Mesh(new THREE.BoxGeometry(6.4, 1.1, 1), M.mat('#7a4a24')); counter.castShadow = counter.receiveShadow = true;
    w.add(counter, 0, -2.5, 0, 0.55); w.box(0, -2.5, 3.2, 0.5);
    w.platform(0, -4.3, 3, 1.2, 0.45, '#5a3a22');
    w.add(M.shelf(), 0, -6.6, 0); w.box(0, -6.6, 1.3, 0.3);
    w.add(M.shelf(), -4.6, -5, 0.75); w.box(-4.6, -5, 1.3, 0.3, 0.75);
    w.add(M.shelf(), 4.6, -5, -0.75); w.box(4.6, -5, 1.3, 0.3, -0.75);
    w.prop(M.barrel(), -5.5, 2.5, 0, 0.45); w.prop(M.barrel(), -6, 1.4, 0, 0.45); w.prop(M.crate(), 5.6, 2.4, 0.3, 0.55);
    if (!game.save.hasShield) {
      const display = M.makeHero().shield; display.rotation.x = Math.PI / 2; display.scale.setScalar(1.6);
      w.add(display, 0, -7.1, 0, 3.6); display.rotation.set(Math.PI / 2, 0, 0); w.display = display;
    }
    for (const [x, z] of [[-3, -1], [3, -1], [0, 4]]) {
      const l = new THREE.PointLight(0xffb060, 14, 11, 1.6); l.position.set(x, 3.6, z); w.scene.add(l);
      w.add(M.lamp(0, 0, 0), x, z, 0, 3.8);
    }
    w.portal(0, 7.05, 0.9, 'village', 'fromShop', { label: 'Leave' });
    w.npc(new NPC(game, { name: 'Pell', x: 0, z: -4, yaw: 0, talkRange: 3.6, look: { top: '#8a5a2a', hair: '#5a3a1a', hat: 'band', hatColor: '#3a7a3a', build: 1.2 }, bark: 'Welcome, welcome!', talk: () => shopTalk(game) }));
  },
};

function shopTalk(game) {
  const S = game.save;
  const PRICE = 30, TONIC = 10;
  const menu = () => [{
    who: 'Pell', text: 'What can I get for you today?',
    choices: [
      ...(S.hasShield ? [] : [{
        label: `Oak Shield — ${PRICE} gems`, run: () => {
          if (S.gems < PRICE) return [say('Pell', `That's *${PRICE} gems*. You've got ${S.gems}... come back with ${PRICE - S.gems} more!`)];
          S.gems -= PRICE; S.hasShield = true;
          if (game.world.display) game.world.display.visible = false;
          game.giveItem('Oak Shield', 'Hold the right mouse button (or K / Shift) to guard. Blocks bites and reflects seeds.');
          return [say('Pell', 'A fine choice! Sturdy oak, brass rim. If you ever lose it, I\'ll have another.')];
        },
      }]),
      {
        label: `Heart Tonic — ${TONIC} gems`, run: () => {
          if (S.hearts >= S.maxHearts) return [say('Pell', 'You look perfectly healthy to me!')];
          if (S.gems < TONIC) return [say('Pell', 'Not enough gems, I\'m afraid.')];
          S.gems -= TONIC; game.heal(99); game.audio.play('heartUp');
          return [say('Pell', 'Drink up! Tastes like moss, works like magic.')];
        },
      },
      { label: 'Just looking', run: () => [say('Pell', 'Look all you like! Gems don\'t grow on trees... well, sometimes in bushes.')] },
    ],
  }];
  return [say('Pell', S.hasShield ? 'Ah, my favorite customer! How\'s that shield holding up?' : 'Welcome to the finest shop in Leafshade! Also the only one.'), ...menu()];
}

// ======================================================================= hollow
SCENES.hollow = {
  name: 'Root Hollow', sub: 'Mind the jaws', music: 'hollow', amb: 'cave', interior: true, ceiling: 8, seed: 21,
  fog: { color: '#1f1b08', near: 7, far: 30 },
  light: { sky: '#9ab88a', ground: '#1a120a', hemi: 0.55, sun: '#e8f0a0', sunI: 1.6, dir: [-0.2, 1, 0.3] },
  ground: {
    size: 34, seg: 60, tex: 'dirt', texScale: 2.5,
    color: (x, z) => mixRgb(hexToRgb('#3a2a20'), hexToRgb('#4a5226'), clamp((fbm(x * 0.4, z * 0.4) + 0.3), 0, 1)),
  },
  height: (x, z) => fbm(x * 0.2, z * 0.2) * 0.25 + Math.max(0, Math.hypot(x, z) - 13) * 0.6,
  surface: () => 'dirt',
  bounds: { type: 'circle', x: 0, z: 0, r: 14 },
  spawns: { fromVillage: { x: 0, z: 11.5, yaw: Math.PI } },
  build(w, game) {
    // Root walls
    for (let i = 0; i < 46; i++) {
      const a = i / 46 * TAU, r = 15 + (i % 3) * 0.6;
      const root = M.rootArch(10 + (i % 4) * 2, 0.8 + (i % 3) * 0.3, i % 2 ? '#4a3424' : '#3f2c1e');
      root.rotation.set(Math.sin(a) * 0.25, a, Math.cos(a) * 0.25 + (i % 2 ? 0.2 : -0.2));
      root.position.set(Math.cos(a) * r, 4, Math.sin(a) * r);
      w.scene.add(root);
    }
    for (let i = 0; i < 18; i++) {
      const a = i / 18 * TAU + 0.2;
      const v = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 6), M.mat('#3f7a33'));
      v.position.set(Math.cos(a) * 13.5, 5, Math.sin(a) * 13.5); w.scene.add(v);
    }
    // Light shafts
    for (const [x, z] of [[-3, 2], [4, -5], [0, -10]]) {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 2.2, 10, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xd8f0a0, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      shaft.position.set(x, 5, z); shaft.rotation.z = 0.15; w.scene.add(shaft);
    }
    for (const [x, z, c] of [[-9, -2, 0x9a6aff], [9, 1, 0x6affc0], [-5, -11, 0x9a6aff], [7, -10, 0x6affc0]]) {
      const l = new THREE.PointLight(c, 6, 8, 1.5); l.position.set(x, 1, z); w.scene.add(l);
      w.add(M.rock(0.6, '#4a4a40', x), x, z);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: M.glowTexture(), color: c, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })); glow.scale.set(1.5, 1.5, 1);
      w.add(glow, x, z, 0, 0.9);
      w.circle(x, z, 0.6);
    }
    w.portal(0, 13.4, 1.4, 'village', 'fromHollow', { label: 'Leave' });
    w.chest(0, -11.5, 0, 'hollow', { gems: 20 });
    w.enemy(new Thornmaw(game, 0, -1.5, Math.PI));
    w.enemy(new Thornmaw(game, -6.5, -6.5, Math.PI));
    w.enemy(new Thornmaw(game, 6.5, -7, Math.PI));
    w.scatter(12, (x, z) => w.bush(x, z), (x, z) => Math.hypot(x, z) < 12 && Math.abs(x) > 2.5);
    w.grass(500, (x, z) => Math.hypot(x, z) < 13, ['#3a6a2a', '#2f5a24'], 0.35);
    w.def.ambient = (fx, p, dt) => { if (Math.random() < dt * 4) fx.mote(p.pos.x + (Math.random() - 0.5) * 12, 0.3 + Math.random() * 3, p.pos.z + (Math.random() - 0.5) * 12, [0.7, 0.5, 1]); };
  },
};

// ========================================================================= field
const riverZ = (x) => 22 + Math.sin(x * 0.05) * 4;
const FPATHS = [
  [[0, 88], [2, 60], [0, 40], [0, 22], [-2, 0], [-4, -30], [0, -60], [0, -88]],
  [[-2, 0], [-30, 4], [-60, -2], [-88, 0]],
];
const fHeight = (x, z) => {
  let h = fbm(x * 0.022, z * 0.022, 4) * 5 + fbm(x * 0.08, z * 0.08) * 0.6;
  const pd = distToPaths(x, z, FPATHS);
  h *= smooth(clamp((pd - 2) / 12, 0, 1)) * 0.9 + 0.1;
  const dr = Math.abs(z - riverZ(x));
  if (dr < 5) h -= Math.pow(1 - dr / 5, 1.4) * 1.8;
  const r = Math.hypot(x, z);
  if (r > 85) h += Math.min(r - 85, 10) * 0.8 - Math.max(0, r - 110) * 0.15;
  return h;
};
SCENES.field = {
  name: 'Greenreach Field', sub: 'The wide world', music: 'field', amb: 'field', seed: 31,
  fog: { color: '#a8c8d4', near: 35, far: 250 },
  sky: { top: '#3f84d0', bottom: '#bcd8e4', clouds: 0.7 },
  light: { sky: '#e0f0ff', ground: '#4a6a3a', hemi: 1.0, sun: '#fff4dc', sunI: 2.6, dir: [0.6, 1, -0.4] },
  ground: {
    size: 400, seg: 200, tex: 'grass', texScale: 3,
    color: (x, z, h) => {
      const pd = distToPaths(x, z, FPATHS);
      const grass = mixRgb(hexToRgb('#5a9430'), hexToRgb('#8ab43e'), (fbm(x * 0.05, z * 0.05) + 1) / 2);
      const dirt = hexToRgb('#a08a62');
      let c = mixRgb(dirt, grass, smooth(clamp((pd - 1) / 1.6, 0, 1)));
      if (h < -0.6) c = mixRgb(c, hexToRgb('#6a6248'), clamp(-h - 0.6, 0, 1));
      if (Math.hypot(x, z) > 95) c = mixRgb(c, hexToRgb('#7a9a5a'), 0.5);
      return c;
    },
  },
  height: fHeight,
  surface: (x, z) => (distToPaths(x, z, FPATHS) < 1.8 ? 'dirt' : 'grass'),
  bounds: { type: 'circle', x: 0, z: 0, r: 87 },
  mapPaths: FPATHS,
  spawns: {
    fromVillage: { x: 1.5, z: 83, yaw: Math.PI },
    fromTown: { x: 0, z: -82, yaw: 0 },
    fromDesert: { x: -82, z: 0, yaw: Math.PI / 2 },
  },
  build(w, game) {
    w.waterRect(0, 22, 200, 14, -0.75);
    w.platform(0.5, 22, 2, 7.5, 0.25, '#8a6a40');
    // Gates at each exit
    w.prop(M.arch('#7a6a50', 4, 4.5), 1.5, 86.5, 0);
    w.circle(-0.5, 86.5, 0.7); w.circle(3.5, 86.5, 0.7);
    w.portal(1.5, 86, 2.2, 'village', 'fromField', { label: 'Leafshade Village' });
    w.prop(M.arch('#b8b0a0', 5, 5.5), 0, -86.5, 0);
    w.portal(0, -86, 2.4, 'town', 'fromField', { label: 'Brightwall Market' });
    w.prop(M.arch('#b87a50', 4, 4.5), -86.5, 0, Math.PI / 2);
    w.portal(-86, 0, 2.4, 'desert', 'fromField', { label: 'Sunscar Basin' });
    w.sign(4, 70, -0.3, 'Village ↓', 'South: Leafshade Village.');
    w.sign(-6, 2, 0.6, '← Basin\nMarket ↑', 'West: Sunscar Basin. North: Brightwall Market.');
    // Distant backdrop
    w.add(M.castle(), 0, -170, 0, 8);
    for (let i = 0; i < 26; i++) {
      const a = i / 26 * TAU, r = 180 + (i % 3) * 25;
      w.add(M.mountain(40 + (i % 4) * 12, 50 + (i % 5) * 18, ['#7a8a9a', '#6a7a6a', '#8a8a8a'][i % 3], i % 2 === 0), Math.cos(a) * r, Math.sin(a) * r, 0, 0);
    }
    w.add(M.mountain(70, 120, '#6a5a5a', true), 160, -150, 0, 0);
    // Wall segments along the field edge
    for (let a = 0; a < TAU; a += 0.09) {
      if (Math.abs(angleDiff(a, -Math.PI / 2)) < 0.08 || Math.abs(angleDiff(a, Math.PI / 2)) < 0.08 || Math.abs(angleDiff(a, Math.PI)) < 0.08) continue;
      const x = Math.cos(a) * 92, z = Math.sin(a) * 92;
      const seg = new THREE.Mesh(new THREE.BoxGeometry(9, 4 + (Math.floor(a * 10) % 3), 2), M.mat('#9a9480', { flat: true }));
      seg.castShadow = true; seg.receiveShadow = true;
      w.add(seg, x, z, -a + Math.PI / 2, fHeight(x, z) + 1);
    }
    const ok = (x, z, pad) => distToPaths(x, z, FPATHS) > pad && Math.abs(z - riverZ(x)) > 7 && Math.hypot(x, z) < 82 && clearOf(w, x, z, pad);
    w.scatter(46, (x, z, i, r) => w.prop(r < 0.6 ? M.roundTree(0.9 + r, i) : M.pine(1 + r * 0.6), x, z, r * 6, 0.45), (x, z) => ok(x, z, 6));
    w.scatter(24, (x, z, i, r) => w.prop(M.rock(0.8 + r * 1.5, '#8a8a80', i), x, z, r * 6, 0.8 + r * 1.2), (x, z) => ok(x, z, 4));
    w.scatter(34, (x, z) => w.bush(x, z), (x, z) => ok(x, z, 2.5));
    w.grass(14000, (x, z) => distToPaths(x, z, FPATHS) > 1.8 && Math.abs(z - riverZ(x)) > 4.5 && Math.hypot(x, z) < 86, ['#6aaa44', '#7ab84a', '#5a9a3a', '#8ac458'], 0.6);
    w.enemy(new HoverBloom(game, 14, 4));
    w.enemy(new HoverBloom(game, -26, -22));
    w.enemy(new HoverBloom(game, 18, -46));
    w.enemy(new HoverBloom(game, -50, 12));
    w.npc(new NPC(game, { name: 'Dorran', x: 6, z: 48, yaw: -1.5, look: { top: '#7a6a4a', hair: '#9a9a9a', hat: 'band', hatColor: '#4a4a7a', build: 1.15 }, bark: 'Lovely day for walking.', talk: () => [say('Dorran', 'A forest child, out in the wide world! Brightwall Market is straight up this road, past the river.'), say('Dorran', 'The *Sunscar Basin* to the west is crawling with burrowing sprouts. They say a treasure waits for whoever clears them out.'), say('Dorran', 'And watch for *Whirlbloom* plants. They spit seeds — a good shield will send them right back.')] }));
  },
};

// ======================================================================== desert
SCENES.desert = {
  name: 'Sunscar Basin', sub: 'Something stirs beneath the sand', music: 'desert', amb: 'desert', seed: 41,
  fog: { color: '#c8ac8a', near: 22, far: 140 },
  sky: { top: '#8aa6c4', bottom: '#d8c6aa', clouds: 0.2 },
  light: { sky: '#fff2d8', ground: '#a07a4a', hemi: 1.0, sun: '#fff0d0', sunI: 2.8, dir: [-0.4, 1, 0.3] },
  ground: {
    size: 140, seg: 120, cz: -30, tex: 'sand', texScale: 4,
    color: (x, z, h) => mixRgb(hexToRgb('#c4ae84'), hexToRgb('#d8c49a'), clamp(h * 0.6 + 0.5, 0, 1)),
  },
  height: (x, z) => fbm(x * 0.06, z * 0.04) * 1.4 + Math.min(Math.max(0, Math.abs(x) - 16), 6) * 1.5,
  surface: () => 'sand',
  bounds: { type: 'rect', x0: -17, x1: 17, z0: -68, z1: 9.5 },
  spawns: { fromField: { x: 0, z: 6, yaw: Math.PI } },
  build(w, game) {
    for (let z = 12, i = 0; z > -80; z -= 8, i++) {
      for (const s of [-1, 1]) {
        const c = M.cliff(8, 12 + ((i * 7 + (s > 0 ? 3 : 0)) % 9), 10, i + (s > 0 ? 1 : 0));
        w.add(c, s * (22 + (i % 2)), z, 0, -2);
      }
    }
    w.add(M.cliff(40, 16, 8, 2), 0, -76, 0, -2);
    w.add(M.arch('#b87a50', 4, 4.5), 0, 10.8, 0);
    w.portal(0, 9.2, 2.2, 'field', 'fromDesert', { label: 'Greenreach Field' });
    for (const [x, z] of [[-10, -58], [10, -58], [-12, -40], [12, -24]]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 5, 8), M.mat('#c89a6a', { flat: true })); pillar.castShadow = true;
      w.add(pillar, x, z, 0, w.heightFn(x, z) + 2.2); w.circle(x, z, 0.8); w.occluders.push(pillar);
    }
    w.scatter(10, (x, z, i, r) => w.prop(M.rock(0.7 + r, '#b8805a', i), x, z, r * 6, 0.7 + r * 0.8), (x, z) => Math.abs(x) < 14 && z < -8 && clearOf(w, x, z, 3));
    w.grass(240, (x, z) => Math.abs(x) < 15, ['#9a9a4a', '#8a8a3a'], 0.4);
    const done = game.save.flags.basin;
    if (!done) {
      const spots = [[-5, -24], [4, -26], [0, -30], [-8, -32], [8, -33], [-3, -37], [5, -39], [-7, -42], [2, -44], [9, -27]];
      for (const [x, z] of spots) w.enemy(new Sprout(game, x, z));
      w.trigger(0, -20, 8, () => { for (const e of w.enemies) e.awake = true; game.audio.setBattle(true); game.ui.toast('The sand is moving…', 2); });
      w.def.onClear = () => {
        if (game.save.flags.basin) return;
        game.save.flags.basin = true;
        game.audio.setBattle(false);
        game.audio.play('chest');
        w.chest(0, -52, 0, 'basin', { heart: true });
        const c = w.chests[w.chests.length - 1];
        game.fx.sparkle(c.x, c.mesh.position.y + 1, c.z, [1, 0.9, 0.5]);
        game.ui.toast('A chest appeared at the far end of the basin!', 3.5);
        game.saveGame();
      };
    } else {
      w.chest(0, -52, 0, 'basin', { heart: true });
    }
  },
};

// ========================================================================== town
const townH = () => 0;
SCENES.town = {
  name: 'Brightwall Market', sub: 'The bustling town square', music: 'town', amb: 'town', seed: 51,
  fog: { color: '#b4bcc0', near: 40, far: 220 },
  sky: { top: '#5a98e0', bottom: '#dbe8f2', clouds: 0.6 },
  light: { sky: '#ffffff', ground: '#8a7a6a', hemi: 1.0, sun: '#fff2dc', sunI: 2.6, dir: [0.4, 1, 0.5] },
  ground: {
    size: 80, seg: 80, tex: 'cobble', texScale: 1.6,
    color: (x, z) => {
      const bx = Math.abs(((x + 100) % 1.4) - 0.7), bz = Math.abs(((z + 100 + (Math.floor((x + 100) / 1.4) % 2) * 0.35) % 0.7) - 0.35);
      const n = (fbm(x * 0.8, z * 0.8) + 1) / 2;
      let c = mixRgb(hexToRgb('#7a7a74'), hexToRgb('#94928a'), n);
      if (bx > 0.66 || bz > 0.32) c = mixRgb(c, hexToRgb('#6a6458'), 0.6);
      return c;
    },
  },
  height: townH,
  surface: () => 'stone',
  bounds: { type: 'rect', x0: -27, x1: 27, z0: -27, z1: 27 },
  spawns: { fromField: { x: 0, z: 23.5, yaw: Math.PI } },
  build(w, game) {
    w.add(M.castle(), 0, -95, 0, 0);
    w.prop(M.fountain(), 0, 0, 0, 3.4);
    // Houses ringing the square
    const H = [
      [-19, -24, 0, 12], [-7, -25, 0, 7], [7, -25, 0, 7], [19, -24, 0, 12],
      [-19, 24, Math.PI, 12], [-8, 25, Math.PI, 8], [8, 25, Math.PI, 8], [19, 24, Math.PI, 12],
      [-25, -9, Math.PI / 2, 10], [-25, 8, Math.PI / 2, 10],
      [25, -12, -Math.PI / 2, 8], [25, 11, -Math.PI / 2, 8],
    ];
    H.forEach(([x, z, yaw, wd], i) => {
      const d = 6, h = 6 + (i % 3);
      const m = M.house(wd, d, h, i);
      w.add(m, x, z, yaw); w.occluders.push(m);
      w.box(x, z, wd / 2, d / 2, yaw);
    });
    // Outer city wall beyond the houses
    for (const [x, z, sx, sz] of [[0, -33, 70, 2], [0, 33, 70, 2], [-33, 0, 2, 70], [33, 0, 2, 70]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, 12, sz), M.mat('#c9c3b5', { flat: true })); m.receiveShadow = true;
      w.add(m, x, z, 0, 6);
    }
    w.add(M.arch('#c9c3b5', 4, 5), 0, -28.5, 0);
    w.add(M.arch('#c9c3b5', 4, 5), 0, 28.5, 0);
    w.portal(0, 26.6, 2, 'field', 'fromTown', { label: 'Greenreach Field' });
    // Stalls and clutter
    for (const [x, z, yaw, c] of [[-11, 9, 0.3, '#c33a3a'], [11, 9, -0.3, '#3a6ac3'], [-12, -9, Math.PI - 0.3, '#e8a83a'], [12, -9, Math.PI + 0.3, '#3aa85a']]) {
      w.add(M.stall(c), x, z, yaw); w.box(x, z, 1.4, 0.8, yaw);
    }
    for (const [x, z] of [[-21, 15], [-20, 16.2], [21, -3], [20.5, 2], [-21, -16], [15, 19]]) w.prop(M.barrel(), x, z, 0, 0.45);
    for (const [x, z] of [[21.5, -16], [22, 16], [-15, 19.5]]) w.prop(M.crate(), x, z, 0.4, 0.55);
    w.add(M.bunting(-19, -21, 19, 21, 7), 0, 0, 0, 0);
    w.add(M.bunting(19, -21, -19, 21, 7), 0, 0, 0, 0);
    w.add(M.bunting(-22, 0, 22, 0, 6.5), 0, 0, 0, 0);
    for (const [x, z] of [[-5, -18], [5, -18], [-5, 18], [5, 18]]) w.prop(M.roundTree(0.8, x > 0 ? 1 : 0), x, z, 0, 0.5);
    for (const [x, z] of [[-6, -6], [6, 6], [-6, 6], [6, -6]]) {
      w.add(M.lamp(0, 3.2, 0), x, z, 0, 0);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 3.1), M.mat('#2a2a2a', { metal: 0.6 })); post.castShadow = true;
      w.add(post, x, z, 0, 1.55); w.circle(x, z, 0.2);
    }
    w.trigger(0, 22, 4, () => { if (!game.save.flags.town) { game.save.flags.town = true; game.saveGame(); } });
    // Townsfolk
    const folk = [
      ['Mira', -8, 4, { top: '#c94a6a', hair: '#5a2a1a', dress: true, hat: 'long' }, 'Fresh apples! Two gems a basket!', ['Apples, pears, a suspicious melon... what\'ll it be?', 'Ha! Just browsing? Suit yourself.']],
      ['Oswin', 9, -4, { top: '#3a5aa8', hair: '#2a2a2a', hat: 'band', hatColor: '#a83a3a', build: 1.2 }, 'Business is booming!', ['Business is booming! Everybody\'s in town for the festival.']],
      ['Lettie', -4, -12, { top: '#e8c43a', hair: '#e86a2a', dress: true, hat: 'bun' }, 'Have you seen my dog?', ['My dog Biscuit ran off again. He\'s probably napping somewhere warm.', 'If you see a very lazy dog, tell him to come home!']],
      ['Gerrit', 14, 14, { top: '#5a7a3a', hair: '#bbbbbb', build: 1.1 }, 'Hmph.', ['Kids these days, running around with swords...', '...though I suppose that shield of yours looks well made.']],
      ['Pip', -14, -3, { top: '#3aa8a8', hair: '#f2d06a', scale: 0.8, hat: 'cap', hatColor: '#3aa8a8' }, 'Tag! You\'re it!', ['Tag! You\'re it! ...hey, you\'re not running!']],
      ['Hilde', 3, 13, { top: '#8a3aa8', hair: '#3a1a0a', dress: true, hat: 'long' }, 'What a lovely day.', ['The fountain was built when Brightwall was founded. Toss a gem in for luck — or don\'t, I\'m not your mother.']],
      ['Bram', -15, 13, { top: '#a86a3a', hair: '#6a3a1a', build: 1.25 }, 'Need anything hauled?', ['Strong arms, honest work. That\'s my motto.', 'You lift rocks too? Respect.']],
      ['Tessa', 16, -15, { top: '#3a8a5a', hair: '#1a1a1a', dress: true, hat: 'band', hatColor: '#e8e8e8' }, 'Psst... the guard naps at noon.', ['Psst. The castle guard is very serious. Very. Serious.']],
      ['Fenn', 22, 0, { top: '#6a6a6a', hair: '#a87a3a', hat: 'cap', hatColor: '#4a4a4a' }, 'This lane is a dead end.', ['This side lane doesn\'t lead anywhere. I just like the quiet.']],
      ['Rosa', -2, 8, { top: '#e85a5a', hair: '#f2e2a2', dress: true, scale: 0.85, hat: 'bun' }, 'Mama says I can\'t have a sword.', ['Mama says I can\'t have a sword until I\'m taller than the fountain.']],
    ];
    for (const [name, x, z, look, bark, lines] of folk) {
      w.npc(new NPC(game, { name, x, z, look, bark, wander: name === 'Fenn' ? 0 : 3.5, talk: () => lines.map((l) => say(name, l)) }));
    }
    w.npc(new NPC(game, { name: 'Gate Guard', x: 0, z: -26, yaw: 0, look: { top: '#4a5a8a', hair: '#3a2a1a', hat: 'helmet', build: 1.3 }, bark: 'Halt.', talk: () => guardTalk(game) }));
  },
};

function guardTalk(game) {
  const S = game.save;
  return [
    say('Gate Guard', 'Halt! The castle is closed to visitors today, by royal order.'),
    say('Gate Guard', '...A forest child with a sword and shield, come all the way from Leafshade? Well. That\'s quite a journey.'),
    run(() => {
      if (S.flags.ending) return [say('Gate Guard', 'Still here? Go and enjoy the market. Maybe try the western basin, if you haven\'t.')];
      S.flags.ending = true; game.saveGame();
      return [
        say('Gate Guard', 'Come back another day. Perhaps the princess will have time for you then.'),
        say(GLIM, 'Hey... we made it all the way here! I think that\'s the end of today\'s adventure.'),
        say(GLIM, S.flags.basin ? 'You even found the treasure in the basin. Thanks for playing *Verdant Hollow*!' : 'Thanks for playing *Verdant Hollow*! Psst — there\'s still a treasure hidden in the *Sunscar Basin*.'),
      ];
    }),
  ];
}

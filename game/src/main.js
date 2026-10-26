import * as THREE from 'three';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { FX } from './fx.js';
import { World } from './world.js';
import { Player } from './player.js';
import { CameraRig } from './camera.js';
import { UI, Dialog } from './ui.js';
import { SCENES } from './scenes.js';
import * as M from './models.js';
import { angleDiff, damp, TAU } from './util.js';

const SAVE_KEY = 'verdant-hollow-save-v1';
const STEP = 1 / 60;
const $ = (id) => document.getElementById(id);

const ENEMY_INFO = {
  thornmaw: ['Watch out, a *Thornmaw*!', 'Its closed bud is too tough to cut. Get close so it opens up, then strike its jaws — or wait until it bites the ground and *hit it while it\'s stuck*!'],
  sprout: ['*Sandsprouts*! They come in bunches.', 'Hold the attack button to charge up, then let go for a *spin attack* that hits everything around you!'],
  bloom: ['A *Whirlbloom*! It spits seeds from afar.', 'Raise your *shield* while facing it to bounce seeds right back. Or just get close and smack it!'],
};

function freshSave() {
  return { hearts: 3, maxHearts: 3, gems: 0, hasShield: false, flags: {}, scene: 'village', spawn: 'start' };
}

class Game {
  constructor() {
    this.canvas = $('view');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 900);
    this.input = new Input(this.canvas);
    this.audio = new AudioSys();
    this.ui = new UI(this);
    this.dialog = new Dialog(this);
    this.cam = new CameraRig(this.camera);
    this.state = 'title';
    this.lock = { target: null, candidate: null };
    this.talkTarget = null; this.context = null; this.barkNpc = null;
    this.projectiles = []; this.time = 0; this.acc = 0;
    this.save = this.loadSave() || freshSave();
    this.world = null;
    this.player = null;
    this.wisp = M.makeWisp();
    this.wispPos = new THREE.Vector3();
    addEventListener('resize', () => this.resize());
    this.resize();
    this.bindMenus();
    // A quiet backdrop behind the title screen.
    this.loadScene('village', 'start', true);
    this.cam.yaw = 2.4; this.cam.pitch = 0.18;
    requestAnimationFrame((t) => this.frame(t));
  }

  // ------------------------------------------------------------- save/load
  loadSave() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return s && s.maxHearts ? s : null; } catch { return null; } }
  saveGame() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.save)); } catch { /* storage unavailable */ }
  }

  bindMenus() {
    if (this.loadSave()) $('btnContinue').classList.remove('hidden');
    $('btnNew').onclick = () => { this.save = freshSave(); this.saveGame(); this.begin(); };
    $('btnContinue').onclick = () => { this.save = this.loadSave() || freshSave(); this.save.hearts = Math.max(this.save.hearts, 3); this.begin(); };
    $('btnResume').onclick = () => this.resume();
    $('btnMusic').onclick = () => { $('btnMusic').textContent = 'Music: ' + (this.audio.toggleMusic() ? 'on' : 'off'); };
    $('btnRestart').onclick = () => { $('pause').classList.add('hidden'); this.save.hearts = this.save.maxHearts; this.goto('village', 'start'); this.resume(); };
    $('btnRetry').onclick = () => {
      $('gameover').classList.add('hidden');
      this.save.hearts = this.save.maxHearts;
      this.goto(this.save.scene, this.save.spawn);
      this.input.requestLock();
    };
    this.canvas.addEventListener('click', () => { if (this.state === 'play' || this.state === 'dialog') this.input.requestLock(); });
    this.input.onLockChange = (locked) => {
      if (!locked && this.state === 'play' && !this.ignoreUnlock) this.pause();
      this.ignoreUnlock = false;
    };
  }

  begin() {
    this.audio.init();
    $('title').classList.add('hidden');
    this.ui.show(true);
    this.goto(this.save.scene || 'village', this.save.spawn || 'start');
    this.input.requestLock();
  }
  pause() {
    if (this.state !== 'play') return;
    this.state = 'pause';
    $('objective').textContent = '★ ' + this.objective();
    $('pause').classList.remove('hidden');
  }
  resume() {
    $('pause').classList.add('hidden');
    this.state = 'play';
    this.input.requestLock();
  }
  objective() {
    const S = this.save, f = S.flags;
    if (!S.hasShield) return `Collect 30 gems (you have ${S.gems}) and buy the Oak Shield in the Leafshade shop.`;
    if (!f.brann) return 'Show Brann your sword and shield at the north passage.';
    if (!f.town) return 'Cross Greenreach Field and reach Brightwall Market to the north.';
    if (!f.ending) return 'Find out what lies beyond Brightwall\'s castle gate.';
    if (!f.basin) return 'Clear the sprouts in the Sunscar Basin, west of the field, and claim its treasure.';
    return 'You have seen everything in this slice. Thanks for playing!';
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.fx?.setScale(h * this.renderer.getPixelRatio(), this.camera.fov);
  }

  // --------------------------------------------------------------- scenes
  loadScene(id, spawnKey, quiet = false) {
    const def = SCENES[id];
    if (this.world) this.disposeWorld(this.world);
    this.lock.target = this.lock.candidate = null;
    this.projectiles.length = 0; this.thrown = [];
    this.world = new World(def, this);
    this.world.id = id;
    if (!this.fx) { this.fx = new FX(this.world.scene); this.resize(); } else this.fx.attach(this.world.scene);
    if (!this.player) this.player = new Player(this);
    this.world.scene.add(this.player.root);
    this.world.scene.add(this.wisp);
    const sp = def.spawns[spawnKey] || Object.values(def.spawns)[0];
    this.player.place(sp.x, sp.z, sp.yaw);
    this.wispPos.set(sp.x, this.player.pos.y + 1.8, sp.z);
    this.cam.snap(this.player);
    this.cam.update(0, this, 1);
    this.audio.setRegion(def.music, def.amb);
    this.audio.setBattle(false);
    if (!quiet) {
      this.save.scene = id; this.save.spawn = spawnKey;
      this.saveGame();
    }
  }
  disposeWorld(w) {
    w.scene.traverse((o) => { if (o === this.player?.root || o === this.wisp) return; if (o.isInstancedMesh || o === w.terrain) o.geometry.dispose(); });
    w.scene.remove(this.player?.root); w.scene.remove(this.wisp);
  }
  goto(id, spawn) {
    this.state = 'transition';
    this.ui.fade(true);
    setTimeout(() => {
      this.loadScene(id, spawn);
      setTimeout(() => {
        this.ui.fade(false);
        this.state = 'play';
        const d = this.world.def;
        this.ui.banner(d.name, d.sub || '');
        d.onEnter?.(this, spawn);
      }, 120);
    }, 380);
  }

  // ------------------------------------------------------------- gameplay
  heal(n) { this.save.hearts = Math.min(this.save.maxHearts, this.save.hearts + n); }
  addGems(n) { this.save.gems = Math.min(500, this.save.gems + n); }

  giveItem(name, desc) {
    this.audio.play('fanfare');
    this.player.setState('get');
    this.ui.toast(`<b>You got the ${name}!</b><br><small>${desc}</small>`, 4.5);
    setTimeout(() => { if (this.player.state === 'get') this.player.setState('move'); }, 1600);
    this.saveGame();
  }

  damagePlayer(amount, fx, fz, blockable) {
    const p = this.player;
    if (p.invuln > 0 || p.state === 'dead' || this.state !== 'play') return 'none';
    const toSrc = Math.atan2(fx - p.pos.x, fz - p.pos.z);
    if (blockable && p.state === 'guard' && Math.abs(angleDiff(p.yaw, toSrc)) < 1.25) {
      this.audio.play('block');
      const f = p.facing; this.fx.clink(p.pos.x + f.x * 0.5, p.pos.y + 0.9, p.pos.z + f.z * 0.5);
      p.vel.x -= Math.sin(toSrc) * 3; p.vel.z -= Math.cos(toSrc) * 3;
      return 'blocked';
    }
    this.save.hearts = Math.max(0, this.save.hearts - amount);
    p.invuln = 1.2;
    if (p.carry) { this.throwRock(p.carry, p.pos.x, p.pos.y + 1.5, p.pos.z, 0, 0, 0); p.carry = null; }
    p.setState('hurt');
    p.vel.set(-Math.sin(toSrc) * 7, 3.5, -Math.cos(toSrc) * 7); p.grounded = false;
    this.audio.play('hurt'); this.ui.hurtFlash(); this.cam.shake = 0.25;
    this.fx.hit(p.pos.x, p.pos.y + 1, p.pos.z, toSrc);
    if (this.save.hearts <= 0) this.die();
    return 'hit';
  }
  die() {
    this.player.setState('dead');
    this.lock.target = null;
    setTimeout(() => {
      this.state = 'gameover';
      this.ignoreUnlock = true; this.input.releaseLock();
      $('gameover').classList.remove('hidden');
    }, 1200);
  }

  /** Sword arc: enemies, bushes and rocks in front of the player. */
  swordHit(p, range, arc, dmg) {
    const f = p.yaw;
    const inArc = (x, z, r) => {
      const dx = x - p.pos.x, dz = z - p.pos.z, d = Math.hypot(dx, dz);
      return d < range + r && (d < r + 0.3 || Math.abs(angleDiff(f, Math.atan2(dx, dz))) < arc / 2);
    };
    for (const e of this.world.enemies) {
      if (!e.alive || p.hitSet.has(e)) continue;
      const lp = e.lockPos;
      if (Math.abs(lp.y - (p.pos.y + 1)) > 1.8) continue;
      if (inArc(e.x, e.z, e.radius)) { p.hitSet.add(e); this.applyHit(e, dmg, 'sword', lp); }
    }
    this.cutBushes((b) => inArc(b.x, b.z, b.r), p);
  }
  spinHit(p, radius, dmg) {
    for (const e of this.world.enemies) {
      if (!e.alive || p.hitSet.has(e)) continue;
      if (Math.hypot(e.x - p.pos.x, e.z - p.pos.z) < radius + e.radius) { p.hitSet.add(e); this.applyHit(e, dmg, 'spin', e.lockPos); }
    }
    this.cutBushes((b) => Math.hypot(b.x - p.pos.x, b.z - p.pos.z) < radius + b.r, p);
  }
  applyHit(e, dmg, src, lp) {
    const r = e.hurt(dmg, src);
    const yaw = Math.atan2(e.x - this.player.pos.x, e.z - this.player.pos.z);
    if (r === 'hit') { this.audio.play('hit'); this.fx.hit(lp.x, lp.y, lp.z, yaw); this.cam.shake = 0.12; this.hitstop = 0.06; }
    else if (r === 'deflect') {
      this.audio.play('clink'); this.fx.clink(lp.x, lp.y, lp.z);
      const p = this.player; p.vel.x -= Math.sin(yaw) * 4; p.vel.z -= Math.cos(yaw) * 4;
      if (p.state === 'attack') p.stateT = Math.max(p.stateT, 0.3);
    }
  }
  cutBushes(test, p) {
    for (const b of this.world.bushes) {
      if (!b.alive || p.hitSet.has(b) || !test(b)) continue;
      p.hitSet.add(b); b.alive = false; b.mesh.visible = false;
      this.audio.play('cut'); this.fx.leaves(b.x, b.mesh.position.y, b.z);
      this.dropLoot(b.x, b.mesh.position.y + 0.3, b.z, 'bush');
    }
  }
  dropLoot(x, y, z, kind) {
    const r = Math.random(), S = this.save;
    if (kind === 'bush') {
      if (r < 0.1 && S.hearts < S.maxHearts) this.spawnPickup('heart', x, y, z);
      else if (r < 0.15) this.spawnPickup('blue', x, y, z);
      else if (r < 0.55) this.spawnPickup('green', x, y, z);
    } else if (kind === 'enemy') {
      this.spawnPickup(r < 0.35 ? 'blue' : 'green', x, y, z);
      if (Math.random() < 0.5) this.spawnPickup('green', x, y, z);
      if (S.hearts < S.maxHearts && Math.random() < 0.4) this.spawnPickup('heart', x, y, z);
    } else if (kind === 'rock') {
      if (r < 0.5) this.spawnPickup('green', x, y, z);
      else if (r < 0.65) this.spawnPickup('blue', x, y, z);
    }
  }
  spawnPickup(kind, x, y, z, life = 14) {
    const mesh = kind === 'heart' ? M.heartMesh() : M.gemMesh(kind);
    if (kind === 'heart') mesh.scale.setScalar(0.8);
    this.world.scene.add(mesh);
    const a = Math.random() * TAU;
    this.world.pickups.push({ kind, mesh, x, y, z, vx: Math.cos(a) * 1.5, vy: 5, vz: Math.sin(a) * 1.5, life, t: 0 });
  }
  onEnemyDefeated(e) {
    const lp = e.lockPos;
    setTimeout(() => this.dropLoot(e.x, lp.y * 0.5 + e.y * 0.5, e.z, 'enemy'), 350);
    if (this.lock.target === e) this.lock.target = null;
    const w = this.world;
    if (w.enemies.every((x) => !x.alive)) setTimeout(() => w.def.onClear?.(), 900);
  }
  spawnSeed(owner, x, y, z, vx, vy, vz) {
    const mesh = M.makeSeed(); mesh.position.set(x, y, z);
    this.world.scene.add(mesh);
    this.projectiles.push({ owner, mesh, vel: new THREE.Vector3(vx, vy, vz), life: 3, reflected: false });
  }
  throwRock(rock, x, y, z, vx, vy, vz) {
    rock.mesh.position.set(x, y, z);
    this.thrown.push({ rock, vel: new THREE.Vector3(vx, vy, vz) });
  }

  updateProjectiles(dt) {
    const p = this.player, w = this.world;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const s = this.projectiles[i];
      s.life -= dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      const m = s.mesh.position;
      let dead = s.life <= 0 || m.y < w.heightFn(m.x, m.z);
      if (!dead && !s.reflected && Math.hypot(m.x - p.pos.x, m.z - p.pos.z) < 0.6 && Math.abs(m.y - (p.pos.y + 0.9)) < 0.9) {
        const r = this.damagePlayer(0.5, m.x - s.vel.x, m.z - s.vel.z, true);
        if (r === 'blocked') {
          // Reflect toward the shooter.
          const o = s.owner, d = new THREE.Vector3(o.x - m.x, o.y - m.y, o.z - m.z).normalize();
          s.vel.copy(d.multiplyScalar(13)); s.reflected = true; s.life = 2;
          this.fx.sparkle(m.x, m.y, m.z, [1, 1, 0.6]);
        } else dead = true;
      }
      if (!dead && s.reflected) {
        for (const e of w.enemies) if (e.alive && Math.hypot(e.x - m.x, e.z - m.z, e.lockPos.y - m.y) < 0.8) { this.applyHit(e, 2, 'seed', e.lockPos); dead = true; break; }
      }
      if (dead) { this.fx.dust(m.x, m.y - 0.1, m.z, [0.5, 0.4, 0.3], 5); s.mesh.removeFromParent(); this.projectiles.splice(i, 1); }
    }
    for (let i = this.thrown.length - 1; i >= 0; i--) {
      const t = this.thrown[i], m = t.rock.mesh.position;
      t.vel.y -= 22 * dt; m.addScaledVector(t.vel, dt);
      t.rock.mesh.rotation.x += dt * 6;
      let hit = m.y < w.groundAt(m.x, m.z);
      for (const e of w.enemies) if (e.alive && Math.hypot(e.x - m.x, e.z - m.z) < e.radius + 0.5 && Math.abs(e.lockPos.y - m.y) < 1.4) { this.applyHit(e, 2, 'rock', e.lockPos); hit = true; break; }
      for (const b of w.bushes) if (b.alive && Math.hypot(b.x - m.x, b.z - m.z) < 0.8 && m.y < b.mesh.position.y + 1) { b.alive = false; b.mesh.visible = false; this.fx.leaves(b.x, b.mesh.position.y, b.z); this.dropLoot(b.x, b.mesh.position.y + 0.3, b.z, 'bush'); }
      if (!hit) { const q = { x: m.x, z: m.z }; w.resolve(q, 0.3, m.y); if (Math.abs(q.x - m.x) + Math.abs(q.z - m.z) > 0.01) hit = true; }
      if (hit) {
        this.audio.play('shatter'); this.fx.rocks(m.x, m.y, m.z);
        t.rock.mesh.visible = false; this.thrown.splice(i, 1);
        this.dropLoot(m.x, m.y + 0.3, m.z, 'rock');
      }
    }
  }

  updatePickups(dt) {
    const p = this.player, w = this.world;
    for (let i = w.pickups.length - 1; i >= 0; i--) {
      const k = w.pickups[i];
      k.t += dt; k.life -= dt;
      k.vy -= 18 * dt; k.x += k.vx * dt; k.y += k.vy * dt; k.z += k.vz * dt;
      const gy = w.groundAt(k.x, k.z, k.y) + 0.35;
      if (k.y < gy) { k.y = gy; k.vy = Math.abs(k.vy) > 2 ? -k.vy * 0.35 : 0; k.vx *= 0.6; k.vz *= 0.6; }
      const d = Math.hypot(p.pos.x - k.x, p.pos.z - k.z);
      if (k.t > 0.35 && d < 1.6) { k.x += (p.pos.x - k.x) * dt * 10; k.z += (p.pos.z - k.z) * dt * 10; }
      k.mesh.position.set(k.x, k.y + Math.sin(k.t * 3) * 0.08, k.z);
      k.mesh.rotation.y += dt * 3;
      k.mesh.visible = k.life > 3 || Math.floor(k.life * 8) % 2 === 0;
      if (k.t > 0.35 && d < 0.6 && Math.abs(p.pos.y + 0.5 - k.y) < 1.4) {
        if (k.kind === 'heart') { this.heal(1); this.audio.play('heart'); }
        else { const v = { green: 1, blue: 5, red: 20 }[k.kind]; this.addGems(v); this.audio.play(v > 1 ? 'bigGem' : 'gem'); }
        this.fx.sparkle(k.x, k.y, k.z, k.kind === 'heart' ? [1, 0.4, 0.5] : k.kind === 'blue' ? [0.4, 0.6, 1] : [0.5, 1, 0.5]);
        k.mesh.removeFromParent(); w.pickups.splice(i, 1);
      } else if (k.life <= 0) { k.mesh.removeFromParent(); w.pickups.splice(i, 1); }
    }
  }

  // ------------------------------------------------------- lock & interact
  updateLock() {
    const p = this.player, w = this.world, inp = this.input;
    const fx = -Math.sin(this.cam.yaw), fz = -Math.cos(this.cam.yaw);
    let best = null, bestScore = Infinity;
    const consider = (t, maxD) => {
      const dx = t.x - p.pos.x, dz = t.z - p.pos.z, d = Math.hypot(dx, dz);
      if (d > maxD || d < 0.01) return;
      const dot = (dx * fx + dz * fz) / d;
      if (dot < -0.2 && d > 3) return;
      const s = d * (1.6 - dot);
      if (s < bestScore) { bestScore = s; best = t; }
    };
    for (const e of w.enemies) if (e.alive && e.targetable) consider(e, 14);
    if (!best) for (const n of w.npcs) consider(n, 6);
    this.lock.candidate = best;
    const L = this.lock;
    if (L.target) {
      const t = L.target;
      const gone = (t.alive === false) || !t.targetable || Math.hypot(t.x - p.pos.x, t.z - p.pos.z) > 18;
      if (gone) { L.target = null; }
    }
    if (inp.hit('lock')) {
      if (L.target) { L.target = null; this.audio.play('unlock'); }
      else if (best) {
        L.target = best; this.audio.play('lock');
        if (best.kind && ENEMY_INFO[best.kind] && !this.save.flags['info_' + best.kind]) {
          this.save.flags['info_' + best.kind] = true;
          this.audio.play('glim');
          const [a, b] = ENEMY_INFO[best.kind];
          this.dialog.start([{ who: 'Glim', text: a }, { who: 'Glim', text: b }]);
        }
      }
    }
  }

  findContext() {
    const p = this.player, w = this.world, f = p.facing;
    if (p.carry) return { key: 'E', label: 'Throw', act: () => p.throwRock() };
    if (p.state !== 'move' || !p.grounded) return null;
    const front = (x, z, maxD) => {
      const dx = x - p.pos.x, dz = z - p.pos.z, d = Math.hypot(dx, dz);
      return d < maxD && (dx * f.x + dz * f.z) / (d || 1) > 0.35;
    };
    let npc = null, nd = Infinity;
    for (const n of w.npcs) {
      const d = Math.hypot(n.x - p.pos.x, n.z - p.pos.z);
      if (d < n.talkRange && (front(n.x, n.z, n.talkRange) || this.lock.target === n) && d < nd) { npc = n; nd = d; }
    }
    if (npc) return { key: 'E', label: 'Talk', act: () => this.talkTo(npc) };
    for (const c of w.chests) if (!c.opened && front(c.x, c.z, 1.7) && Math.abs(c.mesh.position.y - p.pos.y) < 0.6) return { key: 'E', label: 'Open', act: () => this.openChest(c) };
    for (const r of w.rocks) if (r.alive && front(r.x, r.z, 1.25)) return { key: 'E', label: 'Lift', act: () => p.lift(r) };
    for (const s of w.signs) if (front(s.x, s.z, 1.8)) return { key: 'E', label: 'Read', act: () => this.dialog.start([{ who: '', text: s.text }]) };
    if (this.lock.target && this.lock.target.kind !== 'npc' && p.grounded) return { key: 'Space', label: 'Dodge', act: null };
    return null;
  }
  talkTo(npc) {
    this.lock.target = null;
    const steps = npc.talk(this);
    this.dialog.start(steps, { npc });
  }
  openChest(c) {
    c.opened = true; this.save.flags['chest_' + c.id] = true;
    this.player.setState('idle');
    this.audio.play('chest');
    const lid = c.mesh.userData.lid;
    const t0 = performance.now();
    const anim = () => { const k = Math.min(1, (performance.now() - t0) / 600); lid.rotation.x = -1.9 * k; if (k < 1) requestAnimationFrame(anim); };
    anim();
    this.fx.sparkle(c.x, c.mesh.position.y + 0.8, c.z, [1, 0.9, 0.5]);
    setTimeout(() => {
      if (c.reward.gems) {
        this.addGems(c.reward.gems);
        this.giveItem(`${c.reward.gems} gems`, 'Gems can be spent at the Leafshade shop.');
      } else if (c.reward.heart) {
        this.save.maxHearts += 1; this.save.hearts = this.save.maxHearts;
        this.audio.play('heartUp');
        this.giveItem('Heart Vessel', 'Your maximum health increased by one heart, and you are fully healed.');
      }
    }, 650);
  }

  // ----------------------------------------------------------------- loop
  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    const dt = Math.min(0.1, (now - (this.last || now)) / 1000);
    this.last = now;
    try { this.tick(dt); } catch (e) { this.fatal(e); }
  }
  fatal(e) {
    console.error(e);
    if (this.failed) return;
    this.failed = true;
    $('error').classList.remove('hidden'); $('error').textContent = 'Error: ' + e.message + '\n' + e.stack;
  }

  tick(dt) {
    if (this.input.hit('music') && this.audio.ctx) $('btnMusic').textContent = 'Music: ' + (this.audio.toggleMusic() ? 'on' : 'off');
    if (this.input.hit('pause')) { if (this.state === 'play') { this.ignoreUnlock = true; this.input.releaseLock(); this.pause(); } else if (this.state === 'pause') this.resume(); }
    if (this.hitstop > 0) { this.hitstop -= dt; dt *= 0.15; }
    this.acc += dt;
    let steps = 0;
    while (this.acc >= STEP && steps < 6) {
      this.step(STEP);
      this.acc -= STEP; steps++;
      this.input.endStep();
    }
    if (steps === 6) this.acc = 0;
    this.render(dt);
  }

  step(dt) {
    this.time += dt;
    const w = this.world;
    if (this.state === 'dialog') { this.dialog.update(dt); }
    if (this.state === 'play') {
      this.updateLock();
      if (this.state !== 'play') return;
      this.context = this.findContext();
      if (this.input.hit('interact') && this.context?.act) { this.context.act(); if (this.state !== 'play') return; }
      this.player.update(dt);
      // Portals and triggers
      const p = this.player;
      for (const t of w.triggers) if (!t.done && Math.hypot(p.pos.x - t.x, p.pos.z - t.z) < t.r) { t.fn(); if (t.once) t.done = true; }
      for (const pt of w.portals) {
        if (Math.hypot(p.pos.x - pt.x, p.pos.z - pt.z) < pt.r) {
          this.audio.play('door');
          this.goto(pt.to, pt.spawn);
          return;
        }
      }
      this.updateProjectiles(dt);
      this.updatePickups(dt);
      // Battle music while hostile enemies are close.
      const near = w.enemies.some((e) => e.alive && e.targetable && e.state !== 'idle' && e.state !== 'buried' && Math.hypot(e.x - p.pos.x, e.z - p.pos.z) < 12);
      if (near !== this.inBattle) { this.inBattle = near; this.audio.setBattle(near); }
    }
    const active = this.state === 'play' || this.state === 'title';
    if (active) for (const e of w.enemies) e.update(dt, this.time);
    if (active || this.state === 'dialog') for (const n of w.npcs) n.update(dt, this.time);
    // Nearest NPC with something to say floats a bark bubble.
    let bn = null, bd = 7;
    for (const n of w.npcs) { const d = Math.hypot(n.x - this.player.pos.x, n.z - this.player.pos.z); if (n.bark && d < bd) { bd = d; bn = n; } }
    this.barkNpc = bn;
  }

  render(dt) {
    const w = this.world, p = this.player, t = this.time;
    if (this.state === 'title') { this.cam.yaw += dt * 0.05; this.cam.place(new THREE.Vector3(p.pos.x, p.pos.y + 1.6, p.pos.z), this.cam.yaw, 0.18, 7, this); }
    else this.cam.update(dt, this);
    p.animate(dt, t);
    this.updateWisp(dt, t);
    for (const fn of w.animated) fn(t);
    if (w.def.ambient && this.state !== 'title') w.def.ambient(this.fx, p, dt);
    // Keep the shadow frustum centered on the hero.
    const sd = w.sunDir;
    w.sun.position.set(p.pos.x + sd.x * 50, p.pos.y + sd.y * 50, p.pos.z + sd.z * 50);
    w.sun.target.position.copy(p.pos);
    if (w.sky) w.sky.position.copy(this.camera.position);
    this.fx.update(dt);
    this.audio.update(dt);
    this.ui.update(dt, t);
    this.renderer.render(w.scene, this.camera);
  }

  updateWisp(dt, t) {
    const p = this.player;
    const tgt = this.lock.target || (this.lock.candidate && this.lock.candidate.kind !== 'npc' ? this.lock.candidate : null) || this.talkTarget;
    let goal;
    if (tgt) { const lp = tgt.lockPos; goal = new THREE.Vector3(lp.x, lp.y + 0.7, lp.z); }
    else goal = new THREE.Vector3(p.pos.x + Math.cos(t * 1.3) * 0.7 - Math.sin(p.yaw) * 0.2, p.pos.y + 1.9 + Math.sin(t * 2.1) * 0.2, p.pos.z + Math.sin(t * 1.3) * 0.7 - Math.cos(p.yaw) * 0.2);
    this.wispPos.x = damp(this.wispPos.x, goal.x, 4, dt);
    this.wispPos.y = damp(this.wispPos.y, goal.y, 4, dt);
    this.wispPos.z = damp(this.wispPos.z, goal.z, 4, dt);
    this.wisp.position.copy(this.wispPos);
    const u = this.wisp.userData;
    u.wings.forEach((wg, i) => { wg.rotation.y = Math.sin(t * 40 + i) * 0.8 * (i % 2 ? 1 : -1); });
    this.wisp.lookAt(this.camera.position);
    const hostile = tgt && tgt.kind && tgt.kind !== 'npc';
    u.halo.material.color.set(hostile ? 0xfff27a : 0xbff6ff);
    u.halo.scale.setScalar(0.8 + Math.sin(t * 6) * 0.08);
  }
}

try {
  window.game = new Game();
} catch (e) {
  console.error(e);
  const el = $('error'); el.classList.remove('hidden'); el.textContent = 'Failed to start: ' + e.message + '\n' + e.stack;
}

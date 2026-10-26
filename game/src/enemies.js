import * as THREE from 'three';
import * as M from './models.js';
import { clamp, damp, dampAngle, TAU } from './util.js';

const tmp = new THREE.Vector3();

class Enemy {
  constructor(game, x, z) {
    this.game = game; this.x = x; this.z = z; this.y = game.world ? 0 : 0;
    this.yaw = 0; this.alive = true; this.state = 'idle'; this.t = 0;
    this.flash = 0; this.targetable = true; this.solid = false; this.radius = 0.5; this.lockY = 1;
  }
  get player() { return this.game.player; }
  distToPlayer() { return Math.hypot(this.player.pos.x - this.x, this.player.pos.z - this.z); }
  yawToPlayer() { return Math.atan2(this.player.pos.x - this.x, this.player.pos.z - this.z); }
  set(s) { this.state = s; this.t = 0; }
  die() {
    this.alive = false; this.targetable = false;
    const g = this.game;
    g.audio.play('defeat');
    g.fx.defeat(this.x, this.y, this.z);
    this.set('dying');
    g.onEnemyDefeated(this);
  }
  tint(root) {
    // Flash white when hit by boosting emissive on every mesh.
    const f = this.flash;
    root.traverse((o) => {
      if (!o.isMesh) return;
      if (!o.userData.ownMat) { o.material = o.material.clone(); o.userData.ownMat = true; o.userData.baseE = o.material.emissive.clone(); }
      o.material.emissive.copy(o.userData.baseE).lerp(new THREE.Color(1, 0.9, 0.95), f);
    });
  }
}

/** Rooted snapping plant. Closed bud deflects blows; open jaws and the post-bite slump are vulnerable. */
export class Thornmaw extends Enemy {
  constructor(game, x, z, yaw = 0) {
    super(game, x, z);
    this.kind = 'thornmaw'; this.name = 'Thornmaw';
    this.m = M.makeThornmaw(); this.root = this.m.root;
    this.hp = 3; this.solid = true; this.radius = 0.55; this.lockY = 1.9;
    this.yaw = yaw; this.bend = 0; this.open = 0; this.cool = 0.8; this.stretch = 1; this.bit = false;
    this.root.position.set(x, game.world.heightFn(x, z), z);
    this.y = this.root.position.y;
  }
  get guarded() { return this.state === 'idle'; }
  update(dt, time) {
    this.t += dt; this.flash = Math.max(0, this.flash - dt * 4);
    const d = this.distToPlayer();
    let bend = 0.05 + Math.sin(time * 1.7 + this.x) * 0.06, open = 0, stretch = 1, face = this.yawToPlayer(), turn = 5;
    switch (this.state) {
      case 'idle':
        bend = 0.25 + Math.sin(time * 1.2 + this.x) * 0.05; open = 0;
        turn = 0.5;
        if (d < 7) { this.set('alert'); this.cool = 0.9; this.game.audio.play('cue'); }
        break;
      case 'alert':
        open = 0.35 + Math.sin(time * 6) * 0.1; bend = -0.1 + Math.sin(time * 3) * 0.08;
        this.cool -= dt;
        if (d > 8.5) this.set('idle');
        else if (this.cool <= 0 && d < 3.6) { this.set('windup'); this.game.audio.play('cue'); }
        break;
      case 'windup': {
        const p = clamp(this.t / 0.6, 0, 1);
        bend = -0.55 * p; open = 0.4 + p * 0.5; turn = 9;
        if (this.t > 0.6) { this.set('lunge'); this.bit = false; this.game.audio.play('bite'); }
        break;
      }
      case 'lunge': {
        const p = clamp(this.t / 0.18, 0, 1);
        bend = -0.55 + p * 2.15; stretch = 1 + p * 0.3; open = p < 0.8 ? 1 : 0.1; turn = 0;
        if (this.t > 0.06) this.tryBite();
        if (this.t > 0.22) { this.set('stuck'); this.game.fx.dust(tmp.x, this.y, tmp.z, [0.45, 0.38, 0.3], 8); this.game.cam.shake = 0.15; }
        break;
      }
      case 'stuck':
        if (this.t < 0.12) this.tryBite();
        bend = 1.6; stretch = 1.3; open = 0.25 + Math.sin(time * 14) * 0.05; turn = 0;
        if (this.t > 1.4) this.set('recover');
        break;
      case 'recover': {
        const p = clamp(this.t / 0.5, 0, 1);
        bend = 1.6 * (1 - p); stretch = 1.3 - 0.3 * p; open = 0.2;
        if (this.t > 0.5) { this.set('alert'); this.cool = 1.4; }
        break;
      }
      case 'hit':
        bend = -0.7; open = 0.9; turn = 0;
        if (this.t > 0.35) { this.set('alert'); this.cool = 1.0; }
        break;
      case 'dying': {
        const p = clamp(this.t / 0.7, 0, 1);
        this.root.scale.setScalar(Math.max(0.01, 1 - p));
        this.root.rotation.y += dt * 12;
        if (p >= 1) this.root.visible = false;
        return;
      }
    }
    this.yaw = dampAngle(this.yaw, face, turn, dt);
    this.bend = damp(this.bend, bend, this.state === 'lunge' ? 40 : 12, dt);
    this.open = damp(this.open, open, 16, dt);
    this.stretch = damp(this.stretch, stretch, 30, dt);
    this.root.rotation.y = this.yaw;
    for (const s of this.m.segs) { s.rotation.x = this.bend / 4; s.scale.y = this.stretch; }
    this.m.head.rotation.x = -this.bend * 0.55;
    this.m.upper.rotation.x = -this.open * 0.9;
    this.m.lower.rotation.x = this.open * 0.5;
    this.tint(this.root);
  }
  tryBite() {
    if (this.bit) return;
    this.m.head.getWorldPosition(tmp);
    const pp = this.player.pos;
    if (Math.hypot(tmp.x - pp.x, tmp.z - pp.z) < 1.1 && tmp.y < pp.y + 2.1) {
      this.bit = true;
      const r = this.game.damagePlayer(0.5, this.x, this.z, true);
      if (r === 'blocked') { this.set('stuck'); this.t = -0.4; this.game.fx.clink(tmp.x, tmp.y, tmp.z); }
    }
  }
  hurt(dmg, src) {
    if (!this.alive) return 'none';
    if (this.guarded && src !== 'spin' && src !== 'rock') return 'deflect';
    this.hp -= dmg; this.flash = 1;
    if (this.hp <= 0) { this.die(); return 'hit'; }
    this.set('hit');
    return 'hit';
  }
  get lockPos() { this.m.head.getWorldPosition(tmp); return { x: this.x, y: tmp.y, z: this.z }; }
}

/** Small burrowing sprout that pops out of the sand and hops at the hero in groups. */
export class Sprout extends Enemy {
  constructor(game, x, z) {
    super(game, x, z);
    this.kind = 'sprout'; this.name = 'Sandsprout';
    this.m = M.makeSprout(); this.root = this.m.root;
    this.hp = 1; this.radius = 0.45; this.lockY = 0.6; this.targetable = false;
    this.vy = 0; this.vx = 0; this.vz = 0; this.hop = Math.random(); this.contact = 0;
    this.y = game.world.heightFn(x, z);
    this.m.body.position.y = -0.55;
    this.root.position.set(x, this.y, z);
    this.set('buried');
  }
  update(dt, time) {
    this.t += dt; this.flash = Math.max(0, this.flash - dt * 4); this.contact -= dt;
    const w = this.game.world, d = this.distToPlayer();
    const ground = w.heightFn(this.x, this.z);
    switch (this.state) {
      case 'buried':
        this.m.crest.rotation.y += dt * 2;
        if (d < 9 || this.awake) { this.set('pop'); this.game.audio.play('pop'); this.game.fx.dust(this.x, ground, this.z, [0.9, 0.8, 0.55], 12); }
        break;
      case 'pop':
        this.m.body.position.y = damp(this.m.body.position.y, 0, 10, dt);
        if (this.t > 0.45) { this.set('chase'); this.targetable = true; this.m.body.position.y = 0; }
        break;
      case 'chase': {
        this.hop -= dt;
        if (this.y <= ground + 0.01 && this.hop <= 0) {
          const a = this.yawToPlayer() + (Math.random() - 0.5) * 0.6;
          const sp = 2.5 + Math.random() * 1.5;
          this.vx = Math.sin(a) * sp; this.vz = Math.cos(a) * sp; this.vy = 4.5;
          this.hop = 0.5 + Math.random() * 0.4;
        }
        if (d < 0.8 && this.contact <= 0) {
          this.contact = 1;
          const r = this.game.damagePlayer(0.5, this.x, this.z, true);
          if (r === 'blocked') { this.knock(6); }
        }
        break;
      }
      case 'knock': if (this.t > 0.5) this.set('chase'); break;
      case 'dying': {
        const p = clamp(this.t / 0.5, 0, 1);
        this.root.scale.setScalar(Math.max(0.01, 1 - p));
        if (p >= 1) this.root.visible = false;
        return;
      }
    }
    if (this.state === 'chase' || this.state === 'knock') {
      this.vy -= 18 * dt;
      this.x += this.vx * dt; this.z += this.vz * dt; this.y += this.vy * dt;
      const p = { x: this.x, z: this.z };
      w.resolve(p, this.radius, this.y);
      for (const e of w.enemies) if (e !== this && e.alive && e.kind === 'sprout') {
        const dx = p.x - e.x, dz = p.z - e.z, dd = Math.hypot(dx, dz);
        if (dd < 0.8 && dd > 1e-4) { p.x += dx / dd * (0.8 - dd) * 0.5; p.z += dz / dd * (0.8 - dd) * 0.5; }
      }
      this.x = p.x; this.z = p.z;
      const gh = w.heightFn(this.x, this.z);
      if (this.y < gh) { this.y = gh; this.vy = 0; this.vx *= 0.3; this.vz *= 0.3; }
      this.yaw = dampAngle(this.yaw, this.yawToPlayer(), 8, dt);
    } else this.y = ground;
    const squash = this.y <= ground + 0.02 ? 1 + Math.sin(time * 20) * 0.04 : 1.1;
    this.m.body.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
    this.root.position.set(this.x, this.y, this.z);
    this.root.rotation.y = this.yaw;
    this.tint(this.root);
  }
  knock(sp) {
    const a = Math.atan2(this.x - this.player.pos.x, this.z - this.player.pos.z);
    this.vx = Math.sin(a) * sp; this.vz = Math.cos(a) * sp; this.vy = 3; this.set('knock');
  }
  hurt(dmg) {
    if (!this.alive || !this.targetable) return 'none';
    this.hp -= dmg; this.flash = 1;
    if (this.hp <= 0) { this.die(); return 'hit'; }
    this.knock(7); return 'hit';
  }
  get lockPos() { return { x: this.x, y: this.y + 0.6, z: this.z }; }
}

/** Hovering bloom that spits seeds. A raised shield reflects seeds back at it. */
export class HoverBloom extends Enemy {
  constructor(game, x, z) {
    super(game, x, z);
    this.kind = 'bloom'; this.name = 'Whirlbloom';
    this.m = M.makeHoverBloom(); this.root = this.m.root;
    this.hp = 3; this.radius = 0.5; this.lockY = 1.7;
    this.hx = x; this.hz = z; this.ang = Math.random() * TAU; this.fire = 2 + Math.random();
    this.y = game.world.heightFn(x, z) + 1.7;
    this.root.position.set(x, this.y, z);
  }
  update(dt, time) {
    this.t += dt; this.flash = Math.max(0, this.flash - dt * 4);
    const w = this.game.world, d = this.distToPlayer();
    const ground = w.heightFn(this.x, this.z);
    let hover = 1.7 + Math.sin(time * 2 + this.hx) * 0.2;
    switch (this.state) {
      case 'idle': {
        this.ang += dt * 0.5;
        const tx = this.hx + Math.cos(this.ang) * 3, tz = this.hz + Math.sin(this.ang) * 3;
        this.x = damp(this.x, tx, 1.5, dt); this.z = damp(this.z, tz, 1.5, dt);
        this.yaw = dampAngle(this.yaw, Math.atan2(tx - this.x, tz - this.z), 3, dt);
        if (d < 13) this.set('hunt');
        break;
      }
      case 'hunt': {
        this.yaw = dampAngle(this.yaw, this.yawToPlayer(), 4, dt);
        // Keep a medium distance and strafe.
        const a = this.yawToPlayer();
        const want = d > 7 ? 1 : d < 4.5 ? -1 : 0;
        this.x += Math.sin(a) * want * 2 * dt + Math.cos(a) * Math.sin(time * 0.7) * 1.5 * dt;
        this.z += Math.cos(a) * want * 2 * dt - Math.sin(a) * Math.sin(time * 0.7) * 1.5 * dt;
        this.fire -= dt;
        if (this.fire <= 0) { this.set('spit'); this.fire = 2.4 + Math.random(); }
        if (d > 18) this.set('idle');
        break;
      }
      case 'spit':
        this.yaw = dampAngle(this.yaw, this.yawToPlayer(), 8, dt);
        hover += Math.sin(this.t * 30) * 0.05;
        this.m.body.scale.setScalar(1 + Math.min(this.t, 0.5) * 0.3);
        if (this.t > 0.5) {
          this.m.body.scale.setScalar(1);
          const pp = this.player.pos;
          const sx = this.x + Math.sin(this.yaw) * 0.6, sz = this.z + Math.cos(this.yaw) * 0.6;
          const dx = pp.x - sx, dy = pp.y + 0.9 - this.y, dz = pp.z - sz, l = Math.hypot(dx, dy, dz) || 1;
          this.game.spawnSeed(this, sx, this.y, sz, dx / l * 9, dy / l * 9, dz / l * 9);
          this.game.audio.play('spit');
          this.set('hunt');
        }
        break;
      case 'stunned':
        hover = 0.45; this.m.rotor.rotation.y += 0;
        if (this.t > 1.6) this.set('hunt');
        break;
      case 'dying': {
        const p = clamp(this.t / 0.6, 0, 1);
        this.root.scale.setScalar(Math.max(0.01, 1 - p));
        if (p >= 1) this.root.visible = false;
        return;
      }
    }
    if (this.state !== 'stunned') this.m.rotor.rotation.y += dt * 18;
    const p = { x: this.x, z: this.z };
    w.resolve(p, this.radius, 99);
    this.x = p.x; this.z = p.z;
    this.y = damp(this.y, ground + hover, this.state === 'stunned' ? 8 : 3, dt);
    this.root.position.set(this.x, this.y, this.z);
    this.root.rotation.y = this.yaw;
    this.m.body.rotation.z = this.state === 'stunned' ? 0.6 : Math.sin(time * 3) * 0.08;
    this.tint(this.root);
  }
  hurt(dmg) {
    if (!this.alive) return 'none';
    this.hp -= dmg; this.flash = 1;
    if (this.hp <= 0) { this.die(); return 'hit'; }
    this.set('stunned'); return 'hit';
  }
  get lockPos() { return { x: this.x, y: this.y, z: this.z }; }
}

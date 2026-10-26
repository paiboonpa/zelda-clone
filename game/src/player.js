import * as THREE from 'three';
import { makeHero } from './models.js';
import { clamp, damp, dampAngle, angleDiff, TAU } from './util.js';

const SWINGS = [
  // anticipation end, active start/end, total duration, arc (rad), range (m)
  { wind: 0.07, a0: 0.07, a1: 0.19, dur: 0.36, arc: 2.0, range: 1.75 },
  { wind: 0.06, a0: 0.06, a1: 0.18, dur: 0.36, arc: 2.0, range: 1.75 },
  { wind: 0.12, a0: 0.12, a1: 0.24, dur: 0.5, arc: 1.2, range: 2.0 },
];
export const CHARGE_TIME = 0.9;
const GRAV = 24;

export class Player {
  constructor(game) {
    this.game = game;
    this.rig = makeHero();
    this.root = this.rig.root;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.speed = 0;
    this.state = 'move'; this.stateT = 0;
    this.grounded = true; this.combo = 0; this.queued = false;
    this.charge = 0; this.invuln = 0; this.carry = null;
    this.walkPhase = 0; this.stepAcc = 0; this.hitSet = new Set();
    this.tmpA = new THREE.Vector3(); this.tmpB = new THREE.Vector3();
  }

  place(x, z, yaw) {
    this.pos.set(x, this.game.world.groundAt(x, z), z);
    this.vel.set(0, 0, 0); this.yaw = yaw; this.state = 'move'; this.carry = null; this.charge = 0;
    this.root.position.copy(this.pos);
  }

  setState(s) { this.state = s; this.stateT = 0; this.hitSet.clear(); }
  get facing() { return { x: Math.sin(this.yaw), z: Math.cos(this.yaw) }; }

  update(dt) {
    const g = this.game, inp = g.input, w = g.world;
    this.stateT += dt; this.invuln = Math.max(0, this.invuln - dt);
    const lock = g.lock.target;
    const ax = inp.axis();
    const cy = g.cam.yaw;
    let mx = -Math.sin(cy) * ax.y + Math.cos(cy) * ax.x;
    let mz = -Math.cos(cy) * ax.y - Math.sin(cy) * ax.x;
    const mag = Math.min(1, Math.hypot(mx, mz));
    if (mag > 0) { const l = Math.hypot(mx, mz); mx /= l; mz /= l; }
    const wr = w.inWater(this.pos.x, this.pos.z);
    const water = wr && this.pos.y < wr.y - 0.05;
    let maxSpeed = 0, faceTo = null, accel = this.grounded ? 16 : 5;
    const hasShield = g.save.hasShield;

    switch (this.state) {
      case 'move': {
        maxSpeed = this.carry ? 3.6 : lock ? 4.6 : 6;
        if (inp.hit('attack')) { if (this.carry) { this.throwRock(); break; } this.startSwing(0, mx, mz, mag); break; }
        if (inp.down('shield') && hasShield && !this.carry && this.grounded) { this.setState('guard'); g.audio.play('block'); break; }
        if (inp.hit('jump') && this.grounded) {
          if (lock && mag > 0.2) {
            this.setState('dodge');
            this.vel.set(mx * 9, 4.5, mz * 9); this.grounded = false;
            g.audio.play('jump');
          } else if (!this.carry) {
            this.vel.y = 7.4; this.grounded = false; g.audio.play('jump');
          }
          break;
        }
        if (lock) faceTo = Math.atan2(lock.x - this.pos.x, lock.z - this.pos.z);
        else if (mag > 0.1) faceTo = Math.atan2(mx, mz);
        break;
      }
      case 'attack': {
        const s = SWINGS[this.combo];
        if (this.stateT < 0.1 && this.grounded) { const f = this.facing; this.vel.x = f.x * 3; this.vel.z = f.z * 3; }
        if (lock) faceTo = Math.atan2(lock.x - this.pos.x, lock.z - this.pos.z);
        if (inp.hit('attack') && this.stateT > 0.1) this.queued = true;
        if (this.stateT >= s.a0 && this.stateT <= s.a1) {
          g.swordHit(this, s.range, s.arc, this.combo === 2 ? 2 : 1);
          this.pushTrail([0.85, 0.95, 1]);
        }
        if (this.stateT >= s.dur) {
          if (this.queued && this.combo < 2) this.startSwing(this.combo + 1, mx, mz, mag);
          else if (inp.down('attack')) { this.setState('charge'); this.charge = 0; g.audio.play('charge'); }
          else this.setState('move');
        }
        break;
      }
      case 'charge': {
        maxSpeed = 2.2;
        if (lock) faceTo = Math.atan2(lock.x - this.pos.x, lock.z - this.pos.z);
        const was = this.charge;
        this.charge += dt;
        if (was < CHARGE_TIME && this.charge >= CHARGE_TIME) { g.audio.play('ready'); g.fx.sparkle(...this.swordTip().toArray(), [0.6, 0.85, 1]); }
        if (Math.random() < 0.6) g.fx.charge(...this.swordTip().toArray(), this.charge >= CHARGE_TIME);
        if (!inp.down('attack')) {
          if (this.charge >= CHARGE_TIME) this.startSpin();
          else this.setState('move');
        } else if (inp.hit('shield') && hasShield) this.setState('guard');
        break;
      }
      case 'spin': {
        if (this.stateT > 0.04 && this.stateT < 0.42) { g.spinHit(this, 2.9, 2); this.pushTrail([0.55, 0.8, 1]); }
        if (this.stateT >= 0.6) this.setState('move');
        break;
      }
      case 'guard': {
        maxSpeed = lock ? 1.6 : 0;
        if (lock) faceTo = Math.atan2(lock.x - this.pos.x, lock.z - this.pos.z);
        if (!inp.down('shield')) this.setState('move');
        else if (inp.hit('attack')) this.startSwing(0, mx, mz, mag);
        break;
      }
      case 'dodge': if (this.grounded && this.stateT > 0.15) this.setState('move'); accel = 0; break;
      case 'lift':
        if (this.stateT > 0.45) this.setState('move');
        break;
      case 'throw':
        if (this.stateT > 0.35) this.setState('move');
        break;
      case 'hurt': accel = 3; if (this.stateT > 0.4) this.setState('move'); break;
      case 'get': case 'dead': case 'idle': break;
    }

    // Horizontal velocity
    if (water) maxSpeed *= 0.6;
    const tvx = mx * mag * maxSpeed, tvz = mz * mag * maxSpeed;
    if (this.state !== 'dodge' && this.state !== 'hurt') {
      const k = 1 - Math.exp(-accel * dt);
      this.vel.x += (tvx - this.vel.x) * k; this.vel.z += (tvz - this.vel.z) * k;
    } else if (this.state === 'hurt') { this.vel.x *= 1 - 4 * dt; this.vel.z *= 1 - 4 * dt; }
    if (faceTo != null) this.yaw = dampAngle(this.yaw, faceTo, 14, dt);

    // Integrate and collide
    const prevY = this.pos.y;
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    w.resolve(this.pos, 0.35, this.pos.y);
    for (const n of w.npcs) this.pushFrom(n.x, n.z, 0.4);
    for (const e of w.enemies) if (e.alive && e.solid) this.pushFrom(e.x, e.z, e.radius);
    this.vel.y -= GRAV * dt;
    this.pos.y += this.vel.y * dt;
    const ground = w.groundAt(this.pos.x, this.pos.z, prevY);
    if (this.pos.y <= ground || (this.grounded && this.vel.y <= 0 && this.pos.y - ground < 0.4)) {
      if (!this.grounded && this.vel.y < -5) { g.audio.play('land'); g.fx.dust(this.pos.x, ground, this.pos.z); }
      this.pos.y = ground; this.vel.y = 0; this.grounded = true;
    } else this.grounded = false;

    this.speed = Math.hypot(this.vel.x, this.vel.z);
    // Footsteps
    if (this.grounded && this.speed > 0.8) {
      this.stepAcc += this.speed * dt;
      if (this.stepAcc > 1.05) {
        this.stepAcc = 0;
        const surf = w.surfaceAt(this.pos.x, this.pos.z, this.pos.y);
        g.audio.play('step', { surface: surf });
        if (surf === 'water') g.fx.splash(this.pos.x, this.pos.y + 0.1, this.pos.z);
        else if (surf === 'sand' || surf === 'dirt') g.fx.dust(this.pos.x, this.pos.y, this.pos.z, surf === 'sand' ? [0.85, 0.75, 0.55] : [0.6, 0.5, 0.4], 3);
      }
    }
    if (this.carry) this.carry.mesh.position.set(this.pos.x, this.pos.y + 1.55, this.pos.z);
  }

  pushFrom(x, z, r) {
    const dx = this.pos.x - x, dz = this.pos.z - z, d = Math.hypot(dx, dz), m = r + 0.35;
    if (d < m && d > 1e-5) { this.pos.x = x + dx / d * m; this.pos.z = z + dz / d * m; }
  }

  startSwing(i, mx, mz, mag) {
    if (mag > 0.2 && !this.game.lock.target) this.yaw = Math.atan2(mx, mz);
    this.setState('attack'); this.combo = i; this.queued = false;
    this.game.audio.play(i === 1 ? 'swing2' : 'swing');
  }
  startSpin() {
    this.setState('spin');
    this.game.audio.play('spin');
    this.game.fx.spin(this.pos.x, this.pos.y, this.pos.z);
    this.charge = 0;
  }
  swordTip() { return this.rig.sword.localToWorld(this.tmpA.copy(this.rig.sword.userData.tip)); }
  pushTrail(color) {
    const s = this.rig.sword;
    this.root.updateMatrixWorld(true);
    this.game.fx.trail.push(s.localToWorld(this.tmpB.copy(s.userData.base)), s.localToWorld(this.tmpA.copy(s.userData.tip)), color);
  }
  lift(rock) {
    this.carry = rock; rock.alive = false;
    this.setState('lift'); this.game.audio.play('lift');
  }
  throwRock() {
    const r = this.carry; this.carry = null;
    const f = this.facing;
    this.game.throwRock(r, this.pos.x + f.x * 0.6, this.pos.y + 1.5, this.pos.z + f.z * 0.6, f.x * 9, 4, f.z * 9);
    this.setState('throw'); this.game.audio.play('throw');
  }

  // ------------------------------------------------------------- animation
  animate(dt, time) {
    const R = this.rig;
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
    const run = clamp(this.speed / 6, 0, 1);
    // Slow strafing (charging, guarding) uses a quicker, shorter stride so the legs still read as walking.
    const slowGait = this.state === 'charge' || this.state === 'guard';
    if (this.grounded) this.walkPhase += this.speed * dt * (slowGait ? 3.6 : 2.3);
    const strafe = slowGait ? clamp(this.speed / 1.6, 0, 1) : 0;
    const stride = Math.sin(this.walkPhase) * strafe;
    const sw = Math.sin(this.walkPhase) * run;
    const breathe = Math.sin(time * 2.2) * 0.02;
    let legL = sw * 0.9, legR = -sw * 0.9;
    let armL = { x: sw * 0.7 - 0.1, y: 0, z: -0.12 };
    let armR = { x: -sw * 0.5 - 0.25, y: 0, z: 0.12 };
    let swordX = 1.25, shieldFace = 0, torsoX = run * 0.12 + breathe, torsoY = 0, bodyY = Math.abs(Math.cos(this.walkPhase)) * 0.06 * run, spin = 0;
    const t = this.stateT;
    const ease = (v) => 1 - Math.pow(1 - clamp(v, 0, 1), 3);
    switch (this.state) {
      case 'attack': {
        const s = SWINGS[this.combo];
        const p = t < s.wind ? -t / s.wind * 0.15 : ease((t - s.a0) / (s.a1 - s.a0));
        const rec = clamp((t - s.a1) / (s.dur - s.a1), 0, 1);
        if (this.combo === 0) { armR = { x: -1.45, y: -1.8 + p * 3.3, z: 0 }; swordX = Math.PI; torsoY = 0.5 - p * 1.0; }
        else if (this.combo === 1) { armR = { x: -1.3, y: 1.4 - p * 3.2, z: 0.3 }; swordX = Math.PI; torsoY = -0.5 + p * 1.0; }
        else { armR = { x: -2.9 + p * 2.1, y: -0.15, z: 0 }; swordX = Math.PI - 0.1; torsoX = -0.15 + p * 0.45; }
        armL = { x: -0.5, y: 0, z: -0.4 };
        if (rec > 0) { armR.x = armR.x + (-0.4 - armR.x) * rec * 0.6; }
        legL = 0.35; legR = -0.3;
        break;
      }
      case 'charge': armR = { x: -1.1, y: -1.7, z: 0 }; swordX = Math.PI; torsoY = 0.6; legL = 0.3 * (1 - strafe) + stride * 0.75; legR = -0.3 * (1 - strafe) - stride * 0.75; bodyY = Math.abs(Math.cos(this.walkPhase)) * 0.04 * strafe; armL = { x: -0.8, y: 0.3, z: -0.3 }; break;
      case 'spin': {
        spin = ease(t / 0.5) * TAU;
        armR = { x: -1.5, y: -1.5, z: 0 }; swordX = Math.PI; armL = { x: -0.4, y: 0, z: -1.2 }; torsoX = 0.25; legL = 0.6; legR = -0.6;
        break;
      }
      case 'guard': armL = { x: -1.35, y: -0.55, z: 0 }; shieldFace = 1; torsoX = 0.2; armR = { x: -0.3, y: 0, z: 0.4 }; legL = 0.25 * (1 - strafe) + stride * 0.6; legR = -0.25 * (1 - strafe) - stride * 0.6; bodyY -= 0.06; break;
      case 'lift': { const p = ease(t / 0.4); armL = armR = { x: -0.9 - p * 2.1, y: 0, z: 0 }; torsoX = 0.4 - p * 0.4; bodyY -= (1 - p) * 0.15; break; }
      case 'throw': { const p = ease(t / 0.2); armL = armR = { x: -3 + p * 1.6, y: 0, z: 0 }; torsoX = p * 0.3; break; }
      case 'hurt': torsoX = -0.4; armL = { x: 0.5, y: 0, z: -0.6 }; armR = { x: 0.5, y: 0, z: 0.6 }; break;
      case 'get': armR = { x: -3.0, y: 0, z: 0.1 }; armL = { x: -3.0, y: 0, z: -0.1 }; swordX = 0.5; break;
      case 'dodge': legL = 1; legR = 0.8; torsoX = 0.5; break;
      case 'dead': torsoX = 1.3; bodyY = -0.35; legL = legR = 1.2; break;
    }
    if (this.carry && this.state !== 'lift') { armL = { x: -2.95, y: 0, z: -0.15 }; armR = { x: -2.95, y: 0, z: 0.15 }; }
    if (!this.grounded && this.state === 'move') { legL = 0.7; legR = -0.2; armL.x = -0.8; armR.x = -0.6; }
    const k = this.state === 'attack' || this.state === 'spin' ? 1 : 1 - Math.exp(-18 * dt);
    R.legL.rotation.x = damp(R.legL.rotation.x, legL, 18, dt);
    R.legR.rotation.x = damp(R.legR.rotation.x, legR, 18, dt);
    for (const [arm, tgt] of [[R.armL, armL], [R.armR, armR]]) {
      arm.rotation.x += (tgt.x - arm.rotation.x) * k;
      arm.rotation.y += (tgt.y - arm.rotation.y) * k;
      arm.rotation.z += (tgt.z - arm.rotation.z) * k;
    }
    R.sword.rotation.x += (swordX - R.sword.rotation.x) * k;
    R.torso.rotation.x = damp(R.torso.rotation.x, torsoX, 14, dt);
    R.torso.rotation.y = this.state === 'attack' ? torsoY : damp(R.torso.rotation.y, torsoY, 14, dt);
    R.body.position.y = damp(R.body.position.y, bodyY, 20, dt);
    R.body.rotation.y = spin;
    // Shield faces sideways at rest and forward when guarding.
    R.shield.visible = this.game.save.hasShield;
    R.shield.rotation.z = damp(R.shield.rotation.z, shieldFace ? 0 : Math.PI / 2, 20, dt);
    R.shield.position.y = shieldFace ? -0.38 : -0.25;
    const cap = R.head.userData.capTip;
    if (cap) cap.rotation.x = -0.8 - run * 0.5 + Math.sin(time * 9) * 0.06 * run;
    // Charge glow on the blade.
    const glow = this.state === 'charge' ? (this.charge >= CHARGE_TIME ? 0.8 + Math.sin(time * 30) * 0.2 : this.charge / CHARGE_TIME * 0.5) : this.state === 'spin' ? 0.8 : 0;
    R.glow.material.opacity = damp(R.glow.material.opacity, glow, 20, dt);
    this.root.visible = this.invuln <= 0 || Math.floor(time * 20) % 2 === 0 || this.state === 'dead';
  }
}

import { makeHumanoid } from './models.js';
import { damp, dampAngle, clamp } from './util.js';

/** Villager with idle/wander animation, a proximity bark and a talk script. */
export class NPC {
  constructor(game, o) {
    this.game = game;
    this.name = o.name; this.x = o.x; this.z = o.z; this.yaw = o.yaw ?? 0;
    this.home = { x: o.x, z: o.z, yaw: this.yaw };
    this.wander = o.wander || 0; this.bark = o.bark || null; this.talk = o.talk;
    this.talkRange = o.talkRange || 2.2; this.kind = 'npc'; this.targetable = true; this.lockY = 1.5 * (o.look?.scale || 1);
    this.rig = makeHumanoid(o.look || {});
    this.root = this.rig.root;
    this.goal = null; this.wait = Math.random() * 3; this.phase = Math.random() * 6; this.speed = 0;
    this.y = game.world.heightFn(this.x, this.z);
    this.root.position.set(this.x, this.y, this.z);
    this.gesture = 0;
  }
  moveTo(x, z) { this.goal = { x, z, forced: true }; }
  update(dt, time) {
    const g = this.game, p = g.player;
    const dx = p.pos.x - this.x, dz = p.pos.z - this.z, d = Math.hypot(dx, dz);
    let faceTo = null, speed = 0;
    if (g.talkTarget === this) { faceTo = Math.atan2(dx, dz); this.gesture = Math.min(1, this.gesture + dt * 3); }
    else {
      this.gesture = Math.max(0, this.gesture - dt * 3);
      if (this.goal) {
        const gx = this.goal.x - this.x, gz = this.goal.z - this.z, gd = Math.hypot(gx, gz);
        if (gd < 0.2) { if (this.goal.forced) { this.home = { x: this.x, z: this.z, yaw: this.yaw }; } this.goal = null; this.wait = 2 + Math.random() * 4; }
        else { speed = this.goal.forced ? 2.4 : 1.3; faceTo = Math.atan2(gx, gz); this.x += gx / gd * speed * dt; this.z += gz / gd * speed * dt; }
      } else if (d < 4) faceTo = Math.atan2(dx, dz);
      else if (this.wander) {
        this.wait -= dt;
        if (this.wait <= 0) {
          const a = Math.random() * Math.PI * 2, r = Math.random() * this.wander;
          this.goal = { x: this.home.x + Math.cos(a) * r, z: this.home.z + Math.sin(a) * r };
        }
      } else faceTo = this.home.yaw;
    }
    if (faceTo != null) this.yaw = dampAngle(this.yaw, faceTo, 5, dt);
    const pos = { x: this.x, z: this.z };
    g.world.resolve(pos, 0.4, this.y);
    this.x = pos.x; this.z = pos.z;
    this.y = g.world.groundAt(this.x, this.z, this.y + 0.3);
    this.speed = damp(this.speed, speed, 10, dt);
    // Animation
    const R = this.rig;
    this.phase += this.speed * dt * 3.2;
    const sw = Math.sin(this.phase) * clamp(this.speed / 2, 0, 1);
    R.legL.rotation.x = sw * 0.8; R.legR.rotation.x = -sw * 0.8;
    R.armL.rotation.x = -sw * 0.6 - this.gesture * Math.abs(Math.sin(time * 4)) * 0.9;
    R.armR.rotation.x = sw * 0.6 - this.gesture * Math.abs(Math.sin(time * 4 + 1.3)) * 0.6;
    R.armL.rotation.z = -0.1; R.armR.rotation.z = 0.1;
    R.torso.rotation.x = Math.sin(time * 2 + this.phase) * 0.02;
    R.head.rotation.y = d < 5 && g.talkTarget !== this ? clamp(dampAngle(0, Math.atan2(dx, dz) - this.yaw, 1, 1), -0.8, 0.8) : 0;
    this.root.position.set(this.x, this.y, this.z);
    this.root.rotation.y = this.yaw;
  }
  get lockPos() { return { x: this.x, y: this.y + this.lockY, z: this.z }; }
}

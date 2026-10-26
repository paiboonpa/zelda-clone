import * as THREE from 'three';
import { clamp, damp, dampAngle, angleDiff } from './util.js';

/** Third-person orbit camera with lock-on framing, conversation framing and obstruction handling. */
export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0; this.pitch = 0.32; this.dist = 6.2;
    this.focus = new THREE.Vector3();
    this.pos = new THREE.Vector3();
    this.idle = 0;
    this.ray = new THREE.Raycaster();
    this.ray.camera = camera;
    this.shake = 0;
  }

  snap(player) {
    this.yaw = player.yaw + Math.PI; this.pitch = 0.32;
    this.focus.set(player.pos.x, player.pos.y + 1.3, player.pos.z);
    this.update(0, null, 1);
  }

  update(dt, game, snapT = 0) {
    if (!game) { this.place(this.focus, this.yaw, this.pitch, this.dist, null); return; }
    const p = game.player, inp = game.input, lock = game.lock.target, talk = game.talkTarget;
    const m = inp.takeMouse();
    let manual = false;
    if (game.state === 'play') {
      if (m.x || m.y) { this.yaw -= m.x * 0.0026; this.pitch = clamp(this.pitch + m.y * 0.002, -0.25, 1.15); manual = true; }
      const kx = (inp.down('camRight') ? 1 : 0) - (inp.down('camLeft') ? 1 : 0);
      const ky = (inp.down('camDown') ? 1 : 0) - (inp.down('camUp') ? 1 : 0);
      if (kx || ky) { this.yaw -= kx * 2.2 * dt; this.pitch = clamp(this.pitch - ky * 1.2 * dt, -0.25, 1.15); manual = true; }
    }
    this.idle = manual ? 0 : this.idle + dt;

    const pp = new THREE.Vector3(p.pos.x, p.pos.y + 1.25, p.pos.z);
    let dist = this.dist, focusT = pp;
    if (talk) {
      // Over-the-shoulder conversation shot framing both speakers.
      const tx = talk.x - p.pos.x, tz = talk.z - p.pos.z;
      const a = Math.atan2(tx, tz);
      this.yaw = dampAngle(this.yaw, a + Math.PI - 0.55, 4, dt);
      this.pitch = damp(this.pitch, 0.12, 4, dt);
      focusT = new THREE.Vector3(p.pos.x + tx * 0.55, p.pos.y + 1.15, p.pos.z + tz * 0.55);
      dist = 3.4 + Math.hypot(tx, tz) * 0.4;
    } else if (lock) {
      const tx = lock.x - p.pos.x, tz = lock.z - p.pos.z;
      const d = Math.hypot(tx, tz);
      const a = Math.atan2(-tx, -tz);
      this.yaw = dampAngle(this.yaw, a, 7, dt);
      this.pitch = damp(this.pitch, 0.3, 4, dt);
      focusT = new THREE.Vector3(p.pos.x + tx * 0.35, p.pos.y + 1.1 + (lock.lockY - 1) * 0.3, p.pos.z + tz * 0.35);
      dist = clamp(5 + d * 0.35, 5, 8.5);
    } else if (this.idle > 1.2 && p.speed > 2 && game.state === 'play') {
      // Drift behind the hero while traveling, like a follow cam.
      const behind = p.yaw + Math.PI;
      if (Math.abs(angleDiff(this.yaw, behind)) < 2.6) this.yaw = dampAngle(this.yaw, behind, 0.9, dt);
      this.pitch = damp(this.pitch, 0.3, 0.8, dt);
    }
    const k = snapT || 1 - Math.exp(-10 * dt);
    this.focus.lerp(focusT, k);
    this.curDist = this.curDist == null || snapT ? dist : damp(this.curDist, dist, 5, dt);
    this.place(this.focus, this.yaw, this.pitch, this.curDist, game);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const s = this.shake * 0.25;
      this.camera.position.x += (Math.random() - 0.5) * s; this.camera.position.y += (Math.random() - 0.5) * s;
    }
  }

  place(focus, yaw, pitch, dist, game) {
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    let d = dist;
    if (game && game.world.occluders.length) {
      this.ray.set(focus, dir); this.ray.far = dist;
      const hit = this.ray.intersectObjects(game.world.occluders, true)[0];
      if (hit) d = Math.max(0.8, hit.distance - 0.3);
    }
    const pos = focus.clone().addScaledVector(dir, d);
    if (game) {
      const w = game.world;
      const g = w.groundAt(pos.x, pos.z) + 0.35;
      if (pos.y < g) pos.y = g;
      if (w.def.ceiling && pos.y > w.def.ceiling) pos.y = w.def.ceiling;
      const B = w.bounds;
      if (B.type === 'circle' && w.def.interior) {
        const dx = pos.x - B.x, dz = pos.z - B.z, r = Math.hypot(dx, dz), max = B.r - 0.4;
        if (r > max) { pos.x = B.x + dx / r * max; pos.z = B.z + dz / r * max; }
      }
    }
    this.camera.position.copy(pos);
    this.camera.lookAt(focus);
  }
}

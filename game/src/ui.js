import * as THREE from 'three';

const $ = (id) => document.getElementById(id);
const HEART = (fill, id = Math.round(fill * 100)) => `<svg viewBox="0 0 26 24"><defs><clipPath id="c${id}"><rect x="0" y="0" width="${26 * fill}" height="24"/></clipPath></defs>
  <path d="M13 22 C4 15 1 11 1 7 C1 3.5 4 1 7.2 1 C9.6 1 11.8 2.4 13 4.6 C14.2 2.4 16.4 1 18.8 1 C22 1 25 3.5 25 7 C25 11 22 15 13 22Z" fill="#3a1418" stroke="#f3efe2" stroke-width="1.6"/>
  <path clip-path="url(#c${id})" d="M13 22 C4 15 1 11 1 7 C1 3.5 4 1 7.2 1 C9.6 1 11.8 2.4 13 4.6 C14.2 2.4 16.4 1 18.8 1 C22 1 25 3.5 25 7 C25 11 22 15 13 22Z" fill="#e8344a"/></svg>`;

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export class UI {
  constructor(game) {
    this.game = game;
    this.hud = $('hud');
    this.map = $('mapCanvas').getContext('2d');
    this.tris = [];
    for (let i = 0; i < 3; i++) { const d = document.createElement('div'); d.className = 'tri'; $('markers').append(d); this.tris.push(d); }
    this.bubble = document.createElement('div'); this.bubble.className = 'bubble'; $('bubbles').append(this.bubble);
    this.lastHearts = ''; this.v = new THREE.Vector3();
    this.toastT = 0; this.bannerT = 0; this.mapT = 0;
  }
  show(on) { this.hud.classList.toggle('hidden', !on); }

  update(dt, time) {
    const g = this.game, s = g.save;
    const key = s.hearts + '/' + s.maxHearts;
    if (key !== this.lastHearts) {
      this.lastHearts = key;
      let h = '';
      for (let i = 0; i < s.maxHearts; i++) h += HEART(Math.max(0, Math.min(1, s.hearts - i)));
      $('hearts').innerHTML = h;
      $('hearts').classList.toggle('low', s.hearts <= 1);
    }
    $('gemCount').textContent = s.gems;
    $('slotShield').classList.toggle('off', !s.hasShield);
    const low = s.hearts <= 1 && g.state === 'play';
    $('hearts').style.opacity = low ? (0.6 + Math.sin(time * 8) * 0.4).toFixed(2) : 1;

    // Context prompt
    const pr = $('prompt');
    const c = g.context;
    if (c && g.state === 'play') { pr.innerHTML = `<kbd>${c.key}</kbd>${c.label}`; pr.classList.add('on'); } else pr.classList.remove('on');

    this.updateMarkers(time);
    this.toastT -= dt; if (this.toastT <= 0) $('toast').classList.remove('on');
    this.bannerT -= dt; if (this.bannerT <= 0) $('banner').classList.remove('on');
    this.mapT -= dt; if (this.mapT <= 0) { this.mapT = 0.1; this.drawMap(); }
  }

  project(x, y, z) {
    const v = this.v.set(x, y, z).project(this.game.camera);
    return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, on: v.z < 1 && v.z > -1 };
  }

  updateMarkers(time) {
    const g = this.game, t = g.lock.target || g.lock.candidate;
    const showT = t && g.state === 'play';
    for (let i = 0; i < 3; i++) {
      const el = this.tris[i];
      if (!showT) { el.style.display = 'none'; continue; }
      const lp = t.lockPos;
      const s = this.project(lp.x, lp.y, lp.z);
      if (!s.on) { el.style.display = 'none'; continue; }
      const locked = !!g.lock.target;
      const a = time * (locked ? 2.4 : 1.2) + i * Math.PI * 2 / 3;
      const r = locked ? 46 + Math.sin(time * 8) * 4 : 34;
      el.style.display = 'block';
      el.classList.toggle('soft', !locked);
      const x = s.x + Math.sin(a) * r, y = s.y - Math.cos(a) * r;
      el.style.transform = `translate(${x - 9}px, ${y - 8}px) rotate(${a + Math.PI}rad)`;
      if (!locked && i > 0) el.style.display = 'none';
      if (!locked && i === 0) el.style.transform = `translate(${s.x - 9}px, ${s.y - 70 + Math.sin(time * 5) * 5}px)`;
    }
    // Floating bark above the nearest chatty NPC.
    const b = g.barkNpc;
    if (b && g.state === 'play') {
      const s = this.project(b.x, b.y + b.lockY + 0.65, b.z);
      if (s.on) { this.bubble.style.display = 'block'; this.bubble.textContent = b.bark; this.bubble.style.left = s.x + 'px'; this.bubble.style.top = s.y + 'px'; }
      else this.bubble.style.display = 'none';
    } else this.bubble.style.display = 'none';
  }

  drawMap() {
    const g = this.game, w = g.world, ctx = this.map;
    if (!w) return;
    const W = 180, B = w.bounds;
    const span = B.type === 'circle' ? B.r * 2 : Math.max(B.x1 - B.x0, B.z1 - B.z0);
    const cx = B.type === 'circle' ? B.x : (B.x0 + B.x1) / 2, cz = B.type === 'circle' ? B.z : (B.z0 + B.z1) / 2;
    const sc = (W - 20) / span;
    const X = (x) => W / 2 + (x - cx) * sc, Y = (z) => W / 2 + (z - cz) * sc;
    ctx.clearRect(0, 0, W, W);
    ctx.fillStyle = 'rgba(10,14,10,0.55)';
    ctx.strokeStyle = 'rgba(233,200,105,0.85)'; ctx.lineWidth = 2;
    ctx.beginPath();
    if (B.type === 'circle') ctx.arc(X(B.x), Y(B.z), B.r * sc, 0, Math.PI * 2);
    else ctx.rect(X(B.x0), Y(B.z0), (B.x1 - B.x0) * sc, (B.z1 - B.z0) * sc);
    ctx.fill(); ctx.stroke();
    if (w.def.mapPaths) {
      ctx.strokeStyle = 'rgba(210,180,120,0.55)'; ctx.lineWidth = 3;
      for (const p of w.def.mapPaths) { ctx.beginPath(); p.forEach(([x, z], i) => (i ? ctx.lineTo(X(x), Y(z)) : ctx.moveTo(X(x), Y(z)))); ctx.stroke(); }
    }
    ctx.fillStyle = 'rgba(80,140,200,0.7)';
    for (const r of w.water) ctx.fillRect(X(r.x - r.hw), Y(r.z - r.hd), r.hw * 2 * sc, r.hd * 2 * sc);
    ctx.fillStyle = 'rgba(120,110,90,0.6)';
    for (const b of w.boxes) if (b.hw * sc > 1.5) { ctx.save(); ctx.translate(X(b.x), Y(b.z)); ctx.rotate(-Math.atan2(b.s, b.c)); ctx.fillRect(-b.hw * sc, -b.hd * sc, b.hw * 2 * sc, b.hd * 2 * sc); ctx.restore(); }
    for (const m of w.mapMarks) {
      ctx.fillStyle = m.color; ctx.beginPath(); ctx.arc(X(m.x), Y(m.z), m.portal ? 4 : 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#7fd1ff';
    for (const n of w.npcs) { ctx.beginPath(); ctx.arc(X(n.x), Y(n.z), 2.2, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#ff5a7a';
    for (const e of w.enemies) if (e.alive && e.targetable) { ctx.beginPath(); ctx.arc(X(e.x), Y(e.z), 2.5, 0, Math.PI * 2); ctx.fill(); }
    // Player arrow
    const p = g.player;
    ctx.save(); ctx.translate(X(p.pos.x), Y(p.pos.z)); ctx.rotate(-p.yaw + Math.PI);
    ctx.fillStyle = '#ffe27a'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(0, 2); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    // Camera view cone
    const cy = g.cam.yaw;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath();
    ctx.moveTo(X(p.pos.x), Y(p.pos.z));
    ctx.lineTo(X(p.pos.x - Math.sin(cy - 0.5) * 12), Y(p.pos.z - Math.cos(cy - 0.5) * 12));
    ctx.moveTo(X(p.pos.x), Y(p.pos.z));
    ctx.lineTo(X(p.pos.x - Math.sin(cy + 0.5) * 12), Y(p.pos.z - Math.cos(cy + 0.5) * 12));
    ctx.stroke();
  }

  toast(html, t = 3) { $('toast').innerHTML = html; $('toast').classList.add('on'); this.toastT = t; }
  banner(name, sub = '') { $('banner').innerHTML = `${esc(name)}${sub ? `<small>${esc(sub)}</small>` : ''}`; $('banner').classList.add('on'); this.bannerT = 2.6; }
  fade(on) { $('fade').classList.toggle('on', on); }
  hurtFlash() { const v = $('vignette'); v.classList.add('hurt'); setTimeout(() => v.classList.remove('hurt'), 220); }
}

/** Modal dialogue: typewriter pages, choices, and scripted actions. Owns input while open. */
export class Dialog {
  constructor(game) {
    this.game = game; this.open = false;
    this.box = $('dialog'); this.who = $('speaker'); this.text = $('dtext'); this.list = $('choices'); this.next = $('dnext');
  }
  start(steps, { npc = null, onClose = null } = {}) {
    this.steps = steps.slice(); this.i = -1; this.npc = npc; this.onClose = onClose;
    this.open = true; this.box.classList.remove('hidden');
    this.game.talkTarget = npc;
    this.game.state = 'dialog';
    this.advance();
  }
  advance() {
    for (;;) {
      this.i++;
      const s = this.steps[this.i];
      if (!s) return this.close();
      if (s.run) { const more = s.run(); if (Array.isArray(more)) this.steps.splice(this.i + 1, 0, ...more); continue; }
      this.cur = s; this.shown = 0; this.full = s.text; this.sel = 0;
      this.who.textContent = s.who || '';
      this.list.innerHTML = ''; this.list.classList.add('hidden');
      this.next.classList.add('hidden');
      this.render();
      return;
    }
  }
  render() {
    const t = esc(this.full.slice(0, Math.floor(this.shown)));
    this.text.innerHTML = t.replace(/\*([^*]+)\*/g, '<em>$1</em>').replace(/\*([^*]*)$/, '<em>$1</em>');
  }
  update(dt) {
    if (!this.open) return;
    const inp = this.game.input, s = this.cur;
    const total = this.full.length;
    if (this.shown < total) {
      const before = Math.floor(this.shown);
      this.shown = Math.min(total, this.shown + dt * 55);
      if (Math.floor(this.shown) !== before) { if (before % 3 === 0 && this.full[before] !== ' ') this.game.audio.play('blip'); this.render(); }
      if (inp.hit('confirm')) { this.shown = total; this.render(); }
      if (this.shown >= total) this.finishPage();
      return;
    }
    if (s.choices) {
      if (inp.hit('menuUp')) { this.sel = (this.sel + s.choices.length - 1) % s.choices.length; this.renderChoices(); this.game.audio.play('cursor'); }
      if (inp.hit('menuDown')) { this.sel = (this.sel + 1) % s.choices.length; this.renderChoices(); this.game.audio.play('cursor'); }
      for (let i = 0; i < s.choices.length; i++) if (inp.pressed.has('Digit' + (i + 1))) { this.sel = i; this.pick(); return; }
      if (inp.hit('confirm')) this.pick();
    } else if (inp.hit('confirm')) { this.game.audio.play('confirm'); this.advance(); }
  }
  finishPage() {
    if (this.cur.choices) { this.list.classList.remove('hidden'); this.renderChoices(); }
    else this.next.classList.remove('hidden');
  }
  renderChoices() {
    this.list.innerHTML = this.cur.choices.map((c, i) => `<li class="${i === this.sel ? 'sel' : ''}" data-i="${i}">${esc(c.label)}</li>`).join('');
    for (const li of this.list.children) li.onclick = () => { this.sel = +li.dataset.i; this.pick(); };
  }
  pick() {
    const c = this.cur.choices[this.sel];
    this.game.audio.play('confirm');
    const more = c.run ? c.run() : null;
    if (Array.isArray(more)) this.steps.splice(this.i + 1, 0, ...more);
    this.advance();
  }
  close() {
    this.open = false; this.box.classList.add('hidden');
    this.game.talkTarget = null;
    if (this.game.state === 'dialog') this.game.state = 'play';
    const cb = this.onClose; this.onClose = null;
    cb?.();
  }
}

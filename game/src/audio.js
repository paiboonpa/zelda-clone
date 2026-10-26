// Procedural Web Audio: every sound is synthesized and triggered by gameplay events.
const SONGS = {
  // [root midi notes for chords], melody (midi or 0 rest), tempo (beats/min)
  forest: { bpm: 96, chords: [[57, 64, 69], [55, 62, 67], [53, 60, 65], [55, 62, 67]], melody: [69, 0, 72, 74, 76, 0, 74, 72, 71, 0, 67, 69, 72, 0, 0, 0, 69, 0, 72, 74, 76, 79, 76, 74, 72, 0, 71, 67, 69, 0, 0, 0], wave: 'triangle' },
  shop: { bpm: 120, chords: [[60, 64, 67], [57, 60, 64], [62, 65, 69], [55, 59, 62]], melody: [72, 76, 79, 76, 74, 0, 71, 74, 72, 69, 72, 76, 74, 0, 0, 0], wave: 'square' },
  hollow: { bpm: 70, chords: [[50, 57, 62], [48, 55, 60], [46, 53, 58], [45, 52, 57]], melody: [62, 0, 0, 65, 0, 0, 64, 0, 62, 0, 0, 0, 60, 0, 61, 0], wave: 'sine' },
  field: { bpm: 108, chords: [[55, 62, 67], [60, 64, 67], [57, 60, 64], [62, 66, 69]], melody: [67, 0, 71, 74, 0, 72, 71, 69, 67, 0, 0, 62, 64, 66, 67, 0, 69, 0, 71, 72, 74, 0, 79, 78, 76, 74, 72, 71, 69, 0, 0, 0], wave: 'triangle' },
  desert: { bpm: 100, chords: [[52, 59, 64], [53, 60, 65], [52, 59, 64], [50, 57, 62]], melody: [64, 65, 68, 0, 69, 68, 65, 64, 0, 0, 64, 65, 68, 71, 69, 0], wave: 'sawtooth' },
  town: { bpm: 126, chords: [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]], melody: [72, 74, 76, 72, 77, 76, 74, 0, 74, 76, 77, 74, 79, 77, 76, 0], wave: 'square' },
  battle: { bpm: 140, chords: [[52, 55, 59], [50, 53, 57], [48, 52, 55], [47, 50, 54]], melody: [64, 0, 64, 67, 0, 64, 62, 0, 60, 0, 62, 64, 0, 59, 0, 0], wave: 'sawtooth' },
};
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class AudioSys {
  constructor() { this.ctx = null; this.musicOn = true; this.song = null; this.step = 0; this.next = 0; this.ambKind = null; this.birdT = 3; this.override = null; }

  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    const ctx = this.ctx = new C();
    this.master = ctx.createGain(); this.master.gain.value = 0.7; this.master.connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.connect(this.master);
    this.music = ctx.createGain(); this.music.gain.value = 0.12; this.music.connect(this.master);
    this.amb = ctx.createGain(); this.amb.gain.value = 0.0; this.amb.connect(this.master);
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // Looping wind/murmur bed, recolored per region.
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    this.ambFilter = ctx.createBiquadFilter(); this.ambFilter.type = 'lowpass'; this.ambFilter.frequency.value = 400;
    src.connect(this.ambFilter); this.ambFilter.connect(this.amb); src.start();
  }

  get t() { return this.ctx.currentTime; }

  tone(f0, f1, dur, { type = 'sine', gain = 0.2, delay = 0, attack = 0.005, out = this.sfx } = {}) {
    if (!this.ctx) return;
    const t = this.t + delay;
    const o = this.ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
  }

  noise(dur, { type = 'bandpass', f0 = 1000, f1 = f0, q = 1, gain = 0.3, delay = 0, attack = 0.004 } = {}) {
    if (!this.ctx) return;
    const t = this.t + delay;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfx);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  play(name, opt = {}) {
    if (!this.ctx) return;
    const r = Math.random();
    switch (name) {
      case 'swing': this.noise(0.2, { f0: 2400 + r * 600, f1: 500, q: 2, gain: 0.35 }); break;
      case 'swing2': this.noise(0.24, { f0: 1600, f1: 3200, q: 2, gain: 0.35 }); break;
      case 'hit': this.noise(0.14, { type: 'lowpass', f0: 3000, f1: 400, gain: 0.55 }); this.tone(160, 50, 0.18, { type: 'sine', gain: 0.5 }); break;
      case 'clink': this.tone(2400, 2300, 0.12, { type: 'square', gain: 0.07 }); this.tone(3500, 3400, 0.2, { type: 'sine', gain: 0.1, delay: 0.01 }); break;
      case 'block': this.tone(700, 600, 0.12, { type: 'triangle', gain: 0.3 }); this.noise(0.1, { type: 'highpass', f0: 2500, gain: 0.25 }); break;
      case 'charge': this.tone(220, 880, 0.9, { type: 'sawtooth', gain: 0.035, attack: 0.2 }); break;
      case 'ready': this.tone(1320, 1320, 0.15, { gain: 0.15 }); this.tone(1760, 1760, 0.25, { gain: 0.15, delay: 0.07 }); break;
      case 'spin': this.noise(0.55, { f0: 300, f1: 3000, q: 1.5, gain: 0.5 }); this.tone(180, 720, 0.5, { type: 'sawtooth', gain: 0.08 }); break;
      case 'gem': [1046, 1318, 1568].forEach((f, i) => this.tone(f, f, 0.12, { type: 'square', gain: 0.05, delay: i * 0.05 })); break;
      case 'bigGem': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, f, 0.14, { type: 'square', gain: 0.06, delay: i * 0.05 })); break;
      case 'heart': [880, 1175, 1760].forEach((f, i) => this.tone(f, f, 0.18, { type: 'triangle', gain: 0.15, delay: i * 0.07 })); break;
      case 'blip': this.tone(520 + r * 120, 520, 0.035, { type: 'square', gain: 0.025 }); break;
      case 'confirm': this.tone(880, 880, 0.08, { type: 'square', gain: 0.05 }); this.tone(1320, 1320, 0.1, { type: 'square', gain: 0.05, delay: 0.06 }); break;
      case 'cursor': this.tone(1100, 1100, 0.05, { type: 'square', gain: 0.04 }); break;
      case 'lock': this.tone(900, 1400, 0.1, { type: 'triangle', gain: 0.12 }); break;
      case 'unlock': this.tone(1200, 700, 0.1, { type: 'triangle', gain: 0.08 }); break;
      case 'cue': this.tone(240, 120, 0.4, { type: 'sawtooth', gain: 0.12 }); this.noise(0.3, { f0: 600, f1: 200, gain: 0.15 }); break;
      case 'bite': this.noise(0.12, { type: 'lowpass', f0: 1200, f1: 200, gain: 0.5 }); this.tone(300, 80, 0.12, { type: 'square', gain: 0.12 }); break;
      case 'defeat': this.tone(900, 90, 0.7, { type: 'square', gain: 0.08 }); this.noise(0.6, { f0: 3000, f1: 300, gain: 0.25 }); this.tone(1800, 2400, 0.4, { type: 'sine', gain: 0.08, delay: 0.25 }); break;
      case 'hurt': this.tone(500, 180, 0.25, { type: 'square', gain: 0.12 }); this.noise(0.15, { type: 'lowpass', f0: 1500, gain: 0.35 }); break;
      case 'step': this.noise(0.05, { f0: opt.surface === 'water' ? 900 : opt.surface === 'sand' ? 2200 : opt.surface === 'stone' ? 3200 : 1400, q: 1.2, gain: opt.surface === 'water' ? 0.12 : 0.05 }); break;
      case 'jump': this.tone(330, 560, 0.12, { type: 'triangle', gain: 0.08 }); break;
      case 'land': this.noise(0.1, { type: 'lowpass', f0: 800, gain: 0.25 }); break;
      case 'lift': this.tone(180, 320, 0.25, { type: 'triangle', gain: 0.1 }); break;
      case 'throw': this.noise(0.25, { f0: 600, f1: 1800, gain: 0.25 }); break;
      case 'shatter': this.noise(0.35, { type: 'highpass', f0: 1200, gain: 0.4 }); this.noise(0.2, { type: 'lowpass', f0: 600, gain: 0.35 }); break;
      case 'cut': this.noise(0.12, { type: 'highpass', f0: 3000, gain: 0.2 }); break;
      case 'door': this.tone(110, 90, 0.35, { type: 'triangle', gain: 0.2 }); this.noise(0.3, { type: 'lowpass', f0: 500, gain: 0.2 }); break;
      case 'chest': [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, f, 0.3, { type: 'triangle', gain: 0.12, delay: i * 0.09 })); break;
      case 'fanfare': [[523, 0], [659, 0.15], [784, 0.3], [1046, 0.45], [988, 0.75], [1046, 0.9]].forEach(([f, d]) => this.tone(f, f, d > 0.8 ? 0.7 : 0.18, { type: 'square', gain: 0.07, delay: d })); break;
      case 'glim': this.tone(2100, 2600, 0.08, { gain: 0.08 }); this.tone(2600, 2100, 0.1, { gain: 0.08, delay: 0.1 }); break;
      case 'spit': this.noise(0.15, { f0: 900, f1: 300, gain: 0.3 }); this.tone(400, 200, 0.1, { gain: 0.1 }); break;
      case 'pop': this.tone(300, 700, 0.12, { type: 'triangle', gain: 0.12 }); this.noise(0.1, { f0: 1500, gain: 0.15 }); break;
      case 'splash': this.noise(0.3, { f0: 1200, f1: 500, gain: 0.25 }); break;
      case 'heartUp': [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => this.tone(f, f, 0.25, { type: 'triangle', gain: 0.12, delay: i * 0.08 })); break;
    }
  }

  setRegion(songName, ambKind) {
    if (!this.ctx) { this.pendingRegion = [songName, ambKind]; return; }
    if (this.song !== SONGS[songName]) { this.song = SONGS[songName]; this.step = 0; this.next = this.t + 0.3; }
    this.ambKind = ambKind;
    const a = { forest: [500, 0.18], cave: [220, 0.22], field: [700, 0.14], desert: [1200, 0.12], town: [550, 0.16], room: [300, 0.04] }[ambKind] || [400, 0.1];
    this.ambFilter.frequency.setTargetAtTime(a[0], this.t, 0.5);
    this.amb.gain.setTargetAtTime(a[1], this.t, 0.5);
  }

  setBattle(on) { this.override = on ? SONGS.battle : null; }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    if (this.ctx) this.music.gain.setTargetAtTime(this.musicOn ? 0.12 : 0, this.t, 0.1);
    return this.musicOn;
  }

  update(dt) {
    if (!this.ctx) return;
    if (this.pendingRegion) { const p = this.pendingRegion; this.pendingRegion = null; this.setRegion(...p); }
    const song = this.override || this.song;
    if (song && this.musicOn) {
      const beat = 60 / song.bpm / 2;
      if (this.next < this.t - 1) this.next = this.t + 0.05;
      while (this.next < this.t + 0.25) {
        const i = this.step;
        const m = song.melody[i % song.melody.length];
        const delay = this.next - this.t;
        if (m) this.tone(midi(m), midi(m), beat * 1.6, { type: song.wave, gain: song.wave === 'sine' || song.wave === 'triangle' ? 0.35 : 0.12, delay, out: this.music });
        if (i % 8 === 0) {
          const ch = song.chords[(i / 8 | 0) % song.chords.length];
          ch.forEach((n) => this.tone(midi(n), midi(n), beat * 7.5, { type: 'sine', gain: 0.18, delay, attack: 0.15, out: this.music }));
          this.tone(midi(ch[0] - 12), midi(ch[0] - 12), beat * 3, { type: 'triangle', gain: 0.35, delay, out: this.music });
        }
        if (i % 8 === 4) {
          const ch = song.chords[(i / 8 | 0) % song.chords.length];
          this.tone(midi(ch[0] - 12), midi(ch[0] - 12), beat * 3, { type: 'triangle', gain: 0.3, delay, out: this.music });
        }
        this.step++; this.next += beat;
      }
    }
    if (this.ambKind === 'forest' || this.ambKind === 'field') {
      this.birdT -= dt;
      if (this.birdT < 0) {
        this.birdT = 2 + Math.random() * 5;
        const f = 2500 + Math.random() * 1500;
        for (let i = 0; i < 3; i++) this.tone(f, f * 1.3, 0.07, { gain: 0.025, delay: i * 0.11 });
      }
    }
  }
}

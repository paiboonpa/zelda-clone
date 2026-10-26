// Keyboard/mouse state with per-step edge detection. Actions are remappable via BINDINGS.
export const BINDINGS = {
  up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
  attack: ['Mouse0', 'KeyJ'],
  shield: ['Mouse2', 'KeyK', 'ShiftLeft', 'ShiftRight'],
  lock: ['KeyQ', 'Tab'],
  interact: ['KeyE'],
  jump: ['Space'],
  confirm: ['KeyE', 'Space', 'Enter', 'Mouse0', 'KeyJ'],
  camLeft: ['ArrowLeft'], camRight: ['ArrowRight'], camUp: ['ArrowUp'], camDown: ['ArrowDown'],
  menuUp: ['KeyW', 'ArrowUp'], menuDown: ['KeyS', 'ArrowDown'],
  pause: ['Escape', 'KeyP'],
  music: ['KeyM'],
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.mdx = 0; this.mdy = 0;
    this.locked = false;
    this.onLockChange = null;
    const prevent = new Set(['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
    addEventListener('keydown', (e) => {
      if (prevent.has(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => { this.keys.delete(e.code); this.released.add(e.code); });
    canvas.addEventListener('mousedown', (e) => {
      const c = 'Mouse' + e.button;
      if (!this.keys.has(c)) this.pressed.add(c);
      this.keys.add(c);
    });
    addEventListener('mouseup', (e) => { const c = 'Mouse' + e.button; this.keys.delete(c); this.released.add(c); });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => { if (this.locked) { this.mdx += e.movementX; this.mdy += e.movementY; } });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      this.onLockChange?.(this.locked);
    });
    addEventListener('blur', () => { for (const k of this.keys) this.released.add(k); this.keys.clear(); });
  }
  requestLock() {
    if (this.locked) return;
    try { const p = this.canvas.requestPointerLock(); p?.catch?.(() => {}); } catch { /* unsupported */ }
  }
  releaseLock() { if (this.locked) document.exitPointerLock(); }
  down(action) { return BINDINGS[action].some((c) => this.keys.has(c)); }
  hit(action) { return BINDINGS[action].some((c) => this.pressed.has(c)); }
  up(action) { return BINDINGS[action].some((c) => this.released.has(c)); }
  axis() {
    return {
      x: (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0),
      y: (this.down('up') ? 1 : 0) - (this.down('down') ? 1 : 0),
    };
  }
  /** Clear edges after a simulation step so one press is handled once. */
  endStep() { this.pressed.clear(); this.released.clear(); }
  takeMouse() { const d = { x: this.mdx, y: this.mdy }; this.mdx = this.mdy = 0; return d; }
}

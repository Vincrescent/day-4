/**
 * ChessClock — countdown timer for both sides.
 * Modes: 'blitz' (5+0), 'rapid' (10+5), 'unlimited' (no timer).
 */
export class ChessClock {
  constructor() {
    this.mode = 'unlimited'; // blitz | rapid | unlimited
    this.time = { w: 0, b: 0 }; // ms remaining
    this.increment = { w: 0, b: 0 }; // ms per move
    this.running = false;
    this.activeSide = 'w';
    this._interval = null;
    this._lastTick = 0;
    this.onTimeout = null; // callback(side)
    this.onTick = null;    // callback(w_ms, b_ms)
  }

  configure(mode) {
    this.mode = mode;
    this.stop();
    switch (mode) {
      case 'blitz':
        this.time.w = this.time.b = 5 * 60 * 1000;  // 5 min
        this.increment.w = this.increment.b = 0;
        break;
      case 'rapid':
        this.time.w = this.time.b = 10 * 60 * 1000;  // 10 min
        this.increment.w = this.increment.b = 5000;    // +5s
        break;
      case 'unlimited':
      default:
        this.time.w = this.time.b = Infinity;
        this.increment.w = this.increment.b = 0;
        break;
    }
  }

  start(side) {
    if (this.mode === 'unlimited') return;
    this.activeSide = side;
    this.running = true;
    this._lastTick = performance.now();
    if (this._interval) clearInterval(this._interval);
    this._interval = setInterval(() => this._tick(), 100);
  }

  switchTo(side) {
    if (this.mode === 'unlimited') return;
    // Add increment to the side that just moved
    const prev = this.activeSide;
    this.time[prev] += this.increment[prev];
    this.activeSide = side;
    this._lastTick = performance.now();
  }

  stop() {
    this.running = false;
    if (this._interval) { clearInterval(this._interval); this._interval = null; }
  }

  reset() {
    this.stop();
    this.configure(this.mode);
  }

  _tick() {
    if (!this.running) return;
    const now = performance.now();
    const elapsed = now - this._lastTick;
    this._lastTick = now;

    this.time[this.activeSide] -= elapsed;
    if (this.time[this.activeSide] <= 0) {
      this.time[this.activeSide] = 0;
      this.stop();
      if (this.onTimeout) this.onTimeout(this.activeSide);
    }
    if (this.onTick) this.onTick(this.time.w, this.time.b);
  }

  getDisplay(ms) {
    if (ms === Infinity || ms === undefined) return '--:--';
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  }

  isUnlimited() { return this.mode === 'unlimited'; }
}

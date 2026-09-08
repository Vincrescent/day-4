/**
 * AudioController — Web Audio synthesized SFX + optional ambient.
 * No external audio files (to avoid licensing issues); everything is
 * generated. Architecture supports plugging in real samples later.
 */
export class AudioController {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.ambientNode = null;
  }

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.6;
      this.master.connect(this.ctx.destination);
    } catch (e) {
      console.warn('[Audio] Web Audio unavailable:', e);
      this.enabled = false;
    }
  }

  _tone(freq, dur, type = 'sine', vol = 0.2, when = 0) {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  _noise(dur, vol = 0.15, when = 0, freq = 800) {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + when;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 1.2;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t0);
  }

  playSelect() { this._tone(720, 0.06, 'sine', 0.12); }

  playMove() {
    // Wood knock: short low thump
    this._tone(160, 0.08, 'sine', 0.25);
    this._noise(0.04, 0.08, 0, 400);
  }

  playCapture() {
    // Heavier knock + crack
    this._tone(120, 0.12, 'sine', 0.3);
    this._noise(0.08, 0.2, 0, 900);
    this._tone(90, 0.16, 'sine', 0.2, 0.02);
  }

  playCheck() {
    this._tone(660, 0.1, 'sawtooth', 0.18);
    this._tone(880, 0.16, 'sawtooth', 0.14, 0.1);
  }

  playCheckmate() {
    // Victory motif
    [523, 659, 784, 1046].forEach((f, i) => this._tone(f, 0.35, 'sine', 0.2, i * 0.14));
    this._tone(130, 0.6, 'sine', 0.15, 0);
  }

  playPromotion() {
    this._tone(880, 0.12, 'sine', 0.2);
    this._tone(1320, 0.2, 'sine', 0.15, 0.1);
  }

  startAmbient() {
    if (!this.ctx || this.ambientNode) return;
    // Very low drone
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 55;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.04;
    osc.connect(gain).connect(this.master);
    osc.start();
    this.ambientNode = { osc, gain };
  }

  stopAmbient() {
    if (this.ambientNode) {
      try { this.ambientNode.osc.stop(); } catch (e) {}
      this.ambientNode = null;
    }
  }
}

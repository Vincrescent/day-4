/**
 * AudioController — Web Audio synthesized SFX + gothic ambient.
 * Features: random pitch variation, mute toggle, volume control.
 */
export class AudioController {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.muted = false;
    this.ambientNode = null;
    this.rainNode = null;
    this.nextThunderTime = 0;
  }

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.6;
      this.master.connect(this.ctx.destination);
    } catch (e) {
      console.warn('[Audio] Web Audio unavailable:', e);
      this.enabled = false;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.6;
    return this.muted;
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.6;
  }

  // Random pitch variation: ±semi semitones around base freq
  _rp(freq, semi = 1.5) {
    const factor = Math.pow(2, ((Math.random() - 0.5) * 2 * semi) / 12);
    return freq * factor;
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

  // --- Gothic Stone Slide for piece selection (with pitch variation) ---
  playSelect() {
    this._noise(0.06, 0.08, 0, this._rp(1200, 3));
    this._tone(this._rp(400, 2), 0.04, 'sine', 0.06);
  }

  // --- Deep Stone Thud for moves (with pitch variation) ---
  playMove() {
    this._tone(this._rp(70, 2), 0.18, 'sine', 0.35);
    this._tone(this._rp(110, 2), 0.12, 'triangle', 0.15, 0.02);
    this._noise(0.06, 0.12, 0.01, this._rp(250, 3));
  }

  // --- Heavy Stone Impact for captures (with pitch variation) ---
  playCapture() {
    this._tone(this._rp(50, 2), 0.25, 'sine', 0.4);
    this._noise(0.12, 0.25, 0, this._rp(600, 3));
    this._tone(this._rp(85, 2), 0.2, 'triangle', 0.25, 0.03);
    this._noise(0.08, 0.15, 0.1, this._rp(1200, 3));
  }

  // --- Cathedral Bell Toll for Check (with pitch variation) ---
  playCheck() {
    const base = this._rp(180, 1);
    this._tone(base, 0.9, 'sine', 0.3);
    this._tone(base * 2, 0.7, 'sine', 0.12, 0.01);
    this._tone(base * 3, 0.5, 'sine', 0.06, 0.02);
    this._tone(base * 4, 0.3, 'sine', 0.03, 0.03);
    this._noise(0.08, 0.06, 0, this._rp(3000, 2));
  }

  // --- Grand Cathedral Chord for Checkmate ---
  playCheckmate() {
    [130, 195, 260].forEach((f, i) => {
      const rp = this._rp(f, 0.5);
      this._tone(rp, 1.5, 'sine', 0.25, i * 0.3);
      this._tone(rp * 2, 1.0, 'sine', 0.08, i * 0.3 + 0.02);
    });
    this._tone(this._rp(65, 1), 2.0, 'sine', 0.2, 0);
    this._tone(this._rp(97, 1), 1.8, 'sine', 0.1, 0.15);
    this._noise(0.15, 0.08, 0.8, this._rp(800, 2));
  }

  // --- Magical ascent for promotion ---
  playPromotion() {
    this._tone(this._rp(330, 1), 0.15, 'sine', 0.2);
    this._tone(this._rp(440, 1), 0.2, 'sine', 0.18, 0.12);
    this._tone(this._rp(660, 1), 0.25, 'sine', 0.15, 0.25);
    this._tone(this._rp(880, 1), 0.3, 'sine', 0.12, 0.4);
  }

  // --- Gothic Thunder Rumble ---
  playThunder() {
    if (!this.ctx || !this.enabled) return;
    const dur = 1.2 + Math.random() * 1.5;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const env = Math.exp(-t * 3) * (1 + Math.sin(t * 12) * 0.3);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 120;
    lp.Q.value = 0.7;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.25;
    src.connect(lp).connect(gain).connect(this.master);
    src.start();
  }

  // --- Continuous Rain Noise ---
  startAmbient() {
    if (!this.ctx || this.rainNode) return;

    const sampleRate = this.ctx.sampleRate;
    const len = sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 4000;
    hp.Q.value = 0.3;

    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 6500;
    bp.Q.value = 0.8;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.06;

    src.connect(hp).connect(bp).connect(gain).connect(this.master);
    src.start();
    this.rainNode = { src, gain };

    const drone = this.ctx.createOscillator();
    drone.type = 'sine';
    drone.frequency.value = 50;
    const droneGain = this.ctx.createGain();
    droneGain.gain.value = 0.03;
    drone.connect(droneGain).connect(this.master);
    drone.start();
    this.ambientNode = { osc: drone, gain: droneGain };

    this.nextThunderTime = this.ctx.currentTime + 8 + Math.random() * 10;
  }

  updateAmbient() {
    if (!this.ctx || !this.rainNode) return;
    if (this.ctx.currentTime > this.nextThunderTime) {
      this.playThunder();
      this.nextThunderTime = this.ctx.currentTime + 10 + Math.random() * 15;
    }
  }

  stopAmbient() {
    if (this.ambientNode) {
      try { this.ambientNode.osc.stop(); } catch (e) {}
      this.ambientNode = null;
    }
    if (this.rainNode) {
      try { this.rainNode.src.stop(); } catch (e) {}
      this.rainNode = null;
    }
  }
}

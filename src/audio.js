// audio.js — a procedural, ORIGINAL bossa-nova soundtrack + surf SFX, built on
// the Web Audio API. This is a fan tribute, so it evokes the breezy fusion mood
// of Brasilian Skies rather than reproducing any copyrighted recording.
//
// The music has day/night layers: bright comping by day, a softer pad + a
// shimmering "bioluminescent" sparkle by night.

const BPM = 96;
const STEP = 60 / BPM / 4; // one 16th note, seconds

// Warm I–vi–ii–V-ish loop (MIDI note numbers), one bar each.
const CHORDS = [
  [60, 64, 67, 71], // Cmaj7
  [57, 60, 64, 67], // Am7
  [62, 65, 69, 72], // Dm7
  [55, 59, 62, 65], // G7
];
const BASS = [36, 33, 38, 31]; // roots, low
const PENTA = [72, 74, 76, 79, 81, 84]; // C-major pentatonic for melody

// Rhythm grids (16 steps / bar).
const COMP = [0, 3, 6, 8, 11, 14];
const CLAVE = [0, 3, 6, 10, 12];
const SHAKER = [0, 2, 4, 6, 8, 10, 12, 14];

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.started = false;
    this.night = 0;
    this._timer = null;
    this._nextStepTime = 0;
    this._step = 0;
    this._bar = 0;
  }

  async start() {
    if (this.started) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return; // no Web Audio → silent, game still runs
    this.ctx = new AC();
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(ctx.destination);

    // Shared reverb for that soft, open-ocean space.
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this._impulse(2.2, 2.6);
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.22;
    this.reverb.connect(this.wet).connect(this.master);

    // Music bus → gentle lowpass "tone" → dry + reverb send.
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.9;
    this.tone = ctx.createBiquadFilter();
    this.tone.type = 'lowpass';
    this.tone.frequency.value = 4800;
    this.tone.Q.value = 0.4;
    this.musicBus.connect(this.tone);
    this.tone.connect(this.master);
    this.tone.connect(this.reverb);

    // Per-layer gains so day/night can crossfade them.
    this.gPad = this._busGain(0.5);
    this.gComp = this._busGain(0.5);
    this.gBass = this._busGain(0.7);
    this.gPerc = this._busGain(0.35);
    this.gMel = this._busGain(0.4);
    this.gShim = this._busGain(0.0);

    this.started = true;
    this._nextStepTime = ctx.currentTime + 0.06;
    this._step = 0;
    this._bar = 0;
    this._timer = setInterval(() => this._scheduler(), 25);
    this.setNight(this.night);
  }

  _busGain(v) {
    const g = this.ctx.createGain();
    g.gain.value = v;
    g.connect(this.musicBus);
    return g;
  }

  _impulse(dur, decay) {
    const ctx = this.ctx;
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * dur);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  setMuted(m) {
    if (this.master) this.master.gain.value = m ? 0 : 0.85;
  }

  // factor 0 = full day, 1 = deep night.
  setNight(factor) {
    this.night = factor;
    if (!this.started) return;
    const t = this.ctx.currentTime;
    const ramp = (param, v) => param.setTargetAtTime(v, t, 0.5);
    ramp(this.tone.frequency, 4800 - 3000 * factor);
    ramp(this.wet.gain, 0.22 + 0.25 * factor);
    ramp(this.gPad.gain, 0.5 + 0.45 * factor);
    ramp(this.gComp.gain, 0.5 * (1 - 0.55 * factor));
    ramp(this.gPerc.gain, 0.35 * (1 - 0.7 * factor));
    ramp(this.gShim.gain, 0.0 + 0.5 * factor);
    ramp(this.gMel.gain, 0.4 - 0.1 * factor);
  }

  _scheduler() {
    if (!this.started) return;
    const ctx = this.ctx;
    while (this._nextStepTime < ctx.currentTime + 0.12) {
      this._scheduleStep(this._step, this._nextStepTime);
      this._nextStepTime += STEP;
      this._step += 1;
      if (this._step >= 16) {
        this._step = 0;
        this._bar = (this._bar + 1) % CHORDS.length;
      }
    }
  }

  _scheduleStep(step, when) {
    const chord = CHORDS[this._bar];

    // Pad: sustain the whole chord at the top of each bar.
    if (step === 0) {
      for (const n of chord) this._voice({ freq: midi(n), when, dur: STEP * 15, type: 'triangle', dest: this.gPad, attack: 0.4, release: 1.2, gain: 0.16 });
      this._voice({ freq: midi(BASS[this._bar]), when, dur: STEP * 7.5, type: 'sine', dest: this.gBass, attack: 0.01, release: 0.3, gain: 0.5 });
    }
    if (step === 8) this._voice({ freq: midi(BASS[this._bar]), when, dur: STEP * 7.5, type: 'sine', dest: this.gBass, attack: 0.01, release: 0.3, gain: 0.45 });

    // Comp: short jazzy stabs (top three chord tones).
    if (COMP.includes(step)) {
      for (const n of chord.slice(1)) this._voice({ freq: midi(n + 0), when, dur: STEP * 1.8, type: 'triangle', dest: this.gComp, attack: 0.005, release: 0.18, gain: 0.1 });
    }

    // Melody: sparse pentatonic noodle, more active by day.
    if (step % 2 === 0 && Math.random() < 0.18 * (1 - 0.4 * this.night)) {
      const n = PENTA[Math.floor(Math.random() * PENTA.length)];
      this._voice({ freq: midi(n), when, dur: STEP * 2.5, type: 'sine', dest: this.gMel, attack: 0.01, release: 0.4, gain: 0.12 });
    }

    // Bioluminescent shimmer at night: high, slow twinkles.
    if (this.night > 0.2 && step % 4 === 0 && Math.random() < 0.4) {
      const n = PENTA[Math.floor(Math.random() * PENTA.length)] + 12;
      this._voice({ freq: midi(n), when, dur: STEP * 3, type: 'sine', dest: this.gShim, attack: 0.2, release: 0.9, gain: 0.1 });
    }

    // Percussion: soft clave + shaker.
    if (CLAVE.includes(step)) this._click(when, 1500, 0.05, this.gPerc, 0.5);
    if (SHAKER.includes(step)) this._noise(when, 0.03, this.gPerc, 0.12);
  }

  _voice({ freq, when, dur, type = 'sine', dest, attack = 0.01, release = 0.2, gain = 0.2 }) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + attack);
    g.gain.setTargetAtTime(0.0001, when + dur, release);
    osc.connect(g).connect(dest);
    osc.start(when);
    osc.stop(when + dur + release + 0.2);
  }

  _click(when, freq, dur, dest, gain) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g).connect(dest);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  _noise(when, dur, dest, gain) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6000;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(hp).connect(g).connect(dest);
    src.start(when);
  }

  // ───────────────── SFX (fire-and-forget) ─────────────────
  _sfxBus() {
    return this.master;
  }

  sfxNote() {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    this._voice({ freq: midi(84), when: t, dur: 0.08, type: 'sine', dest: this._sfxBus(), attack: 0.005, release: 0.12, gain: 0.18 });
    this._voice({ freq: midi(88), when: t + 0.06, dur: 0.08, type: 'sine', dest: this._sfxBus(), attack: 0.005, release: 0.12, gain: 0.16 });
  }

  sfxRing(combo = 1) {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    const base = 72 + Math.min(combo, 8);
    for (let i = 0; i < 3; i++)
      this._voice({ freq: midi(base + i * 4), when: t + i * 0.04, dur: 0.12, type: 'triangle', dest: this._sfxBus(), attack: 0.005, release: 0.18, gain: 0.16 });
  }

  sfxJump() {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(midi(60), t);
    osc.frequency.exponentialRampToValueAtTime(midi(79), t + 0.2);
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    osc.connect(g).connect(this._sfxBus());
    osc.start(t);
    osc.stop(t + 0.3);
  }

  sfxBoost() {
    if (!this.started) return;
    this._noise(this.ctx.currentTime, 0.4, this._sfxBus(), 0.25);
  }

  sfxWipeout() {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(midi(60), t);
    osc.frequency.exponentialRampToValueAtTime(midi(40), t + 0.4);
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    osc.connect(g).connect(this._sfxBus());
    osc.start(t);
    osc.stop(t + 0.5);
  }

  sfxDiscover() {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    [72, 76, 79, 84].forEach((n, i) =>
      this._voice({ freq: midi(n), when: t + i * 0.09, dur: 0.25, type: 'triangle', dest: this._sfxBus(), attack: 0.01, release: 0.4, gain: 0.16 })
    );
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
    this.started = false;
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch {
        /* ignore */
      }
    }
    this.ctx = null;
  }
}

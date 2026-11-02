// Every sound is synthesised: candle crackle, paper, a music box that follows his footsteps.
// Spatial: the candle crackles at your chest, Wick's steps come from where he is on the page.
const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];

export class Sound {
  ctx: AudioContext | null = null;
  master!: GainNode;
  rev!: ConvolverNode;
  wick!: PannerNode;
  noise!: AudioBuffer;
  step = 0;
  rainGain: GainNode | null = null;

  /** Must be called from a user gesture. */
  start() {
    if (this.ctx) { void this.ctx.resume(); return; }
    const Ctor = window.AudioContext;
    if (!Ctor) return;
    const c = (this.ctx = new Ctor());
    this.master = c.createGain();
    this.master.gain.value = 0.85;
    const comp = c.createDynamicsCompressor();
    this.master.connect(comp).connect(c.destination);
    // A small room, made of decaying noise: the "wood and paper" around everything.
    const len = c.sampleRate * 1.4, ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.4); }
    this.rev = c.createConvolver();
    this.rev.buffer = ir;
    const wet = c.createGain();
    wet.gain.value = 0.22;
    this.rev.connect(wet).connect(this.master);
    this.noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const n = this.noise.getChannelData(0);
    for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;
    this.wick = c.createPanner();
    this.wick.panningModel = 'HRTF';
    this.wick.refDistance = 0.4;
    this.wick.connect(this.master);
    this.wick.connect(this.rev);
  }

  private noiseBurst(dest: AudioNode, dur: number, freq: number, gain: number, type: BiquadFilterType = 'bandpass', q = 1.2, when = 0) {
    const c = this.ctx!, t = c.currentTime + when;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(dest);
    s.start(t, Math.random());
    s.stop(t + dur + 0.02);
  }

  private bell(semitone: number, gain = 0.14, when = 0, dest: AudioNode = this.wick) {
    const c = this.ctx!, t = c.currentTime + when, f = 880 * Math.pow(2, semitone / 12);
    for (const [mult, g2, dur] of [[1, 1, 1.1], [3.93, 0.28, 0.32], [8.1, 0.09, 0.12]] as const) {
      const o = c.createOscillator();
      o.frequency.value = f * mult;
      const g = c.createGain();
      g.gain.setValueAtTime(gain * g2, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(dest);
      o.start(t);
      o.stop(t + dur + 0.02);
    }
  }

  crackle() {
    if (!this.ctx) return;
    if (Math.random() < 0.3) this.noiseBurst(this.master, 0.015 + Math.random() * 0.03, 1800 + Math.random() * 4600, 0.03 + Math.random() * 0.1, 'highpass', 0.7);
  }

  /** Called every frame: keeps listener and Wick's voice in the right place, plus rain and crackle. */
  place(wx: number, wy: number, wz: number, head: { x: number; y: number; z: number; fx: number; fy: number; fz: number; ux: number; uy: number; uz: number }, raining: boolean, duck: number) {
    const c = this.ctx;
    if (!c) return;
    this.wick.positionX.value = wx; this.wick.positionY.value = wy; this.wick.positionZ.value = wz;
    const l = c.listener;
    if (l.positionX) {
      l.positionX.value = head.x; l.positionY.value = head.y; l.positionZ.value = head.z;
      l.forwardX.value = head.fx; l.forwardY.value = head.fy; l.forwardZ.value = head.fz;
      l.upX.value = head.ux; l.upY.value = head.uy; l.upZ.value = head.uz;
    }
    this.master.gain.setTargetAtTime(0.85 * duck, c.currentTime, 0.4);
    if (raining && !this.rainGain) {
      const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
      const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2600;
      this.rainGain = c.createGain(); this.rainGain.gain.value = 0;
      s.connect(f).connect(this.rainGain).connect(this.wick);
      s.start();
    }
    if (this.rainGain) this.rainGain.gain.setTargetAtTime(raining ? 0.16 : 0, c.currentTime, 0.5);
  }

  event(t: string, who?: string) {
    if (!this.ctx) return;
    const b = (s: number, g?: number, w?: number) => this.bell(s, g, w);
    switch (t) {
      case 'lit': this.noiseBurst(this.master, 0.35, 900, 0.5, 'bandpass', 0.5); [0, 4, 7, 12].forEach((n, i) => this.bell(n - 12, 0.11, 0.12 + i * 0.13, this.master)); break;
      case 'step': b(PENTATONIC[(this.step = (this.step + (Math.random() < 0.7 ? 1 : 3)) % PENTATONIC.length)], 0.06); this.noiseBurst(this.wick, 0.03, 3200, 0.05); break;
      case 'wait': b(9, 0.1); b(7, 0.08, 0.14); break;
      case 'go': b(12, 0.1); b(16, 0.1, 0.09); break;
      case 'awake': this.noiseBurst(this.wick, 0.12, 2400, 0.16); [0, 7, 12].forEach((n, i) => b(n + (PUPPET_KEY[who ?? ''] ?? 0), 0.12, i * 0.08)); break;
      case 'album-new': [12, 16, 19, 24].forEach((n, i) => b(n, 0.12, 0.35 + i * 0.1)); break;
      case 'bark': this.voice(290, 150, 0.14, 'sawtooth', 0.32); this.voice(330, 170, 0.12, 'sawtooth', 0.26, 0.17); break;
      case 'crow-flees': this.voice(900, 520, 0.2, 'square', 0.1); this.noiseBurst(this.wick, 0.4, 1800, 0.18, 'bandpass', 0.5); break;
      case 'thump': this.voice(120, 44, 0.3, 'sine', 0.9); this.noiseBurst(this.wick, 0.18, 240, 0.5, 'lowpass'); break;
      case 'snip': this.noiseBurst(this.wick, 0.04, 6400, 0.4, 'highpass'); this.noiseBurst(this.wick, 0.04, 5200, 0.4, 'highpass', 1, 0.09); break;
      case 'gate-opens': this.voice(180, 90, 0.5, 'triangle', 0.14); break;
      case 'grab': this.voice(520, 880, 0.2, 'triangle', 0.16); this.noiseBurst(this.wick, 0.25, 1500, 0.14, 'bandpass', 0.5); break;
      case 'drop': case 'land': this.noiseBurst(this.wick, 0.05, 1300, 0.14); break;
      case 'fell': this.voice(700, 280, 0.8, 'sine', 0.12); break;
      case 'back': b(4, 0.1); b(7, 0.1, 0.1); break;
      case 'page-done': [0, 2, 4, 7, 9, 12, 16, 19].forEach((n, i) => b(n, 0.12, i * 0.09)); break;
      case 'page-turn': this.noiseBurst(this.master, 1.0, 1700, 0.28, 'bandpass', 0.4); this.noiseBurst(this.master, 0.5, 4200, 0.1, 'highpass', 0.5, 0.3); break;
      case 'page-open': this.noiseBurst(this.master, 0.2, 2500, 0.1, 'bandpass', 0.6); break;
      case 'tab': b(7, 0.13); this.noiseBurst(this.master, 0.03, 3600, 0.14); break;
    }
  }

  private voice(from: number, to: number, dur: number, type: OscillatorType, gain: number, when = 0) {
    const c = this.ctx!, t = c.currentTime + when;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const f = c.createBiquadFilter(); f.frequency.value = 1700;
    o.connect(f).connect(g).connect(this.wick);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
}

const PUPPET_KEY: Record<string, number> = { dog: 0, bird: 7, rabbit: 4, snail: -5, crab: -3, swan: 9, butterfly: 12 };

/**
 * Devlog — Ambient Sound Engine
 *
 * Web Audio API sound generators for writing ambiance.
 * Sounds: rain (brown noise), lo-fi (warm hum + pink noise),
 * cafe (murmur oscillators), silence (off).
 */

const ambient = {
  ctx: null,
  masterGain: null,
  currentSound: "silence",
  currentVolume: 0.3,
  nodes: [],

  _ensureCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.currentVolume;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  },

  _stopAll() {
    this.nodes.forEach(n => {
      try { if (n.stop) n.stop(); } catch (e) {}
      try { n.disconnect(); } catch (e) {}
    });
    this.nodes = [];
  },

  _gain(value) {
    const g = this.ctx.createGain();
    g.gain.value = value;
    g.connect(this.masterGain);
    return g;
  },

  play(sound) {
    this._ensureCtx();
    this._stopAll();
    this.currentSound = sound;
    this.masterGain.gain.value = this.currentVolume;

    if (sound === "rain") this._rain();
    else if (sound === "lofi") this._lofi();
    else if (sound === "cafe") this._cafe();

    this._save();
  },

  setVolume(v) {
    this.currentVolume = v;
    if (this.masterGain) this.masterGain.gain.value = v;
    this._save();
  },

  // ── Rain: brown noise through low-pass filter ──
  _rain() {
    const sr = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, 2 * sr, sr);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      d[i] = (last + 0.02 * w) / 1.02;
      last = d[i];
      d[i] *= 3.5;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filt = this.ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 400;
    const g = this._gain(0.8);
    src.connect(filt);
    filt.connect(g);
    src.start();
    this.nodes.push(src, filt, g);
  },

  // ── Lo-fi: sine wave with LFO + pink noise ──
  _lofi() {
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 295;
    const lfo = this.ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.3;
    const lfoG = this.ctx.createGain();
    lfoG.gain.value = 8;
    lfo.connect(lfoG);
    lfoG.connect(osc.frequency);
    const filt = this.ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 800;
    const oscG = this._gain(0.12);
    osc.connect(filt);
    filt.connect(oscG);
    osc.start();
    lfo.start();

    // Pink noise
    const sr = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, 2 * sr, sr);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.0168980;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
    const nSrc = this.ctx.createBufferSource();
    nSrc.buffer = buf;
    nSrc.loop = true;
    const nG = this._gain(0.15);
    nSrc.connect(nG);
    nSrc.start();

    this.nodes.push(osc, lfo, lfoG, filt, oscG, nSrc, nG);
  },

  // ── Cafe: oscillator murmur + bandpass noise ──
  _cafe() {
    [180, 220, 260, 340, 420].forEach(freq => {
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq + Math.random() * 40;
      const lfo = this.ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 0.1 + Math.random() * 0.4;
      const lG = this.ctx.createGain();
      lG.gain.value = 0.04;
      lfo.connect(lG);
      lG.connect(osc.frequency);
      const g = this._gain(0.03);
      osc.connect(g);
      osc.start();
      lfo.start();
      this.nodes.push(osc, lfo, lG, g);
    });

    const sr = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, 2 * sr, sr);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      d[i] = (last + 0.02 * w) / 1.02;
      last = d[i];
      d[i] *= 3.5;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filt = this.ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = 600;
    filt.Q.value = 0.5;
    const g = this._gain(0.2);
    src.connect(filt);
    filt.connect(g);
    src.start();
    this.nodes.push(src, filt, g);
  },

  _save() {
    chrome.storage.local.set({
      devlog_ambient: { sound: this.currentSound, volume: this.currentVolume }
    });
  },

  async load() {
    return new Promise(resolve => {
      chrome.storage.local.get(["devlog_ambient"], r =>
        resolve(r.devlog_ambient || { sound: "silence", volume: 0.3 })
      );
    });
  }
};

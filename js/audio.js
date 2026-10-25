/* ============================================================
   ColorUp.io — js/audio.js
   File 7/8 · AUDIO DESIGN SYSTEM (PRD v2.1 §3.A.9)
   Mengganti sintesis oscillator 8-bit v1.1 dengan AudioManager:
   - 3 bus: master → sfx + ambient (default 80% / 100% / 40%)
   - asset drop-in: assets/audio/<name>.ogg → .mp3 → .wav
     (decode sekali ke AudioBuffer, tidak re-request)
   - fallback prosedural "matte": noise ter-filter + envelope
     lembut + partials sinus (BUKAN beep square/8-bit)
   - ducking ambient −20dB saat SFX kritis
   - rate limit 80ms per nama SFX
   - pitch variation ±5% untuk SFX repetitif
   - mute persist (localStorage) + hormati prefers-reduced-motion
     (ambient di-mute, SFX tetap) + pause ambient saat tab hidden
   Sound.* lama dipertahankan sebagai THIN WRAPPER.
   ============================================================ */
'use strict';

const AUDIO_MANIFEST = [
  'click-matte', 'hover-soft', 'success', 'error', 'warning', 'toggle-on', 'toggle-off',
  'dice-roll', 'dice-land', 'coin-soft', 'coin-out', 'rent', 'build', 'mega',
  'trade-accept', 'sabotage', 'weather-change', 'inflation', 'jail', 'ghost-steal',
  'ambient-lobby', 'ambient-game', 'podium-reveal', 'confetti'
];
const AMBIENT_NAMES = ['ambient-lobby', 'ambient-game'];
const CRITICAL_DUCK = ['dice-roll', 'sabotage', 'podium-reveal'];
const PITCH_VARY = ['click-matte', 'coin-soft', 'coin-out', 'dice-land', 'hover-soft'];

class AudioManager {
  constructor() {
    this.ctx = null;
    this.buffers = {};          // name → AudioBuffer (asset atau prosedural)
    this.loading = {};          // name → Promise
    this.lastPlay = {};         // rate limit
    this.ambient = { name: null, src: null };
    this.duckUntil = 0;
    this.enabled = true;        // mute global (persist)
    this.vol = { master: 0.8, sfx: 1.0, ambient: 0.4 };
    this._prefersReduced = false;
    this._hidden = false;
    this._bound = false;
  }

  /* ---------- lifecycle ---------- */
  loadPrefs(store) {
    this.store = store || null;
    try {
      const raw = this.store && this.store.getLocal('cu_audio');
      const p = raw ? JSON.parse(raw) : null;
      if (p) {
        this.enabled = p.enabled !== false;
        this.vol = Object.assign(this.vol, p.vol || {});
      }
    } catch (e) { /* pakai default */ }
    try {
      this._prefersReduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { this._prefersReduced = false; }
  }
  savePrefs() {
    if (!this.store) return;
    this.store.setLocal('cu_audio', JSON.stringify({ enabled: this.enabled, vol: this.vol }));
  }

  /** Panggil pada user gesture pertama (kebijakan autoplay browser, R9). */
  unlock() {
    const c = this.ac();
    if (!c) return;
    if (c.state === 'suspended') { try { c.resume(); } catch (e) {} }
    if (!this._bound) {
      this._bound = true;
      document.addEventListener('visibilitychange', () => {
        this._hidden = document.hidden;
        if (document.hidden) this.stopAmbient();
        else if (this.ambient.name) this.startAmbient(this.ambient.name);
      });
    }
  }

  ac() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.sfxBus = this.ctx.createGain();
        this.ambBus = this.ctx.createGain();
        this.sfxBus.connect(this.master);
        this.ambBus.connect(this.master);
        this.master.connect(this.ctx.destination);
        this.applyVolumes();
      } catch (e) { return null; }
    }
    return this.ctx;
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.enabled ? this.vol.master : 0, t, 0.02);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.02);
    const ducked = Date.now() < this.duckUntil ? 0.1 : 1;   // −20dB
    const ambMute = this._prefersReduced ? 0 : 1;          // reduced motion → ambient mati
    this.ambBus.gain.setTargetAtTime(this.vol.ambient * ducked * ambMute, t, 0.08);
  }

  setVolume(bus, v) { this.vol[bus] = Math.max(0, Math.min(1, v)); this.applyVolumes(); this.savePrefs(); }
  setMuted(m) { this.enabled = !m; this.applyVolumes(); this.savePrefs(); }
  get muted() { return !this.enabled; }

  /* ---------- asset pipeline ---------- */
  /** Coba muat berkas nyata; gagal → null (pakai prosedural). */
  async loadAsset(name) {
    const exts = ['ogg', 'mp3', 'wav'];
    for (const ext of exts) {
      try {
        const res = await fetch('assets/audio/' + name + '.' + ext);
        if (!res.ok) continue;
        const buf = await res.arrayBuffer();
        const decoded = await this.ac().decodeAudioData(buf);
        return decoded;
      } catch (e) { /* coba ekstensi berikutnya */ }
    }
    return null;
  }

  async buffer(name) {
    if (this.buffers[name]) return this.buffers[name];
    if (this.loading[name]) return this.loading[name];
    const c = this.ac();
    if (!c) return null;
    this.loading[name] = (async () => {
      let buf = await this.loadAsset(name);
      if (!buf) buf = Synth.render(c, name);
      this.buffers[name] = buf;
      delete this.loading[name];
      return buf;
    })();
    return this.loading[name];
  }

  /** Preload non-blocking saat lobi (target < 1.5s, tidak menahan render). */
  preload(names) {
    (names || AUDIO_MANIFEST).forEach(n => { this.buffer(n).catch(() => {}); });
  }

  /* ---------- play ---------- */
  async play(name, opts) {
    opts = opts || {};
    if (!this.enabled) return;
    const c = this.ac();
    if (!c) return;
    if (c.state === 'suspended') { try { await c.resume(); } catch (e) {} }

    // rate limit 80ms per nama
    const now = Date.now();
    if (now - (this.lastPlay[name] || 0) < 80) return;
    this.lastPlay[name] = now;

    const buf = await this.buffer(name);
    if (!buf) return;

    // ducking ambient untuk SFX kritis
    if (CRITICAL_DUCK.indexOf(name) > -1) {
      this.duckUntil = now + Math.round(buf.duration * 1000) + 250;
      this.applyVolumes();
      setTimeout(() => this.applyVolumes(), Math.round(buf.duration * 1000) + 300);
    }

    const src = c.createBufferSource();
    src.buffer = buf;
    let rate = opts.rate || 1;
    if (PITCH_VARY.indexOf(name) > -1) rate *= 1 + (Math.random() * 0.10 - 0.05);  // ±5%
    src.playbackRate.value = rate;
    const g = c.createGain();
    g.gain.value = opts.vol == null ? 1 : opts.vol;
    src.connect(g);
    g.connect(AMBIENT_NAMES.indexOf(name) > -1 ? this.ambBus : this.sfxBus);
    src.start();
  }

  /* ---------- ambient ---------- */
  async startAmbient(name) {
    if (!this.enabled || this._hidden || this._prefersReduced) { this.ambient.name = name; return; }
    if (this.ambient.name === name && this.ambient.src) return;
    this.stopAmbient();
    const c = this.ac();
    if (!c) return;
    const buf = await this.buffer(name);
    if (!buf) return;
    const src = c.createBufferSource();
    src.buffer = buf; src.loop = true;
    const g = c.createGain();
    g.gain.value = 0;
    src.connect(g); g.connect(this.ambBus);
    src.start();
    g.gain.setTargetAtTime(1, c.currentTime, 1.2);   // fade-in lembut
    this.ambient = { name, src, g };
  }
  stopAmbient() {
    const a = this.ambient;
    if (a.src) {
      try {
        a.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
        a.src.stop(this.ctx.currentTime + 1.2);
      } catch (e) {}
    }
    this.ambient = { name: null, src: null };
  }
}

/* ============================================================
   Synth prosedural "matte" — dipakai hanya bila asset tidak ada.
   Semua dirender SEKALI ke AudioBuffer (kontrak: decode sekali).
   ============================================================ */
const Synth = {
  SR: 44100,

  render(ctx, name) {
    const fn = this[name] || this['click-matte'];
    const spec = fn.call(this);
    const buf = ctx.createBuffer(1, Math.max(1, Math.round(spec.dur * ctx.sampleRate)), ctx.sampleRate);
    const d = buf.getChannelData(0);
    const sr = ctx.sampleRate;
    spec.fill(d, sr);
    return buf;
  },

  /* helper: envelope eksponensial lembut */
  env(t, a, d, total) {
    const at = Math.min(1, t / Math.max(0.0001, a));
    const rel = Math.exp(-Math.max(0, t - a) / Math.max(0.0001, d));
    const tail = t > total - 0.02 ? Math.max(0, (total - t) / 0.02) : 1;
    return at * rel * tail;
  },
  noiseAt(i) { return Math.random() * 2 - 1; },

  /* stateful one-pole filters */
  lp() { let y = 0; return (x, f, sr) => { const k = 1 - Math.exp(-2 * Math.PI * f / sr); y += k * (x - y); return y; }; },
  hp() { let y = 0, px = 0; return (x, f, sr) => { const k = Math.exp(-2 * Math.PI * f / sr); y = k * (y + x - px); px = x; return y; }; },
  bp() { const l = this.lp(), h = this.hp(); return (x, fl, fh, sr) => h(l(x, fh, sr), fl, sr); },

  /* ---------- UI ---------- */
  'click-matte'() {
    const dur = 0.06, lp = this.lp();
    return { dur, fill: (d, sr) => { for (let i = 0; i < d.length; i++) { const t = i / sr; const n = lp(this.noiseAt(i), 2400, sr); const th = Math.sin(2 * Math.PI * 170 * t) * 0.5; d[i] = (n * 0.55 + th) * this.env(t, 0.002, 0.02, dur) * 0.5; } } };
  },
  'hover-soft'() {
    const dur = 0.04, bp = this.bp();
    return { dur, fill: (d, sr) => { for (let i = 0; i < d.length; i++) { const t = i / sr; d[i] = bp(this.noiseAt(i), 3000, 6000, sr) * this.env(t, 0.002, 0.015, dur) * 0.10; } } };
  },
  success() {
    const dur = 0.7, notes = [523.25, 659.25, 783.99];
    return { dur, fill: (d, sr) => { for (let i = 0; i < d.length; i++) { const t = i / sr; let v = 0; notes.forEach((f, k) => { const st = k * 0.07; if (t > st) v += Math.sin(2 * Math.PI * f * (t - st)) * this.env(t - st, 0.012, 0.34, dur) * 0.22; }); d[i] = v; } } };
  },
  error() {
    const dur = 0.3;
    return { dur, fill: (d, sr) => { for (let i = 0; i < d.length; i++) { const t = i / sr; const f = t < 0.13 ? 311 : 233; const st = t < 0.13 ? 0 : 0.13; d[i] = Math.sin(2 * Math.PI * f * (t - st)) * this.env(t - st, 0.01, 0.14, dur) * 0.28; } } };
  },
  warning() {
    const dur = 0.25;
    return { dur, fill: (d, sr) => { for (let i = 0; i < d.length; i++) { const t = i / sr; d[i] = Math.sin(2 * Math.PI * 440 * t) * this.env(t, 0.015, 0.14, dur) * 0.18; } } };
  },
  'toggle-on'() {
    const dur = 0.09, bp = this.bp();
    return { dur, fill: (d, sr) => { for (let i = 0; i < d.length; i++) { const t = i / sr; const f = 1200 + 2600 * (t / dur); d[i] = (bp(this.noiseAt(i), f * 0.7, f * 1.4, sr) * 0.7 + Math.sin(2 * Math.PI * 520 * t) * 0.3) * this.env(t, 0.003, 0.03, dur) * 0.3; } } };
  },
  'toggle-off'() {
    const dur = 0.09, bp = this.bp();
    return { dur, fill: (d, sr) => { for (let i = 0; i < d.length; i++) { const t = i / sr; const f = 3400 - 2200 * (t / dur); d[i] = (bp(this.noiseAt(i), f * 0.7, f * 1.4, sr) * 0.7 + Math.sin(2 * Math.PI * 360 * t) * 0.3) * this.env(t, 0.003, 0.03, dur) * 0.3; } } };
  },

  /* ---------- Gameplay ---------- */
  'dice-roll'() {
    const dur = 0.6, bp = this.bp(); const clicks = [0.08, 0.21, 0.34, 0.47].map(x => x + Math.random() * 0.03);
    return { dur, fill: (d, sr) => { for (let i = 0; i < d.length; i++) { const t = i / sr; const f = 500 + 2200 * Math.sin(Math.PI * t / dur); let v = bp(this.noiseAt(i), f * 0.6, f * 1.5, sr) * 0.30 * Math.sin(Math.PI * t / dur); clicks.forEach(ct => { if (t > ct && t < ct + 0.03) v += this.noiseAt(i) * 0.35 * this.env(t - ct, 0.001, 0.012, 0.03); }); d[i] = v; } } };
  },
  'dice-land'() {
    const dur = 0.16, lp = this.lp();
    return { dur, fill: (d, sr) => { for (let i = 0; i < d.length; i++) { const t = i / sr; const n = lp(this.noiseAt(i), 900, sr) * 0.6; const th = Math.sin(2 * Math.PI * (120 - 40 * t) * t) * 0.7; d[i] = (n + th) * this.env(t, 0.001, 0.06, dur) * 0.5; } } };
  },
  'coin-soft'() {
    const dur = 0.28;
    return { dur, fill: (d, sr) => { for (let i = 0; i < d.length; i++) { const t = i / sr; d[i] = (Math.sin(2 * Math.PI * 1318 * t) * 0.5 + Math.sin(2 * Math.PI * 1976 * t) * 0.28 + Math.sin(2 * Math.PI * 2637 * t) * 0.12) * this.env(t, 0.004, 0.11, dur) * 0.30; } } };
  },
  'coin-out'() {
    const dur = 0.26;
    return { dur, fill: (d, sr) => { for (let i = 0; i < d.length; i++) { const t = i / sr; d[i] = (Math.sin(2 * Math.PI * 988 * t) * 0.5 + Math.sin(2 * Math.PI * 1480 * t) * 0.25) * this.env(t, 0.004, 0.10, dur) * 0.28; } } };
  },
  rent() {
    const dur = 0.4, hp = this.hp();
    return { dur, fill: (d, sr) => { for (let i = 0; i < d.length; i++) { const t = i / sr; const coin = t < 0.2 ? (Math.sin(2 * Math.PI * 1318 * t) * 0.4 + Math.sin(2 * Math.PI * 1976 * t) * 0.2) * this.env(t, 0.004, 0.1, 0.2) : 0; const paper = t > 0.12 ? hp(this.noiseAt(i), 2600, sr) * 0.22 * this.env(t - 0.12, 0.01, 0.12, 0.28) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 22 * t)) : 0; d[i] = (coin + paper) * 0.8; } } };
  },
  build() {
    const dur = 0.3, lp = this.lp(), bp = this.bp();
    return { dur, fill: (d, sr) => { for (let i = 0; i < d.length; i++) { const t = i / sr; const hammer = lp(this.noiseAt(i), 800, sr) * this.env(t, 0.001, 0.05, 0.12) * 0.7; const knock = t > 0.05 ? bp(this.noiseAt(i), 380, 700, sr) * this.env(t - 0.05, 0.002, 0.09, 0.25) * 0.6 : 0; const th = Math.sin(2 * Math.PI * 95 * t) * this.env(t, 0.001, 0.07, 0.2) * 0.5; d[i] = hammer + knock + th; } } };
  },
  mega() {
    const dur = 1.1, notes = [523.25, 659.25, 783.99, 1046.5];
    return { dur, fill: (d, sr) => { for (let i = 0; i < d.length; i++) { const t = i / sr; let v = 0; notes.forEach((f, k) => { const st = k * 0.11; if (t > st) { const e = this.env(t - st, 0.01, 0.5, dur); v += (Math.sin(2 * Math.PI * f * (t - st)) * 0.6 + Math.sin(2 * Math.PI * f * 2 * (t - st)) * 0.15) * e * 0.2; } }); d[i] = v; } } };
  },
  'trade-accept'() {
    const dur = 0.55, bp = this.bp();
    return { dur, fill: (d, sr) => { for (let i = 0; i < d.length; i++) { const t = i / sr; const swipe = bp(this.noiseAt(i), 900 + 1800 * (t / dur), 2600, sr) * 0.16 * Math.sin(Math.PI * t / dur); const n1 = t > 0.05 ? Math.sin(2 * Math.PI * 392 * (t - 0.05)) * this.env(t - 0.05, 0.01, 0.2, dur) * 0.22 : 0; const n2 = t > 0.18 ? Math.sin(2 * Math.PI * 523.25 * (t - 0.18)) * this.env(t - 0.18, 0.01, 0.26, dur) * 0.22 : 0; d[i] = swipe + n1 + n2; } } };
  },
  sabotage() {
    const dur = 0.55, hp = this.hp(), lp = this.lp();
    const shards = [0, 0.05, 0.11, 0.19, 0.28];
    return { dur, fill: (d, sr) => { for (let i = 0; i < d.length; i++) { const t = i / sr; let v = 0; shards.forEach((st, k) => { if (t > st) v += hp(this.noiseAt(i), 2200 + k * 300, sr) * this.env(t - st, 0.001, 0.06 + k * 0.02, dur) * (0.4 - k * 0.06); }); v = lp(v, 4200, sr); d[i] = v * 0.8; } } };
  },
  'weather-change'() {
    const dur = 1.2, bp = this.bp();
    return { dur, fill: (d, sr) => { for (let i = 0; i < d.length; i++) { const t = i / sr; const p = t / dur; const f = 250 + 1500 * Math.sin(Math.PI * p); d[i] = bp(this.noiseAt(i), f * 0.5, f * 1.6, sr) * Math.sin(Math.PI * p) * 0.35; } } };
  },
  inflation() {
    const dur = 0.9, lp = this.lp();
    return { dur, fill: (d, sr) => { for (let i = 0; i < d.length; i++) { const t = i / sr; const rumble = lp(this.noiseAt(i), 110, sr) * Math.sin(Math.PI * t / dur) * 0.5; const coin = t > 0.45 ? (Math.sin(2 * Math.PI * 988 * (t - 0.45)) * 0.3) * this.env(t - 0.45, 0.004, 0.12, 0.4) : 0; d[i] = rumble + coin; } } };
  },
  jail() {
    const dur = 0.9; const parts = [620, 845, 1130, 1490];
    return { dur, fill: (d, sr) => { for (let i = 0; i < d.length; i++) { const t = i / sr; let v = 0; parts.forEach((f, k) => { v += Math.sin(2 * Math.PI * f * t + k) * Math.exp(-t * (5 + k)) * 0.16; }); const echo = t > 0.22 ? parts[0] ? Math.sin(2 * Math.PI * parts[0] * (t - 0.22)) * Math.exp(-(t - 0.22) * 7) * 0.06 : 0 : 0; d[i] = v + echo; } } };
  },
  'ghost-steal'() {
    const dur = 0.8, bp = this.bp();
    return { dur, fill: (d, sr) => { for (let i = 0; i < d.length; i++) { const t = i / sr; const mod = 0.5 + 0.5 * Math.sin(2 * Math.PI * 6 * t); const wh = bp(this.noiseAt(i), 1200, 3200, sr) * mod * Math.sin(Math.PI * t / dur) * 0.22; const ch = t > 0.3 ? Math.sin(2 * Math.PI * 880 * (t - 0.3)) * this.env(t - 0.3, 0.02, 0.3, 0.5) * 0.12 : 0; d[i] = wh + ch; } } };
  },

  /* ---------- Celebration ---------- */
  'podium-reveal'() {
    const dur = 2.0; const chord = [261.63, 329.63, 392.0, 523.25];
    return { dur, fill: (d, sr) => { for (let i = 0; i < d.length; i++) { const t = i / sr; const swell = Math.min(1, t / 0.9) * Math.exp(-Math.max(0, t - 1.1) / 0.5); let v = 0; chord.forEach((f, k) => { v += (Math.sin(2 * Math.PI * f * t) * 0.5 + Math.sin(2 * Math.PI * f * 1.005 * t) * 0.25) * (0.5 + 0.5 * Math.min(1, t / (0.3 + k * 0.18))); }); d[i] = v * swell * 0.10; } } };
  },
  confetti() {
    const dur = 0.7; const sp = [];
    for (let k = 0; k < 9; k++) sp.push([0.02 + k * 0.06 + Math.random() * 0.03, 1500 + Math.random() * 2200]);
    return { dur, fill: (d, sr) => { for (let i = 0; i < d.length; i++) { const t = i / sr; let v = 0; sp.forEach(([st, f]) => { if (t > st) v += Math.sin(2 * Math.PI * f * (t - st)) * this.env(t - st, 0.002, 0.07, 0.2) * 0.10; }); d[i] = v; } } };
  },

  /* ---------- Ambient (loop seamless: siklus integer per durasi) ---------- */
  _pad(dur, freqs, lfoHz, level) {
    return { dur, fill: (d, sr) => {
      const cycles = freqs.map(f => Math.round(f * dur));
      const lfoC = Math.round(lfoHz * dur);
      for (let i = 0; i < d.length; i++) {
        const t = i / sr;
        let v = 0;
        for (let k = 0; k < freqs.length; k++) {
          const ph = 2 * Math.PI * cycles[k] * (t / dur);
          v += Math.sin(ph + k * 1.7) * (0.6 + 0.4 * Math.sin(2 * Math.PI * lfoC * (t / dur) + k));
        }
        d[i] = v * level / freqs.length;
      }
    } };
  },
  'ambient-lobby'() { return this._pad(8, [130.81, 196.0, 261.63, 329.63], 0.125, 0.16); },
  'ambient-game'()  { return this._pad(8, [110.0, 164.81, 220.0, 277.18], 0.25, 0.13); }
};

/* ============================================================
   Sound — THIN WRAPPER (nama method v1.1 dipertahankan)
   ============================================================ */
const Sound = {
  manager: new AudioManager(),
  get enabled() { return this.manager.enabled; },
  set enabled(v) { this.manager.setMuted(!v); },
  click()    { this.manager.play('click-matte'); },
  hover()    { this.manager.play('hover-soft', { vol: 0.5 }); },
  err()      { this.manager.play('error'); },
  warn()     { this.manager.play('warning'); },
  toggle(on) { this.manager.play(on ? 'toggle-on' : 'toggle-off'); },
  ok()       { this.manager.play('success'); },
  dice()     { this.manager.play('dice-roll', { duck: true }); },
  diceLand() { this.manager.play('dice-land'); },
  coin()     { this.manager.play('coin-soft'); },
  coinOut()  { this.manager.play('coin-out'); },
  rent()     { this.manager.play('rent'); },
  build()    { this.manager.play('build'); },
  mega()     { this.manager.play('mega'); },
  trade()    { this.manager.play('trade-accept'); },
  sabotage() { this.manager.play('sabotage', { duck: true }); },
  weather()  { this.manager.play('weather-change'); },
  inflation(){ this.manager.play('inflation'); },
  jail()     { this.manager.play('jail'); },
  ghost()    { this.manager.play('ghost-steal'); },
  podium()   { this.manager.play('podium-reveal', { duck: true }); },
  confetti() { this.manager.play('confetti'); },
  start()    { this.manager.play('success'); },
  win()      { this.manager.play('podium-reveal', { duck: true }); },
  ambient(name) { this.manager.startAmbient(name); },
  stopAmbient() { this.manager.stopAmbient(); }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AudioManager, Synth, Sound, AUDIO_MANIFEST };
}

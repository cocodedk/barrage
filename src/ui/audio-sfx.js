// The synth patches. Each takes { ctx, out, noise, t } and options, and schedules its nodes.

function env(a, t, peak, attack, decay) {
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  g.connect(a.out);
  return g;
}

function tone(a, type, f0, f1, t, dur, peak, attack = 0.005) {
  const o = a.ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  o.connect(env(a, t, peak, attack, dur));
  o.start(t);
  o.stop(t + attack + dur + 0.05);
}

function hiss(a, t, dur, peak, type, f0, f1, q = 1, attack = 0.005) {
  const s = a.ctx.createBufferSource();
  s.buffer = a.noise;
  s.loop = true;
  const f = a.ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  s.connect(f).connect(env(a, t, peak, attack, dur));
  s.start(t, (t * 7.3) % 0.9);
  s.stop(t + attack + dur + 0.05);
}

export const SFX = {
  fire(a) { // rocket whoosh over a soft thump
    hiss(a, a.t, 0.45, 0.5, 'bandpass', 600, 2400, 1.2, 0.02);
    tone(a, 'sine', 160, 50, a.t, 0.18, 0.7);
  },
  shot(a) {
    hiss(a, a.t, 0.18, 0.9, 'lowpass', 5000, 400, 0.7);
    tone(a, 'square', 140, 40, a.t, 0.08, 0.35);
  },
  drop(a) {
    tone(a, 'triangle', 520, 180, a.t, 0.25, 0.3);
  },
  explosion(a, { r = 40 }) { // noise burst + low thump, both bigger with the radius
    const k = Math.min(1.8, r / 40);
    hiss(a, a.t, 0.4 + 0.5 * k, Math.min(1, 0.45 + 0.3 * k), 'lowpass', 3000 + 2000 * k, 120, 0.8);
    tone(a, 'sine', 110 - 25 * Math.min(1, k), 28, a.t, 0.35 + 0.45 * k, Math.min(1, 0.6 + 0.3 * k));
  },
  bounce(a) {
    tone(a, 'triangle', 900, 600, a.t, 0.04, 0.18);
  },
  splash(a) {
    hiss(a, a.t, 0.55, 0.45, 'bandpass', 1800, 300, 0.9, 0.01);
    tone(a, 'sine', 320, 900, a.t + 0.02, 0.12, 0.12);
  },
  jump(a) {
    tone(a, 'square', 260, 620, a.t, 0.12, 0.12);
  },
  land(a, { impact = 8 }) {
    tone(a, 'sine', 140, 60, a.t, 0.1, Math.min(0.5, 0.1 + impact / 60));
  },
  turn(a) { // two-note chime
    tone(a, 'sine', 880, 880, a.t, 0.35, 0.22);
    tone(a, 'sine', 1320, 1320, a.t + 0.11, 0.45, 0.2);
  },
  death(a) {
    tone(a, 'sawtooth', 420, 70, a.t, 0.6, 0.22);
  },
  win(a) { // short major fanfare
    [523, 659, 784, 1047].forEach((f, i) => tone(a, 'triangle', f, f, a.t + i * 0.13, 0.32, 0.3));
    tone(a, 'sine', 1047, 1047, a.t + 0.52, 0.9, 0.25);
    tone(a, 'triangle', 1319, 1319, a.t + 0.52, 0.9, 0.18);
  },
  lose(a) {
    [392, 330, 262].forEach((f, i) => tone(a, 'triangle', f, f * 0.98, a.t + i * 0.2, 0.4, 0.26));
  },
  menu(a) {
    tone(a, 'sine', 660, 990, a.t, 0.06, 0.15);
  },
  select(a) {
    tone(a, 'triangle', 520, 1040, a.t, 0.14, 0.25);
  },
  denied(a) {
    tone(a, 'square', 180, 120, a.t, 0.16, 0.12);
  },
};

// Sound, synthesized with WebAudio: no files. The context is created on the first user gesture
// (browsers refuse to start audio before one); until then every sound is silently skipped.
import { isMuted, setMuted } from './storage.js';
import { SFX } from './audio-sfx.js';

let ctx = null;
let master = null;
let noiseBuf = null;
let muted = isMuted();
const last = {}; // sound name -> ctx time, to thin out bursts (bounce storms, cluster blasts)
const GAP = { bounce: 0.06, land: 0.08, explosion: 0.03, menu: 0.03 };

// Call from a keydown / pointerdown handler.
export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.7;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp).connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      let s = 1;
      for (let i = 0; i < d.length; i++) {
        s = (s * 16807) % 2147483647; // deterministic white noise; no Math.random needed
        d[i] = (s / 2147483647) * 2 - 1;
      }
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch {
    ctx = null; // no audio on this machine; the game plays on in silence
  }
}

export function toggleMute() {
  muted = !muted;
  setMuted(muted);
  if (master) master.gain.setTargetAtTime(muted ? 0 : 0.7, ctx.currentTime, 0.02);
  return muted;
}

// play('explosion', { r: 40 }) and friends; see audio-sfx.js for the names.
export function play(name, opts = {}) {
  if (!ctx || muted || ctx.state !== 'running' || !SFX[name]) return;
  const now = ctx.currentTime;
  if (GAP[name] && now - (last[name] ?? -1) < GAP[name]) return;
  last[name] = now;
  try {
    SFX[name]({ ctx, out: master, noise: noiseBuf, t: now }, opts);
  } catch {
    // a sound that fails to build is not worth a crash
  }
}

// The sounds a core event makes ('win' is left to the caller: fanfare or not depends on who won).
export function soundForEvent(ev) {
  switch (ev.type) {
    case 'fire': return play(ev.weapon === 'shotgun' ? 'shot' : ev.weapon === 'dynamite' || ev.weapon === 'airstrike' ? 'drop' : 'fire');
    case 'explosion': return play('explosion', { r: ev.r });
    case 'bounce': return play('bounce');
    case 'splash': return play('splash');
    case 'jump': return play('jump');
    case 'land': return play('land', { impact: ev.impact });
    case 'turn': return play('turn');
    case 'death': return play('death');
    default: return undefined;
  }
}

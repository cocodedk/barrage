// Effect state. Everything a renderer draws on top of the world lives on one `fx` object:
//   particles [see particles.js]
//   rings     shockwaves   { x, y, r, maxR, life, max, color }
//   flashes   glow flashes { x, y, r, life, max }
//   floaters  floating text { x, y, vy, text, color, life, max }
//   graves    gravestones { x, y } (permanent)
//   shake     screen-shake amplitude in px; shakeX/shakeY the offset to apply this frame
//   timeScale 1, or SLOWMO_SCALE during slow motion: the main loop multiplies logic dt by it
// stepFx takes real frame time. Particles and rings follow timeScale so slow motion shows.
import { stepParticles } from './particles.js';

export const SLOWMO_SCALE = 0.3;
export const SLOWMO_TIME = 1; // real seconds
const SHAKE_DECAY = 5; // exp rate per second
const SHAKE_MIN = 0.1; // px, below this the shake snaps to 0

export function createFx() {
  return {
    particles: [], rings: [], flashes: [], floaters: [], graves: [],
    shake: 0, shakeX: 0, shakeY: 0, timeScale: 1, slowLeft: 0, time: 0,
  };
}

export function startSlowMo(fx) {
  fx.slowLeft = SLOWMO_TIME;
  fx.timeScale = SLOWMO_SCALE;
}

export function addShake(fx, amount) {
  fx.shake = Math.max(fx.shake, amount);
}

function stepTimed(list, dt, onStep) {
  let n = 0;
  for (const e of list) {
    e.life -= dt;
    if (e.life <= 0) continue;
    onStep(e, dt);
    list[n++] = e;
  }
  list.length = n;
}

// terrain (optional) lets bouncing particles hit the ground: anything with solid(x, y).
export function stepFx(fx, dt, terrain) {
  fx.time += dt;
  fx.slowLeft = Math.max(0, fx.slowLeft - dt);
  fx.timeScale = fx.slowLeft > 0 ? SLOWMO_SCALE : 1;
  const sdt = dt * fx.timeScale;

  stepParticles(fx.particles, sdt, terrain);
  stepTimed(fx.rings, sdt, (r) => {
    const t = 1 - r.life / r.max;
    r.r = r.maxR * (1 - (1 - t) * (1 - t)); // ease-out
  });
  stepTimed(fx.flashes, sdt, () => {});
  stepTimed(fx.floaters, sdt, (f, d) => { f.y += f.vy * d; });

  fx.shake = fx.shake * Math.exp(-SHAKE_DECAY * dt);
  if (fx.shake < SHAKE_MIN) fx.shake = 0;
  fx.shakeX = fx.shake ? fx.shake * Math.sin(fx.time * 71) : 0;
  fx.shakeY = fx.shake ? fx.shake * Math.cos(fx.time * 53) : 0;
}

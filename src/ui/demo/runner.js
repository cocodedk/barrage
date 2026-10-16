// The demo's step machine, DOM-free. Per step: 'show' (the script plays) -> 'try' (the player
// does it, until the step's check passes) -> 'done' (a beat to enjoy it) -> the next step.
// Watch-only steps go from 'show' straight to the next one; the last step is 'final' and stays.
// pilotFor() plugs a runner into a match: game.js asks it for each tick's intents and calls
// after() once the world has stepped, with that tick's events still in world.events.
import { humanIntents } from '../controls.js';
import { tidy, calm, holdTurn } from './scene.js';

const TRY_BEAT = 0.6; // s of calm after a show before the player's turn
const WATCH_BEAT = 1.2; // s of calm after a watch-only show before the next step
const DONE_BEAT = 1.4; // s of calm after the player did it
const LIT = { left: '←', right: '→', aimUp: '↑', aimDown: '↓', jump: 'Enter', charge: 'Space', release: 'Space' };

// fx (optional): the match's effects, so a revived soldier's grave can be cleared.
export function createRunner(steps, fx = null) {
  return { steps, fx, i: 0, phase: 'show', t: 0, wait: 0, ended: false, state: {}, lit: [] };
}

export function startStep(r, world, i) {
  const step = r.steps[i];
  Object.assign(r, { i, phase: step.final ? 'final' : 'show', t: 0, wait: 0, ended: false, state: {}, lit: [] });
  tidy(world, r.fx);
  step.setup?.(world, r.state);
}

export const replay = (r, world) => startStep(r, world, r.i);
export const skip = (r, world) => startStep(r, world, Math.min(r.i + 1, r.steps.length - 1));

const litOf = (out) => [...Object.keys(LIT).filter((k) => out[k]).map((k) => LIT[k]), ...(out.press ? [out.press] : [])];

// This tick's intents: the script's while showing, the player's (from `player()`) while trying.
export function runnerIntents(r, world, dt, player) {
  r.lit = [];
  if (r.phase === 'try') return player();
  if (r.phase !== 'show' || r.ended) return {};
  const out = r.steps[r.i].show?.(r.t, world, r.state) ?? null;
  r.t += dt;
  if (!out) {
    r.ended = true;
    return {};
  }
  r.lit = [...new Set(litOf(out))];
  return out;
}

// After the world stepped: keep the turn on the player, check the try, advance when it is time.
export function afterTick(r, world, events, dt) {
  const step = r.steps[r.i];
  holdTurn(world, !!step.clock && r.phase === 'show', r.fx);
  r.wait = calm(world) ? r.wait + dt : 0;
  if (r.phase === 'show' && r.ended) {
    if (r.wait < (step.check ? TRY_BEAT : WATCH_BEAT)) return;
    if (!step.check) return skip(r, world);
    Object.assign(r, { phase: 'try', state: {}, wait: 0 });
    step.ready?.(world, r.state);
  } else if (r.phase === 'try' && step.check(world, events, r.state)) {
    Object.assign(r, { phase: 'done', wait: 0 });
  } else if (r.phase === 'done' && r.wait >= DONE_BEAT) skip(r, world);
}

// The airstrike marker the show is sliding, where the renderer draws it.
const markerAt = (world, x) => ({ x, y: world.terrain.surfaceY(Math.round(x)) });

// player(m, input, dt) gives the try-phase intents; the default reads the keyboard and mouse.
export function pilotFor(r, player = (m, input, dt) => humanIntents(m.controls, input, m.world, m.view, m.cam, dt)) {
  return {
    runner: r,
    intents(m, input, dt) {
      if (r.phase !== 'try') m.controls.armed = false; // a Space held into the next try needs a fresh press
      const out = runnerIntents(r, m.world, dt, () => (input ? player(m, input, dt) : {}));
      if (r.phase !== 'try') m.view.cursor = out.marker != null ? markerAt(m.world, out.marker) : null;
      return out;
    },
    after: (m, dt) => afterTick(r, m.world, m.world.events, dt),
  };
}

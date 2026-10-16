// Fixtures for the computer-opponent tests: a flat duel and a driver that plays a plan for real.
import { makeRng } from '../../src/core/rng.js';
import { stepWorld } from '../../src/core/world.js';
import { aiIntents } from '../../src/core/ai.js';
import { bodyCentre } from '../../src/core/explode.js';
import { flatWorld, DT } from './helpers.js';

export const SHOOTER = { x: 1500 };

// Team 1 (the computer, `skill`) on the right, its soldier 0 active; one live enemy `dist` px
// to the left. Everyone else is dead, so the tests see one clean target.
export function duel(skill, dist = 600, over = {}) {
  const w = flatWorld(over);
  w.teams[1].ai = { skill };
  w.turn.team = 1;
  w.turn.unit = 0;
  w.turn.phase = 'aim';
  w.teams.forEach((t) => t.units.forEach((u, i) => (u.alive = i === 0)));
  Object.assign(w.teams[1].units[0], { x: SHOOTER.x, facing: -1 });
  w.teams[0].units[0].x = SHOOTER.x - dist;
  return w;
}

export const enemyOf = (w) => w.teams[0].units[0];

// Play `plan` through aiIntents until something blows up; returns the first explosion event.
export function playPlan(w, plan, rng = makeRng(5), maxSeconds = 25) {
  for (let i = 0, t = 0; t < maxSeconds; i++, t += DT) {
    const hit = w.events.find((e) => e.type === 'explosion');
    if (hit) return hit;
    stepWorld(w, DT, aiIntents(plan, t, w), rng);
  }
  return null;
}

export const distTo = (e, u) => Math.hypot(e.x - bodyCentre(u).x, e.y - bodyCentre(u).y);

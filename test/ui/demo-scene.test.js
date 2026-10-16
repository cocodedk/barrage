import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../../src/core/levels.js';
import { createWorld, stepWorld } from '../../src/core/world.js';
import { makeRng } from '../../src/core/rng.js';
import { createFx } from '../../src/fx/fx.js';
import { applyEvent } from '../../src/fx/react.js';
import { STEPS } from '../../src/ui/demo/script.js';
import { createRunner, startStep } from '../../src/ui/demo/runner.js';
import { DEMO_SEED, HOME, hero, arrange, place, holdTurn } from '../../src/ui/demo/scene.js';
import { DT } from '../core/helpers.js';

// A demo world where the last step went badly: one enemy hurt, one dead (with a grave), the hero
// walked far off. Effects are fed the tick's events the way game.js drains them.
function battered() {
  const w = createWorld(LEVELS[0], 'versus', makeRng(DEMO_SEED));
  const fx = createFx();
  const rng = makeRng(2);
  arrange(w);
  const [hurt, dead] = w.teams[1].units;
  hurt.hp = 30;
  dead.hp = 0;
  place(w, hero(w), 1000);
  w.events.length = 0;
  stepWorld(w, DT, {}, rng);
  for (const ev of w.events) applyEvent(fx, ev, rng, w.level, w);
  w.events.length = 0;
  return { w, fx, hurt, dead };
}

test('each step starts with every soldier alive at full health, the hero home, no stray graves', () => {
  const { w, fx, dead } = battered();
  assert.equal(dead.alive, false);
  assert.equal(fx.graves.length, 1);
  const r = createRunner(STEPS, fx);
  startStep(r, w, 5);
  for (const t of w.teams) for (const u of t.units) assert.deepEqual([u.alive, u.hp], [true, 100], `unit ${u.id}`);
  assert.equal(hero(w).x, HOME[0][0]);
  assert.equal(fx.graves.length, 0);
  assert.deepEqual([w.turn.team, w.turn.phase, w.turn.shotsFired], [0, 'aim', 0]);
});

test('holdTurn puts a fallen hero back on his feet and takes away his grave', () => {
  const w = createWorld(LEVELS[0], 'versus', makeRng(DEMO_SEED));
  const fx = createFx();
  arrange(w);
  const u = hero(w);
  Object.assign(u, { alive: false, hp: 0 });
  fx.graves.push({ x: u.x, y: u.y }, { x: 1500, y: 700 });
  holdTurn(w, false, fx);
  assert.deepEqual([u.alive, u.hp, u.x], [true, 100, HOME[0][0]]);
  assert.deepEqual(fx.graves, [{ x: 1500, y: 700 }]); // someone else's grave stays
});

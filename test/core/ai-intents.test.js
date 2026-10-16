import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { makeRng } from '../../src/core/rng.js';
import { LEVELS } from '../../src/core/levels.js';
import { createWorld, stepWorld } from '../../src/core/world.js';
import { TURN_TIME } from '../../src/core/turns.js';
import { aiPlan, aiIntents, aiTick, createAi } from '../../src/core/ai.js';
import { duel } from './ai-helpers.js';
import { DT } from './helpers.js';

test('a human-followable sequence: think, then aim, then charge, then release', () => {
  const w = duel(1, 600);
  const plan = aiPlan(w, makeRng(1));
  const log = [];
  for (let i = 0; i < 60 * 12 && w.turn.phase === 'aim'; i++) {
    const intents = aiIntents(plan, i * DT, w);
    log.push({ t: i * DT, ...intents });
    stepWorld(w, DT, intents, makeRng(1));
  }
  const first = log.find((l) => Object.keys(l).length > 1);
  assert.ok(first.t >= 0.6 - 1e-9, `acted at ${first.t}`);
  const idx = (key) => log.findIndex((l) => l[key]);
  assert.ok(idx('aimUp') >= 0 || idx('aimDown') >= 0, 'rotated the aim');
  assert.ok(idx('charge') > Math.min(...[idx('aimUp'), idx('aimDown')].filter((i) => i >= 0)), 'charged after aiming');
  assert.ok(idx('release') > idx('charge'), 'released after charging');
  assert.equal(w.turn.phase !== 'aim', true, 'the shot left');
  assert.ok(Math.abs(w.turn.power - plan.power) < 0.02, `power ${w.turn.power} vs ${plan.power}`);
});

test('never idles past the turn timer, whatever the plan', () => {
  const w = duel(0.5, 700);
  const plan = aiPlan(w, makeRng(2));
  let t = 0;
  while (w.turn.phase === 'aim' && t < TURN_TIME) {
    stepWorld(w, DT, aiIntents(plan, t, w), makeRng(1));
    t += DT;
  }
  assert.ok(t < 10, `took ${t.toFixed(1)} s`);
  assert.equal(w.turn.shotsFired, 1);
});

test('only plays during aim, and walks away from dynamite in retreat', () => {
  const w = duel(1, 40);
  const plan = aiPlan(w, makeRng(1));
  w.turn.phase = 'flying';
  assert.deepEqual(aiIntents(plan, 5, w), {});
  w.turn.phase = 'retreat';
  assert.deepEqual(aiIntents(plan, 5, w), { right: true });
  assert.deepEqual(aiIntents({ ...plan, retreat: undefined }, 5, w), {});
});

// Whole matches, computer against computer, on every level: plans must stay legal, finish
// turns and never throw; each plan must come back inside 50 ms.
test('computer vs computer plays turns to a result on every level', () => {
  let slowest = 0;
  let finished = 0;
  for (const level of LEVELS) {
    const w = createWorld({ ...level, aiSkill: 0.8 }, 'campaign', makeRng(level.name.length));
    w.teams[0].ai = { skill: 0.8 };
    const rng = makeRng(3);
    const ai = createAi();
    for (let tick = 0; tick < 60 * 60 * 15 && w.turn.phase !== 'over'; tick++) {
      const t0 = performance.now();
      const intents = aiTick(ai, w, DT, rng);
      if (ai.elapsed === DT) slowest = Math.max(slowest, performance.now() - t0); // the tick that planned
      stepWorld(w, DT, intents, rng);
      w.events.length = 0;
    }
    finished += w.turn.phase === 'over' ? 1 : 0;
  }
  assert.ok(finished >= LEVELS.length * 0.6, `only ${finished} matches finished`);
  assert.ok(slowest < 50, `slowest plan ${slowest.toFixed(1)} ms`);
});

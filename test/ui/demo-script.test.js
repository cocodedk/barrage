import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../../src/core/levels.js';
import { createWorld, stepWorld } from '../../src/core/world.js';
import { makeRng } from '../../src/core/rng.js';
import { STEPS } from '../../src/ui/demo/script.js';
import { createRunner, startStep, runnerIntents, afterTick } from '../../src/ui/demo/runner.js';
import { DEMO_SEED, hero, arrange, place } from '../../src/ui/demo/scene.js';
import { DT } from '../core/helpers.js';

const demoWorld = () => createWorld(LEVELS[0], 'versus', makeRng(DEMO_SEED));

// What "the player did it" looks like for each try step: a change to the world and/or events.
const DID_IT = {
  walk: (w) => { hero(w).x += 50; return []; },
  jump: (w) => [{ type: 'jump', unit: hero(w).id }],
  aim: (w) => { hero(w).aim += 0.4; return []; },
  fire: () => [{ type: 'fire', weapon: 'bazooka', x: 0, y: 0 }],
  weapons: (w) => { w.turn.weapon = 'grenade'; return []; },
  grenade: () => [{ type: 'fire', weapon: 'grenade', x: 0, y: 0 }],
  airstrike: () => [{ type: 'fire', weapon: 'airstrike', x: 0, y: 0 }],
};

test('the script has 13 steps and ends on the final card', () => {
  assert.equal(STEPS.length, 13);
  assert.ok(STEPS.at(-1).final);
  for (const s of STEPS) assert.ok(s.title && s.watch, s.id);
});

test('every try step passes when the player did it and fails when idle', () => {
  const tries = STEPS.filter((s) => s.check);
  assert.deepEqual(tries.map((s) => s.id).toSorted(), Object.keys(DID_IT).toSorted());
  for (const step of tries) {
    const w = demoWorld();
    const r = createRunner(STEPS);
    startStep(r, w, STEPS.indexOf(step));
    const state = {};
    step.ready?.(w, state);
    assert.equal(step.check(w, [], state), false, `${step.id} idle`);
    assert.equal(step.check(w, DID_IT[step.id](w), state), true, `${step.id} done`);
  }
});

// The whole demo, headless: the "player" in each try plays that step's own show again.
function playThrough() {
  const w = demoWorld();
  const r = createRunner(STEPS);
  const rng = makeRng(DEMO_SEED);
  const log = [];
  let tryT = 0;
  let tryState = {};
  const player = () => {
    const out = STEPS[r.i].show?.(tryT, w, tryState) ?? null;
    tryT += DT;
    return out || {};
  };
  startStep(r, w, 0);
  for (let n = 0; n < 60 * 240 && r.phase !== 'final'; n++) {
    const was = r.phase;
    const out = runnerIntents(r, w, DT, player);
    stepWorld(w, DT, out, rng);
    for (const e of w.events) log.push({ step: STEPS[r.i].id, ...e });
    afterTick(r, w, w.events, DT);
    w.events.length = 0;
    if (r.phase === 'try' && was !== 'try') [tryT, tryState] = [0, {}];
    assert.equal(w.turn.team, 0);
    assert.equal(w.winner, null);
  }
  return { w, r, log };
}

test('a scripted player gets through the whole demo to the final card', () => {
  const { r, log } = playThrough();
  assert.deepEqual([r.i, r.phase], [STEPS.length - 1, 'final']);
  const fires = (id) => log.filter((e) => e.step === id && e.type === 'fire').map((e) => e.weapon);
  assert.deepEqual(fires('fire'), ['bazooka', 'bazooka']); // the show, then the player
  assert.deepEqual(fires('grenade'), ['grenade', 'grenade']);
  assert.deepEqual(fires('airstrike'), ['airstrike', 'airstrike']);
  assert.ok(log.some((e) => e.step === 'blast' && e.type === 'damage' && e.unit >= 3), 'the blast hurts an enemy');
  const drowned = log.find((e) => e.step === 'hazards' && e.type === 'death');
  assert.ok(drowned && drowned.y >= LEVELS[0].liquid.y, 'the hazards show drops a soldier in the water');
});

test('the hazards show drops the soldier on the lip in the water wherever the hero stands', () => {
  const at = STEPS.findIndex((s) => s.id === 'hazards');
  for (const x of [200, 400, 500, 650, 800, 1000]) {
    const w = demoWorld();
    arrange(w);
    place(w, hero(w), x);
    for (const cx of [1100, 1180, 1260]) w.terrain.carve(cx, w.terrain.surfaceY(cx), 40); // earlier shows' craters
    const r = createRunner(STEPS);
    const rng = makeRng(3);
    startStep(r, w, at);
    let drowned = false;
    for (let n = 0; n < 60 * 15 && r.i === at; n++) {
      stepWorld(w, DT, runnerIntents(r, w, DT, () => ({})), rng);
      drowned ||= w.events.some((e) => e.type === 'death' && e.y >= w.liquidY);
      afterTick(r, w, w.events, DT);
      w.events.length = 0;
    }
    assert.ok(drowned, `hero at ${x}`);
  }
});

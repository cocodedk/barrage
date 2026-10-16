import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepWorld } from '../../src/core/world.js';
import { makeRng } from '../../src/core/rng.js';
import { createRunner, startStep, skip, replay, runnerIntents, afterTick, pilotFor } from '../../src/ui/demo/runner.js';
import { createControls } from '../../src/ui/controls.js';
import { newInputState, endTick } from '../../src/ui/input.js';
import { hero } from '../../src/ui/demo/scene.js';
import { flatWorld, DT } from '../core/helpers.js';

// A tiny two-step script: walk right for 0.2 s, then the player must walk 40 px; then the end.
const MINI = [
  {
    id: 'walk', show: (t) => (t < 0.2 ? { right: true } : null),
    ready: (world, s) => { s.x = hero(world).x; },
    check: (world, events, s) => hero(world).x - s.x >= 40,
  },
  { id: 'end', final: true },
];

function rig(steps = MINI, player = () => ({})) {
  const w = flatWorld();
  const r = createRunner(steps);
  const rng = makeRng(5);
  startStep(r, w, 0);
  const tick = (n = 1) => {
    for (let i = 0; i < n; i++) {
      const out = runnerIntents(r, w, DT, player);
      stepWorld(w, DT, out, rng);
      afterTick(r, w, w.events, DT);
      w.events.length = 0;
    }
  };
  return { w, r, tick };
}

test('the runner shows, waits for calm, hands over to the player, then moves on', () => {
  let walking = false;
  const { w, r, tick } = rig(MINI, () => (walking ? { right: true } : {}));
  assert.deepEqual([r.i, r.phase], [0, 'show']);
  tick(5);
  assert.deepEqual(r.lit, ['→']); // the key being "pressed" lights up
  tick(60);
  assert.equal(r.phase, 'try');
  tick(60);
  assert.equal(r.phase, 'try'); // idle player: still waiting
  walking = true;
  tick(60);
  assert.equal(r.phase, 'done');
  walking = false;
  tick(150);
  assert.deepEqual([r.i, r.phase], [1, 'final']);
  assert.equal(w.turn.team, 0);
});

test('skip jumps to the next step and stops at the last; replay restarts the show', () => {
  const { r, w, tick } = rig();
  tick(90);
  assert.equal(r.phase, 'try');
  replay(r, w);
  assert.deepEqual([r.i, r.phase, r.t], [0, 'show', 0]);
  skip(r, w);
  assert.deepEqual([r.i, r.phase], [1, 'final']);
  skip(r, w);
  assert.equal(r.i, 1);
});

test('a watch-only step advances by itself once the show is over', () => {
  const steps = [{ id: 'look', show: (t) => (t < 0.5 ? {} : null) }, MINI[1]];
  const { r, tick } = rig(steps);
  tick(30);
  assert.equal(r.phase, 'show');
  tick(200);
  assert.deepEqual([r.i, r.phase], [1, 'final']);
});

test('the turn stays with the player: a shot that lands hands back a fresh aim phase', () => {
  const steps = [{ id: 'shoot', show: (t) => (t < 0.3 ? { charge: true } : t < 0.32 ? { release: true } : null) }, MINI[1]];
  const { r, w, tick } = rig(steps);
  let sawFlight = false;
  for (let i = 0; i < 600 && r.i === 0; i++) {
    tick();
    sawFlight ||= w.turn.phase !== 'aim';
    assert.deepEqual([w.turn.team, w.turn.unit], [0, 0]);
  }
  assert.ok(sawFlight);
  assert.equal(r.i, 1);
  assert.deepEqual([w.turn.phase, w.turn.shotsFired, w.winner], ['aim', 0, null]);
});

test('Space held through a skip does not charge in the next try without a fresh press', () => {
  const tryStep = { id: 'try', show: () => null, check: () => false };
  const w = flatWorld();
  const r = createRunner([tryStep, tryStep]);
  const m = { world: w, controls: createControls(), view: { cursor: null }, cam: null };
  const pilot = pilotFor(r);
  const input = newInputState();
  const rng = makeRng(5);
  const tick = (n) => {
    for (let i = 0; i < n; i++) {
      const out = pilot.intents(m, input, DT);
      endTick(input);
      stepWorld(w, DT, out, rng);
      pilot.after(m, DT);
      w.events.length = 0;
    }
  };
  startStep(r, w, 0);
  tick(60);
  assert.equal(r.phase, 'try');
  input.down.add('Space');
  input.pressed.add('Space');
  tick(20);
  assert.ok(w.turn.charging);
  skip(r, w); // Tab mid-charge
  tick(60);
  assert.deepEqual([r.i, r.phase], [1, 'try']);
  assert.deepEqual([w.turn.charging, w.turn.power], [false, 0]);
});

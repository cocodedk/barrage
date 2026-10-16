// A stray terrain pixel touching a soldier's side or shoulder must never leave him hovering:
// the landing test and the "still on the ground" test have to agree.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unitAtRest } from '../../src/core/units.js';
import { flatWorld, setFloor, hero, run, DT } from './helpers.js';

const FLOOR = 560; // near enough below the speck to drop without fall damage

// Empty sky, a floor at y = 560 and one speck at (94, 487); the hero falls from (100.5, 470).
function speckWorld() {
  const w = flatWorld();
  setFloor(w, FLOOR);
  w.terrain.mask[487 * w.terrain.w + 94] = 1;
  for (const team of w.teams) for (const u of team.units) Object.assign(u, { y: FLOOR - 1, peakY: FLOOR - 1 });
  const u = hero(w);
  Object.assign(u, { x: 100.5, y: 470, peakY: 470, vx: 0, vy: 0, onGround: false });
  return { w, u };
}

test('a soldier brushing a single stray pixel does not hang in the air', () => {
  const { w, u } = speckWorld();
  let hung = 0; // seconds not at rest since he last got anywhere (the hover flickers to rest every few ticks)
  let anchor = { x: u.x, y: u.y };
  for (let i = 0; i < 180; i++) {
    run(w, DT);
    if (Math.hypot(u.x - anchor.x, u.y - anchor.y) > 2) {
      anchor = { x: u.x, y: u.y };
      hung = 0;
    } else if (!unitAtRest(u)) hung += DT;
    assert.ok(hung < 0.5, `hung in the air at y ${u.y} (onGround ${u.onGround}, vy ${u.vy})`);
  }
  assert.ok(unitAtRest(u), `at rest (onGround ${u.onGround}, vy ${u.vy})`);
  assert.ok(u.y === FLOOR - 1 || u.y < FLOOR - 40, `fell to the floor or stands on the speck (y ${u.y})`);
});

test('wherever he settles beside the speck, he can turn, walk and jump', () => {
  const { w, u } = speckWorld();
  run(w, 2);
  assert.ok(unitAtRest(u));
  run(w, DT, { left: true });
  assert.equal(u.facing, -1, 'turned to face left');
  const x0 = u.x;
  run(w, 1, { left: true });
  assert.ok(u.x < x0 - 30, `walked left (x ${x0} -> ${u.x})`);
  assert.equal(u.y, FLOOR - 1, 'and ended on the floor');
  run(w, DT, { jump: true });
  assert.equal(u.onGround, false, 'jumped');
  run(w, 2);
  assert.ok(unitAtRest(u) && u.y === FLOOR - 1, 'came back down');
});

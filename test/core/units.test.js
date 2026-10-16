import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explode } from '../../src/core/explode.js';
import { flatWorld, run, eventsOf, GROUND } from './helpers.js';

const hero = (w) => w.teams[0].units[0];
const W = 1920;

// A ramp of `rise` px per px from x0 to x1, standing on the flat ground.
function slope(world, x0, x1, rise) {
  for (let x = x0; x < x1; x++) {
    const top = GROUND - Math.round((x - x0) * rise);
    for (let y = top; y < GROUND; y++) world.terrain.mask[y * W + x] = 1;
  }
}

function drop(w, from) {
  const u = hero(w);
  u.y = GROUND - 1 - from;
  u.peakY = u.y;
  u.onGround = false;
  return u;
}

test('a soldier standing on flat ground stays put', () => {
  const w = flatWorld();
  run(w, 2);
  assert.equal(hero(w).y, GROUND - 1);
  assert.equal(hero(w).x, 300);
  assert.equal(hero(w).onGround, true);
});

test('walking moves at about 90 px/s and turns to face the way he goes', () => {
  const w = flatWorld();
  run(w, 1, { left: true });
  assert.ok(Math.abs(hero(w).x - (300 - 90)) < 8, `x ${hero(w).x}`);
  assert.equal(hero(w).facing, -1);
});

test('walking up a 1:1 slope works', () => {
  const w = flatWorld();
  slope(w, 400, 700, 1);
  hero(w).x = 380;
  run(w, 2.5, { right: true });
  assert.ok(hero(w).x > 560, `x ${hero(w).x}`);
  assert.ok(hero(w).y < GROUND - 150, `y ${hero(w).y}`);
  assert.equal(hero(w).onGround, true);
});

test('a 2:1 wall blocks', () => {
  const w = flatWorld();
  slope(w, 400, 700, 2);
  hero(w).x = 380;
  run(w, 3, { right: true });
  assert.ok(hero(w).x < 410, `x ${hero(w).x}`);
  assert.equal(hero(w).y, GROUND - 1);
});

test('a vertical wall stops him', () => {
  const w = flatWorld();
  for (let y = 600; y < GROUND; y++) for (let x = 500; x < 520; x++) w.terrain.mask[y * W + x] = 1;
  hero(w).x = 450;
  run(w, 3, { right: true });
  assert.ok(hero(w).x < 500);
});

test('walking down a 1:1 slope follows the ground without falling', () => {
  const w = flatWorld();
  w.terrain.mask.fill(0);
  for (let x = 0; x < W; x++) {
    const top = Math.min(1000, 500 + Math.max(0, x - 400));
    for (let y = top; y < 1080; y++) w.terrain.mask[y * W + x] = 1;
  }
  const u = hero(w);
  u.x = 380;
  u.y = 499;
  run(w, 1, { right: true });
  assert.equal(u.onGround, true);
  assert.ok(u.y > 520, `y ${u.y}`);
  assert.equal(eventsOf(w, 'land').filter((e) => e.unit === u.id).length, 0);
});

test('jump leaves the ground, emits jump, lands, and does not hurt', () => {
  const w = flatWorld();
  run(w, 1 / 60, { jump: true });
  assert.equal(eventsOf(w, 'jump')[0].unit, hero(w).id);
  assert.equal(hero(w).onGround, false);
  run(w, 2);
  assert.equal(hero(w).onGround, true);
  assert.equal(hero(w).hp, 100);
  assert.equal(eventsOf(w, 'land').length, 1);
});

test('a jump stays below the safe fall height on the moon too', () => {
  const w = flatWorld({ gravity: 160 });
  run(w, 1 / 60, { jump: true });
  run(w, 5);
  assert.equal(hero(w).hp, 100);
});

test('a fall above the safe height hurts: (fall - 80) * 0.4, rounded', () => {
  const w = flatWorld();
  const u = drop(w, 180);
  run(w, 2);
  const land = eventsOf(w, 'land')[0];
  assert.ok(Math.abs(land.impact - 180) <= 1, `impact ${land.impact}`);
  assert.equal(u.hp, 100 - Math.round((land.impact - 80) * 0.4));
  assert.ok(u.hp >= 59 && u.hp <= 61);
});

test('a short drop does no damage', () => {
  const w = flatWorld();
  const u = drop(w, 60);
  run(w, 1);
  assert.equal(u.hp, 100);
});

test('ground removed from under him makes him fall', () => {
  const w = flatWorld();
  const u = hero(w);
  w.terrain.carve(u.x, GROUND, 40);
  run(w, 0.1);
  assert.equal(u.onGround, false);
  run(w, 1);
  assert.equal(u.onGround, true);
  assert.ok(u.y > GROUND);
});

test('touching liquid kills him with a splash, and he does not explode', () => {
  const w = flatWorld();
  w.terrain.carve(900, GROUND + 100, 150);
  w.terrain.carve(900, GROUND, 60);
  w.liquidY = GROUND + 60;
  const u = drop(w, 50);
  u.x = 900;
  run(w, 2);
  assert.equal(u.alive, false);
  assert.equal(u.hp, 0);
  assert.equal(eventsOf(w, 'splash').length, 1);
  assert.equal(eventsOf(w, 'death').length, 1);
  assert.equal(eventsOf(w, 'explosion').length, 0);
});

test('ice: he keeps sliding after the key is released; grippy ground stops him', () => {
  const ice = flatWorld({ friction: 0.1 });
  run(ice, 1, { right: true });
  const x0 = ice.teams[0].units[0].x;
  run(ice, 1);
  assert.ok(ice.teams[0].units[0].x - x0 > 20, `slid ${ice.teams[0].units[0].x - x0}`);
  const grip = flatWorld({ friction: 0.9 });
  run(grip, 1, { right: true });
  const g0 = grip.teams[0].units[0].x;
  run(grip, 1);
  assert.ok(grip.teams[0].units[0].x - g0 < 5);
});

test('the world edges stop him', () => {
  const w = flatWorld();
  hero(w).x = 20;
  run(w, 2, { left: true });
  assert.ok(hero(w).x >= 6);
});

test('being blasted into the air and landing is not a fall from where he last stood', () => {
  const w = flatWorld();
  const u = hero(w);
  u.peakY = u.y - 400; // stale apex from an earlier jump
  explode(w, u.x - 30, u.y - 10, 40, 10);
  assert.equal(u.onGround, false);
  const hp = u.hp;
  run(w, 3);
  assert.equal(u.onGround, true);
  assert.equal(u.hp, hp);
});

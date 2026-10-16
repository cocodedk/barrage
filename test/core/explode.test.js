import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explode, hurt, resolveDeaths } from '../../src/core/explode.js';
import { flatWorld, eventsOf, run, DT, GROUND } from './helpers.js';

const victim = (world) => world.teams[1].units[0];
const centre = (u) => ({ x: u.x, y: u.y - 10 });

test('damage is full at d=0 and half at d=r/2', () => {
  const world = flatWorld();
  const a = world.teams[1].units[0];
  const b = world.teams[1].units[1];
  const ca = centre(a);
  explode(world, ca.x, ca.y, 40, 50);
  assert.equal(a.hp, 50);
  explode(world, b.x - 20, centre(b).y, 40, 50);
  assert.equal(b.hp, 75);
});

test('nothing at d >= r + 8; a body just inside r + 8 is shoved but takes no damage', () => {
  const world = flatWorld();
  const u = victim(world);
  const c = centre(u);
  explode(world, c.x - 46, c.y, 40, 50);
  assert.equal(u.hp, 100);
  assert.ok(u.vx > 0, 'shoved away from the blast');
  const far = world.teams[1].units[1];
  explode(world, centre(far).x - 60, centre(far).y, 40, 50);
  assert.equal(far.vx, 0);
});

test('knockback pushes away from the centre and lifts off the ground', () => {
  const world = flatWorld();
  const u = victim(world);
  explode(world, u.x - 15, u.y - 10, 40, 50);
  assert.ok(u.vx > 0 && u.vy < 0);
  assert.equal(u.onGround, false);
});

test('emits explosion, crater and damage events and carves the ground', () => {
  const world = flatWorld();
  const u = victim(world);
  assert.ok(world.terrain.solid(900, GROUND + 5));
  explode(world, 900, GROUND, 40, 50);
  assert.ok(!world.terrain.solid(900, GROUND + 5));
  assert.deepEqual(eventsOf(world, 'explosion')[0], { type: 'explosion', x: 900, y: GROUND, r: 40 });
  assert.deepEqual(eventsOf(world, 'crater')[0], { type: 'crater', x: 900, y: GROUND, r: 40 });
  explode(world, u.x, u.y - 10, 40, 50);
  const dmg = eventsOf(world, 'damage')[0];
  assert.equal(dmg.unit, u.id);
  assert.equal(dmg.amount, 50);
});

test('a soldier at 0 hp dies, then blows up on his own (r 25, dmg 15)', () => {
  const world = flatWorld();
  const u = victim(world);
  const mate = world.teams[1].units[1];
  mate.x = u.x + 20; // inside the death blast
  u.hp = 10;
  explode(world, u.x, u.y - 10, 10, 10); // too small to reach the mate at 20 px
  assert.equal(u.alive, false);
  assert.equal(eventsOf(world, 'death').length, 1);
  const blasts = eventsOf(world, 'explosion');
  assert.equal(blasts.length, 2);
  assert.equal(blasts[1].r, 25);
  assert.ok(mate.hp < 100 && mate.hp > 0, `mate hp ${mate.hp}`);
});

test('chain: a death blast that kills a weakened neighbour kills him too, once', () => {
  const world = flatWorld();
  const [a, b] = world.teams[1].units;
  b.x = a.x + 15;
  b.hp = 5;
  a.hp = 0;
  resolveDeaths(world);
  assert.equal(b.alive, false);
  assert.equal(eventsOf(world, 'death').length, 2);
});

test('hurt ignores the dead and non-positive amounts', () => {
  const world = flatWorld();
  const u = victim(world);
  hurt(world, u, 0);
  assert.equal(u.hp, 100);
  u.alive = false;
  hurt(world, u, 30);
  assert.equal(u.hp, 100);
});

test('the death that wipes out a team is marked decisive, blast or drowning', () => {
  const world = flatWorld();
  const [a, b, c] = world.teams[1].units;
  a.hp = 0;
  resolveDeaths(world);
  assert.equal(eventsOf(world, 'death')[0].decisive, false, 'two of his team still stand');
  b.alive = false;
  c.y = world.liquidY + 1; // the last one walks into the sea
  run(world, DT);
  const last = eventsOf(world, 'death').filter((e) => e.unit === c.id);
  assert.deepEqual(last.map((e) => e.decisive), [true]);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepProjectile } from '../../src/core/physics.js';
import { flatWorld, DT, solidRect } from './helpers.js';

const shell = (over = {}) => ({
  kind: 'bazooka', x: 100, y: 100, vx: 300, vy: -400, windy: false, fuse: null,
  restitution: 0, radius: 40, damage: 50, ...over,
});
const fly = (p, world, seconds) => {
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    const r = stepProjectile(p, world, DT);
    if (r) return r;
  }
  return null;
};

test('gravity only: follows the closed-form arc within 1 px after 1 s', () => {
  const world = flatWorld();
  const p = shell();
  fly(p, world, 1);
  assert.ok(Math.abs(p.x - (100 + 300)) <= 1, `x ${p.x}`);
  assert.ok(Math.abs(p.y - (100 - 400 + 0.5 * world.gravity)) <= 1, `y ${p.y}`);
});

test('wind changes x only for windy projectiles', () => {
  const world = flatWorld();
  world.wind = 100;
  const plain = shell({ vy: 0 });
  const windy = shell({ vy: 0, windy: true });
  fly(plain, world, 0.5);
  fly(windy, world, 0.5);
  assert.ok(Math.abs(plain.x - 250) <= 1);
  assert.ok(Math.abs(windy.x - (250 + 0.5 * 100 * 0.25)) <= 1);
  assert.ok(Math.abs(plain.y - windy.y) < 1e-6);
});

test('drag slows a projectile', () => {
  const dragged = flatWorld({ drag: 0.5 });
  const free = flatWorld({ drag: 0 });
  const a = shell({ vy: 0 });
  const b = shell({ vy: 0 });
  fly(a, dragged, 1);
  fly(b, free, 1);
  assert.ok(a.x < b.x - 50, `${a.x} vs ${b.x}`);
  assert.ok(Math.hypot(a.vx, a.vy) < Math.hypot(b.vx, b.vy));
});

test('a 1200 px/s shell cannot tunnel through a 4 px wall', () => {
  const world = flatWorld();
  solidRect(world, 600, 604, 400, 800);
  const p = shell({ x: 500, y: 700, vx: 1200, vy: 0 });
  world.gravity = 0;
  const r = fly(p, world, 0.5);
  assert.equal(r.hit, 'terrain');
  assert.ok(r.x >= 600 && r.x <= 604, `x ${r.x}`);
});

test('hits the first soldier on its path', () => {
  const world = flatWorld();
  const target = world.teams[1].units[0];
  const p = shell({ x: target.x - 200, y: target.y - 10, vx: 600, vy: 0 });
  world.gravity = 0;
  const r = fly(p, world, 1);
  assert.equal(r.hit, 'unit');
  assert.equal(r.unit, target);
});

test('out of bounds left, right and below; above the top is not out', () => {
  const world = flatWorld();
  world.gravity = 0;
  assert.equal(fly(shell({ x: 10, vx: -500, vy: 0 }), world, 1).hit, 'out');
  assert.equal(fly(shell({ x: 1900, vx: 500, vy: 0, y: 300 }), world, 1).hit, 'out');
  const high = shell({ x: 900, y: 20, vx: 0, vy: -300 });
  assert.equal(fly(high, world, 0.5), null);
  assert.ok(high.y < 0);
});

test('stepProjectile pushes no events and leaves terrain untouched', () => {
  const world = flatWorld();
  const before = world.terrain.mask.slice();
  fly(shell({ x: 900, y: 790, vx: 0, vy: 300 }), world, 1);
  assert.equal(world.events.length, 0);
  assert.ok(world.terrain.mask.every((v, i) => v === before[i]));
});

test('a bouncer reflects off the ground and loses energy; no hit is reported', () => {
  const world = flatWorld();
  const p = shell({ restitution: 0.5, x: 900, y: 700, vx: 100, vy: 300, fuse: 3 });
  let top = Infinity;
  let bounced = false;
  for (let i = 0; i < 120; i++) {
    assert.equal(stepProjectile(p, world, DT), null);
    if (p.bounced) bounced = true;
    if (bounced) top = Math.min(top, p.y);
    assert.ok(!world.terrain.solid(p.x, p.y), 'never inside the ground');
  }
  assert.ok(bounced);
  assert.ok(top < 765 && top > 745, `rebound apex ${top}`); // ~229 px/s up: ~44 px of rise
});

test('a bouncer comes to rest on flat ground', () => {
  const world = flatWorld();
  const p = shell({ restitution: 0.5, x: 900, y: 790, vx: 0, vy: 0 });
  for (let i = 0; i < 300; i++) stepProjectile(p, world, DT);
  assert.equal(p.vy, 0);
  assert.ok(Math.abs(p.vx) < 1e-9);
  assert.ok(p.y > 780 && p.y < 800);
});

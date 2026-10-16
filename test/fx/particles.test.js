import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFx, stepFx } from '../../src/fx/fx.js';
import { addParticle, MAX_PARTICLES, makeParticle } from '../../src/fx/particles.js';

test('particle count is capped at 600 and the oldest are dropped', () => {
  const fx = createFx();
  for (let i = 0; i < MAX_PARTICLES + 50; i++) addParticle(fx, makeParticle({ x: i, life: 5 }));
  assert.equal(fx.particles.length, MAX_PARTICLES);
  assert.equal(fx.particles[0].x, 50);
  assert.equal(fx.particles[MAX_PARTICLES - 1].x, MAX_PARTICLES + 49);
});

test('particles carry every field a renderer needs', () => {
  const p = makeParticle({ x: 1, y: 2, life: 2 });
  for (const k of ['x', 'y', 'vx', 'vy', 'life', 'max', 'size', 'grow', 'color', 'kind', 'gravity', 'drag', 'additive']) {
    assert.ok(k in p, k);
  }
  assert.equal(p.max, 2);
});

test('particles expire after their life', () => {
  const fx = createFx();
  addParticle(fx, makeParticle({ life: 0.5 }));
  addParticle(fx, makeParticle({ life: 2 }));
  for (let i = 0; i < 40; i++) stepFx(fx, 1 / 60); // 0.67 s
  assert.equal(fx.particles.length, 1);
  for (let i = 0; i < 120; i++) stepFx(fx, 1 / 60);
  assert.equal(fx.particles.length, 0);
});

const floor = { solid: (x, y) => y >= 100 };

test('a bouncing particle rebounds off solid ground, then settles', () => {
  const fx = createFx();
  addParticle(fx, makeParticle({ life: 100, gravity: 900, bounce: 0.4, vx: 50 }));
  let bounced = false;
  for (let i = 0; i < 600 && !bounced; i++) {
    stepFx(fx, 1 / 60, floor);
    const p = fx.particles[0];
    assert.ok(p.y < 100, 'never inside the ground');
    if (p.vy < 0) bounced = true;
  }
  assert.ok(bounced, 'moving upward after the hit');
  for (let i = 0; i < 600; i++) stepFx(fx, 1 / 60, floor);
  const p = fx.particles[0];
  assert.ok(p.y < 100 && p.y > 90);
  assert.equal(p.vy, 0);
  assert.equal(p.vx, 0);
});

test('without terrain a bouncing particle falls straight through', () => {
  const fx = createFx();
  addParticle(fx, makeParticle({ life: 10, gravity: 900, bounce: 0.4 }));
  for (let i = 0; i < 120; i++) stepFx(fx, 1 / 60);
  assert.ok(fx.particles[0].y > 100);
  assert.ok(fx.particles[0].vy > 0);
});

test('particles with bounce 0 ignore terrain', () => {
  const fx = createFx();
  addParticle(fx, makeParticle({ life: 10, gravity: 900 }));
  for (let i = 0; i < 120; i++) stepFx(fx, 1 / 60, floor);
  assert.ok(fx.particles[0].y > 100);
});

test('a particle hitting a wall reflects sideways; one born inside ground escapes', () => {
  const wall = { solid: (x) => x >= 100 };
  const fx = createFx();
  addParticle(fx, makeParticle({ life: 10, vx: 200, bounce: 0.5 }));
  for (let i = 0; i < 60; i++) stepFx(fx, 1 / 60, wall);
  assert.ok(fx.particles[0].x < 100 && fx.particles[0].vx < 0);
  const inside = createFx();
  addParticle(inside, makeParticle({ x: 150, life: 10, vx: 100, bounce: 0.5 }));
  stepFx(inside, 1 / 60, wall);
  assert.ok(inside.particles[0].x > 150);
});

test('gravity pulls down, drag slows, grow enlarges', () => {
  const fx = createFx();
  addParticle(fx, makeParticle({ life: 5, vx: 100, gravity: 500, drag: 2, size: 4, grow: 10 }));
  stepFx(fx, 0.5);
  const p = fx.particles[0];
  assert.ok(p.vy > 200);
  assert.ok(p.y > 0);
  assert.ok(p.vx < 100 && p.vx > 0);
  assert.equal(p.size, 9);
});

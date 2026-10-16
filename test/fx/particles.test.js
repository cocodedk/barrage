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

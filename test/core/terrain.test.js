import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Terrain } from '../../src/core/terrain.js';

function solidBlock(w = 200, h = 200) {
  const t = new Terrain(w, h);
  t.mask.fill(1);
  return t;
}

test('mask has w*h cells and starts empty', () => {
  const t = new Terrain(30, 20);
  assert.equal(t.mask.length, 600);
  assert.equal(t.solid(5, 5), false);
});

test('solid: out of bounds is false, except below the world', () => {
  const t = solidBlock(50, 50);
  assert.equal(t.solid(10, 10), true);
  assert.equal(t.solid(-1, 10), false);
  assert.equal(t.solid(50, 10), false);
  assert.equal(t.solid(10, -1), false);
  assert.equal(t.solid(10, 50), true);
  assert.equal(t.solid(-5, 99), true);
});

test('carve of r=10 removes about pi*r^2 pixels and clears the centre', () => {
  const t = solidBlock();
  const removed = t.carve(100, 100, 10);
  assert.ok(Math.abs(removed - Math.PI * 100) <= Math.PI * 10, `removed ${removed}`);
  assert.equal(t.solid(100, 100), false);
  assert.equal(t.solid(100, 115), true);
});

test('carve counts only pixels that were solid', () => {
  const t = solidBlock();
  const first = t.carve(100, 100, 10);
  assert.ok(first > 0);
  assert.equal(t.carve(100, 100, 10), 0);
});

test('carve near the edge stays in bounds', () => {
  const t = solidBlock(50, 50);
  const removed = t.carve(0, 0, 10);
  assert.ok(removed > 0 && removed < Math.PI * 100);
});

test('surfaceY: first solid y from top, h when none, moves down after carve', () => {
  const t = new Terrain(100, 100);
  assert.equal(t.surfaceY(50), 100);
  for (let y = 60; y < 100; y++) for (let x = 0; x < 100; x++) t.mask[y * 100 + x] = 1;
  assert.equal(t.surfaceY(50), 60);
  t.carve(50, 60, 10);
  assert.ok(t.surfaceY(50) > 60);
  assert.equal(t.surfaceY(-3), 100);
  assert.equal(t.surfaceY(100), 100);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../../src/core/rng.js';

test('same seed gives the same sequence', () => {
  const a = makeRng(42);
  const b = makeRng(42);
  for (let i = 0; i < 100; i++) assert.equal(a(), b());
});

test('different seeds give different sequences', () => {
  const a = makeRng(1);
  const b = makeRng(2);
  const same = Array.from({ length: 20 }, () => a() === b()).every(Boolean);
  assert.equal(same, false);
});

test('values are in [0, 1) and spread over the range', () => {
  const r = makeRng(7);
  let lo = 1;
  let hi = 0;
  for (let i = 0; i < 5000; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1);
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  assert.ok(lo < 0.05 && hi > 0.95);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../../src/core/levels.js';
import { lookFor } from '../../src/ui/looks.js';
import { BODIES } from '../../src/ui/sky-bodies.js';
import { TEX } from '../../src/ui/terrain-tex.js';
import { AMBIENT_KINDS } from '../../src/ui/ambient.js';
import { FLOURISH_NAMES } from '../../src/ui/flourish.js';

test('every level has its own look, built only from parts the renderer implements', () => {
  for (const level of LEVELS) {
    const look = lookFor(level);
    assert.ok(BODIES[look.sky], `level ${level.id} sky '${look.sky}'`);
    assert.ok(TEX[look.tex], `level ${level.id} texture '${look.tex}'`);
    assert.ok(AMBIENT_KINDS.includes(look.ambient.kind), `level ${level.id} ambient '${look.ambient.kind}'`);
    assert.ok(look.flourish.length > 0, `level ${level.id} has a signature flourish`);
    for (const f of look.flourish) assert.ok(FLOURISH_NAMES.includes(f), `level ${level.id} flourish '${f}'`);
  }
});

test('no two levels share a sky or a ground texture', () => {
  const looks = LEVELS.map(lookFor);
  assert.equal(new Set(looks.map((l) => l.sky)).size, LEVELS.length);
  assert.equal(new Set(looks.map((l) => l.tex)).size, LEVELS.length);
});

// The drawn crater must be the carved crater: on the chunky Pixel Retro canvas (k = 4) a cell is
// cleared exactly when the mask pixel it was baked from (its centre) has been carved away.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Terrain } from '../../src/core/terrain.js';
import { craterSpans } from '../../src/ui/crater-blocks.js';

const W = 1920;
const H = 1080;
const CASES = [
  [600, 500, 40], [600.4, 500.6, 40], [913.7, 311.2, 25], [1001.5, 702.5, 70],
  [250.25, 640.75, 8], [1777.9, 120.1, 33.3], [3.6, 1070.4, 40], [1500.49, 899.51, 17.5],
];

const key = (col, row) => `${col},${row}`;

function drawnCells(x, y, r, k) {
  const out = new Set();
  for (const [row, x0, x1] of craterSpans(x, y, r, k)) {
    if (row < 0 || row >= H / k) continue;
    for (let col = Math.max(0, x0); col <= Math.min(x1, W / k - 1); col++) out.add(key(col, row));
  }
  return out;
}

// Cells whose baked centre pixel (k >> 1 into the cell, as sampleMask reads it) the core carved.
function carvedCells(x, y, r, k) {
  const t = new Terrain(W, H);
  t.mask.fill(1);
  t.carve(x, y, r);
  const out = new Set();
  const c = k >> 1;
  for (let row = 0; row < H / k; row++) {
    for (let col = 0; col < W / k; col++) if (!t.mask[(row * k + c) * W + col * k + c]) out.add(key(col, row));
  }
  return out;
}

for (const k of [4, 1]) {
  test(`k = ${k}: the cells cleared on screen are exactly the cells the core carved`, () => {
    for (const [x, y, r] of CASES) {
      const drawn = drawnCells(x, y, r, k);
      const carved = carvedCells(x, y, r, k);
      const extra = [...drawn].filter((cell) => !carved.has(cell)).length;
      const missed = [...carved].filter((cell) => !drawn.has(cell)).length;
      const where = `crater (${x}, ${y}, r ${r})`;
      assert.deepEqual([extra, missed], [0, 0], `${where}: ${extra} holes over solid, ${missed} carved cells still drawn`);
    }
  });
}

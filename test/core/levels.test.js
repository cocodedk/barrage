import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../../src/core/levels.js';
import { generateTerrain, spawnPoints } from '../../src/core/terrain-gen.js';
import { makeRng } from '../../src/core/rng.js';

const byId = (id) => LEVELS.find((l) => l.id === id);
const snapshot = (t) => t.mask.reduce((h, v, i) => (h + v * (i % 97 + 1)) % 1000003, 0);

test('there are 15 levels with unique ids 1..15 and names', () => {
  assert.equal(LEVELS.length, 15);
  assert.deepEqual(LEVELS.map((l) => l.id), Array.from({ length: 15 }, (_, i) => i + 1));
  assert.equal(new Set(LEVELS.map((l) => l.name)).size, 15);
});

test('every level has every field, in range', () => {
  for (const l of LEVELS) {
    const at = `level ${l.id}`;
    assert.ok(l.name, at);
    assert.ok(l.sky.length >= 2, at);
    l.sky.forEach(([stop, color], i) => {
      assert.ok(stop >= 0 && stop <= 1 && typeof color === 'string', at);
      if (i) assert.ok(stop > l.sky[i - 1][0], `${at} stops ascend`);
    });
    assert.ok(l.layers.length >= 2 && l.layers.length <= 3, at);
    for (const ly of l.layers) {
      assert.ok(ly.kind && ly.color, at);
      assert.ok(ly.height > 0 && ly.height <= 1080, at);
      assert.ok(ly.roughness >= 0 && ly.roughness <= 1, at);
      assert.ok(ly.speed > 0 && ly.speed < 1, at);
    }
    assert.equal(l.fill.length, 2, at);
    assert.ok(l.edge, at);
    assert.ok(['water', 'lava'].includes(l.liquid.kind), at);
    assert.ok(l.liquid.color, at);
    assert.ok(l.liquid.y >= 1000 && l.liquid.y <= 1040, at);
    assert.ok(l.gravity > 0, at);
    assert.ok(l.windMax >= 0, at);
    assert.ok(l.friction >= 0 && l.friction <= 1, at);
    assert.ok(l.drag >= 0 && l.drag <= 1, at);
    assert.ok(l.aiSkill >= 0 && l.aiSkill <= 1, at);
    assert.equal(typeof l.terrain, 'object', at);
  }
});

test('ai skill rises from about 0.25 to about 0.95', () => {
  const s = LEVELS.map((l) => l.aiSkill);
  assert.ok(s[0] <= 0.3 && s[14] >= 0.9);
  s.forEach((v, i) => { if (i) assert.ok(v > s[i - 1]); });
});

test('levels carry their signature traits', () => {
  const others = (id, key) => LEVELS.filter((l) => l.id !== id).map((l) => l[key]);
  assert.ok(byId(4).friction < Math.min(...others(4, 'friction')));
  assert.ok(byId(10).drag > Math.max(...others(10, 'drag')));
  assert.equal(byId(11).liquid.kind, 'lava');
  assert.equal(byId(15).liquid.kind, 'lava');
  assert.ok(byId(14).gravity < Math.min(...others(14, 'gravity')));
  assert.ok(byId(9).windMax >= 120 && byId(15).windMax >= 120);
  assert.equal(byId(12).pixel, true);
  assert.deepEqual(LEVELS.filter((l) => l.pixel).map((l) => l.id), [12]);
  assert.ok(byId(13).terrain.chasm && byId(13).terrain.islands);
});

test('generateTerrain is deterministic per seed and differs across seeds', () => {
  const spec = LEVELS[0].terrain;
  const a = generateTerrain(spec, makeRng(5));
  const b = generateTerrain(spec, makeRng(5));
  const c = generateTerrain(spec, makeRng(6));
  assert.equal(snapshot(a), snapshot(b));
  assert.notEqual(snapshot(a), snapshot(c));
});

test('every level leaves 6 clear spawns on ground above the liquid', () => {
  for (const seed of [1, 2, 3, 99]) {
    for (const l of LEVELS) {
      const rng = makeRng(seed * 1000 + l.id);
      const t = generateTerrain(l.terrain, rng);
      const pts = spawnPoints(t, 6, rng, l.liquid.y);
      const at = `level ${l.id} seed ${seed}`;
      assert.equal(pts.length, 6, at);
      for (const p of pts) {
        assert.ok(t.solid(p.x, p.y + 2), `${at} ground`);
        assert.ok(!t.solid(p.x, p.y - 30), `${at} headroom`);
        assert.ok(p.y < l.liquid.y, `${at} above liquid`);
      }
      for (let i = 0; i < 6; i++) {
        for (let j = i + 1; j < 6; j++) {
          assert.ok(Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) >= 120, `${at} apart`);
        }
      }
    }
  }
});

test('caves really remove ground on every level that has them', () => {
  const solidCount = (t) => t.mask.reduce((n, v) => n + v, 0);
  const withCaves = LEVELS.filter((l) => l.terrain.caves);
  assert.ok(withCaves.length >= 6);
  for (const l of withCaves) {
    // Caves draw from the rng before platforms and islands, so strip those to compare
    // like with like.
    const base = { ...l.terrain, platforms: undefined, islands: undefined };
    const plain = generateTerrain({ ...base, caves: undefined }, makeRng(8));
    const holed = generateTerrain(base, makeRng(8));
    assert.ok(solidCount(holed) < solidCount(plain) - 1000, `level ${l.id} caves carved nothing`);
  }
});

test('spawnPoints is deterministic', () => {
  const l = LEVELS[2];
  const run = () => {
    const rng = makeRng(11);
    const t = generateTerrain(l.terrain, rng);
    return spawnPoints(t, 6, rng, l.liquid.y);
  };
  assert.deepEqual(run(), run());
});

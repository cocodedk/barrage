import { Terrain } from './terrain.js';
import { between } from './rng.js';

export const WORLD_W = 1920;
export const WORLD_H = 1080;
const TOP_MIN = 160; // highest the main ground may reach
const BOTTOM_ROOM = 150; // lowest ground top sits this far above the world floor

// Terrain spec (all optional except base and amp):
//   base      mean ground-top height as a fraction of the world height
//   amp       peak deviation of the value-noise sum, px
//   octaves   noise octaves; roughness is the amplitude kept per octave
//   cells     noise lattice cells at the first octave (doubles each octave)
//   waves     { n, amp }  a sine of n periods across the world, amp px
//   quant     snap columns and heights to blocks of this many px (pixel look)
//   chasm     { x, w }  vertical gap cut through everything, centre x and width
//   caves     { count, r:[lo,hi], depth:[lo,hi] }  discs below the surface (depth may be 0)
//   platforms { count, w:[lo,hi], y:[lo,hi], thick }  flat slabs hanging in the air
//   islands   { count, y:[lo,hi], rx:[lo,hi], ry:[lo,hi] }  floating rocks

const smooth = (t) => t * t * (3 - 2 * t);
const range = (rng, [lo, hi]) => between(rng, lo, hi);

function valueNoise(rng, cells) {
  const pts = Array.from({ length: cells + 1 }, () => rng() * 2 - 1);
  return (u) => {
    const p = u * cells;
    const i = Math.min(Math.floor(p), cells - 1);
    const t = smooth(p - i);
    return pts[i] * (1 - t) + pts[i + 1] * t;
  };
}

function heightmap(spec, rng, w, h) {
  const { base, amp, octaves = 3, roughness = 0.5, cells = 4, waves, quant = 0 } = spec;
  const noises = Array.from({ length: octaves }, (_, o) => valueNoise(rng, cells * 2 ** o));
  const phase = rng() * Math.PI * 2;
  const norm = noises.reduce((s, _, o) => s + roughness ** o, 0);
  const tops = new Array(w);
  for (let x = 0; x < w; x++) {
    const sx = quant ? Math.min(Math.floor(x / quant) * quant + quant / 2, w - 1) : x;
    const u = sx / (w - 1);
    let v = noises.reduce((s, n, o) => s + n(u) * roughness ** o, 0) / norm;
    v *= amp;
    if (waves) v += Math.sin(u * waves.n * Math.PI * 2 + phase) * waves.amp;
    let top = base * h + v;
    if (quant) top = Math.round(top / quant) * quant;
    tops[x] = Math.round(Math.min(Math.max(top, TOP_MIN), h - BOTTOM_ROOM));
  }
  return tops;
}

function fillColumns(t, tops) {
  for (let x = 0; x < t.w; x++) {
    for (let y = tops[x]; y < t.h; y++) t.mask[y * t.w + x] = 1;
  }
}

function setRect(t, x0, y0, x1, y1, value) {
  for (let y = Math.max(y0, 0); y < Math.min(y1, t.h); y++) {
    for (let x = Math.max(x0, 0); x < Math.min(x1, t.w); x++) t.mask[y * t.w + x] = value;
  }
}

// A rock with a flattish top and a rounded belly.
function fillIsland(t, cx, cy, rx, ry) {
  for (let x = Math.max(Math.round(cx - rx), 0); x < Math.min(Math.round(cx + rx), t.w); x++) {
    const k = Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2));
    const top = Math.round(cy - ry * 0.3 * k);
    const bottom = Math.round(cy + ry * k);
    for (let y = Math.max(top, 0); y < Math.min(bottom, t.h); y++) t.mask[y * t.w + x] = 1;
  }
}

function addFeatures(t, spec, rng, tops) {
  const { chasm, caves, platforms, islands } = spec;
  if (chasm) setRect(t, Math.round(chasm.x - chasm.w / 2), 0, Math.round(chasm.x + chasm.w / 2), t.h, 0);
  if (caves) {
    for (let i = 0; i < caves.count; i++) {
      const x = Math.round(range(rng, [100, t.w - 100]));
      t.carve(x, tops[x] + range(rng, caves.depth), range(rng, caves.r));
    }
  }
  if (platforms) {
    for (let i = 0; i < platforms.count; i++) {
      const w = Math.round(range(rng, platforms.w));
      const x = Math.round(range(rng, [80, t.w - 80 - w]));
      const y = Math.round(range(rng, platforms.y));
      setRect(t, x, y, x + w, y + platforms.thick, 1);
    }
  }
  if (islands) {
    for (let i = 0; i < islands.count; i++) {
      const rx = range(rng, islands.rx);
      fillIsland(t, range(rng, [rx + 40, t.w - rx - 40]), range(rng, islands.y), rx, range(rng, islands.ry));
    }
  }
}

export function generateTerrain(spec, rng, w = WORLD_W, h = WORLD_H) {
  const t = new Terrain(w, h);
  const tops = heightmap(spec, rng, w, h);
  fillColumns(t, tops);
  addFeatures(t, spec, rng, tops);
  return t;
}

// --- spawn points -----------------------------------------------------------

const SPAWN_MARGIN = 60;
const SPAWN_GAP = 120;
const HEADROOM = 30;
const MAX_SLOPE = 8; // surface may differ this much 8 px to either side

// y of the last air pixel above the surface at x, or null if x is no good to stand on.
function standY(t, x, liquidY) {
  const s = t.surfaceY(x);
  if (s - 1 < HEADROOM || s + 40 > liquidY) return null;
  if (Math.abs(t.surfaceY(x - 8) - s) > MAX_SLOPE || Math.abs(t.surfaceY(x + 8) - s) > MAX_SLOPE) {
    return null;
  }
  return s - 1;
}

// `count` spots on the surface, above the liquid, >= 120 px apart, sorted by x. One is
// picked per equal-width zone where it can be, so spawns spread across the world.
export function spawnPoints(terrain, count, rng, liquidY) {
  const cands = [];
  for (let x = SPAWN_MARGIN; x <= terrain.w - SPAWN_MARGIN; x += 4) {
    const y = standY(terrain, x, liquidY);
    if (y !== null) cands.push({ x, y });
  }
  const taken = [];
  const free = (c) => taken.every((p) => Math.hypot(p.x - c.x, p.y - c.y) >= SPAWN_GAP);
  const take = (pool) => taken.push(pool[Math.floor(rng() * pool.length)]);
  const zoneW = (terrain.w - 2 * SPAWN_MARGIN) / count;
  for (let i = 0; i < count; i++) {
    const pool = cands.filter((c) => Math.floor((c.x - SPAWN_MARGIN) / zoneW) === i && free(c));
    if (pool.length) take(pool);
  }
  while (taken.length < count) {
    const pool = cands.filter(free);
    if (!pool.length) throw new Error('no room for spawn points');
    take(pool);
  }
  return taken.sort((a, b) => a.x - b.x);
}

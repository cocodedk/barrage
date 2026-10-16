// Procedural ground textures, evaluated once per pixel when the terrain is baked.
// Each takes out = [r, g, b] (the level's fill gradient at this pixel) and recolours it in
// place; x, y are world px and d is depth below the local surface in px.
import { hash2, noise2 } from './sprites.js';

const scale = (o, f) => { o[0] *= f; o[1] *= f; o[2] *= f; };
const toward = (o, c, t) => {
  o[0] += (c[0] - o[0]) * t;
  o[1] += (c[1] - o[1]) * t;
  o[2] += (c[2] - o[2]) * t;
};
const ridged = (x, y, cell, seed) => Math.abs(noise2(x, y, cell, seed) - 0.5);
const grain = (x, y) => 0.92 + 0.16 * hash2(x, y);

const WHITE = [255, 255, 255];
const LAVA = [255, 150, 40];
const EMBER_RED = [255, 60, 30];
const BONE = [216, 208, 192];
const NEON = [[0, 240, 255], [255, 45, 149], [255, 226, 120]];
const SPRINKLES = [[255, 90, 90], [90, 200, 255], [255, 230, 90], [120, 230, 120], [255, 255, 255]];

function pebbles(o, x, y, chance, f) {
  if (hash2(x >> 2, y >> 2) > 1 - chance) scale(o, f);
}

export const TEX = {
  soil(o, x, y) {
    scale(o, (0.82 + 0.3 * noise2(x, y, 22)) * grain(x, y));
    scale(o, 1 + 0.06 * Math.sin(y * 0.09 + noise2(x, y, 60, 1) * 5));
    pebbles(o, x, y, 0.02, 1.3);
  },
  strata(o, x, y) {
    const band = Math.sin(y * 0.07 + noise2(x, y, 120, 2) * 7);
    scale(o, (band > 0.3 ? 1.1 : band < -0.5 ? 0.86 : 1) * (0.94 + 0.1 * noise2(x, y, 8)) * grain(x, y));
  },
  loam(o, x, y) {
    scale(o, (0.8 + 0.35 * noise2(x, y, 26, 3)) * grain(x, y));
    if (ridged(x, y, 46, 4) < 0.008) toward(o, [150, 95, 55], 0.28);
    pebbles(o, x, y, 0.012, 1.35);
  },
  ice(o, x, y) {
    scale(o, 0.95 + 0.06 * noise2(x, y, 30) + 0.03 * hash2(x, y));
    if (ridged(x, y, 70, 5) < 0.007) toward(o, [120, 170, 215], 0.7);
  },
  mud(o, x, y) {
    scale(o, (0.78 + 0.4 * noise2(x, y, 18, 6)) * grain(x, y));
    if (ridged(x, y, 34, 7) < 0.009) toward(o, [125, 85, 45], 0.3);
  },
  city(o, x, y, d) {
    const cx = Math.floor(x / 48);
    const cy = Math.floor(y / 40);
    if (x % 48 < 2 || y % 40 < 2) scale(o, 1.6);
    const h = hash2(cx, cy);
    if (d > 14 && h > 0.6 && x % 12 < 6 && y % 13 > 4 && hash2(x / 12 | 0, y / 13 | 0) > 0.45) {
      toward(o, NEON[Math.floor(h * 31) % 3], Math.max(0.12, 0.55 - d / 600));
    }
  },
  candy(o, x, y) {
    if ((x + y) % 54 < 22) toward(o, WHITE, 0.42);
    scale(o, 0.96 + 0.06 * noise2(x, y, 20));
    if (hash2(x >> 2, y >> 2) > 0.982) toward(o, SPRINKLES[Math.floor(hash2(y >> 2, x >> 2) * 5)], 0.9);
  },
  grave(o, x, y) {
    scale(o, (0.68 + 0.32 * noise2(x, y, 20, 8)) * grain(x, y));
    if (hash2(x >> 3, y >> 3) > 0.997 && (y & 7) > 2 && (y & 7) < 5 && (x & 7) > 0) toward(o, BONE, 0.5);
  },
  rock(o, x, y) {
    const facet = Math.floor(noise2(x, y, 34, 9) * 5) / 5;
    scale(o, (0.8 + 0.4 * facet) * grain(x, y));
    if (ridged(x, y, 90, 10) < 0.005) scale(o, 0.6);
  },
  coral(o, x, y) {
    scale(o, 0.88 + 0.22 * noise2(x, y, 24, 11));
    const cx = Math.floor(x / 11);
    const cy = Math.floor(y / 11);
    const px = (x % 11) - 3 - hash2(cx, cy + 7) * 5; // pores jittered within their cell
    const py = (y % 11) - 3 - hash2(cx + 7, cy) * 5;
    if (px * px + py * py < 4 + hash2(cx, cy) * 4 && hash2(cx, cy) > 0.4) scale(o, 0.7);
    if (hash2(x >> 2, y >> 2) > 0.988) toward(o, [255, 240, 170], 0.7);
  },
  basalt(o, x, y, d) {
    scale(o, (0.75 + 0.45 * noise2(x, y, 16, 12)) * grain(x, y));
    const v = ridged(x, y, 80, 13);
    if (d > 6 && v < 0.016) toward(o, LAVA, 0.95 - v * 20);
    else if (d > 6 && v < 0.045) toward(o, EMBER_RED, 0.25);
  },
  bricks(o, x, y) {
    const row = Math.floor(y / 16);
    const bx = x + (row % 2) * 16;
    if (y % 16 < 4 || bx % 32 < 4) scale(o, 0.62);
    else scale(o, 0.9 + 0.2 * hash2(Math.floor(bx / 32), row));
  },
  glacier(o, x, y) {
    const facet = Math.floor(noise2(x, y, 56, 14) * 4) / 4;
    toward(o, [150, 210, 255], facet * 0.22);
    scale(o, 0.96 + 0.05 * Math.sin(x * 0.12 + noise2(x, y, 40) * 8));
    if (ridged(x, y, 90, 15) < 0.005) toward(o, WHITE, 0.45);
  },
  regolith(o, x, y) {
    scale(o, (0.86 + 0.24 * noise2(x, y, 14, 16)) * grain(x, y));
    const cx = Math.floor(x / 56);
    const cy = Math.floor(y / 56);
    if (hash2(cx, cy) < 0.55) return;
    const r = 7 + hash2(cy, cx) * 16;
    const dx = x - (cx * 56 + 14 + hash2(cx + 3, cy) * 28); // centres jittered in their cell
    const dy = (y - (cy * 56 + 14 + hash2(cx, cy + 3) * 28)) * 1.6;
    const dd = Math.sqrt(dx * dx + dy * dy);
    if (dd < r * 0.8) scale(o, 0.78 + (dy / r) * 0.12);
    else if (dd < r) scale(o, 1.18);
  },
  obsidian(o, x, y, d) {
    scale(o, (0.75 + 0.5 * noise2(x, y, 30, 17)) * grain(x, y));
    if (noise2(x, y, 9, 18) > 0.8) toward(o, [120, 70, 110], 0.35);
    const v = ridged(x, y, 110, 19);
    if (d > 6 && v < 0.01) toward(o, EMBER_RED, 0.95 - v * 30);
  },
};

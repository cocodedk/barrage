// Small level previews for the level cards: the level's sky, its parallax colours as soft
// ridges, and a silhouette of the real terrain (generated from a fixed seed) with its bright
// edge and liquid. Cheap enough to draw all fifteen at once; cached per level.
import { generateTerrain } from '../../core/terrain-gen.js';
import { makeRng } from '../../core/rng.js';

const TW = 320;
const TH = 180;
const SCALE = 1920 / TW;
const cache = new Map();

function rgb(hex) {
  const n = parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function ridges(g, level) {
  level.layers.forEach((layer, li) => {
    const top = TH - layer.height / SCALE - 18;
    g.fillStyle = layer.color;
    g.beginPath();
    g.moveTo(0, TH);
    for (let x = 0; x <= TW; x += 4) {
      const wob = Math.sin(x * 0.045 + li * 2.1) * 9 + Math.sin(x * 0.13 + li) * 4 * (layer.roughness ?? 0.4);
      g.lineTo(x, top + wob);
    }
    g.lineTo(TW, TH);
    g.fill();
  });
}

function ground(g, level) {
  const t = generateTerrain(level.terrain, makeRng(level.id * 7919));
  const img = g.getImageData(0, 0, TW, TH);
  const d = img.data;
  const [a, b, edge] = [rgb(level.fill[0]), rgb(level.fill[1]), rgb(level.edge)];
  const liquidY = level.liquid.y / SCALE;
  const lq = rgb(level.liquid.color);
  for (let x = 0; x < TW; x++) {
    let prevSolid = false;
    for (let y = 0; y < TH; y++) {
      const solid = t.solid(Math.floor((x + 0.5) * SCALE), Math.floor((y + 0.5) * SCALE));
      const i = (y * TW + x) * 4;
      let c = null;
      if (solid) {
        const k = y / TH;
        c = prevSolid ? a.map((v, j) => v + (b[j] - v) * k) : edge;
      } else if (y >= liquidY) c = lq.map((v, j) => d[i + j] * 0.25 + v * 0.75);
      if (c) [d[i], d[i + 1], d[i + 2], d[i + 3]] = [c[0], c[1], c[2], 255];
      prevSolid = solid;
    }
  }
  g.putImageData(img, 0, 0);
}

export function levelThumb(level) {
  if (!cache.has(level.id)) {
    const c = document.createElement('canvas');
    c.width = TW;
    c.height = TH;
    const g = c.getContext('2d', { willReadFrequently: true });
    const sky = g.createLinearGradient(0, 0, 0, TH);
    for (const [stop, color] of level.sky) sky.addColorStop(stop, color);
    g.fillStyle = sky;
    g.fillRect(0, 0, TW, TH);
    ridges(g, level);
    ground(g, level);
    cache.set(level.id, c.toDataURL());
  }
  const img = new Image(TW, TH);
  img.alt = '';
  img.src = cache.get(level.id);
  return img;
}

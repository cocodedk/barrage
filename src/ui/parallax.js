// Parallax silhouettes: baked once per level, shifted with the camera at their own speed.
import { W, H, makeCanvas, rgba, shade, glow } from './sprites.js';
import { makeRng } from '../core/rng.js';
import { paintLayer, SKIRT } from './parallax-shapes.js';
import { skyHaze } from './sky-paint.js';

const MARGIN = 260; // spare width each side so camera shifts never show an edge

// Layers stand on a horizon just below the typical ground line, so each one's `height`
// is how far it rises above the land instead of being buried behind it.
export function horizonOf(terrain) {
  const tops = [];
  for (let x = 8; x < W; x += 16) tops.push(terrain.surfaceY(x));
  tops.sort((a, b) => a - b);
  return Math.min(H, tops[tops.length >> 1] + 110);
}

export function buildLayers(level, look, horizon) {
  const haze = skyHaze(level);
  return level.layers.map((L, i) => {
    const w = W + MARGIN * 2;
    const c = makeCanvas(w, L.height + SKIRT);
    const g = c.getContext('2d');
    const out = { lights: [], peak: null };
    paintLayer(g, w, L.height, makeRng(level.id * 101 + i * 7), L, look, out);
    // atmospheric haze: far layers fade toward the horizon colour at their tops
    g.globalCompositeOperation = 'source-atop';
    const hazeAmt = Math.max(0.08, 0.42 - L.speed * 0.7);
    const gr = g.createLinearGradient(0, 0, 0, L.height + SKIRT);
    gr.addColorStop(0, rgba(haze, hazeAmt));
    gr.addColorStop(0.6, rgba(haze, hazeAmt * 0.25));
    gr.addColorStop(1, rgba(haze, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, w, L.height + SKIRT);
    // a thin lit rim along every top edge gives the silhouettes definition
    g.globalCompositeOperation = 'source-over';
    const rim = makeCanvas(w, L.height + SKIRT);
    const r = rim.getContext('2d');
    r.drawImage(c, 0, 0);
    r.globalCompositeOperation = 'source-in';
    r.fillStyle = shade(L.color, 0.3);
    r.fillRect(0, 0, w, L.height + SKIRT);
    g.globalCompositeOperation = 'destination-over';
    g.drawImage(rim, 0, -2);
    g.globalCompositeOperation = 'source-over';
    return {
      canvas: c, top: horizon - L.height, height: L.height, speed: L.speed,
      alpha: L.kind === 'clouds' ? 0.82 : 1, // cloud banks let the sky glow through
      lights: out.lights, peak: out.peak,
    };
  });
}

// Offset of a layer for the current camera: far layers barely move.
function offset(L, cam) {
  return {
    x: (cam.x - W / 2) * (1 - L.speed),
    y: (cam.y - H / 2) * (1 - L.speed) * 0.6,
  };
}

// Draw in world space (camera transform already applied). `between(i)` runs after layer i.
export function drawLayers(ctx, layers, cam, t, between) {
  layers.forEach((L, i) => {
    const o = offset(L, cam);
    const x0 = -MARGIN + o.x;
    const y0 = L.top + o.y;
    ctx.globalAlpha = L.alpha;
    ctx.drawImage(L.canvas, x0, y0);
    ctx.globalAlpha = 1;
    if (L.lights.length) {
      ctx.globalCompositeOperation = 'lighter';
      const sprite = glow('#ff3a3a');
      L.lights.forEach((p, k) => {
        const on = 0.5 + 0.5 * Math.sin(t * 2.2 + k * 1.7);
        ctx.globalAlpha = on;
        ctx.drawImage(sprite, x0 + p.x - 12, y0 + p.y - 12, 24, 24);
      });
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    if (between) between(i, x0, y0);
  });
}

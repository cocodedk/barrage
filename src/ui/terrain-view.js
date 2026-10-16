// The terrain as an offscreen canvas, baked from the core mask once per level and then only
// ever cut (destination-out) where the core carved a crater. Pixel levels bake at 1/4 size
// and are drawn back up with smoothing off.
import { W, H, makeCanvas, rgb, rgba, mix, glow } from './sprites.js';
import { TEX } from './terrain-tex.js';
import { trimSpec, trimPixel, dress, openAir, caveWalls } from './terrain-trim.js';

const RIM = 2; // px of bright edge along the surface
const HOT_TIME = 1.4; // s a fresh crater rim glows

// Mask at 1/k resolution, sampled at each block's centre.
function sampleMask(terrain, k) {
  if (k === 1) return terrain.mask;
  const w = W / k;
  const h = H / k;
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) m[y * w + x] = terrain.mask[(y * k + (k >> 1)) * W + x * k + (k >> 1)];
  }
  return m;
}

// Per pixel: px down from the open sky above it (depth; caves don't reset it, so the
// ground under a cave keeps its deep colour) and px of solid below it (under).
function runs(m, open, w, h) {
  const depth = new Uint16Array(w * h);
  const under = new Uint16Array(w * h);
  for (let x = 0; x < w; x++) {
    let a = 0;
    let b = 0;
    for (let y = 0; y < h; y++) depth[y * w + x] = a = open[y * w + x] ? 0 : a + 1;
    for (let y = h - 1; y >= 0; y--) under[y * w + x] = b = m[y * w + x] ? b + 1 : 0;
  }
  return { depth, under };
}

function paint(m, w, h, k, level, look) {
  const img = new ImageData(w, h);
  const rim = new ImageData(w, h);
  const open = openAir(m, w, h);
  const { depth, under } = runs(m, open, w, h);
  const top = rgb(level.fill[0]);
  const bot = rgb(level.fill[1]);
  const edge = rgb(level.edge);
  const tex = TEX[look.tex] || TEX.soil;
  const T = trimSpec(look, level);
  const reach = k === 1 ? 2 : 1;
  const o = [0, 0, 0];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (!m[p]) continue;
      const wx = x * k;
      const wy = y * k;
      const d = depth[p] * k;
      // mostly by height, a little by depth: per-column depth alone streaks under steps
      const g = Math.min(1, Math.max(0, (wy - 250) / 750) * 0.8 + 0.3 * Math.min(1, d / 140));
      for (let i = 0; i < 3; i++) o[i] = top[i] + (bot[i] - top[i]) * g;
      tex(o, wx, wy, d);
      trimPixel(o, T, wx, wy, d);
      let e = 0;
      if (d <= RIM * (k === 1 ? 1 : 2) || (y > 0 && !m[p - w])) e = 1;
      else if ((x >= reach && !m[p - reach]) || (x < w - reach && !m[p + reach]) || !m[p - 1] || !m[p + 1]) e = 0.55;
      else if (under[p] * k <= RIM && y + under[p] < h) e = 0.4;
      if (e) {
        for (let i = 0; i < 3; i++) o[i] += (edge[i] - o[i]) * e;
        const r = p * 4;
        rim.data[r] = edge[0];
        rim.data[r + 1] = edge[1];
        rim.data[r + 2] = edge[2];
        rim.data[r + 3] = 255 * e;
      }
      const q = p * 4;
      img.data[q] = o[0];
      img.data[q + 1] = o[1];
      img.data[q + 2] = o[2];
      img.data[q + 3] = 255;
    }
  }
  caveWalls(img.data, m, open, w, h, k, level.fill[1]);
  dress(img.data, m, w, h, k, T);
  return { img, rim };
}

// Bake (or re-bake) the terrain canvas from the core mask.
export function bakeTerrain(terrain, level, look) {
  const k = level.pixel ? 4 : 1;
  const w = W / k;
  const h = H / k;
  const m = sampleMask(terrain, k);
  const { img, rim } = paint(m, w, h, k, level, look);
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.putImageData(img, 0, 0);
  if (look.glow > 0) {
    // baked edge glow: the rim, blurred once here, added back with 'lighter'
    const r = makeCanvas(w, h);
    r.getContext('2d').putImageData(rim, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    for (const [blur, a] of [[3, 0.9], [12, 0.8]]) {
      ctx.filter = `blur(${blur}px)`;
      ctx.globalAlpha = look.glow * a;
      ctx.drawImage(r, 0, 0);
    }
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  return { canvas, ctx, k, hot: [] };
}

// Cut a crater the core already carved: scorch the ground around it, trace a fresh edge,
// then clear the disc. Called once per crater, never per frame.
export function cutTerrain(tv, x, y, r, level, look, now) {
  const { ctx: g, k } = tv;
  const cx = Math.round(x) / k;
  const cy = Math.round(y) / k;
  const R = r / k;
  g.save();
  g.globalCompositeOperation = 'source-atop';
  const S = R + 14 / k;
  const gr = g.createRadialGradient(cx, cy, R * 0.85, cx, cy, S);
  gr.addColorStop(0, 'rgba(24,12,6,0.8)');
  gr.addColorStop(1, 'rgba(24,12,6,0)');
  g.fillStyle = gr;
  g.fillRect(cx - S, cy - S, S * 2, S * 2);
  g.strokeStyle = rgba(mix(level.edge, look.hot, 0.5), 0.7);
  g.lineWidth = Math.max(1, 3 / k);
  g.beginPath();
  g.arc(cx, cy, R + 1.5 / k, 0, Math.PI * 2);
  g.stroke();
  g.globalCompositeOperation = 'destination-out';
  if (k > 1) {
    const n = Math.ceil(R);
    for (let dy = -n; dy <= n; dy++) {
      const half = Math.floor(Math.sqrt(Math.max(0, R * R - dy * dy)));
      g.fillRect(Math.round(cx - half), Math.round(cy + dy), half * 2 + 1, 1);
    }
  } else {
    g.beginPath();
    g.arc(cx, cy, R + 0.5, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  tv.hot.push({ x, y, r, t0: now });
}

// The terrain plus the cooling glow of fresh crater walls (world space).
export function drawTerrain(ctx, tv, look, now) {
  if (tv.k > 1) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tv.canvas, 0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
  } else ctx.drawImage(tv.canvas, 0, 0);
  tv.hot = tv.hot.filter((c) => now - c.t0 < HOT_TIME);
  if (!tv.hot.length) return;
  ctx.globalCompositeOperation = 'lighter';
  const sprite = glow(look.hot);
  for (const c of tv.hot) {
    const a = 1 - (now - c.t0) / HOT_TIME;
    ctx.globalAlpha = a * a;
    ctx.strokeStyle = look.hot;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r + 1, 0.15, Math.PI - 0.15);
    ctx.stroke();
    ctx.globalAlpha = a * a * 0.5;
    ctx.drawImage(sprite, c.x - c.r * 1.2, c.y - c.r * 0.6, c.r * 2.4, c.r * 1.8);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

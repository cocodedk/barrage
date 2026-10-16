// The death liquid: a translucent body under an animated sine-shimmer surface. Lava (and
// neon water) glows additively and bubbles.
import { W, H, rgba, mix, shade, hash, glow, wrap } from './sprites.js';

const STEP = 16;
const bodies = new WeakMap(); // level -> its body gradient, built on the first frame

const surface = (x, y, t) => y + Math.sin(x * 0.021 + t * 2.1) * 2.6 + Math.sin(x * 0.0067 - t * 1.3) * 2.2;

function bubbles(ctx, y, t, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  for (let i = 0; i < 16; i++) {
    const period = 1.6 + hash(i + 7) * 2.2;
    const ph = (t / period + hash(i)) % 1;
    const x = wrap(hash(i + 3) * W + Math.floor(t / period + hash(i)) * 397, 0, W);
    const r = 2 + ph * (6 + hash(i + 9) * 8);
    ctx.globalAlpha = ph < 0.85 ? 0.9 : (1 - ph) * 6;
    ctx.beginPath();
    ctx.arc(x, surface(x, y, t) + 3 - r * 0.3, r, Math.PI, 0);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export function drawLiquid(ctx, level, look, t) {
  const { kind, color, y } = level.liquid;
  const hot = kind === 'lava';
  const glowy = hot || look.glow > 0.6;
  // body
  let gr = bodies.get(level);
  if (!gr) {
    gr = ctx.createLinearGradient(0, y - 4, 0, H);
    gr.addColorStop(0, rgba(hot ? mix(color, '#ffe07a', 0.55) : color, hot ? 0.96 : 0.62));
    gr.addColorStop(0.35, rgba(color, hot ? 0.95 : 0.78));
    gr.addColorStop(1, rgba(shade(color, -0.55), 0.95));
    bodies.set(level, gr);
  }
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.moveTo(-200, H + 200);
  for (let x = -200; x <= W + 200; x += STEP) ctx.lineTo(x, surface(x, y, t));
  ctx.lineTo(W + 200, H + 200);
  ctx.fill();
  // a second, slower ripple line just below the surface
  ctx.strokeStyle = rgba(shade(color, 0.5), 0.25);
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = -200; x <= W + 200; x += STEP) ctx.lineTo(x, surface(x * 1.3 + 90, y + 9, t * 0.7));
  ctx.stroke();
  // bright surface line
  ctx.strokeStyle = hot ? '#fff0a0' : rgba(shade(color, 0.7), 0.9);
  ctx.lineWidth = hot ? 3 : 2;
  ctx.beginPath();
  for (let x = -200; x <= W + 200; x += STEP) ctx.lineTo(x, surface(x, y, t));
  ctx.stroke();
  ctx.globalCompositeOperation = 'lighter';
  if (glowy) {
    const sprite = glow(hot ? '#ff7a1a' : color);
    for (let x = -60, i = 0; x < W + 60; x += 90, i++) {
      ctx.globalAlpha = 0.28 + 0.12 * Math.sin(t * 1.7 + i * 1.3);
      ctx.drawImage(sprite, x - 90, y - 70, 180, 140);
    }
  }
  // glints riding the surface
  const g = glow(shade(color, 0.8));
  for (let i = 0; i < 22; i++) {
    const x = wrap(hash(i + 40) * W + t * (hash(i + 41) - 0.5) * 60, 0, W);
    ctx.globalAlpha = Math.max(0, Math.sin(t * (1.5 + hash(i + 42) * 2) + i * 2.1)) * 0.8;
    ctx.drawImage(g, x - 10, surface(x, y, t) - 4, 20, 8);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  if (hot) bubbles(ctx, y, t, '#ffd24a');
}

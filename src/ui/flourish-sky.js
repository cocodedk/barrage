// Animated sky flourishes, drawn behind the land in fixed screen space (the sky is far away).
// Everything is a pure function of t; prebuilt sprites live in v.cache.
import { W, H, makeCanvas, rgba, mix, hash, soft } from './sprites.js';
import { cloud } from './sky-paint.js';
import { bolt, flash, streaks } from './flourish-strikes.js';

const wrap = (v, lo, hi) => lo + ((((v - lo) % (hi - lo)) + (hi - lo)) % (hi - lo));
const lighter = (ctx) => { ctx.globalCompositeOperation = 'lighter'; };
const normal = (ctx) => { ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; };

function clouds(ctx, v, t) {
  const top = v.level.sky[0][1];
  v.cache.clouds ??= [0, 1, 2, 3].map((i) => {
    const c = makeCanvas(640, 360);
    cloud(c.getContext('2d'), 320, 190, 300 + i * 20, mix(top, '#ffffff', 0.9), mix(top, '#ffffff', 0.6), 70 + i);
    return c;
  });
  v.cache.clouds.forEach((c, i) => {
    const x = wrap(hash(i + 90) * W + t * (8 + i * 4), -600, W + 100);
    ctx.globalAlpha = 0.85 - i * 0.1;
    ctx.drawImage(c, x, i * 70 + hash(i + 91) * 60, 640 * (1 - i * 0.12), 360 * (1 - i * 0.12));
  });
  ctx.globalAlpha = 1;
}

function birds(ctx, v, t) {
  ctx.strokeStyle = rgba(mix(v.level.sky[0][1], '#000000', 0.65), 0.75);
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const x = wrap(t * 42 + (i % 3) * 38 + i * 22, -300, W + 300);
    const y = 230 + Math.abs(i - 3) * 16 + Math.sin(t * 0.7 + i) * 6;
    const f = Math.sin(t * 7 + i * 1.3) * 5;
    ctx.moveTo(x - 9, y - f);
    ctx.quadraticCurveTo(x - 4, y - 2, x, y);
    ctx.quadraticCurveTo(x + 4, y - 2, x + 9, y - f);
  }
  ctx.stroke();
}

// Bats flitting around the moon on looping paths, wings beating.
function bats(ctx, v, t) {
  ctx.fillStyle = '#05060c';
  for (let i = 0; i < 7; i++) {
    const a = t * (0.25 + hash(i + 140) * 0.2) + i * 0.9;
    const x = 1480 + Math.cos(a) * (260 + hash(i + 141) * 300) + Math.sin(a * 2.3) * 40;
    const y = 240 + Math.sin(a * 1.4) * (90 + hash(i + 142) * 80);
    const flap = Math.sin(t * 16 + i * 2) * 7;
    const s = 0.8 + hash(i + 143) * 0.6;
    ctx.beginPath();
    ctx.ellipse(x, y, 3 * s, 4 * s, 0, 0, Math.PI * 2);
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - 8 * s, y - 6 * s - flap, x - 16 * s, y - flap);
    ctx.quadraticCurveTo(x - 9 * s, y + 1 * s, x, y + 2 * s);
    ctx.quadraticCurveTo(x + 9 * s, y + 1 * s, x + 16 * s, y - flap);
    ctx.quadraticCurveTo(x + 8 * s, y - 6 * s - flap, x, y);
    ctx.fill();
  }
}

function haze(ctx, v, t) {
  lighter(ctx);
  for (let i = 0; i < 5; i++) {
    ctx.globalAlpha = 0.05 + 0.04 * Math.sin(t * 1.3 + i * 1.7);
    ctx.drawImage(soft('#ffb070'), -200, 640 + i * 26 + Math.sin(t * 0.9 + i) * 6, W + 400, 22);
  }
  normal(ctx);
}

function strip(color) {
  const c = makeCanvas(8, 300);
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 300);
  gr.addColorStop(0, rgba(color, 0));
  gr.addColorStop(0.25, rgba(color, 0.9));
  gr.addColorStop(0.5, rgba(color, 0.35));
  gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr;
  g.fillRect(0, 0, 8, 300);
  return c;
}

function aurora(ctx, v, t) {
  v.cache.aurora ??= [strip('#5affb0'), strip('#b06aff')];
  lighter(ctx);
  v.cache.aurora.forEach((s, k) => {
    for (let x = 0; x < W; x += 12) {
      const top = 50 + k * 70 + Math.sin(x * 0.004 + t * 0.3 + k) * 50 + Math.sin(x * 0.011 - t * 0.5) * 22;
      const h = 230 + Math.sin(x * 0.007 + t * 0.4 + k * 2) * 70;
      ctx.globalAlpha = Math.max(0, 0.32 + 0.22 * Math.sin(x * 0.019 + t * 0.9 + k)) * (k ? 0.6 : 1);
      ctx.drawImage(s, x, top, 14, h);
    }
  });
  normal(ctx);
}

function beam(color) {
  const c = makeCanvas(240, 1000);
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 1000, 0, 0);
  gr.addColorStop(0, rgba(color, 0.55));
  gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(112, 1000);
  g.lineTo(0, 0);
  g.lineTo(240, 0);
  g.lineTo(128, 1000);
  g.fill();
  return c;
}

function searchlights(ctx, v, t) {
  v.cache.beams ??= ['#7ff6ff', '#ff7ad8', '#ffffff'].map(beam);
  lighter(ctx);
  v.cache.beams.forEach((b, i) => {
    ctx.save();
    ctx.translate(360 + i * 600, H - 300);
    ctx.rotate(Math.sin(t * 0.35 + i * 2.1) * 0.55);
    ctx.globalAlpha = 0.35;
    ctx.drawImage(b, -120, -1000);
    ctx.restore();
  });
  normal(ctx);
}

function scud(ctx, v, t) {
  for (let i = 0; i < 12; i++) {
    const w = 300 + hash(i + 130) * 300;
    const x = wrap(hash(i + 131) * W + t * (50 + hash(i + 132) * 70), -w, W + w);
    ctx.globalAlpha = 0.5;
    ctx.drawImage(soft(i % 2 ? '#1a2029' : '#2b3542'), x - w / 2, 20 + hash(i + 133) * 240, w, w * 0.3);
  }
  ctx.globalAlpha = 1;
}

function pixclouds(ctx, v, t) {
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 3; i++) {
    const x = Math.round(wrap(hash(i + 160) * W + t * (10 + i * 6), -400, W + 100) / 16) * 16;
    const y = 120 + i * 110;
    const rows = [[2, 6], [0, 10], [1, 9]];
    rows.forEach(([a, b], r) => {
      ctx.fillRect(x + a * 24, y + r * 24, (b - a) * 24, 24);
    });
  }
}

export const SKY = {
  clouds: { sky: clouds }, birds: { sky: birds }, bats: { sky: bats }, haze: { sky: haze }, aurora: { sky: aurora },
  searchlights: { sky: searchlights }, scud: { sky: scud }, lightning: { sky: bolt, screen: flash },
  shooting: { sky: streaks(2.6, 0.6, ['#ffffff', '#9ab8ff'], 160, 2) },
  meteors: { sky: streaks(1.7, 0.75, ['#ffd27a', '#ff3d0a'], 260, 4) },
  pixclouds: { sky: pixclouds },
};

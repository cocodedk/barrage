// Per-level ambient particles. Stateless: every particle's position is a function of its
// index, the time t and `drift` (px of wind drift the view accumulates), so nothing is
// simulated and nothing allocates per frame.
import { W, H, hash, glow, soft, star, wrap } from './sprites.js';


const P = {}; // one scratch particle, refilled per index: no per-frame garbage
function each(a, fn) {
  const [s0, s1] = a.size;
  for (let i = 0; i < a.n; i++) {
    P.i = i;
    P.h = hash(i * 5 + 11);
    P.x0 = hash(i * 5 + 12) * (W + 200) - 100;
    P.y0 = hash(i * 5 + 13) * H;
    P.size = s0 + (s1 - s0) * hash(i * 5 + 14);
    P.ph = hash(i * 5 + 15) * Math.PI * 2;
    P.color = a.colors[i % a.colors.length];
    fn(P);
  }
}

const KINDS = {
  pollen(ctx, a, t, drift) {
    each(a, (p) => {
      const x = wrap(p.x0 + drift * 0.6 + Math.sin(t * 0.6 + p.ph) * 30, -100, W + 100);
      const y = wrap(p.y0 - t * a.speed * (0.3 + p.h) + Math.sin(t * 0.9 + p.ph) * 14, 0, H);
      ctx.globalAlpha = a.alpha * (0.5 + 0.5 * Math.sin(t * 1.3 + p.ph));
      ctx.drawImage(soft(p.color), x - p.size, y - p.size, p.size * 2, p.size * 2);
    });
  },
  dust(ctx, a, t, drift) {
    each(a, (p) => {
      const x = wrap(p.x0 + t * a.speed * (0.4 + p.h) + drift, -100, W + 100);
      const y = 300 + p.y0 * 0.7 + Math.sin(t * 1.1 + p.ph) * 12;
      ctx.globalAlpha = a.alpha;
      ctx.drawImage(soft(p.color), x - p.size * 2, y - p.size, p.size * 4, p.size * 2);
    });
  },
  leaves(ctx, a, t, drift) {
    each(a, (p) => {
      const y = wrap(p.y0 + t * a.speed * (0.6 + 0.6 * p.h), -20, H + 20);
      const x = wrap(p.x0 + drift + Math.sin(t * 1.2 + p.ph) * 40, -100, W + 100);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * 1.6 + p.ph);
      ctx.scale(Math.cos(t * 2.4 + p.ph), 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  },
  snow(ctx, a, t, drift) {
    each(a, (p) => {
      const y = wrap(p.y0 + t * a.speed * (0.4 + p.size / a.size[1]), -10, H + 10);
      const x = wrap(p.x0 + drift * (0.5 + p.h) + Math.sin(t * 0.8 + p.ph) * 22, -100, W + 100);
      ctx.globalAlpha = a.alpha;
      ctx.drawImage(soft(p.color), x - p.size, y - p.size, p.size * 2, p.size * 2);
    });
  },
  rain(ctx, a, t, drift, wind) {
    const slant = Math.max(-0.7, Math.min(0.7, wind / 220)) + 0.08;
    ctx.lineWidth = a.size[0] > 14 ? 2 : 1.5;
    a.colors.forEach((c, ci) => {
      ctx.strokeStyle = c;
      ctx.globalAlpha = a.alpha;
      ctx.beginPath();
      each(a, (p) => {
        if (p.i % a.colors.length !== ci) return;
        const y = wrap(p.y0 + t * a.speed * (0.8 + 0.4 * p.h), -60, H + 60);
        const x = wrap(p.x0 + y * slant + drift * 0.2, -100, W + 100);
        ctx.moveTo(x, y);
        ctx.lineTo(x - slant * p.size, y - p.size);
      });
      ctx.stroke();
    });
  },
  fog(ctx, a, t, drift) {
    each(a, (p) => {
      const w = p.size * 2.4;
      const x = wrap(p.x0 + t * a.speed * (0.5 + p.h) + drift * 0.3, -w, W + w);
      const y = 560 + p.h * 460;
      ctx.globalAlpha = a.alpha * (0.6 + 0.4 * Math.sin(t * 0.3 + p.ph));
      ctx.drawImage(soft(p.color), x - w, y - p.size * 0.35, w * 2, p.size * 0.7);
    });
  },
  bubbles(ctx, a, t) {
    ctx.lineWidth = 1.5;
    each(a, (p) => {
      const y = wrap(p.y0 - t * a.speed * (0.5 + p.h), -20, H + 20);
      const x = p.x0 + Math.sin(t * 1.5 + p.ph) * 12;
      ctx.globalAlpha = a.alpha;
      ctx.strokeStyle = p.color;
      ctx.beginPath();
      ctx.arc(x, y, p.size, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = p.color;
      ctx.fillRect(x - p.size * 0.45, y - p.size * 0.5, 2, 2);
    });
  },
};

const ADDITIVE = {
  fireflies(ctx, a, t) {
    each(a, (p) => {
      const x = p.x0 + Math.sin(t * 0.35 + p.ph) * 70 + Math.sin(t * 1.3 + p.i) * 10;
      const y = 140 + p.y0 * 0.8 + Math.cos(t * 0.45 + p.ph * 1.3) * 40;
      const on = Math.max(0, Math.sin(t * 1.8 + p.ph));
      ctx.globalAlpha = a.alpha * on * on;
      ctx.drawImage(glow(p.color), x - p.size, y - p.size, p.size * 2, p.size * 2);
    });
  },
  sparkles(ctx, a, t) {
    each(a, (p) => {
      const x = p.x0 + Math.sin(t * 0.3 + p.ph) * 30;
      const y = wrap(p.y0 + t * a.speed, 0, H);
      ctx.globalAlpha = a.alpha * Math.abs(Math.sin(t * 1.4 + p.ph)) ** 3;
      ctx.drawImage(star(p.color), x - p.size, y - p.size, p.size * 2, p.size * 2);
    });
  },
  glitter(ctx, a, t, drift) {
    each(a, (p) => {
      const x = wrap(p.x0 + drift * 0.4 + Math.sin(t * 0.5 + p.ph) * 18, -100, W + 100);
      const y = wrap(p.y0 + t * a.speed * (0.5 + p.h), 0, H);
      ctx.globalAlpha = a.alpha * Math.max(0, Math.sin(t * 2.2 + p.ph)) ** 6;
      ctx.drawImage(star(p.color), x - p.size, y - p.size, p.size * 2, p.size * 2);
    });
  },
  embers(ctx, a, t, drift) {
    each(a, (p) => {
      const y = wrap(p.y0 - t * a.speed * (0.5 + p.h), -20, H + 20);
      const x = wrap(p.x0 + drift * 0.5 + Math.sin(t * 2 + p.ph) * 22, -100, W + 100);
      ctx.globalAlpha = a.alpha * (0.55 + 0.45 * Math.sin(t * 9 + p.ph * 3)) * Math.min(1, y / 300);
      ctx.drawImage(glow(p.color), x - p.size * 3, y - p.size * 3, p.size * 6, p.size * 6);
    });
  },
  pixels(ctx, a, t) {
    each(a, (p) => {
      if ((Math.floor(t * 1.5 + p.ph) & 3) === 0) return;
      const x = wrap(p.x0 + t * a.speed, -100, W + 100);
      const y = wrap(p.y0 + t * a.speed * 0.5, 0, H * 0.75);
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = p.color;
      const s = Math.round(p.size / 4) * 4;
      ctx.fillRect(Math.round(x / 4) * 4, Math.round(y / 4) * 4, s, s);
    });
  },
  twinkle(ctx, a, t) {
    each(a, (p) => {
      ctx.globalAlpha = a.alpha * (0.3 + 0.7 * Math.max(0, Math.sin(t * (0.8 + p.h * 2) + p.ph)) ** 4);
      ctx.drawImage(star(p.color), p.x0 - p.size, p.y0 * 0.62 - p.size, p.size * 2, p.size * 2);
    });
  },
};

export const AMBIENT_KINDS = [...Object.keys(KINDS), ...Object.keys(ADDITIVE)];

// phase 'sky' draws only star twinkle (it belongs behind the land); 'front' the rest.
export function drawAmbient(ctx, look, t, drift, wind, phase) {
  const a = look.ambient;
  if ((a.kind === 'twinkle') !== (phase === 'sky')) return;
  const fn = KINDS[a.kind] || ADDITIVE[a.kind];
  if (!fn) return;
  if (ADDITIVE[a.kind]) ctx.globalCompositeOperation = 'lighter';
  fn(ctx, a, t, drift, wind);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

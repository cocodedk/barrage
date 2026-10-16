// Drawing for fx state (src/fx): particles by kind, shockwave rings, flashes, floating text,
// and the full-screen tint big flashes leave. Pure reads of fx; nothing is changed here.
import { W, H, INK, rgba, glow, soft } from './sprites.js';

function plain(ctx, p, chunky) {
  const f = p.life / p.max;
  const s = p.size;
  if (p.kind === 'smoke' || p.kind === 'dust') {
    ctx.globalAlpha = f * (p.kind === 'smoke' ? 0.55 : 0.6);
    if (chunky) {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - s, p.y - s, s * 2, s * 2);
    } else ctx.drawImage(soft(p.color), p.x - s * 1.4, p.y - s * 1.4, s * 2.8, s * 2.8);
    return;
  }
  ctx.globalAlpha = Math.min(1, f * 3);
  ctx.fillStyle = p.color;
  ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
}

function hot(ctx, p, chunky) {
  const f = p.life / p.max;
  ctx.globalAlpha = f;
  if (p.kind === 'spark' && !chunky) {
    ctx.strokeStyle = p.color;
    ctx.lineWidth = Math.max(1, p.size);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
    ctx.stroke();
    return;
  }
  if (chunky) {
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
    return;
  }
  const r = p.size * 4;
  ctx.drawImage(glow(p.color), p.x - r, p.y - r, r * 2, r * 2);
}

function rings(ctx, fx) {
  for (const r of fx.rings) {
    const f = r.life / r.max;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(r.color, 0.25 * f);
    ctx.lineWidth = 6 + 22 * f;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = rgba(r.color, 0.9 * f);
    ctx.lineWidth = 1.5 + 5 * f;
    ctx.stroke();
  }
}

function floaters(ctx, fx) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (const f of fx.floaters) {
    const age = f.max - f.life;
    const pop = 1 + Math.max(0, 1 - age / 0.18) * 0.6;
    ctx.globalAlpha = Math.min(1, (f.life / f.max) * 2.5);
    ctx.font = `900 ${Math.round(28 * pop)}px system-ui, sans-serif`;
    ctx.lineWidth = 6;
    ctx.strokeStyle = INK;
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

// World space, after the soldiers. chunky: pixel level, particles become squares.
export function drawFx(ctx, fx, chunky) {
  for (const p of fx.particles) if (!p.additive) plain(ctx, p, chunky);
  ctx.globalCompositeOperation = 'lighter';
  for (const p of fx.particles) if (p.additive) hot(ctx, p, chunky);
  for (const f of fx.flashes) {
    const k = f.life / f.max;
    ctx.globalAlpha = k;
    ctx.drawImage(glow('#ffe2a8'), f.x - f.r * 1.6, f.y - f.r * 1.6, f.r * 3.2, f.r * 3.2);
    ctx.drawImage(glow('#ffffff'), f.x - f.r * 0.6, f.y - f.r * 0.6, f.r * 1.2, f.r * 1.2);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  rings(ctx, fx);
  floaters(ctx, fx);
}

// Screen space: big, fresh flashes wash the whole view.
export function drawFlashTint(ctx, fx) {
  let k = 0;
  for (const f of fx.flashes) k += (f.life / f.max) * Math.min(1, f.r / 160) * 0.3;
  if (k < 0.01) return;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = `rgba(255,236,200,${Math.min(0.5, k)})`;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
}

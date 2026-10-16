// Sudden sky events on a deterministic timetable: lightning (bolt + screen flash),
// shooting stars and meteors.
import { W, H, rgba, hash, glow, lighter, normal } from './sprites.js';
import { makeRng } from '../core/rng.js';

// Lightning: in each 3.3 s slot, half the slots strike once. Returns brightness 0..1.
export function lightning(t) {
  const slot = Math.floor(t / 3.3);
  if (hash(slot + 500) > 0.55) return { k: 0, slot };
  const lt = t - slot * 3.3 - hash(slot + 501) * 2;
  if (lt < 0 || lt > 0.5) return { k: 0, slot };
  const k = lt < 0.07 ? 1 : lt < 0.14 ? 0.25 : lt < 0.22 ? 0.9 : Math.max(0, 1 - (lt - 0.22) / 0.28);
  return { k, slot };
}

export function bolt(ctx, v, t) {
  const { k, slot } = lightning(t);
  if (!k) return;
  const rng = makeRng(slot * 31 + 7);
  const paths = [[]];
  let x = 200 + rng() * (W - 400);
  for (let y = 0; y < 640; y += 28 + rng() * 20) {
    x += (rng() - 0.5) * 70;
    paths[0].push([x, y]);
    if (rng() < 0.15) paths.push([[x, y], [x + (rng() - 0.5) * 160, y + 90], [x + (rng() - 0.5) * 220, y + 170]]);
  }
  lighter(ctx);
  for (const [w, a] of [[10, 0.18], [4, 0.5], [2, 1]]) {
    ctx.lineWidth = w;
    ctx.strokeStyle = `rgba(210,225,255,${a * k})`;
    for (const p of paths) {
      ctx.beginPath();
      for (const [px, py] of p) ctx.lineTo(px, py);
      ctx.stroke();
    }
  }
  normal(ctx);
}

export function flash(ctx, v, t) {
  const { k } = lightning(t);
  if (!k) return;
  lighter(ctx);
  ctx.fillStyle = `rgba(170,190,230,${0.32 * k})`;
  ctx.fillRect(0, 0, W, H);
  normal(ctx);
}

// Shooting stars (moon) and meteors (finale): a head with a fading tail, on a timetable.
export function streaks(period, chance, colors, len, size) {
  return (ctx, v, t) => {
    lighter(ctx);
    for (let lane = 0; lane < 2; lane++) {
      const slot = Math.floor(t / period + lane * 0.5);
      if (hash(slot * 3 + lane) > chance) continue;
      const lt = (t / period + lane * 0.5 - slot) * period;
      if (lt > 1.1) continue;
      const x0 = 300 + hash(slot * 3 + lane + 1) * (W - 300);
      const x = x0 - lt * 700;
      const y = 40 + hash(slot * 3 + lane + 2) * 260 + lt * 380;
      const a = Math.min(1, lt * 6) * (1 - lt / 1.1);
      const gr = ctx.createLinearGradient(x, y, x + len, y - len * 0.54);
      gr.addColorStop(0, rgba(colors[0], a));
      gr.addColorStop(1, rgba(colors[1], 0));
      ctx.strokeStyle = gr;
      ctx.lineWidth = size;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y - len * 0.54);
      ctx.stroke();
      ctx.globalAlpha = a;
      ctx.drawImage(glow(colors[0]), x - size * 5, y - size * 5, size * 10, size * 10);
      ctx.globalAlpha = 1;
    }
    normal(ctx);
  };
}

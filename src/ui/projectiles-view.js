// Shells in flight: a glowing trail from a per-projectile history ring (keyed by object
// identity in a WeakMap, so it vanishes with the shell) and a sprite per kind. Trail points
// age by time, so a shell that comes to rest loses its tail.
import { INK, hash, glow } from './sprites.js';
import { inFlight } from '../core/weapons.js';

const TRAIL = 22;
const TRAIL_LIFE = 0.45; // s a trail point stays visible
const COLORS = {
  bazooka: '#ffb347', missile: '#ff6a3a', grenade: '#a8ff7a', cluster: '#ff8a5a',
  bomblet: '#ffd24a', dynamite: '#ff4a3a',
};

function remember(v, p, t) {
  let h = v.trails.get(p);
  if (!h) {
    h = {
      xs: new Float32Array(TRAIL), ys: new Float32Array(TRAIL), ts: new Float64Array(TRAIL), n: 0, i: 0,
    };
    v.trails.set(p, h);
  }
  const last = (h.i + TRAIL - 1) % TRAIL;
  if (h.n && Math.abs(p.x - h.xs[last]) + Math.abs(p.y - h.ys[last]) < 2) return h;
  h.xs[h.i] = p.x;
  h.ys[h.i] = p.y;
  h.ts[h.i] = t;
  h.i = (h.i + 1) % TRAIL;
  h.n = Math.min(TRAIL, h.n + 1);
  return h;
}

function trail(ctx, h, color, t) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  for (const [wide, alpha] of [[9, 0.18], [3.5, 0.75]]) {
    for (let k = 1; k < h.n; k++) {
      const a = (h.i + TRAIL - h.n + k - 1) % TRAIL;
      const b = (a + 1) % TRAIL;
      const f = (k / h.n) * (1 - (t - h.ts[b]) / TRAIL_LIFE);
      if (f <= 0) continue;
      ctx.globalAlpha = alpha * f;
      ctx.lineWidth = 1 + wide * f;
      ctx.beginPath();
      ctx.moveTo(h.xs[a], h.ys[a]);
      ctx.lineTo(h.xs[b], h.ys[b]);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

function rocket(ctx, p, t, body, stripe) {
  ctx.rotate(Math.atan2(p.vy, p.vx));
  ctx.globalCompositeOperation = 'lighter';
  const fl = 9 + Math.sin(t * 47) * 3 + hash(Math.floor(t * 30)) * 4;
  ctx.drawImage(glow('#ffb347'), -14 - fl, -fl * 0.7, fl * 2, fl * 1.4);
  ctx.fillStyle = '#fff2b0';
  ctx.beginPath();
  ctx.moveTo(-9, -2.5);
  ctx.lineTo(-9 - fl, 0);
  ctx.lineTo(-9, 2.5);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = INK;
  ctx.fillStyle = '#3a3e48';
  ctx.beginPath();
  ctx.moveTo(-9, -3);
  ctx.lineTo(-13, -7);
  ctx.lineTo(-5, -3);
  ctx.moveTo(-9, 3);
  ctx.lineTo(-13, 7);
  ctx.lineTo(-5, 3);
  ctx.fill();
  ctx.fillStyle = body;
  ctx.fillRect(-10, -3.5, 16, 7);
  ctx.strokeRect(-10, -3.5, 16, 7);
  ctx.fillStyle = stripe;
  ctx.fillRect(-4, -3.5, 3, 7);
  ctx.beginPath();
  ctx.moveTo(6, -3.5);
  ctx.lineTo(12, 0);
  ctx.lineTo(6, 3.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function ball(ctx, p, r, color, band) {
  ctx.rotate(p.x * 0.09);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = INK;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  if (band) {
    ctx.fillStyle = band;
    ctx.fillRect(-r, -1.3, r * 2, 2.6);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(-r * 0.5, -r * 0.6, r * 0.45, r * 0.35);
  ctx.fillStyle = '#c9c9c9';
  ctx.fillRect(-1.5, -r - 3, 3, 3);
}

function dynamite(ctx, t) {
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = INK;
  ctx.fillStyle = '#d8342a';
  ctx.fillRect(-4, -12, 8, 15);
  ctx.strokeRect(-4, -12, 8, 15);
  ctx.fillStyle = '#f4e6c0';
  ctx.fillRect(-4, -7, 8, 3);
  ctx.strokeStyle = '#e8d8b0';
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.quadraticCurveTo(4, -17, 1, -20);
  ctx.stroke();
  ctx.globalCompositeOperation = 'lighter';
  const s = 8 + Math.sin(t * 60) * 3;
  ctx.drawImage(glow('#ffd24a'), 1 - s, -20 - s, s * 2, s * 2);
  ctx.fillStyle = '#fff6c8';
  for (let i = 0; i < 5; i++) {
    const a = hash(Math.floor(t * 24) * 5 + i) * Math.PI * 2;
    const d = 3 + hash(Math.floor(t * 24) * 5 + i + 99) * 7;
    ctx.fillRect(1 + Math.cos(a) * d, -20 + Math.sin(a) * d, 1.5, 1.5);
  }
  ctx.globalCompositeOperation = 'source-over';
}

function fuseLabel(ctx, p) {
  if (p.fuse == null || p.kind === 'bomblet') return;
  const y = p.y - (p.kind === 'dynamite' ? 34 : 18);
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = INK;
  ctx.strokeText(String(Math.max(1, Math.ceil(p.fuse))), p.x, y);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(String(Math.max(1, Math.ceil(p.fuse))), p.x, y);
}

export function drawProjectiles(ctx, v, world, t) {
  ctx.globalCompositeOperation = 'lighter';
  for (const p of world.projectiles) {
    const h = remember(v, p, t);
    if (inFlight(p)) trail(ctx, h, COLORS[p.kind] || '#ffffff', t);
  }
  for (const p of world.projectiles) {
    ctx.globalAlpha = 0.55;
    const r = p.kind === 'bomblet' ? 14 : 22;
    ctx.drawImage(glow(COLORS[p.kind] || '#ffffff'), p.x - r, p.y - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const p of world.projectiles) {
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.kind === 'bazooka') rocket(ctx, p, t, '#d4d8e0', '#d8342a');
    else if (p.kind === 'missile') rocket(ctx, p, t, '#6b7d45', '#ffd24a');
    else if (p.kind === 'grenade') ball(ctx, p, 5.5, '#4a6b2a', null);
    else if (p.kind === 'cluster') ball(ctx, p, 6.5, '#c8432a', '#ffd24a');
    else if (p.kind === 'bomblet') ball(ctx, p, 3.8, '#ffb02a', null);
    else if (p.kind === 'dynamite') dynamite(ctx, t);
    ctx.restore();
    fuseLabel(ctx, p);
  }
}

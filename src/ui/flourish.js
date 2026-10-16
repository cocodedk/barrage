// Signature flourishes in world space, plus the dispatcher over every phase.
// Phases: 'sky' (screen space, behind the land), 'far' (just after the farthest parallax
// layer, given that layer's origin), 'mid' (after all layers), 'front' (over everything in
// the world) and 'screen' (full-screen tints after the camera).
import { W, H, rgba, shade, hash, glow, soft, star, wrap } from './sprites.js';
import { SKY } from './flourish-sky.js';
import { skyHaze } from './sky-paint.js';

function rays(ctx, v, t) {
  const warm = v.level.id === 3;
  const ox = warm ? 420 : 760;
  const oy = warm ? 190 : -80;
  const color = warm ? '#fff0c0' : '#e8ffb0';
  v.cache.rays ??= (() => {
    const gr = ctx.createLinearGradient(0, oy, 0, H);
    gr.addColorStop(0, rgba(color, 0.35));
    gr.addColorStop(1, rgba(color, 0));
    return gr;
  })();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = v.cache.rays;
  for (let i = 0; i < 6; i++) {
    const a = (warm ? 0.25 : 1.1) + i * (warm ? 0.17 : 0.16) + Math.sin(t * 0.2 + i) * 0.02;
    const spread = 0.03 + hash(i + 200) * 0.04;
    ctx.globalAlpha = 0.22 + 0.18 * Math.sin(t * 0.5 + i * 1.9);
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + Math.cos(a - spread) * 2400, oy + Math.sin(a - spread) * 2400);
    ctx.lineTo(ox + Math.cos(a + spread) * 2400, oy + Math.sin(a + spread) * 2400);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function mist(ctx, v, t) {
  const color = shade(skyHaze(v.level), 0.35);
  const sprite = soft(color);
  for (let i = 0; i < 9; i++) {
    const w = 500 + hash(i + 210) * 400;
    const x = wrap(hash(i + 211) * W + t * (10 + hash(i + 212) * 14), -w, W + w);
    ctx.globalAlpha = 0.14 + 0.06 * Math.sin(t * 0.4 + i);
    ctx.drawImage(sprite, x - w / 2, 720 + hash(i + 213) * 220, w, 90);
  }
  ctx.globalAlpha = 1;
}

function caustics(ctx, v, t) {
  ctx.globalCompositeOperation = 'lighter';
  v.cache.caustics ??= (() => { // one gradient for every shaft; each one's flicker is globalAlpha
    const gr = ctx.createLinearGradient(0, 0, 0, 980);
    gr.addColorStop(0, 'rgba(190,255,250,1)');
    gr.addColorStop(1, 'rgba(190,255,250,0)');
    return gr;
  })();
  ctx.fillStyle = v.cache.caustics;
  for (let i = 0; i < 8; i++) {
    const x = hash(i + 220) * W + Math.sin(t * 0.3 + i) * 70;
    const w = 50 + hash(i + 221) * 110;
    const lean = 160 + Math.sin(t * 0.25 + i * 2) * 60;
    ctx.globalAlpha = 0.16 + 0.08 * Math.sin(t * 0.8 + i * 1.7);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + w, 0);
    ctx.lineTo(x + w * 1.8 + lean, 980);
    ctx.lineTo(x + lean, 980);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function fish(ctx, v, t) {
  ctx.fillStyle = 'rgba(8,40,70,0.55)';
  for (let s = 0; s < 3; s++) {
    const dir = s % 2 ? -1 : 1;
    const cx = wrap(hash(s + 230) * W + dir * t * (40 + s * 12), -300, W + 300);
    const cy = 240 + s * 150 + Math.sin(t * 0.5 + s) * 30;
    for (let i = 0; i < 9; i++) {
      const x = cx + (hash(s * 20 + i) - 0.5) * 160;
      const y = cy + (hash(s * 20 + i + 9) - 0.5) * 70 + Math.sin(t * 2 + i) * 4;
      const tail = Math.sin(t * 10 + i) * 3;
      ctx.beginPath();
      ctx.ellipse(x, y, 9, 4, 0, 0, Math.PI * 2);
      ctx.moveTo(x - dir * 7, y);
      ctx.lineTo(x - dir * 15, y - 5 + tail);
      ctx.lineTo(x - dir * 15, y + 5 + tail);
      ctx.fill();
    }
  }
}

// Volcano: the far peak glows, spits lava and breathes a plume.
function eruption(ctx, v, t, terrain, x0, y0) {
  const p = v.layers[0].peak;
  if (!p) return;
  const px = x0 + p.x;
  const py = y0 + p.y;
  for (let i = 0; i < 10; i++) {
    const tau = (t / 7 + i / 10) % 1;
    const s = 40 + tau * 260;
    ctx.globalAlpha = (1 - tau) * 0.5;
    ctx.drawImage(soft(i % 2 ? '#2a0e08' : '#3a1610'), px - s / 2 + tau * 180, py - 30 - tau * 420 - s / 2, s, s);
  }
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 2.3);
  ctx.drawImage(glow('#ff6a14'), px - 160, py - 120, 320, 240);
  for (let i = 0; i < 14; i++) {
    const tau = (t / 1.8 + hash(i + 240)) % 1;
    const vx = (hash(i + 241) - 0.5) * 140;
    const vy = 160 + hash(i + 242) * 120;
    ctx.globalAlpha = 1 - tau;
    const sx = px + vx * tau * 1.8;
    const sy = py - vy * tau * 1.8 + 200 * (tau * 1.8) ** 2;
    ctx.drawImage(glow('#ffb14a'), sx - 6, sy - 6, 12, 12);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

// Glacier: sun glints winking on the ice, wherever the ice still stands.
function glints(ctx, v, t, terr) {
  v.cache.glints ??= Array.from({ length: 18 }, (_, i) => {
    const x = 40 + hash(i + 250) * (W - 80);
    return { x, y: terr.surfaceY(x) + 2 };
  });
  ctx.globalCompositeOperation = 'lighter';
  v.cache.glints.forEach((g, i) => {
    if (!terr.solid(g.x, g.y + 2)) return;
    ctx.globalAlpha = Math.max(0, Math.sin(t * 1.3 + i * 2.4)) ** 10;
    ctx.drawImage(star('#ffffff'), g.x - 14, g.y - 14, 28, 28);
  });
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function ash(ctx, v, t) {
  ctx.fillStyle = '#4a3a3a';
  for (let i = 0; i < 60; i++) {
    const y = wrap(hash(i + 260) * H + t * (30 + hash(i + 261) * 30), 0, H);
    const x = wrap(hash(i + 262) * W + Math.sin(t + i) * 30 + v.drift * 0.4, 0, W);
    ctx.fillRect(x, y, 3, 2);
  }
}

const WORLD = {
  rays: { mid: rays }, mist: { mid: mist }, caustics: { front: caustics }, fish: { mid: fish },
  eruption: { far: eruption }, glints: { front: glints }, ash: { front: ash },
};

export const FLOURISH_NAMES = [...Object.keys(WORLD), ...Object.keys(SKY)];

export function drawFlourishes(ctx, v, world, t, phase, x0, y0) {
  for (const name of v.look.flourish) {
    const f = (WORLD[name] || SKY[name])?.[phase];
    if (f) f(ctx, v, t, world.terrain, x0, y0);
  }
}

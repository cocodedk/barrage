// The 'spikes' parallax kind, styled per level: jagged rocks, branching coral, a graveyard
// fence with tombstones, or ice shards.
import { shade } from './sprites.js';
import { profile } from './parallax-shapes.js';

export function spikes(g, w, h, rng, L, style) {
  if (style === 'coral') {
    g.strokeStyle = L.color;
    g.lineCap = 'round';
    profile(g, w, h, (x) => h * 0.78 + Math.sin(x * 0.01) * 12);
    for (let x = 0; x < w; x += 30 + rng() * 60) {
      const branch = (bx, by, len, a, wd) => {
        if (wd < 2) return;
        const ex = bx + Math.cos(a) * len;
        const ey = by + Math.sin(a) * len;
        g.lineWidth = wd;
        g.beginPath();
        g.moveTo(bx, by);
        g.lineTo(ex, ey);
        g.stroke();
        branch(ex, ey, len * 0.75, a - 0.5 + rng() * 0.3, wd * 0.7);
        branch(ex, ey, len * 0.7, a + 0.3 + rng() * 0.3, wd * 0.7);
      };
      branch(x, h * 0.8, h * (0.12 + rng() * 0.12), -Math.PI / 2 + (rng() - 0.5) * 0.6, 12);
    }
    return;
  }
  if (style === 'fence') {
    profile(g, w, h, (x) => h * 0.72 + Math.sin(x * 0.006) * 10);
    for (let x = 0; x < w; x += 9) g.fillRect(x, h * 0.42 + (x % 27 === 0 ? -8 : 0), 3, h * 0.4);
    g.fillRect(0, h * 0.5, w, 4);
    for (let x = 30; x < w; x += 70 + rng() * 120) {
      const sh = 26 + rng() * 26;
      const y0 = h * 0.72 - sh;
      if (rng() < 0.5) {
        g.fillRect(x - 3, y0 - 10, 6, sh + 10);
        g.fillRect(x - 11, y0, 22, 6);
      } else {
        g.beginPath();
        g.arc(x, y0 + 10, 12, Math.PI, 0);
        g.lineTo(x + 12, y0 + sh);
        g.lineTo(x - 12, y0 + sh);
        g.fill();
      }
    }
    return;
  }
  const shard = style === 'shards';
  profile(g, w, h, (x) => h * 0.6 + Math.sin(x * 0.005) * 20);
  for (let x = -20; x < w + 20; x += 18 + rng() * 40) {
    const sh = h * (0.25 + rng() * 0.5 * L.roughness);
    const sw = shard ? 14 + rng() * 18 : 26 + rng() * 50;
    const lean = (rng() - 0.5) * sw * (shard ? 0.6 : 1);
    g.beginPath();
    g.moveTo(x - sw / 2, h * 0.65);
    g.lineTo(x + lean, h * 0.62 - sh);
    g.lineTo(x + sw / 2, h * 0.65);
    g.fill();
    if (shard) {
      g.fillStyle = shade(L.color, 0.25);
      g.beginPath();
      g.moveTo(x + lean, h * 0.62 - sh);
      g.lineTo(x + sw / 2, h * 0.65);
      g.lineTo(x + lean * 0.3, h * 0.65);
      g.fill();
      g.fillStyle = L.color;
    }
  }
}

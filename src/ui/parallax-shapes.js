// Silhouette painters for the parallax layers, one per layer kind. Each fills `g` (w wide,
// the layer's band 0..h tall plus a skirt below) in the layer colour; `rng` is seeded.
import { glow } from './sprites.js';
import { spikes } from './parallax-spikes.js';
import { pick } from '../core/rng.js';

export const SKIRT = 520; // below the band, down past the world floor

// A filled outline from a top-edge function y(x), closed down past the band.
export function profile(g, w, h, top, step = 4) {
  g.beginPath();
  g.moveTo(0, h + SKIRT);
  for (let x = 0; x <= w + step; x += step) g.lineTo(x, top(x));
  g.lineTo(w + step, h + SKIRT);
  g.closePath();
  g.fill();
}

// Sum of random sines in [-1, 1].
function waves(rng, n, base) {
  const parts = Array.from({ length: n }, (_, i) => ({
    f: base * (i + 1) * (0.7 + rng() * 0.6), p: rng() * 7, a: 1 / (i + 1),
  }));
  const norm = parts.reduce((s, p) => s + p.a, 0);
  return (x) => parts.reduce((s, p) => s + Math.sin(x * p.f + p.p) * p.a, 0) / norm;
}

// Midpoint displacement ridge, values 0..1.
function ridge(rng, n, rough) {
  const pts = Array.from({ length: n + 1 }, () => 0);
  pts[0] = rng();
  pts[n] = rng();
  for (let step = n; step > 1; step >>= 1) {
    const amp = (step / n) ** (1 - rough * 0.6);
    for (let i = step / 2; i < n; i += step) {
      pts[i] = (pts[i - step / 2] + pts[i + step / 2]) / 2 + (rng() - 0.5) * amp;
    }
  }
  const lo = Math.min(...pts);
  const hi = Math.max(...pts);
  return pts.map((p) => (p - lo) / (hi - lo || 1));
}

function forest(g, w, h, rng, L, pine) {
  profile(g, w, h, (x) => h * 0.55 + Math.sin(x * 0.004) * h * 0.06);
  for (let x = -20; x < w + 40; x += 14 + rng() * 26 * (1.2 - L.roughness)) {
    const th = h * (0.25 + rng() * 0.35);
    const base = h * 0.6;
    if (pine) {
      const tw = th * 0.32;
      for (let k = 0; k < 3; k++) {
        const ty = base - th + k * th * 0.28;
        g.beginPath();
        g.moveTo(x, ty);
        g.lineTo(x - tw * (0.6 + k * 0.25), ty + th * 0.42);
        g.lineTo(x + tw * (0.6 + k * 0.25), ty + th * 0.42);
        g.fill();
      }
    } else {
      for (let k = 0; k < 5; k++) {
        g.beginPath();
        g.arc(x + (rng() - 0.5) * th * 0.4, base - th * (0.3 + rng() * 0.4), th * (0.2 + rng() * 0.14), 0, 7);
        g.fill();
      }
    }
  }
}

function skyline(g, w, h, rng, L, out) {
  const glowSprite = glow('#ff5ad8');
  for (let x = -10; x < w; ) {
    const bw = 40 + rng() * 110;
    const bh = h * (0.3 + rng() * 0.65 * (0.5 + L.roughness));
    const top = h - bh;
    g.fillStyle = L.color;
    g.fillRect(x, top, bw - 4, bh + SKIRT);
    if (rng() < 0.35) {
      g.fillRect(x + bw / 2 - 2, top - 40, 4, 40);
      out.lights.push({ x: x + bw / 2, y: top - 42 });
    }
    const colors = ['#ffe9a8', '#7ff6ff', '#ff7ad8'];
    const wc = pick(rng, colors);
    for (let wy = top + 12; wy < h; wy += 18) {
      for (let wx = x + 8; wx < x + bw - 14; wx += 14) {
        if (rng() > 0.42) continue;
        g.fillStyle = wc;
        g.globalAlpha = 0.45 + rng() * 0.55;
        g.fillRect(wx, wy, 6, 8);
      }
    }
    g.globalAlpha = 1;
    if (rng() < 0.4) {
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.35;
      g.drawImage(glowSprite, x - 20, top - 30, bw + 40, 80);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }
    x += bw;
  }
}

export function paintLayer(g, w, h, rng, L, look, out) {
  g.fillStyle = L.color;
  const k = L.kind;
  if (k === 'hills') {
    const f = waves(rng, 3, 0.0035);
    profile(g, w, h, (x) => h * (0.3 + 0.4 * L.roughness * f(x)));
  } else if (k === 'mountains') {
    const r = ridge(rng, 64, L.roughness);
    const seg = w / 64;
    let top = 8; // highest peak away from the edges, for the volcano's eruption
    for (let i = 8; i <= 56; i++) if (r[i] > r[top]) top = i;
    out.peak = { x: top * seg, y: h * (1 - 0.95 * r[top] ** 1.3) };
    profile(g, w, h, (x) => h * (1 - 0.95 * r[Math.min(64, Math.round(x / seg))] ** 1.3), seg);
  } else if (k === 'dunes') {
    const f = waves(rng, 2, 0.003);
    profile(g, w, h, (x) => h * (0.55 - 0.35 * Math.abs(f(x)) ** 0.7));
  } else if (k === 'forest' || k === 'pines') forest(g, w, h, rng, L, k === 'pines');
  else if (k === 'skyline') skyline(g, w, h, rng, L, out);
  else if (k === 'spikes') spikes(g, w, h, rng, L, look.spikes);
  else if (k === 'waves') {
    const f = waves(rng, 4, 0.012);
    profile(g, w, h, (x) => h * (0.62 + 0.14 * f(x) * L.roughness));
    g.strokeStyle = 'rgba(220,235,245,0.35)';
    g.lineWidth = 2;
    for (let j = 0; j < 4; j++) {
      g.beginPath();
      for (let x = 0; x < w; x += 6) g.lineTo(x, h * (0.66 + j * 0.08) + Math.sin(x * 0.02 + j * 2) * 4);
      g.stroke();
    }
  } else if (k === 'blocks') {
    const f = waves(rng, 2, 0.004);
    profile(g, w, h, (x) => Math.round((h * (0.4 + 0.35 * f(Math.floor(x / 48) * 48))) / 24) * 24, 48);
  } else if (k === 'clouds') {
    // a cloud bank across the top of the band, puffy on both edges, open sky beneath
    g.fillRect(0, h * 0.08, w, h * 0.16);
    for (const [y, big] of [[0.08, 1], [0.24, 0.6]]) {
      for (let x = 0; x < w; x += 40 + rng() * 50) {
        g.beginPath();
        g.arc(x, h * y, (20 + rng() * 50 * (0.5 + L.roughness)) * big, 0, 7);
        g.fill();
      }
    }
  }
}

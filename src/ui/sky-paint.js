// Painting helpers shared by the sky, its bodies and the animated flourishes.
import { W, makeCanvas, mix, shade, hash, noise2, glow, soft } from './sprites.js';

// The level's sky colour at the very top, and at the horizon.
export const skyTop = (level) => level.sky[0][1];
export const skyHaze = (level) => level.sky[level.sky.length - 1][1];

// Colour of the sky gradient at u (0 top .. 1 bottom).
export function sampleSky(stops, u) {
  for (let i = 1; i < stops.length; i++) {
    const [s1, c1] = stops[i];
    const [s0, c0] = stops[i - 1];
    if (u <= s1) return mix(c0, c1, (u - s0) / Math.max(1e-6, s1 - s0));
  }
  return stops[stops.length - 1][1];
}

// A scatter of stars over the top `maxY` px; bright ones get a glow.
export function stars(g, n, seed, maxY, bright = 1) {
  for (let i = 0; i < n; i++) {
    const x = hash(seed + i * 3) * W;
    const y = hash(seed + i * 3 + 1) ** 1.4 * maxY;
    const m = hash(seed + i * 3 + 2);
    const a = (0.25 + 0.75 * m) * bright * (1 - (y / maxY) * 0.6);
    g.fillStyle = `rgba(255,255,255,${a})`;
    const s = m > 0.93 ? 2 : m > 0.6 ? 1.5 : 1;
    g.fillRect(x, y, s, s);
    if (m > 0.96) {
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.5 * bright;
      g.drawImage(glow('#cfe0ff'), x - 8, y - 8, 16, 16);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }
  }
}

// A plain sun: wide additive halo, then a solid disc.
export function sun(g, x, y, r, color, haloScale = 7, haloAlpha = 0.9) {
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = haloAlpha;
  const R = r * haloScale;
  g.drawImage(glow(color), x - R, y - R, R * 2, R * 2);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = shade(color, 0.55);
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

// Puffy cloud: overlapping soft discs with a lit top and shaded belly.
export function cloud(g, x, y, w, color, shadow, seed) {
  const n = 6 + Math.floor(hash(seed) * 4);
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const px = x + (u - 0.5) * w;
      const r = w * (0.16 + 0.14 * Math.sin(u * Math.PI)) * (0.8 + 0.4 * hash(seed + i));
      const py = y - Math.sin(u * Math.PI) * w * 0.08 + (pass ? -r * 0.12 : r * 0.1);
      g.drawImage(soft(pass ? color : shadow), px - r * 1.3, py - r * 1.3, r * 2.6, r * 2.6);
    }
  }
}


export function add(g, sprite, x, y, r, a = 1) {
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = a;
  g.drawImage(sprite, x - r, y - r, r * 2, r * 2);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
}

// Retro sun: vertical gradient disc with horizontal slots cut out of its lower half.
export function stripedSun(g, x, y, r, top, bottom, haloColor) {
  add(g, glow(haloColor), x, y, r * 3.2, 0.8);
  const c = makeCanvas(r * 2, r * 2);
  const s = c.getContext('2d');
  const gr = s.createLinearGradient(0, 0, 0, r * 2);
  gr.addColorStop(0, top);
  gr.addColorStop(1, bottom);
  s.fillStyle = gr;
  s.beginPath();
  s.arc(r, r, r, 0, Math.PI * 2);
  s.fill();
  s.globalCompositeOperation = 'destination-out';
  for (let i = 0, yy = r * 0.95; yy < r * 2; i++) {
    const gap = 3 + i * 2.6;
    s.fillRect(0, yy, r * 2, gap);
    yy += gap + 22 - i * 2;
  }
  g.drawImage(c, x - r, y - r);
}

export function moonDisc(g, x, y, r, color, crater) {
  g.fillStyle = color;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = crater;
  for (let i = 0; i < 9; i++) {
    const a = hash(i * 5 + 1) * Math.PI * 2;
    const d = Math.sqrt(hash(i * 5 + 2)) * r * 0.75;
    g.beginPath();
    g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.06 + hash(i * 5 + 3) * 0.14), 0, Math.PI * 2);
    g.fill();
  }
}

// Earth seen from the moon: oceans, noise continents, cloud swirls, night side, atmosphere.
export function earth(g, x, y, r) {
  add(g, glow('#4aa8ff'), x, y, r * 2.1, 0.9);
  const d = r * 2;
  const c = makeCanvas(d, d);
  const s = c.getContext('2d');
  const img = s.createImageData(d, d);
  for (let py = 0; py < d; py++) {
    for (let px = 0; px < d; px++) {
      const nx = (px - r) / r;
      const ny = (py - r) / r;
      const rr = nx * nx + ny * ny;
      if (rr > 1) continue;
      const land = noise2(px, py, 34, 3) * 0.7 + noise2(px, py, 11, 4) * 0.3;
      const cl = noise2(px * 0.6 + py * 0.9, py * 0.5, 14, 9);
      let col = land > 0.56 ? (land > 0.66 ? [196, 170, 110] : [70, 150, 70]) : [24, 86, 190];
      if (cl > 0.62) col = [240, 246, 255];
      const lit = Math.max(0.08, Math.min(1, 0.55 + nx * 0.7 - ny * 0.35)) * (1 - rr * 0.25);
      const i = (py * d + px) * 4;
      img.data[i] = col[0] * lit;
      img.data[i + 1] = col[1] * lit;
      img.data[i + 2] = col[2] * lit;
      img.data[i + 3] = 255;
    }
  }
  s.putImageData(img, 0, 0);
  g.drawImage(c, x - r, y - r);
  g.strokeStyle = 'rgba(140,200,255,0.55)';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(x, y, r + 1, -2.4, 0.9);
  g.stroke();
}

export function milkyWay(g) {
  for (let i = 0; i < 260; i++) {
    const u = hash(900 + i);
    const off = (hash(1900 + i) - 0.5) * 220;
    const x = u * W;
    const y = 80 + u * 520 + off;
    const r = 30 + hash(2900 + i) * 60;
    g.globalAlpha = 0.05;
    g.drawImage(soft(i % 3 ? '#9aa6ff' : '#e0c8ff'), x - r, y - r, r * 2, r * 2);
  }
  g.globalAlpha = 1;
  stars(g, 220, 4000, 760, 0.8);
}

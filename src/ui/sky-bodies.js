// Celestial bodies baked into each level's sky, one painter per look.sky name.
import { W, rgba, hash, glow, soft } from './sprites.js';
import { stars, sun, cloud, add, stripedSun, moonDisc, earth, milkyWay } from './sky-paint.js';

export const BODIES = {
  sun(g) {
    sun(g, 1560, 170, 54, '#fff1a8', 6, 0.9);
    g.globalAlpha = 0.55;
    for (let i = 0; i < 3; i++) cloud(g, 300 + i * 520, 330 + i * 30, 260, '#ffffff', '#dbeefa', 30 + i);
    g.globalAlpha = 1;
  },
  sunset: (g) => stripedSun(g, 1230, 690, 210, '#fff2a0', '#ff4f7b', '#ff7a5a'),
  synth(g) {
    stars(g, 140, 77, 560, 0.9);
    stripedSun(g, 960, 650, 250, '#ffe66d', '#ff2d95', '#ff2d95');
  },
  hazy(g) {
    add(g, glow('#fff0c0'), 420, 190, 520, 0.85);
    sun(g, 420, 190, 58, '#fff4d0', 4, 0.6);
  },
  pale: (g) => sun(g, 1500, 150, 26, '#eaf6ff', 9, 0.8),
  canopy(g) {
    add(g, glow('#e8ffb0'), 760, 40, 600, 0.45);
    for (let i = 0; i < 46; i++) {
      const x = hash(i + 300) * W;
      const r = 50 + hash(i + 400) * 90;
      g.globalAlpha = 0.85;
      g.drawImage(soft(i % 2 ? '#0a2a1e' : '#0f3a28'), x - r, -r * 1.2, r * 2, r * 2);
    }
    g.globalAlpha = 1;
  },
  rainbow(g) {
    sun(g, 300, 170, 46, '#fff6d8', 6, 0.7);
    const bands = ['#ff6a8a', '#ffab5a', '#ffe86a', '#7cf08a', '#6ac8ff', '#a98aff'];
    g.lineWidth = 26;
    bands.forEach((c, i) => {
      g.strokeStyle = rgba(c, 0.33);
      g.beginPath();
      g.arc(1180, 1200, 820 - i * 25, Math.PI * 1.08, Math.PI * 1.92);
      g.stroke();
    });
  },
  moon(g) {
    stars(g, 180, 11, 700, 0.8);
    add(g, glow('#b8b0ff'), 1480, 220, 420, 0.75);
    moonDisc(g, 1480, 220, 92, '#f2eeff', 'rgba(170,160,210,0.28)');
  },
  storm(g) {
    for (let i = 0; i < 14; i++) cloud(g, (i / 13) * W, 60 + hash(i + 50) * 260, 420, '#3c4858', '#1d2530', 60 + i);
  },
  surface(g) {
    add(g, glow('#bff8ff'), 1300, -60, 700, 0.6);
    g.strokeStyle = 'rgba(220,255,255,0.18)';
    g.lineWidth = 3;
    for (let k = 0; k < 6; k++) {
      g.beginPath();
      for (let x = 0; x <= W; x += 24) g.lineTo(x, 14 + k * 16 + Math.sin(x * 0.012 + k * 1.7) * 6);
      g.stroke();
    }
  },
  volcano(g) {
    stars(g, 60, 5, 300, 0.4);
    add(g, glow('#ff4a14'), 960, 1180, 1200, 0.9);
    g.globalAlpha = 0.5;
    moonDisc(g, 470, 250, 48, '#ff9a6a', 'rgba(150,40,20,0.4)');
    g.globalAlpha = 1;
  },
  pixelsun(g) {
    const cx = 1500;
    const cy = 200;
    for (let y = -6; y <= 6; y++) {
      for (let x = -6; x <= 6; x++) {
        const d = Math.hypot(x, y);
        if (d > 6.2) continue;
        g.fillStyle = d > 5 ? '#ffb040' : d > 3.5 ? '#ffe04a' : '#fff7b0';
        g.fillRect(cx + x * 16, cy + y * 16, 16, 16);
      }
    }
  },
  halo(g) {
    sun(g, 1400, 220, 30, '#ffffff', 8, 0.85);
    g.lineWidth = 16;
    g.strokeStyle = 'rgba(255,255,255,0.14)';
    g.beginPath();
    g.arc(1400, 220, 230, 0, Math.PI * 2);
    g.stroke();
    add(g, glow('#ffe0c0'), 1170, 220, 50, 0.8);
    add(g, glow('#ffe0c0'), 1630, 220, 50, 0.8);
  },
  earth(g) {
    milkyWay(g);
    earth(g, 1470, 230, 104);
  },
  eclipse(g) {
    const x = 760;
    const y = 225;
    stars(g, 90, 21, 520, 0.5);
    add(g, glow('#ff5a2a'), x, y, 520, 1);
    add(g, glow('#ffd0a0'), x, y, 170, 0.9);
    g.strokeStyle = 'rgba(255,190,140,0.25)';
    g.lineWidth = 2;
    for (let i = 0; i < 40; i++) {
      const a = hash(i + 700) * Math.PI * 2;
      const l = 100 + hash(i + 800) * 140;
      g.beginPath();
      g.moveTo(x + Math.cos(a) * 84, y + Math.sin(a) * 84);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
    g.fillStyle = '#12000a';
    g.beginPath();
    g.arc(x, y, 82, 0, Math.PI * 2);
    g.fill();
    add(g, glow('#fff0d8'), x - 60, y - 54, 36, 1);
  },
};

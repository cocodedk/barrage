// The sky: level gradient plus its celestial body, baked once per level to one canvas.
import { W, H, makeCanvas, rgba } from './sprites.js';
import { BODIES } from './sky-bodies.js';
import { sampleSky } from './sky-paint.js';

// Linear sky gradient over height h (pixel levels get hard 8-bit colour bands).
function skyGradient(g, level, h) {
  if (level.pixel) {
    const bands = 12;
    for (let i = 0; i < bands; i++) {
      g.fillStyle = sampleSky(level.sky, (i + 0.5) / bands);
      g.fillRect(0, Math.floor((i * h) / bands), W, Math.ceil(h / bands) + 1);
    }
    return;
  }
  const gr = g.createLinearGradient(0, 0, 0, h);
  for (const [stop, color] of level.sky) gr.addColorStop(stop, color);
  g.fillStyle = gr;
  g.fillRect(0, 0, W, h);
}

export function buildSky(level, look) {
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  skyGradient(g, level, H);
  const body = BODIES[look.sky];
  if (body) body(g, level);
  // a soft horizon glow ties the sky to the far layers
  const hz = g.createLinearGradient(0, H * 0.55, 0, H);
  hz.addColorStop(0, rgba(level.sky[level.sky.length - 1][1], 0));
  hz.addColorStop(1, rgba(level.sky[level.sky.length - 1][1], 0.35));
  g.fillStyle = hz;
  g.fillRect(0, H * 0.55, W, H * 0.45);
  return c;
}

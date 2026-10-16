// The renderer. createView bakes everything static for a level (sky, parallax, terrain);
// drawFrame draws one frame of world + fx through the camera, then the HUD.
//   createView(canvas, level, world) -> view
//   drawFrame(view, world, fx, camera, t)   t: seconds, any monotonic clock
//   view.onCrater(x, y, r)                  cut a crater the core already carved
//   rebuildTerrain(view, world)             new match on the same level: re-bake terrain and
//                                           parallax, reset banner, trails, squash, drift
//   view.cursor = { x, y } | null           airstrike target (world px), from the input layer
// The canvas is sized to its CSS box; the 1920 x 1080 world is letterboxed into it, and the
// backing store never exceeds 1:1 with the world (Pi 4 fill rate).
import { W, H, makeCanvas, shade } from './sprites.js';
import { lookFor } from './looks.js';
import { buildSky } from './sky.js';
import { buildLayers, drawLayers, horizonOf } from './parallax.js';
import { bakeTerrain, cutTerrain, drawTerrain } from './terrain-view.js';
import { drawLiquid } from './liquid.js';
import { drawAmbient } from './ambient.js';
import { drawFlourishes } from './flourish.js';
import { drawUnits } from './units-view.js';
import { drawProjectiles } from './projectiles-view.js';
import { drawFx, drawFlashTint } from './fx-view.js';
import { drawHud } from './hud.js';

const HOME = { x: W / 2, y: H / 2, zoom: 1 };
const NO_FX = { particles: [], rings: [], flashes: [], floaters: [], graves: [], shakeX: 0, shakeY: 0 };

export function createView(canvas, level, world) {
  const look = lookFor(level);
  const v = {
    canvas, ctx: canvas.getContext('2d'), level, look, world,
    sky: buildSky(level, look), low: level.pixel ? makeCanvas(W / 4, H / 4) : null,
    lastT: null, now: 0, showHud: true, fit: { css: '', s: 1, ox: 0, oy: 0 },
    cursor: null, // { x, y } airstrike target, set by the input layer; null hides the marker
  };
  v.onCrater = (x, y, r) => cutTerrain(v.terrain, x, y, r, level, look, v.now);
  rebuildTerrain(v, world);
  return v;
}

// Start over on a new world of the same level (a new match): re-bake the terrain and the
// parallax (its horizon follows the new ground) and forget every per-match visual state.
export function rebuildTerrain(v, world) {
  v.world = world;
  v.layers = buildLayers(v.level, v.look, horizonOf(world.terrain));
  v.terrain = bakeTerrain(world.terrain, v.level, v.look);
  v.unitFx = new Map();
  v.trails = new WeakMap();
  v.cache = {};
  v.hud = { key: null, t0: 0 };
  v.drift = 0;
  v.cursor = null;
}

// Match the backing store to the CSS box (capped at world resolution) and refit the world.
function fit(v) {
  const c = v.canvas;
  const cssW = c.clientWidth || c.width;
  const cssH = c.clientHeight || c.height;
  const dpr = globalThis.devicePixelRatio || 1;
  const key = `${cssW}x${cssH}@${dpr}`;
  if (key === v.fit.css) return v.fit;
  const rawW = cssW * dpr;
  const rawH = cssH * dpr;
  const fitRaw = Math.min(rawW / W, rawH / H);
  const s = Math.min(1, fitRaw);
  c.width = Math.max(1, Math.round((rawW * s) / fitRaw));
  c.height = Math.max(1, Math.round((rawH * s) / fitRaw));
  const oy = (c.height - H * s) / 2;
  // letterbox: the sky's top colour above the world, the deep liquid below it
  const g = v.ctx.createLinearGradient(0, 0, 0, c.height);
  g.addColorStop(0, v.level.sky[0][1]);
  g.addColorStop(Math.min(1, oy / c.height + 0.01), v.level.sky[0][1]);
  g.addColorStop(Math.max(0, 1 - oy / c.height - 0.01), shade(v.level.liquid.color, -0.6));
  g.addColorStop(1, shade(v.level.liquid.color, -0.6));
  v.fit = { css: key, s, ox: (c.width - W * s) / 2, oy, letterbox: g };
  return v.fit;
}

function camera(g, cam, fx) {
  g.translate(W / 2, H / 2);
  g.scale(cam.zoom, cam.zoom);
  g.translate(-cam.x + fx.shakeX, -cam.y + fx.shakeY);
}

// Sky, parallax, terrain and liquid: everything a pixel level renders chunky.
function backdrop(g, v, cam, fx, t) {
  g.drawImage(v.sky, 0, 0);
  drawAmbient(g, v.look, t, v.drift, v.world.wind, 'sky');
  drawFlourishes(g, v, t, 'sky');
  g.save();
  camera(g, cam, fx);
  drawLayers(g, v.layers, cam, t, (i, x0, y0) => i === 0 && drawFlourishes(g, v, t, 'far', x0, y0));
  drawFlourishes(g, v, t, 'mid');
  drawTerrain(g, v.terrain, v.look, t);
  drawLiquid(g, v.level, v.look, t);
  g.restore();
}

export function drawFrame(v, world, fx = NO_FX, cam = HOME, t = 0) {
  const dt = v.lastT == null ? 0 : Math.min(0.1, Math.max(0, t - v.lastT));
  v.lastT = t;
  v.now = t;
  v.world = world;
  v.drift += (world.wind || 0) * dt * 0.9;
  const f = fit(v);
  const ctx = v.ctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = f.letterbox;
  ctx.fillRect(0, 0, v.canvas.width, v.canvas.height);
  ctx.setTransform(f.s, 0, 0, f.s, f.ox, f.oy);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  if (v.low) {
    const g = v.low.getContext('2d');
    g.setTransform(0.25, 0, 0, 0.25, 0, 0);
    g.imageSmoothingEnabled = false;
    backdrop(g, v, cam, fx, t);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(v.low, 0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
  } else backdrop(ctx, v, cam, fx, t);
  ctx.save();
  camera(ctx, cam, fx);
  drawUnits(ctx, v, world, fx, t, dt);
  drawProjectiles(ctx, v, world, t);
  drawFx(ctx, fx, !!v.level.pixel);
  drawAmbient(ctx, v.look, t, v.drift, world.wind, 'front');
  drawFlourishes(ctx, v, t, 'front');
  ctx.restore();
  drawFlourishes(ctx, v, t, 'screen');
  drawFlashTint(ctx, fx);
  ctx.restore();
  if (v.showHud) drawHud(ctx, world, v.hud, t);
}

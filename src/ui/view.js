// The renderer. createView bakes everything static for a level (sky, parallax, terrain);
// drawFrame draws one frame of world + fx through the camera, then the HUD.
//   createView(canvas, level, world) -> view
//   drawFrame(view, world, fx, camera, t)   t: seconds, any monotonic clock
//   view.onCrater(x, y, r)                  cut a crater the core already carved
//   replayTerrain(view)                     same seed again: restore the kept bake, no re-bake
//   warmFrame(view, world, fx, camera)      draw one unseen frame, so the first real one is not slow
//   view.cursor = { x, y } | null           airstrike target (world px), from the input layer
// The canvas is sized to its CSS box; the 1920 x 1080 world is letterboxed into it, and the
// backing store never exceeds 1:1 with the world (Pi 4 fill rate).
import { W, H, makeCanvas, shade } from './sprites.js';
import { skyTop } from './sky-paint.js';
import { clamp } from '../core/math.js';
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

// keepBake: hold a copy of the fresh terrain bake so replayTerrain can restore it (the title battle).
export function createView(canvas, level, world, keepBake = false) {
  const look = lookFor(level);
  const v = {
    canvas, ctx: canvas.getContext('2d'), level, look,
    sky: buildSky(level, look), low: level.pixel ? makeCanvas(W / 4, H / 4) : null,
    lastT: null, now: 0, showHud: true, fit: { css: '', s: 1, ox: 0, oy: 0 },
    cursor: null, // { x, y } airstrike target, set by the input layer; null hides the marker
  };
  v.onCrater = (x, y, r) => cutTerrain(v.terrain, x, y, r, level, look, v.now);
  rebuildTerrain(v, world, keepBake);
  return v;
}

// Bake the terrain and the parallax (its horizon follows the ground) and reset every
// per-match visual state.
function rebuildTerrain(v, world, keepBake = false) {
  v.layers = buildLayers(v.level, v.look, horizonOf(world.terrain));
  v.terrain = bakeTerrain(world.terrain, v.level, v.look);
  v.pristine = null;
  if (keepBake) {
    const c = v.terrain.canvas;
    v.pristine = makeCanvas(c.width, c.height);
    v.pristine.getContext('2d').drawImage(c, 0, 0);
  }
  v.cache = {}; // flourish sprites and gradients: they belong to the level, so a replay keeps them
  freshVisuals(v);
}

// The same ground again (same level and seed): put the fresh bake back with one drawImage
// instead of baking, which stalls a Pi 4 for about a second.
export function replayTerrain(v) {
  const { canvas, ctx } = v.terrain;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(v.pristine, 0, 0);
  v.terrain.hot = [];
  freshVisuals(v);
}

function freshVisuals(v) {
  v.unitFx = new Map();
  v.trails = new WeakMap();
  v.hud = { key: null, t0: 0 };
  v.drift = 0;
  v.cursor = null;
}

// Draw one frame and throw it away: sprites, gradients, flourish caches and the bakes' first
// trip to the GPU happen now, unseen, not in the first frame the player sees.
// Then it is undone: the canvas gets its pixels back, both canvases their default state, the
// first real frame refits (as it would have) and the per-match state starts over.
export function warmFrame(v, world, fx, cam) {
  const c = v.canvas;
  const keep = makeCanvas(c.width, c.height);
  keep.getContext('2d').drawImage(c, 0, 0);
  drawFrame(v, world, fx, cam, 0);
  c.width = keep.width; // setting the size clears the canvas and resets its context
  c.height = keep.height;
  v.ctx.drawImage(keep, 0, 0);
  if (v.low) v.low.width = W / 4; // same size: blank again, default state
  v.fit.css = '';
  freshVisuals(v);
  v.lastT = null;
  v.now = 0;
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
  g.addColorStop(0, skyTop(v.level));
  g.addColorStop(Math.min(1, oy / c.height + 0.01), skyTop(v.level));
  g.addColorStop(Math.max(0, 1 - oy / c.height - 0.01), shade(v.level.liquid.color, -0.6));
  g.addColorStop(1, shade(v.level.liquid.color, -0.6));
  v.fit = { css: key, s, ox: (c.width - W * s) / 2, oy, letterbox: g };
  return v.fit;
}

// Fill only the bars beside the world, 1 px into it so its antialiased edge has them beneath;
// nothing at all when the world fills the canvas (most frames, and a full 1080p fill on a Pi).
function letterbox(ctx, f, c) {
  const x1 = f.ox + W * f.s;
  const y1 = f.oy + H * f.s;
  ctx.fillStyle = f.letterbox;
  if (f.ox >= 1e-3) {
    ctx.fillRect(0, 0, f.ox + 1, c.height);
    ctx.fillRect(x1 - 1, 0, c.width - x1 + 1, c.height);
  }
  if (f.oy >= 1e-3) {
    ctx.fillRect(0, 0, c.width, f.oy + 1);
    ctx.fillRect(0, y1 - 1, c.width, c.height - y1 + 1);
  }
}

function camera(g, cam, fx) {
  g.translate(W / 2, H / 2);
  g.scale(cam.zoom, cam.zoom);
  g.translate(-cam.x + fx.shakeX, -cam.y + fx.shakeY);
}

// Sky, parallax, terrain and liquid: everything a pixel level renders chunky.
function backdrop(g, v, world, cam, fx, t) {
  g.drawImage(v.sky, 0, 0);
  drawAmbient(g, v.look, t, v.drift, world.wind, 'sky');
  drawFlourishes(g, v, world, t, 'sky');
  g.save();
  camera(g, cam, fx);
  drawLayers(g, v.layers, cam, t, (i, x0, y0) => i === 0 && drawFlourishes(g, v, world, t, 'far', x0, y0));
  drawFlourishes(g, v, world, t, 'mid');
  drawTerrain(g, v.terrain, v.look, t);
  drawLiquid(g, v.level, v.look, t);
  g.restore();
}

export function drawFrame(v, world, fx, cam, t = 0) {
  const dt = v.lastT == null ? 0 : clamp(t - v.lastT, 0, 0.1);
  v.lastT = t;
  v.now = t;
  v.drift += (world.wind || 0) * dt * 0.9;
  const f = fit(v);
  const ctx = v.ctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  letterbox(ctx, f, v.canvas);
  ctx.setTransform(f.s, 0, 0, f.s, f.ox, f.oy);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.clip();
  if (v.low) {
    const g = v.low.getContext('2d');
    g.setTransform(0.25, 0, 0, 0.25, 0, 0);
    g.imageSmoothingEnabled = false;
    backdrop(g, v, world, cam, fx, t);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(v.low, 0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
  } else backdrop(ctx, v, world, cam, fx, t);
  ctx.save();
  camera(ctx, cam, fx);
  drawUnits(ctx, v, world, fx, t, dt);
  drawProjectiles(ctx, v, world, t);
  drawFx(ctx, fx, !!v.level.pixel);
  drawAmbient(ctx, v.look, t, v.drift, world.wind, 'front');
  drawFlourishes(ctx, v, world, t, 'front');
  ctx.restore();
  drawFlourishes(ctx, v, world, t, 'screen');
  drawFlashTint(ctx, fx);
  ctx.restore();
  if (v.showHud) drawHud(ctx, world, v.hud, t);
}

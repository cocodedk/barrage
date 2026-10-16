// Placeholder boot: shows level 1's sky and terrain. Replaced by the real loop in Task 6.
import { LEVELS } from './core/levels.js';
import { generateTerrain, WORLD_W, WORLD_H } from './core/terrain-gen.js';
import { makeRng } from './core/rng.js';

const level = LEVELS[0];
const ctx = document.getElementById('game').getContext('2d');

const sky = ctx.createLinearGradient(0, 0, 0, WORLD_H);
for (const [stop, color] of level.sky) sky.addColorStop(stop, color);
ctx.fillStyle = sky;
ctx.fillRect(0, 0, WORLD_W, WORLD_H);

const terrain = generateTerrain(level.terrain, makeRng(1));
const ground = ctx.createLinearGradient(0, 0, 0, WORLD_H);
ground.addColorStop(0, level.fill[0]);
ground.addColorStop(1, level.fill[1]);
const layer = document.createElement('canvas');
layer.width = WORLD_W;
layer.height = WORLD_H;
const lctx = layer.getContext('2d');
lctx.fillStyle = ground;
lctx.fillRect(0, 0, WORLD_W, WORLD_H);
const px = lctx.getImageData(0, 0, WORLD_W, WORLD_H);
for (let i = 0; i < terrain.mask.length; i++) if (!terrain.mask[i]) px.data[i * 4 + 3] = 0;
lctx.putImageData(px, 0, 0);
ctx.drawImage(layer, 0, 0);

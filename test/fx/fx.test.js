import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../../src/core/rng.js';
import { createFx, stepFx } from '../../src/fx/fx.js';
import { applyEvent } from '../../src/fx/react.js';

const level = { fill: ['#7b5233', '#3b2515'], liquid: { kind: 'water', color: '#2a8fd6', y: 1020 } };
const boom = (r) => ({ type: 'explosion', x: 500, y: 400, r });
const run = (fx, secs) => { for (let i = 0; i < secs * 60; i++) stepFx(fx, 1 / 60); };

test('explosion creates flash, shockwave, debris in terrain colour, smoke, sparks and shake', () => {
  const fx = createFx();
  applyEvent(fx, boom(60), makeRng(1), level);
  assert.equal(fx.flashes.length, 1);
  assert.equal(fx.rings.length, 1);
  assert.ok(fx.shake > 0);
  const kinds = new Set(fx.particles.map((p) => p.kind));
  for (const k of ['debris', 'smoke', 'spark']) assert.ok(kinds.has(k), k);
  const debris = fx.particles.filter((p) => p.kind === 'debris');
  assert.ok(debris.length > 0);
  assert.ok(debris.every((p) => level.fill.includes(p.color) && p.gravity > 0));
  assert.ok(fx.particles.filter((p) => p.kind === 'spark').every((p) => p.additive));
  assert.ok(fx.particles.filter((p) => p.kind === 'smoke').every((p) => p.gravity < 0 && p.grow > 0));
});

test('shockwave expands then expires', () => {
  const fx = createFx();
  applyEvent(fx, boom(60), makeRng(1), level);
  const r0 = fx.rings[0].r;
  run(fx, 0.2);
  assert.ok(fx.rings[0].r > r0);
  run(fx, 2);
  assert.equal(fx.rings.length, 0);
  assert.equal(fx.flashes.length, 0);
});

test('shake is proportional to explosion radius', () => {
  const a = createFx();
  const b = createFx();
  applyEvent(a, boom(30), makeRng(1), level);
  applyEvent(b, boom(90), makeRng(1), level);
  assert.ok(b.shake > a.shake * 2);
});

test('shake decays to exactly 0 and the offset follows', () => {
  const fx = createFx();
  applyEvent(fx, boom(100), makeRng(1), level);
  stepFx(fx, 1 / 60);
  assert.ok(Math.abs(fx.shakeX) + Math.abs(fx.shakeY) > 0);
  run(fx, 3);
  assert.equal(fx.shake, 0);
  assert.equal(fx.shakeX, 0);
  assert.equal(fx.shakeY, 0);
});

test('damage floats rising, fading text', () => {
  const fx = createFx();
  applyEvent(fx, { type: 'damage', unit: 3, amount: 27.4, x: 100, y: 200 }, makeRng(1), level);
  assert.equal(fx.floaters[0].text, '-27');
  run(fx, 0.5);
  assert.ok(fx.floaters[0].y < 200);
  run(fx, 3);
  assert.equal(fx.floaters.length, 0);
});

test('explosion debris is the only bouncing kind', () => {
  const fx = createFx();
  applyEvent(fx, boom(60), makeRng(1), level);
  assert.ok(fx.particles.filter((p) => p.kind === 'debris').every((p) => p.bounce > 0));
  assert.ok(fx.particles.filter((p) => p.kind !== 'debris').every((p) => p.bounce === 0));
});

test('no gravestone for a death in the liquid, but one just above it', () => {
  const drowned = createFx();
  applyEvent(drowned, { type: 'death', unit: 2, x: 300, y: 1020 }, makeRng(1), level);
  assert.deepEqual(drowned.graves, []);
  assert.ok(drowned.particles.length > 0);
  const edge = createFx();
  applyEvent(edge, { type: 'death', unit: 2, x: 300, y: 1016 }, makeRng(1), level);
  assert.equal(edge.graves.length, 0);
  const land = createFx();
  applyEvent(land, { type: 'death', unit: 2, x: 300, y: 1015 }, makeRng(1), level);
  assert.equal(land.graves.length, 1);
  const noLevel = createFx();
  applyEvent(noLevel, { type: 'death', unit: 2, x: 300, y: 2000 }, makeRng(1), undefined);
  assert.equal(noLevel.graves.length, 1);
});

test('death adds sparks and a gravestone', () => {
  const fx = createFx();
  applyEvent(fx, { type: 'death', unit: 2, x: 300, y: 700 }, makeRng(1), level);
  assert.deepEqual(fx.graves, [{ x: 300, y: 700, unit: 2 }]);
  assert.ok(fx.particles.some((p) => p.kind === 'spark'));
});

test('splash makes droplets in the liquid colour', () => {
  const fx = createFx();
  applyEvent(fx, { type: 'splash', x: 400, y: 1020 }, makeRng(1), level);
  const drops = fx.particles.filter((p) => p.kind === 'splash');
  assert.ok(drops.length > 5);
  assert.ok(drops.every((p) => p.color === '#2a8fd6'));
});

test('fire gives a muzzle flash and smoke; bounce and land give dust', () => {
  const fx = createFx();
  applyEvent(fx, { type: 'fire', weapon: 'bazooka', x: 10, y: 10 }, makeRng(1), level);
  assert.equal(fx.flashes.length, 1);
  assert.ok(fx.particles.some((p) => p.kind === 'smoke'));
  const f2 = createFx();
  applyEvent(f2, { type: 'bounce', x: 5, y: 5 }, makeRng(1), level);
  assert.ok(f2.particles.some((p) => p.kind === 'dust'));
  const world = { teams: [{ units: [{ id: 7, x: 50, y: 60 }] }] };
  const f3 = createFx();
  applyEvent(f3, { type: 'land', unit: 7, impact: 30 }, makeRng(1), level, world);
  assert.ok(f3.particles.some((p) => p.kind === 'dust' && p.x >= 20 && p.x <= 80));
  const f4 = createFx();
  applyEvent(f4, { type: 'land', unit: 99, impact: 30 }, makeRng(1), level, world);
  assert.equal(f4.particles.length, 0);
});

test('jump and land with a world raise dust; jump without one does nothing', () => {
  const world = { teams: [{ units: [{ id: 7, x: 50, y: 60 }] }] };
  const j = createFx();
  applyEvent(j, { type: 'jump', unit: 7 }, makeRng(1), level, world);
  assert.ok(j.particles.length > 0 && j.particles.every((p) => p.kind === 'dust'));
  const none = createFx();
  applyEvent(none, { type: 'jump', unit: 7 }, makeRng(1), level);
  assert.equal(none.particles.length, 0);
  const soft = createFx();
  applyEvent(soft, { type: 'land', unit: 7, impact: 5 }, makeRng(1), level, world);
  assert.equal(soft.particles.length, 0);
});

test('the deciding kill slows time to 0.3x for 1 s of real time, then restores it', () => {
  const fx = createFx();
  assert.equal(fx.timeScale, 1);
  applyEvent(fx, { type: 'death', unit: 3, x: 500, y: 700, decisive: false }, makeRng(1), level);
  applyEvent(fx, { type: 'win', winner: 0 }, makeRng(1), level); // after settling: too late to matter
  stepFx(fx, 1 / 60);
  assert.equal(fx.timeScale, 1, 'neither an ordinary death nor the win event slows time');
  applyEvent(fx, { type: 'death', unit: 4, x: 500, y: 700, decisive: true }, makeRng(1), level);
  stepFx(fx, 1 / 60);
  assert.equal(fx.timeScale, 0.3);
  run(fx, 0.9);
  assert.equal(fx.timeScale, 0.3);
  run(fx, 0.2);
  assert.equal(fx.timeScale, 1);
});

test('a turn event leaves fx unchanged', () => {
  const fx = createFx();
  const before = JSON.stringify(fx);
  applyEvent(fx, { type: 'turn', team: 0, unit: 0, wind: 3 }, makeRng(1), level);
  assert.equal(JSON.stringify(fx), before);
});

test('a missing level is harmless', () => {
  const fx = createFx();
  applyEvent(fx, boom(40), makeRng(1), undefined);
  applyEvent(fx, { type: 'splash', x: 1, y: 1 }, makeRng(1), undefined);
  assert.ok(fx.particles.length > 0);
});

test('same seed gives the same effects', () => {
  const a = createFx();
  const b = createFx();
  applyEvent(a, boom(70), makeRng(9), level);
  applyEvent(b, boom(70), makeRng(9), level);
  assert.deepEqual(a, b);
});

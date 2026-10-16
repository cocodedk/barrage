import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS, weaponById } from '../../src/core/weapons.js';
import { flatWorld, run, shoot, eventsOf, DT, GROUND, hero, solidRect } from './helpers.js';

// Move the shooter's squad mates out of his line of fire.
const clearLine = (w) => w.teams[0].units.slice(1).forEach((u, i) => (u.x = 100 + i * 50));

test('WEAPONS carries the spec numbers', () => {
  const row = (id) => {
    const w = weaponById(id);
    return [w.r, w.damage, w.fuse, w.restitution];
  };
  assert.deepEqual(WEAPONS.map((w) => w.id), ['bazooka', 'grenade', 'cluster', 'airstrike', 'shotgun', 'dynamite']);
  assert.deepEqual(row('bazooka'), [40, 50, null, 0]);
  assert.deepEqual(row('grenade'), [40, 45, 3, 0.5]);
  assert.deepEqual(row('airstrike'), [25, 25, null, 0]);
  assert.deepEqual(row('shotgun'), [8, 25, null, 0]);
  assert.deepEqual(row('dynamite'), [70, 75, 4, 0.2]);
  assert.equal(weaponById('bazooka').windy, true);
  assert.equal(weaponById('grenade').windy, false);
  for (const w of WEAPONS) assert.ok(w.name);
});

test('bazooka: speed is power * 900 along the aim, explodes on contact (r 40)', () => {
  const w = flatWorld();
  hero(w).aim = 0;
  shoot(w, 'bazooka', 0.5);
  const fires = eventsOf(w, 'fire');
  assert.equal(fires.length, 1);
  assert.equal(fires[0].weapon, 'bazooka');
  assert.equal(w.projectiles.length, 1);
  const p = w.projectiles[0];
  assert.equal(p.windy, true);
  assert.ok(Math.abs(p.vx - w.turn.power * 900) < 2, `vx ${p.vx}`);
  assert.ok(Math.abs(w.turn.power - 0.45) < 0.02);
  run(w, 4);
  assert.equal(w.projectiles.length, 0);
  assert.equal(eventsOf(w, 'explosion')[0].r, 40);
});

test('bazooka fired straight up falls back onto its owner', () => {
  const w = flatWorld();
  hero(w).aim = Math.PI / 2;
  shoot(w, 'bazooka', 0.5);
  run(w, 8);
  assert.ok(hero(w).hp < 100);
});

test('grenade bounces, then explodes at the end of its 3 s fuse', () => {
  const w = flatWorld();
  hero(w).aim = 0.8;
  shoot(w, 'grenade', 0.6);
  const t0 = w.events.length;
  let t = 0;
  let boom = null;
  while (!boom && t < 6) {
    run(w, DT);
    t += DT;
    boom = w.events.slice(t0).find((e) => e.type === 'explosion');
  }
  assert.ok(eventsOf(w, 'bounce').length >= 1, 'bounced at least once');
  assert.ok(Math.abs(t - 3) < 0.1, `exploded at ${t}`);
  assert.equal(boom.r, 40);
});

test('grenade is not blown by the wind', () => {
  const w = flatWorld();
  w.wind = 200;
  hero(w).aim = Math.PI / 2;
  shoot(w, 'grenade', 0.3);
  const x0 = w.projectiles[0].x;
  run(w, 0.5);
  assert.ok(Math.abs(w.projectiles[0].x - x0) < 1);
});

test('cluster bomb bursts into 5 bomblets (r 20, dmg 20)', () => {
  const w = flatWorld();
  hero(w).aim = 0.8;
  shoot(w, 'cluster', 0.5);
  for (let i = 0; i < 400 && !w.projectiles.some((p) => p.kind === 'bomblet'); i++) run(w, DT);
  const bomblets = w.projectiles.filter((p) => p.kind === 'bomblet');
  assert.equal(bomblets.length, 5);
  assert.ok(bomblets.every((b) => b.radius === 20 && b.damage === 20 && b.fuse === null));
  assert.equal(eventsOf(w, 'explosion').length, 1);
  run(w, 3);
  assert.equal(eventsOf(w, 'explosion').filter((e) => e.r === 20).length, 5);
});

test('airstrike: 5 missiles fall straight down around the target x', () => {
  const w = flatWorld();
  shoot(w, 'airstrike', 0, { target: { x: 900 } });
  assert.equal(w.projectiles.length, 5);
  assert.deepEqual(w.projectiles.map((p) => p.x), [820, 860, 900, 940, 980]);
  assert.ok(w.projectiles.every((p) => p.y < 0 && p.vx === 0 && p.windy === false && p.kind === 'missile'));
  run(w, 3);
  assert.equal(w.projectiles.length, 0);
  const blasts = eventsOf(w, 'explosion');
  assert.equal(blasts.length, 5);
  assert.ok(blasts.every((b) => b.r === 25 && Math.abs(b.y - GROUND) < 8));
});

test('airstrike without a target does not fire', () => {
  const w = flatWorld();
  shoot(w, 'airstrike', 0);
  assert.equal(eventsOf(w, 'fire').length, 0);
  assert.equal(w.turn.phase, 'aim');
});

test('shotgun hits the first soldier on its ray, with a small crater', () => {
  const w = flatWorld();
  hero(w).aim = 0;
  clearLine(w);
  const [front, back] = w.teams[1].units;
  front.x = 600;
  back.x = 700;
  shoot(w, 'shotgun', 0);
  assert.equal(front.hp, 75);
  assert.equal(back.hp, 100);
  assert.equal(eventsOf(w, 'explosion')[0].r, 8);
});

test('shotgun stops at terrain before reaching a soldier behind it', () => {
  const w = flatWorld();
  hero(w).aim = 0;
  clearLine(w);
  solidRect(w, 500, 520, 700, GROUND);
  w.teams[1].units[0].x = 700;
  shoot(w, 'shotgun', 0);
  assert.equal(w.teams[1].units[0].hp, 100);
  assert.ok(Math.abs(eventsOf(w, 'explosion')[0].x - 500) <= 2);
  assert.ok(!w.terrain.solid(500, 789), 'a bite was taken out of the wall face');
});

test('shotgun range is 900 px', () => {
  const w = flatWorld();
  hero(w).aim = 0;
  clearLine(w);
  const u = w.teams[1].units[0];
  u.x = hero(w).x + 960;
  shoot(w, 'shotgun', 0);
  assert.equal(u.hp, 100);
});

test('shotgun has 2 shots per turn; the turn moves on after the second', () => {
  const w = flatWorld();
  hero(w).aim = 0;
  clearLine(w);
  w.teams[1].units[0].x = 600;
  shoot(w, 'shotgun', 0);
  assert.equal(w.turn.phase, 'aim');
  assert.equal(w.turn.shotsLeft, 1);
  shoot(w, 'shotgun', 0);
  assert.equal(eventsOf(w, 'fire').length, 2);
  assert.notEqual(w.turn.phase, 'aim');
  assert.equal(w.teams[1].units[0].hp, 50);
});

test('dynamite is dropped at his feet and goes off after 4 s (r 70)', () => {
  const w = flatWorld();
  const u = hero(w);
  shoot(w, 'dynamite', 0);
  const p = w.projectiles[0];
  assert.equal(p.kind, 'dynamite');
  assert.ok(Math.abs(p.x - u.x) < 1 && p.y > u.y - 6 && p.y <= u.y + 1);
  assert.equal(w.turn.phase, 'retreat');
  let t = 0;
  while (!eventsOf(w, 'explosion').length && t < 6) {
    run(w, DT);
    t += DT;
  }
  assert.ok(Math.abs(t - 4) < 0.1, `exploded at ${t}`);
  assert.equal(eventsOf(w, 'explosion')[0].r, 70);
});

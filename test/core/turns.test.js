import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POWER_RATE, RETREAT_TIME, TURN_TIME } from '../../src/core/turns.js';
import { flatWorld, run, shoot, eventsOf, skipTurn, DT, hero } from './helpers.js';

const GROUND_PIT = 900;

test('a new world starts on team 0, soldier 0, aim phase, 30 s on the clock', () => {
  const w = flatWorld();
  assert.deepEqual([w.turn.team, w.turn.unit, w.turn.phase, w.turn.timeLeft], [0, 0, 'aim', TURN_TIME]);
  assert.equal(w.winner, null);
});

test('holding Space charges power at 0.9 per second up to 1', () => {
  const w = flatWorld();
  run(w, 0.5, { charge: true });
  assert.ok(Math.abs(w.turn.power - 0.5 * POWER_RATE) < 0.02, `power ${w.turn.power}`);
  assert.equal(w.turn.charging, true);
  run(w, 3, { charge: true });
  assert.equal(w.turn.power, 1);
});

test('release fires with the charged power and starts the retreat clock', () => {
  const w = flatWorld();
  shoot(w, 'bazooka', 0.5);
  assert.ok(['flying', 'retreat'].includes(w.turn.phase));
  assert.ok(Math.abs(w.turn.timeLeft - RETREAT_TIME) < 0.1);
  assert.equal(w.turn.charging, false);
});

test('aim keys move the angle and clamp at straight up and straight down', () => {
  const w = flatWorld();
  hero(w).aim = 0;
  run(w, 0.5, { aimUp: true });
  assert.ok(Math.abs(hero(w).aim - 0.6) < 0.02);
  run(w, 5, { aimUp: true });
  assert.ok(Math.abs(hero(w).aim - Math.PI / 2) < 1e-9);
  run(w, 5, { aimDown: true });
  assert.ok(Math.abs(hero(w).aim + Math.PI / 2) < 1e-9);
});

test('retreat: he can walk but not fire again', () => {
  const w = flatWorld();
  hero(w).aim = Math.PI / 2;
  shoot(w, 'grenade', 0.3);
  assert.notEqual(w.turn.phase, 'aim');
  const x0 = hero(w).x;
  run(w, 1, { left: true, charge: true, release: true });
  assert.ok(hero(w).x < x0 - 30, `x ${hero(w).x}`);
  assert.equal(eventsOf(w, 'fire').length, 1);
});

test('phase is flying while a shell is up and retreat when only a fuse is left', () => {
  const w = flatWorld();
  hero(w).aim = Math.PI / 2;
  shoot(w, 'bazooka', 0.5);
  assert.equal(w.turn.phase, 'flying');
  const w2 = flatWorld();
  shoot(w2, 'dynamite', 0);
  assert.equal(w2.turn.phase, 'retreat');
});

test('the turn passes to the other team once everything has settled', () => {
  const w = flatWorld();
  hero(w).aim = 0.8;
  shoot(w, 'bazooka', 0.5);
  run(w, 3.1);
  assert.equal(w.turn.team, 1);
  assert.equal(w.turn.phase, 'aim');
  assert.ok(w.turn.timeLeft > 29);
});

test('timer expiry while charging ends the turn with no fire event', () => {
  const w = flatWorld();
  w.turn.timeLeft = 0.5;
  run(w, 2, { charge: true });
  assert.equal(eventsOf(w, 'fire').length, 0);
  assert.equal(w.projectiles.length, 0);
  assert.equal(w.turn.team, 1);
});

test('a turn lasts 30 s: without input it ends on its own', () => {
  const w = flatWorld();
  run(w, 29.5);
  assert.equal(w.turn.team, 0);
  run(w, 1.5);
  assert.equal(w.turn.team, 1);
});

test('a shot that leaves the world is removed and the turn still advances', () => {
  const w = flatWorld();
  hero(w).facing = -1;
  hero(w).aim = 0.2;
  shoot(w, 'bazooka', 1.2);
  run(w, 6);
  assert.equal(w.projectiles.length, 0);
  assert.equal(eventsOf(w, 'explosion').length, 0);
  assert.equal(w.turn.team, 1);
});

test('a shell over the water splashes and is gone', () => {
  const w = flatWorld();
  w.terrain.carve(900, GROUND_PIT, 200);
  w.liquidY = 850;
  const p = { kind: 'bazooka', x: 900, y: 820, vx: 0, vy: 200, windy: false, fuse: null, restitution: 0, radius: 40, damage: 50 };
  w.projectiles.push(p);
  run(w, 1);
  assert.equal(w.projectiles.length, 0);
  assert.equal(eventsOf(w, 'splash').length, 1);
  assert.equal(eventsOf(w, 'explosion').length, 0);
});

test('cancel drops a charge without firing', () => {
  const w = flatWorld();
  run(w, 0.5, { charge: true });
  run(w, DT, { cancel: true, release: true });
  assert.deepEqual([w.turn.charging, w.turn.power, w.turn.phase], [false, 0, 'aim']);
  assert.equal(eventsOf(w, 'fire').length, 0);
});

test('each team keeps its own weapon; a team starts on the bazooka', () => {
  const w = flatWorld();
  run(w, DT, { weapon: 'grenade' });
  skipTurn(w);
  assert.deepEqual([w.turn.team, w.turn.weapon], [1, 'bazooka'], "player 2 does not inherit player 1's grenade");
  run(w, DT, { weapon: 'airstrike' }); // the computer calls an airstrike
  skipTurn(w);
  assert.deepEqual([w.turn.team, w.turn.weapon], [0, 'grenade'], 'the player gets his own grenade back');
  run(w, DT, { weapon: 'shotgun' });
  skipTurn(w);
  assert.equal(w.turn.weapon, 'airstrike');
  skipTurn(w);
  assert.deepEqual([w.turn.weapon, w.turn.shotsLeft], ['shotgun', 2]);
});

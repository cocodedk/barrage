import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../../src/core/rng.js';
import { stepWorld } from '../../src/core/world.js';
import { SETTLE_CAP } from '../../src/core/turns.js';
import { flatWorld, run, shoot, skipTurn, eventsOf, DT, GROUND, hero } from './helpers.js';

const killTeam = (w, t) => w.teams[t].units.forEach((u) => (u.hp = 0));

test('the active soldier killed on his own turn passes the turn to the next team', () => {
  const w = flatWorld();
  hero(w).hp = 0;
  run(w, 1);
  assert.equal(w.turn.team, 1);
  assert.equal(w.winner, null);
});

test('soldiers rotate within a team: 0, 1, 2, 0', () => {
  const w = flatWorld();
  const seen = [];
  for (let i = 0; i < 6; i++) {
    if (w.turn.team === 0) seen.push(w.turn.unit);
    skipTurn(w);
  }
  assert.deepEqual(seen, [0, 1, 2]);
  assert.equal(w.turn.team, 0);
  assert.equal(w.turn.unit, 0);
});

test('rotation skips the dead', () => {
  const w = flatWorld();
  w.teams[0].units[1].alive = false;
  w.teams[0].units[1].hp = 0;
  skipTurn(w);
  skipTurn(w);
  assert.equal(w.turn.team, 0);
  assert.equal(w.turn.unit, 2);
});

test('wind is re-rolled every turn within +-windMax', () => {
  const w = flatWorld({ windMax: 100 });
  const winds = new Set();
  for (let i = 0; i < 20; i++) {
    skipTurn(w, makeRng(100 + i));
    winds.add(w.wind);
    assert.ok(Math.abs(w.wind) <= 100);
  }
  assert.ok(winds.size > 10);
  const turns = eventsOf(w, 'turn');
  assert.equal(turns.length, 20);
  assert.equal(turns[19].wind, w.wind);
});

test('all of a team dead sets the winner and ends the match', () => {
  const w = flatWorld();
  killTeam(w, 1);
  run(w, 1);
  assert.equal(w.winner, 0);
  assert.equal(w.turn.phase, 'over');
  assert.deepEqual(eventsOf(w, 'win'), [{ type: 'win', winner: 0 }]);
});

test('team 0 wiping itself out hands the win to team 1', () => {
  const w = flatWorld();
  killTeam(w, 0);
  run(w, 1);
  assert.equal(w.winner, 1);
});

test('both last soldiers dying in the same turn is a draw', () => {
  const w = flatWorld();
  w.teams[0].units.slice(1).forEach((u) => (u.alive = false));
  w.teams[1].units.slice(1).forEach((u) => (u.alive = false));
  hero(w).x = 900;
  w.teams[1].units[0].x = 940;
  hero(w).aim = 0;
  // a point-blank grenade-sized blast on both
  w.projectiles.push({ kind: 'bazooka', x: 920, y: 789, vx: 0, vy: 10, windy: false, fuse: 0.01, restitution: 0, radius: 60, damage: 400, owner: 0 });
  run(w, 3);
  assert.equal(w.winner, 'draw');
  assert.deepEqual(eventsOf(w, 'win'), [{ type: 'win', winner: 'draw' }]);
});

test('a settled world with a stuck projectile is handed on after the settle cap', () => {
  const w = flatWorld();
  w.turn.phase = 'settling';
  w.projectiles.push({ kind: 'dynamite', x: 900, y: 700, vx: 0, vy: 0, windy: false, fuse: 99, restitution: 0.2, radius: 70, damage: 75, owner: 0 });
  run(w, SETTLE_CAP - 0.5);
  assert.equal(w.turn.team, 0);
  run(w, 1);
  assert.equal(w.turn.team, 1);
});

test('stepWorld ignores intents that are not for the aim phase (settling)', () => {
  const w = flatWorld();
  w.turn.phase = 'settling';
  stepWorld(w, DT, { left: true, charge: true, release: true }, makeRng(1));
  assert.equal(eventsOf(w, 'fire').length, 0);
});

test('a soldier who kills himself with his own bazooka passes the turn to team 1', () => {
  const w = flatWorld();
  hero(w).hp = 1;
  hero(w).aim = Math.PI / 2;
  shoot(w, 'bazooka', 0.5);
  run(w, 8);
  assert.equal(hero(w).alive, false);
  assert.equal(w.turn.team, 1);
  assert.equal(w.winner, null);
});

test('a soldier who walks into the liquid drowns and the turn passes to team 1', () => {
  const w = flatWorld();
  w.terrain.carve(150, GROUND, 60); // a pit to his left
  w.terrain.carve(150, GROUND + 100, 120);
  w.liquidY = GROUND + 40;
  hero(w).x = 260;
  run(w, 6, { left: true });
  assert.equal(hero(w).alive, false);
  assert.equal(eventsOf(w, 'splash').length, 1);
  assert.equal(eventsOf(w, 'explosion').length, 0);
  assert.equal(w.turn.team, 1);
});

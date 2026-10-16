import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../../src/core/levels.js';
import { makeRng } from '../../src/core/rng.js';
import { createWorld, stepWorld } from '../../src/core/world.js';
import { run, eventsOf, DT } from './helpers.js';

const level = LEVELS[0];

test('campaign: team 0 is human, team 1 is the computer at the level skill; 3 soldiers each', () => {
  const w = createWorld(LEVELS[6], 'campaign', makeRng(5));
  assert.equal(w.teams.length, 2);
  assert.equal(w.teams[0].ai, null);
  assert.deepEqual(w.teams[1].ai, { skill: LEVELS[6].aiSkill });
  for (const t of w.teams) assert.equal(t.units.length, 3);
});

test('versus: both teams are human', () => {
  const w = createWorld(level, 'versus', makeRng(5));
  assert.equal(w.teams[0].ai, null);
  assert.equal(w.teams[1].ai, null);
});

test('the world follows the core contract', () => {
  const w = createWorld(level, 'versus', makeRng(5));
  assert.equal(w.level, level);
  assert.equal(w.gravity, level.gravity);
  assert.equal(w.liquidY, level.liquid.y);
  assert.ok(Math.abs(w.wind) <= level.windMax);
  assert.deepEqual(w.projectiles, []);
  assert.equal(w.winner, null);
  assert.equal(w.terrain.w, 1920);
  assert.equal(w.terrain.h, 1080);
  for (const t of w.teams) assert.ok(t.id !== undefined && t.name && t.color);
  const ids = w.teams.flatMap((t) => t.units.map((u) => u.id));
  assert.equal(new Set(ids).size, 6);
  for (const u of w.teams.flatMap((t) => t.units)) {
    assert.equal(u.hp, 100);
    assert.equal(u.alive, true);
    assert.ok(u.facing === 1 || u.facing === -1);
    assert.equal(u.onGround, true);
  }
  assert.equal(eventsOf(w, 'turn').length, 1);
});

test('same seed, same world and same play', () => {
  const play = () => {
    const w = createWorld(level, 'versus', makeRng(11));
    run(w, 1, { charge: true }, makeRng(2));
    run(w, 1, { release: true }, makeRng(2));
    run(w, 5, {}, makeRng(2));
    return JSON.stringify([w.teams, w.turn, w.wind, w.events.length]);
  };
  assert.equal(play(), play());
});

test('every level: soldiers stand still on their spawn points, unharmed', () => {
  for (const lv of LEVELS) {
    const w = createWorld(lv, 'versus', makeRng(lv.id));
    const before = w.teams.flatMap((t) => t.units.map((u) => [u.x, u.y]));
    run(w, 2);
    const after = w.teams.flatMap((t) => t.units.map((u) => [u.x, u.y]));
    assert.deepEqual(after, before, `level ${lv.id}`);
    for (const u of w.teams.flatMap((t) => t.units)) {
      assert.equal(u.hp, 100, `level ${lv.id}`);
      assert.equal(u.onGround, true);
    }
  }
});

test('every level: a full AI-less turn cycle runs without throwing and hands over', () => {
  for (const lv of LEVELS) {
    const w = createWorld(lv, 'versus', makeRng(lv.id + 40));
    const u = w.teams[0].units[0];
    u.aim = 0.9;
    run(w, 0.5, { weapon: 'bazooka', charge: true });
    run(w, DT, { release: true });
    run(w, 12);
    assert.equal(w.turn.team, 1, `level ${lv.id}`);
    assert.equal(w.projectiles.length, 0);
  }
});

test('random play for ten minutes keeps every invariant', () => {
  const rng = makeRng(99);
  const w = createWorld(level, 'versus', makeRng(4));
  const phases = ['aim', 'flying', 'retreat', 'settling', 'over'];
  for (let i = 0; i < 60 * 600 && w.winner === null; i++) {
    const t = i * DT;
    const weapon = Math.floor(rng() * 6);
    const intents = { weapon, target: { x: rng() * 1920 }, charge: t % 3 < 1.2, release: t % 3 >= 1.2 && t % 3 < 1.22, aimUp: rng() < 0.05, left: rng() < 0.1 };
    stepWorld(w, DT, intents, rng);
    w.events.length = 0;
    assert.ok(phases.includes(w.turn.phase));
    assert.ok(w.projectiles.length < 40);
    for (const u of w.teams.flatMap((x) => x.units)) {
      assert.ok(Number.isFinite(u.x) && Number.isFinite(u.y), `unit ${u.id} at ${u.x},${u.y}`);
      assert.ok(u.hp >= 0 && u.hp <= 100);
      assert.equal(u.alive, u.hp > 0);
    }
  }
  assert.ok(w.winner !== null || w.turn.phase !== 'over');
});

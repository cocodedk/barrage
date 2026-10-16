import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { makeRng } from '../../src/core/rng.js';
import { LEVELS } from '../../src/core/levels.js';
import { createWorld } from '../../src/core/world.js';
import { activeUnit } from '../../src/core/turns.js';
import { aiPlan } from '../../src/core/ai.js';
import { duel, enemyOf, playPlan, distTo, SHOOTER } from './ai-helpers.js';
import { solidRect } from './helpers.js';

test('skill 1 on flat ground: a real shot lands within 30 px of an enemy 600 px away', () => {
  const w = duel(1);
  const plan = aiPlan(w, makeRng(1));
  assert.equal(plan.weapon, 'bazooka');
  assert.equal(plan.facing, -1);
  const hit = playPlan(w, plan);
  assert.ok(hit, 'the shell exploded');
  assert.ok(distTo(hit, enemyOf(w)) <= 30, `missed by ${distTo(hit, enemyOf(w))}`);
});

test('skill 1 with wind: still within 50 px, both ways', () => {
  for (const wind of [-18, 18]) {
    const w = duel(1);
    w.wind = wind;
    const hit = playPlan(w, aiPlan(w, makeRng(2)));
    assert.ok(hit && distTo(hit, enemyOf(w)) <= 50, `wind ${wind}: ${hit && distTo(hit, enemyOf(w))}`);
  }
});

test('skill 0 misses by more on average than skill 1 (20 seeds)', () => {
  const mean = (skill) => {
    let sum = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const w = duel(skill);
      const hit = playPlan(w, aiPlan(w, makeRng(seed)));
      sum += hit ? distTo(hit, enemyOf(w)) : 2000;
    }
    return sum / 20;
  };
  const sharp = mean(1);
  const sloppy = mean(0);
  assert.ok(sloppy > sharp + 20, `skill 0 ${sloppy.toFixed(1)} vs skill 1 ${sharp.toFixed(1)}`);
});

test('noise is drawn from the rng: same seed, same plan; different seed, different plan', () => {
  const a = aiPlan(duel(0.2), makeRng(4));
  assert.deepEqual(aiPlan(duel(0.2), makeRng(4)), a);
  assert.notDeepEqual(aiPlan(duel(0.2), makeRng(9)), a);
});

test('never aims at its own team: faces the enemy and the shell lands nearer the enemy', () => {
  const w = duel(1, 700);
  const mate = w.teams[1].units[1];
  Object.assign(mate, { alive: true, x: 1150 }); // a friend standing out in the field
  const plan = aiPlan(w, makeRng(3));
  assert.equal(plan.facing, -1);
  const hit = playPlan(w, plan);
  assert.ok(hit);
  assert.ok(distTo(hit, enemyOf(w)) < distTo(hit, mate), 'the blast is nearer the enemy than the friend');
  assert.equal(mate.hp, 100, 'friendly fire spared');
});

test('an enemy on the other side turns the soldier round', () => {
  const w = duel(1, 600);
  const e = enemyOf(w);
  Object.assign(w.teams[1].units[0], { x: 400, facing: -1 });
  e.x = 1000;
  const plan = aiPlan(w, makeRng(1));
  assert.equal(plan.facing, 1);
  const hit = playPlan(w, plan);
  assert.ok(hit && distTo(hit, e) <= 30);
});

test('enemy within 80 px: dynamite at high skill, a lobbed grenade at middling skill', () => {
  const w = duel(1, 40);
  const plan = aiPlan(w, makeRng(1));
  assert.equal(plan.weapon, 'dynamite');
  assert.ok(plan.retreat === 1, 'walks away from the enemy on his left');
  const shooter = w.teams[1].units[0];
  playPlan(w, plan);
  assert.ok(enemyOf(w).hp < 100, 'dynamite blast hurt the enemy');
  assert.equal(shooter.hp, 100, 'and he walked clear in time');
  const mid = duel(0.35, 60);
  assert.ok(['grenade', 'bazooka'].includes(aiPlan(mid, makeRng(1)).weapon));
});

test('no ballistic shot clear: calls an airstrike on a soldier under open sky', () => {
  const w = duel(1, 600);
  const e = enemyOf(w);
  // A tall wall between them blocks every arc the muzzle can fly; the enemy stays under open sky.
  solidRect(w, 1100, 1180, 0, 800);
  const plan = aiPlan(w, makeRng(1));
  assert.equal(plan.weapon, 'airstrike');
  assert.ok(Math.abs(plan.target.x - e.x) < 1, 'aimed at the enemy x');
});

test('walks into range when the enemy is out of reach from here', () => {
  const w = duel(1, 700, { gravity: 3000 }); // a few hundred px of reach from where he stands
  const plan = aiPlan(w, makeRng(1));
  assert.ok(plan.moveSteps < 0, `moveSteps ${plan.moveSteps}`);
  assert.equal(plan.x, SHOOTER.x + plan.moveSteps);
  const hit = playPlan(w, plan);
  assert.ok(hit && distTo(hit, enemyOf(w)) <= 40, `missed by ${hit && distTo(hit, enemyOf(w))}`);
  assert.ok(Math.abs(w.teams[1].units[0].x - plan.x) < 8, 'he really walked there');
});

test('plans never mutate the world', () => {
  const w = duel(1);
  const before = Buffer.from(w.terrain.mask).toString('base64').length + JSON.stringify(w.teams) + w.events.length;
  aiPlan(w, makeRng(1));
  const after = Buffer.from(w.terrain.mask).toString('base64').length + JSON.stringify(w.teams) + w.events.length;
  assert.equal(after, before);
  assert.equal(w.projectiles.length, 0);
});

test('aiPlan returns within 50 ms on every level', () => {
  aiPlan(duel(1), makeRng(0)); // warm the JIT like a running game would
  for (const level of LEVELS) {
    const w = createWorld({ ...level, aiSkill: 1 }, 'campaign', makeRng(11));
    w.turn.team = 1;
    w.turn.unit = 0;
    const t0 = performance.now();
    const plan = aiPlan(w, makeRng(1));
    const ms = performance.now() - t0;
    assert.ok(ms < 50, `${level.name}: ${ms.toFixed(1)} ms`);
    assert.ok(plan.weapon && activeUnit(w).alive);
  }
});

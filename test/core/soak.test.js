// AI-vs-AI soak: whole seeded matches on every kind of level, played with the real aiTick
// loop of game.js. No soldier may hang (not at rest, going nowhere) and every match must end.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../../src/core/rng.js';
import { LEVELS } from '../../src/core/levels.js';
import { createWorld, stepWorld } from '../../src/core/world.js';
import { unitAtRest } from '../../src/core/units.js';
import { aiTick, createAi } from '../../src/core/ai.js';
import { DT } from './helpers.js';

const SKILL = 0.75; // the title screen's attract matches
const MAX_GAME_TIME = 1200; // s of game time; real matches end long before this
const HANG_LIMIT = 1; // s a soldier may be off rest without getting anywhere

// Play one match to the end; returns { time, turns, worst (longest hang), winner }.
function soak(level, seed) {
  const rng = makeRng(seed);
  const world = createWorld(level, 'versus', rng);
  for (const t of world.teams) t.ai = { skill: SKILL };
  const hang = new Map(); // unit id -> { x, y, s }
  const ai = createAi();
  let turns = 0;
  let worst = { s: 0 };
  let time = 0;
  for (; world.winner == null && time < MAX_GAME_TIME; time += DT) {
    stepWorld(world, DT, aiTick(ai, world, DT, rng), rng);
    for (const ev of world.events) if (ev.type === 'turn') turns++;
    world.events.length = 0;
    for (const team of world.teams) {
      for (const u of team.units) {
        const h = hang.get(u.id) || { x: u.x, y: u.y, s: 0 };
        if (Math.hypot(u.x - h.x, u.y - h.y) > 2) Object.assign(h, { x: u.x, y: u.y, s: 0 });
        else if (!unitAtRest(u)) h.s += DT;
        hang.set(u.id, h);
        if (h.s > worst.s) worst = { s: h.s, unit: u.id, x: u.x, y: u.y, onGround: u.onGround };
      }
    }
  }
  return { time, turns, worst, winner: world.winner };
}

test('20 seeded AI-vs-AI matches: nobody hangs and every match ends', () => {
  for (let i = 0; i < 20; i++) {
    const level = LEVELS[i % LEVELS.length];
    const r = soak(level, 1000 + i);
    const tag = `${level.name} seed ${1000 + i}`;
    assert.ok(r.worst.s <= HANG_LIMIT, `${tag}: soldier hung ${r.worst.s.toFixed(2)} s ${JSON.stringify(r.worst)}`);
    assert.notEqual(r.winner, null, `${tag}: no winner after ${r.time.toFixed(0)} s, ${r.turns} turns`);
  }
});

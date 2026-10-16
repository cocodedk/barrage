// Shared test fixtures: a flat world with known soldiers, and a stepping loop.
import { LEVELS } from '../../src/core/levels.js';
import { makeRng } from '../../src/core/rng.js';
import { createWorld, stepWorld } from '../../src/core/world.js';

export const DT = 1 / 60;
export const GROUND = 800; // first solid row of the flat world

export const hero = (world) => world.teams[0].units[0];

// Empty sky over solid ground from row y down.
export function setFloor(world, y) {
  const t = world.terrain;
  t.mask.fill(0);
  t.mask.fill(1, y * t.w);
}

// Solid block over x0 <= x < x1, y0 <= y < y1 (default: down to the bottom of the world).
export function solidRect(world, x0, x1, y0, y1 = world.terrain.h) {
  const t = world.terrain;
  for (let y = y0; y < y1; y++) t.mask.fill(1, y * t.w + x0, y * t.w + x1);
}

// Flat ground from y=800 down; team 0 at x 300/360/420, team 1 at 1500/1560/1620.
export function flatWorld(levelOver = {}, seed = 1) {
  const level = { ...LEVELS[0], windMax: 0, drag: 0, ...levelOver };
  const world = createWorld(level, 'versus', makeRng(seed));
  setFloor(world, GROUND);
  world.teams.forEach((team, ti) => {
    team.units.forEach((u, i) => {
      Object.assign(u, { x: (ti ? 1500 : 300) + i * 60, y: GROUND - 1, vx: 0, vy: 0, onGround: true });
      u.facing = ti ? -1 : 1;
      u.peakY = u.y;
    });
  });
  world.wind = 0;
  world.events.length = 0;
  return world;
}

export function run(world, seconds, intents = {}, rng = makeRng(7)) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) {
    stepWorld(world, DT, intents, rng);
  }
}

export const eventsOf = (world, type) => world.events.filter((e) => e.type === type);

// Select `weapon`, hold Space for `charge` seconds, release (extra carries e.g. a target).
export function shoot(world, weapon, charge = 0.5, extra = {}) {
  run(world, DT, { weapon });
  if (charge > 0) run(world, charge, { charge: true });
  run(world, DT, { release: true, ...extra });
}

// End the current turn at once and run until the next one begins.
export function skipTurn(world, rng = makeRng(3)) {
  const before = world.events.length;
  world.turn.timeLeft = 0.001;
  const over = () => world.events.slice(before).some((e) => e.type === 'turn' || e.type === 'win');
  for (let i = 0; i < 1200 && !over(); i++) stepWorld(world, DT, {}, rng);
}

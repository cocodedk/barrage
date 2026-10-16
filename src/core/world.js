// World construction and the per-tick step.
import { generateTerrain, spawnPoints } from './terrain-gen.js';
import { createUnit, stepUnit } from './units.js';
import { stepProjectiles } from './projectiles.js';
import { newTurnState, beginTurn, applyIntents, stepTurn, activeUnit } from './turns.js';
import { resolveDeaths } from './explode.js';

const UNITS_PER_TEAM = 3;
const TEAM_COLORS = ['#3aa0ff', '#ff5252'];

function shuffle(list, rng) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// mode: 'campaign' (team 1 is the computer) or 'versus' (two humans).
export function createWorld(level, mode, rng) {
  const terrain = generateTerrain(level.terrain, rng);
  const spots = shuffle(spawnPoints(terrain, 2 * UNITS_PER_TEAM, rng, level.liquid.y), rng);
  const names = mode === 'campaign' ? ['Player', 'Computer'] : ['Player 1', 'Player 2'];
  const teams = names.map((name, id) => ({
    id,
    name,
    color: TEAM_COLORS[id],
    ai: mode === 'campaign' && id === 1 ? { skill: level.aiSkill } : null,
    last: -1, // index of the soldier that played last, for rotation
    weapon: 'bazooka', // the weapon the team last held
    units: spots
      .slice(id * UNITS_PER_TEAM, (id + 1) * UNITS_PER_TEAM)
      .map((s, i) => createUnit(id * UNITS_PER_TEAM + i, id, s.x, s.y, s.x < terrain.w / 2 ? 1 : -1)),
  }));
  const world = {
    level, mode, terrain, gravity: level.gravity, wind: 0, liquidY: level.liquid.y,
    teams, projectiles: [], events: [], turn: newTurnState(), winner: null,
  };
  beginTurn(world, 0, rng);
  return world;
}

// One fixed tick. `intents` drive the active soldier only (the AI supplies the same shape).
export function stepWorld(world, dt, intents, rng) {
  const move = applyIntents(world, intents || {}, dt);
  const active = activeUnit(world);
  for (const team of world.teams) {
    for (const u of team.units) stepUnit(world, u, dt, u === active ? move : undefined);
  }
  resolveDeaths(world);
  stepProjectiles(world, dt, rng);
  stepTurn(world, dt, rng);
}

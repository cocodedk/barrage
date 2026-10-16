// Turn flow: aim -> (fire) -> flying/retreat -> settling -> next team; wind, rotation, winner.
import { WEAPONS, weaponById, fireWeapon, inFlight } from './weapons.js';
import { unitAtRest, AIM_LIMIT } from './units.js';
import { clamp } from './math.js';
import { between } from './rng.js';

export const TURN_TIME = 30;
export const RETREAT_TIME = 3;
export const SETTLE_CAP = 6;
export const POWER_RATE = 0.9; // power per second while Space is held
export const AIM_RATE = 1.2; // rad/s
export const MIN_POWER = 0.1;

export const activeUnit = (world) => world.teams[world.turn.team].units[world.turn.unit];

export function newTurnState() {
  return {
    team: 0, unit: 0, timeLeft: TURN_TIME, phase: 'aim', weapon: 'bazooka', shotsLeft: 1,
    shotsFired: 0, power: 0, charging: false, settled: 0,
  };
}

// Hand the turn to `teamId`: next living soldier in rotation, fresh timer, fresh wind. Each team
// keeps the weapon it last held (a team's first turn starts on the bazooka), so nobody inherits
// the other side's airstrike.
export function beginTurn(world, teamId, rng) {
  const team = world.teams[teamId];
  const n = team.units.length;
  let idx = team.last;
  do idx = (idx + 1) % n;
  while (!team.units[idx].alive);
  team.last = idx;
  world.wind = between(rng, -1, 1) * world.level.windMax;
  Object.assign(world.turn, newTurnState(), { team: teamId, unit: idx });
  setWeapon(world, team.weapon);
  world.events.push({ type: 'turn', team: teamId, unit: idx, wind: world.wind });
}

// Arm the active soldier with weapon `id`, with its shots for the turn; his team keeps it.
export function setWeapon(world, id) {
  world.turn.weapon = id;
  world.teams[world.turn.team].weapon = id;
  world.turn.shotsLeft = weaponById(id).shots;
}

function chooseWeapon(world, pick) {
  const w = typeof pick === 'number' ? WEAPONS[pick] : weaponById(pick);
  if (w && world.turn.shotsFired === 0) setWeapon(world, w.id);
}

function fire(world, u, intents) {
  const turn = world.turn;
  const w = weaponById(turn.weapon);
  if (w.target && !(intents.target && Number.isFinite(intents.target.x))) return;
  fireWeapon(world, u, w, Math.max(MIN_POWER, turn.power), intents.target);
  turn.charging = false;
  turn.shotsFired += 1;
  turn.shotsLeft -= 1;
  if (turn.shotsLeft > 0) return; // shotgun keeps the turn for its second shot
  turn.phase = 'flying';
  turn.timeLeft = RETREAT_TIME;
}

// Apply the active human's intents (the AI produces the same shape) for one tick.
// `cancel` drops a charge in progress without firing.
export function applyIntents(world, intents, dt) {
  const turn = world.turn;
  const u = activeUnit(world);
  if (!u.alive || turn.phase === 'over' || turn.phase === 'settling') return { dir: 0, jump: false };
  const move = { dir: (intents.right ? 1 : 0) - (intents.left ? 1 : 0), jump: !!intents.jump };
  if (turn.phase !== 'aim') return move; // retreating: walk and jump only
  if (intents.weapon != null) chooseWeapon(world, intents.weapon);
  if (intents.cancel) { // the UI paused or lost focus mid-charge: drop the charge, never fire
    turn.charging = false;
    turn.power = 0;
    return move;
  }
  const aimMove = (intents.aimUp ? 1 : 0) - (intents.aimDown ? 1 : 0);
  u.aim = clamp(u.aim + aimMove * AIM_RATE * dt, -AIM_LIMIT, AIM_LIMIT);
  if (intents.charge) {
    if (!turn.charging) turn.power = 0;
    turn.charging = true;
    turn.power = Math.min(1, turn.power + POWER_RATE * dt);
  }
  if (intents.release && (turn.charging || weaponById(turn.weapon).instant)) fire(world, u, intents);
  return move;
}

// Nothing in the air and every soldier standing still.
export const worldAtRest = (world) =>
  world.projectiles.length === 0 && world.teams.every((t) => t.units.every(unitAtRest));

function finishMatchOrTurn(world, rng) {
  const alive = world.teams.map((t) => t.units.some((u) => u.alive));
  if (alive[0] && alive[1]) return beginTurn(world, 1 - world.turn.team, rng);
  endMatch(world, !alive[0] && !alive[1] ? 'draw' : alive[0] ? 0 : 1);
}

// The match is over: `winner` is a team id or 'draw'.
export function endMatch(world, winner) {
  world.turn.phase = 'over';
  world.winner = winner;
  world.events.push({ type: 'win', winner });
}

function settle(world) {
  world.turn.phase = 'settling';
  world.turn.charging = false;
  world.turn.settled = 0;
}

// Timers and phase changes, run once per tick after units and projectiles have moved.
export function stepTurn(world, dt, rng) {
  const turn = world.turn;
  const { phase } = turn;
  if (phase === 'over') return;
  const wiped = world.teams.some((t) => !t.units.some((u) => u.alive));
  if (phase !== 'settling' && (wiped || !activeUnit(world).alive)) return settle(world);
  if (phase === 'settling') {
    turn.settled += dt;
    if (worldAtRest(world) || turn.settled >= SETTLE_CAP) finishMatchOrTurn(world, rng);
    return;
  }
  turn.timeLeft -= dt; // aim, flying or retreat
  if (turn.timeLeft <= 0) settle(world); // out of time, even mid-charge: no shot
  else if (phase !== 'aim') turn.phase = world.projectiles.some(inFlight) ? 'flying' : 'retreat';
}

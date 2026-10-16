// Turn flow: aim -> (fire) -> flying/retreat -> settling -> next team; wind, rotation, winner.
import { WEAPONS, weaponById, fireWeapon } from './weapons.js';
import { unitAtRest, AIM_LIMIT } from './units.js';

export const TURN_TIME = 30;
export const RETREAT_TIME = 3;
export const SETTLE_CAP = 6;
export const POWER_RATE = 0.9; // power per second while Space is held
export const AIM_RATE = 1.2; // rad/s
const MIN_POWER = 0.1;

export const activeUnit = (world) => world.teams[world.turn.team].units[world.turn.unit];

export function newTurnState() {
  return {
    team: 0, unit: 0, timeLeft: TURN_TIME, phase: 'aim', weapon: 'bazooka', shotsLeft: 1,
    shotsFired: 0, power: 0, charging: false, settled: 0,
  };
}

// Hand the turn to `teamId`: next living soldier in rotation, fresh timer, fresh wind.
export function beginTurn(world, teamId, rng) {
  const team = world.teams[teamId];
  const n = team.units.length;
  let idx = team.last;
  do idx = (idx + 1) % n;
  while (!team.units[idx].alive);
  team.last = idx;
  world.wind = (rng() * 2 - 1) * world.level.windMax;
  const keep = world.turn.weapon;
  Object.assign(world.turn, newTurnState(), { team: teamId, unit: idx, weapon: keep });
  world.turn.shotsLeft = weaponById(keep).shots;
  world.events.push({ type: 'turn', team: teamId, unit: idx, wind: world.wind });
}

function chooseWeapon(turn, pick) {
  const w = typeof pick === 'number' ? WEAPONS[pick] : weaponById(pick);
  if (!w || turn.shotsFired > 0) return;
  turn.weapon = w.id;
  turn.shotsLeft = w.shots;
}

function fire(world, u, intents) {
  const turn = world.turn;
  const w = weaponById(turn.weapon);
  if (w.id === 'airstrike' && !(intents.target && Number.isFinite(intents.target.x))) return;
  fireWeapon(world, u, w, Math.max(MIN_POWER, turn.power), intents.target);
  turn.charging = false;
  turn.shotsFired += 1;
  turn.shotsLeft -= 1;
  if (turn.shotsLeft > 0) return; // shotgun keeps the turn for its second shot
  turn.phase = 'flying';
  turn.timeLeft = RETREAT_TIME;
}

// Apply the active human's intents (the AI produces the same shape) for one tick.
export function applyIntents(world, intents, dt) {
  const turn = world.turn;
  const u = activeUnit(world);
  if (!u.alive || turn.phase === 'over' || turn.phase === 'settling') return { dir: 0, jump: false };
  const move = { dir: (intents.right ? 1 : 0) - (intents.left ? 1 : 0), jump: !!intents.jump };
  if (turn.phase !== 'aim') return move; // retreating: walk and jump only
  if (intents.weapon !== undefined && intents.weapon !== null) chooseWeapon(turn, intents.weapon);
  const aimMove = (intents.aimUp ? 1 : 0) - (intents.aimDown ? 1 : 0);
  u.aim = Math.max(-AIM_LIMIT, Math.min(AIM_LIMIT, u.aim + aimMove * AIM_RATE * dt));
  if (intents.charge) {
    if (!turn.charging) turn.power = 0;
    turn.charging = true;
    turn.power = Math.min(1, turn.power + POWER_RATE * dt);
  }
  if (intents.release && (turn.charging || weaponById(turn.weapon).instant)) fire(world, u, intents);
  return move;
}

function allAtRest(world) {
  return world.teams.every((t) => t.units.every(unitAtRest));
}

function finishMatchOrTurn(world, rng) {
  const alive = world.teams.map((t) => t.units.some((u) => u.alive));
  if (alive[0] && alive[1]) return beginTurn(world, 1 - world.turn.team, rng);
  world.turn.phase = 'over';
  world.winner = !alive[0] && !alive[1] ? 'draw' : alive[0] ? 0 : 1;
  world.events.push({ type: 'win', winner: world.winner });
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
  if (phase === 'aim') {
    turn.timeLeft -= dt;
    if (turn.timeLeft <= 0) settle(world); // out of time, even mid-charge: no shot
  } else if (phase === 'flying' || phase === 'retreat') {
    turn.timeLeft -= dt;
    if (turn.timeLeft <= 0) settle(world);
    else turn.phase = world.projectiles.some((p) => p.kind !== 'dynamite') ? 'flying' : 'retreat';
  } else {
    turn.settled += dt;
    const still = world.projectiles.length === 0 && allAtRest(world);
    if (still || turn.settled >= SETTLE_CAP) finishMatchOrTurn(world, rng);
  }
}

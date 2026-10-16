// The demo's stagehands: where everyone stands, keeping the turn on the player between steps,
// and planning the scripted shots. UI layer only: it places soldiers and resets the turn the way
// a director sets a scene, but every shot, blast and fall still runs through the real core.
import { TURN_TIME, newTurnState, setWeapon } from '../../core/turns.js';
import { weaponById } from '../../core/weapons.js';
import { unitAtRest } from '../../core/units.js';
import { bodyCentre } from '../../core/explode.js';
import { simWorldFor, bestShot } from '../../core/ai-sim.js';
import { DEG } from '../../core/math.js';

export const DEMO_SEED = 11; // Green Meadow with this seed is gentle and rolling
export const HOME = [[560, 200, 340], [1180, 1460, 1790]]; // x of each soldier, team by team
// A well down to the water for the hazards step, away from where the earlier shows aim (the
// nearest enemy, at 1180), so their craters never spoil its lip.
const PIT = { x: 1600, r: 110, depth: 1070 }; // wide: a full-power knock still drops in

export const hero = (world) => world.teams[0].units[0];
const pitSoldier = (world) => world.teams[1].units[1]; // the enemy on the well's lip

// Stand soldier `u` on the ground at x, still.
export function place(world, u, x) {
  const y = world.terrain.surfaceY(x) - 1;
  Object.assign(u, { x, y, vx: 0, vy: 0, onGround: true, peakY: y });
}

// Home, at full health. `fx` (optional): a fallen soldier's grave goes when he gets up again.
function revive(world, u, fx) {
  if (!u.alive && fx) fx.graves = fx.graves.filter((g) => g.unit !== u.id);
  place(world, u, HOME[u.team][world.teams[u.team].units.indexOf(u)]);
  Object.assign(u, { hp: 100, alive: true });
}

// The player's turn, from the top: aim phase, no shot fired, a full clock.
function freshTurn(world) {
  const { weapon } = world.turn;
  Object.assign(world.turn, newTurnState(), { weapon, shotsLeft: weaponById(weapon).shots });
}

// Everyone home at full health, the hero facing the enemy (the first step and its replays).
export function arrange(world) {
  for (const team of world.teams) for (const u of team.units) revive(world, u);
  for (const team of world.teams) for (const u of team.units) u.facing = team.id ? -1 : 1;
  hero(world).aim = 0.5;
  setWeapon(world, 'bazooka');
}

// Between steps: no shells in the air, calm wind, a fresh turn, every soldier at full health
// (the fallen back on their feet, without their graves) and the hero home, so each step's show
// starts from the same place whatever the last try did.
export function tidy(world, fx) {
  world.projectiles.length = 0;
  world.wind = 0;
  for (const team of world.teams) {
    for (const u of team.units) {
      if (!u.alive || u.y >= world.liquidY || u === hero(world)) revive(world, u, fx);
      else u.hp = 100;
    }
  }
  hero(world).facing = 1;
  freshTurn(world);
}

const still = (world) => world.projectiles.length === 0 && world.teams.every((t) => t.units.every(unitAtRest));
export const calm = (world) => world.turn.phase === 'aim' && still(world);

// Run after every tick: the turn never leaves the hero. When a shot has played out, he gets a
// fresh aim phase instead of the core handing the turn to the other team. `clock` lets the
// turn timer run down (the timer step); otherwise it is held full.
export function holdTurn(world, clock = false, fx = null) {
  const turn = world.turn;
  if (!hero(world).alive) revive(world, hero(world), fx);
  for (const team of world.teams) {
    if (!team.units.some((u) => u.alive)) for (const u of team.units) revive(world, u, fx);
  }
  turn.team = 0;
  turn.unit = 0;
  if (turn.phase === 'aim') {
    if (!clock) turn.timeLeft = TURN_TIME;
    return;
  }
  turn.timeLeft = TURN_TIME; // a retreat never times out into the other team's turn
  if (still(world)) freshTurn(world);
  else if (turn.phase === 'settling') turn.phase = 'retreat'; // or the core would end the turn
}

// The best `weaponId` shot from where the hero stands at the point `target` (default: the
// nearest enemy's body), in the shape aiIntents plays out: face, aim, then charge to the power.
export function planShot(world, weaponId, target) {
  const u = hero(world);
  const foes = world.teams[1].units.filter((v) => v.alive);
  const aim = target || bodyCentre(foes.reduce((a, b) => (Math.abs(b.x - u.x) < Math.abs(a.x - u.x) ? b : a)));
  const mates = world.teams[0].units.filter((v) => v.alive && v !== u).map(bodyCentre);
  const ctx = { enemies: [aim], own: [...mates, bodyCentre(u)], work: { sims: 0 } };
  const facing = aim.x >= u.x ? 1 : -1;
  const s = bestShot(simWorldFor(world, u), weaponById(weaponId), ctx, u, facing);
  return { weapon: weaponId, moveSteps: 0, facing, x: u.x, aim: s.deg * DEG, power: s.power };
}

// Sink a well down into the water and stand pitSoldier on its near lip.
// Crater events let the renderer cut the same hole.
export function digPit(world) {
  const t = world.terrain;
  for (let y = t.surfaceY(PIT.x) - PIT.r / 2; y < PIT.depth; y += PIT.r / 4) {
    t.carve(PIT.x, y, PIT.r);
    world.events.push({ type: 'crater', x: PIT.x, y, r: PIT.r });
  }
  const u = pitSoldier(world);
  place(world, u, PIT.x - PIT.r - 6);
  u.facing = -1;
}

// Where the hazards show aims: the ground at the near heel of the soldier on the lip, a wider
// mark than his body (a shot that sails past him into the well would never burst), and a blast
// there throws him away from it, into the well.
export const pitShove = (world) => ({ x: pitSoldier(world).x - 10, y: pitSoldier(world).y });
